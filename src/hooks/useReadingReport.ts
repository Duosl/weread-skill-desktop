import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "../lib/format";
import { buildReportData } from "../lib/report/buildReportData";
import { noteTotal } from "../lib/format";
import { WEREAD_DATA_REFRESHED_EVENT } from "../lib/dataRefreshEvents";
import { loadAllReviews } from "../lib/reviews";
import type { ReadingReportData, ReportExcerpt, ReportPeriod } from "../lib/report/types";
import type { Bookmark, BookmarkListResult, NotebookBook, ReadingStatsResult, Review } from "../types";

function modeForPeriod(period: ReportPeriod): "monthly" | "annually" | "overall" {
  if (period === "last_month" || period === "current_month") return "monthly";
  if (period === "last_year" || period === "current_year") return "annually";
  return "overall";
}

function baseTimeForPeriod(period: ReportPeriod): number {
  const now = new Date();
  if (period === "last_month") {
    return Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000);
  }
  if (period === "current_month") {
    return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
  }
  if (period === "last_year") {
    return Math.floor(new Date(now.getFullYear() - 1, 0, 1).getTime() / 1000);
  }
  if (period === "current_year") {
    return Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);
  }
  return 0;
}

type PeriodBounds = {
  start?: number;
  end?: number;
};

type PeriodBookNotes = {
  book: NotebookBook;
  bookmarks: Bookmark[];
  reviews: Review[];
};

function periodBounds(period: ReportPeriod): PeriodBounds {
  const now = new Date();
  if (period === "last_month") {
    return {
      start: Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000),
      end: Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000),
    };
  }
  if (period === "current_month") {
    return {
      start: Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000),
    };
  }
  if (period === "last_year") {
    return {
      start: Math.floor(new Date(now.getFullYear() - 1, 0, 1).getTime() / 1000),
      end: Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000),
    };
  }
  if (period === "current_year") {
    return {
      start: Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000),
    };
  }
  return {};
}

function timestampInPeriod(timestamp: number, bounds: PeriodBounds): boolean {
  return (bounds.start === undefined || timestamp >= bounds.start)
    && (bounds.end === undefined || timestamp < bounds.end);
}

function buildExcerptsFromNotes(noteGroups: PeriodBookNotes[]): ReportExcerpt[] {
  return noteGroups
    .flatMap(({ book, bookmarks, reviews }) => {
      const reviewExcerpts = reviews
        .filter((item) => item.content.trim().length >= 6)
        .sort((left, right) => right.content.length - left.content.length)
        .slice(0, 2)
        .map((review) => ({
          bookId: book.bookId,
          bookTitle: book.title,
          bookAuthor: book.author,
          kind: "review" as const,
          content: review.content,
          chapter: review.chapterName,
        }));
      const bookmarkExcerpts = bookmarks
        .filter((item) => item.markText.trim().length >= 8)
        .sort((left, right) => right.markText.length - left.markText.length)
        .slice(0, 2)
        .map((bookmark) => ({
          bookId: book.bookId,
          bookTitle: book.title,
          bookAuthor: book.author,
          kind: "bookmark" as const,
          content: bookmark.markText,
          chapter: bookmark.chapterTitle,
        }));

      return [...reviewExcerpts, ...bookmarkExcerpts];
    })
    .sort((left, right) => right.content.length - left.content.length)
    .slice(0, 24);
}

async function loadRepresentativeExcerpts(books: NotebookBook[]): Promise<ReportExcerpt[]> {
  const candidates = [...books].sort((left, right) => noteTotal(right) - noteTotal(left)).slice(0, 10);

  const groups = await Promise.all(
    candidates.map(async (book) => {
      try {
        const [bookmarkResult, reviewResult] = await Promise.all([
          invoke<BookmarkListResult>("get_bookmarks", { bookId: book.bookId }).catch(() => ({ bookmarks: [] })),
          loadAllReviews(book.bookId).then((reviews) => ({ reviews })).catch(() => ({ reviews: [] })),
        ]);

        return buildExcerptsFromNotes([{
          book,
          bookmarks: bookmarkResult.bookmarks ?? [],
          reviews: reviewResult.reviews ?? [],
        }]);
      } catch {
        return [];
      }
    }),
  );

  return groups
    .flat()
    .sort((left, right) => right.content.length - left.content.length)
    .slice(0, 24);
}

async function loadPeriodScopedNotes(book: NotebookBook, bounds: PeriodBounds): Promise<PeriodBookNotes> {
  const [bookmarkResult, reviews] = await Promise.all([
    book.noteCount > 0
      ? invoke<BookmarkListResult>("get_bookmarks", { bookId: book.bookId }).catch(() => ({ bookmarks: [] }))
      : Promise.resolve({ bookmarks: [] }),
    book.reviewCount > 0
      ? loadAllReviews(book.bookId).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    book,
    bookmarks: (bookmarkResult.bookmarks ?? []).filter((item) => timestampInPeriod(item.createTime, bounds)),
    reviews: reviews.filter((item) => timestampInPeriod(item.createTime, bounds)),
  };
}

async function buildPeriodScopedReportInputs(
  books: NotebookBook[],
  period: ReportPeriod,
): Promise<{ books: NotebookBook[]; excerpts: ReportExcerpt[] }> {
  if (period === "all") {
    return {
      books,
      excerpts: await loadRepresentativeExcerpts(books),
    };
  }

  const bounds = periodBounds(period);
  const candidates = books.filter((book) => bounds.start === undefined || book.sort >= bounds.start);
  const noteGroups = await Promise.all(candidates.map((book) => loadPeriodScopedNotes(book, bounds)));
  const scopedBooks = noteGroups
    .map(({ book, bookmarks, reviews }) => ({
      ...book,
      noteCount: bookmarks.length,
      reviewCount: reviews.length,
      bookmarkCount: 0,
    }))
    .filter((book) => noteTotal(book) > 0)
    .sort((left, right) => noteTotal(right) - noteTotal(left));

  return {
    books: scopedBooks,
    excerpts: buildExcerptsFromNotes(noteGroups),
  };
}

export function useReadingReport() {
  const [data, setData] = useState<ReadingReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const cacheRef = useRef<Partial<Record<ReportPeriod, ReadingReportData>>>({});

  useEffect(() => {
    function onDataRefreshed() {
      cacheRef.current = {};
      setRefreshVersion((current) => current + 1);
    }

    window.addEventListener(WEREAD_DATA_REFRESHED_EVENT, onDataRefreshed);
    return () => window.removeEventListener(WEREAD_DATA_REFRESHED_EVENT, onDataRefreshed);
  }, []);

  const loadReport = useCallback(async (period: ReportPeriod, forceRefresh = false) => {
    const cached = cacheRef.current[period];
    if (cached && !forceRefresh) {
      setData(cached);
      setError(null);
      return cached;
    }

    setLoading(true);
    setError(null);
    try {
      const [stats, firstPage] = await Promise.all([
        invoke<ReadingStatsResult>("get_reading_stats", {
          mode: modeForPeriod(period),
          baseTime: baseTimeForPeriod(period),
          forceRefresh,
        }),
        invoke<{ books: NotebookBook[]; hasMore: number }>("get_notebooks", {
          count: 50,
          lastSort: 0,
          forceRefresh,
        }),
      ]);

      const books = [...firstPage.books];
      let lastSort = firstPage.books[firstPage.books.length - 1]?.sort ?? 0;
      let hasMore = firstPage.hasMore === 1 && firstPage.books.length > 0;

      while (hasMore) {
        const page = await invoke<{ books: NotebookBook[]; hasMore: number }>("get_notebooks", {
          count: 50,
          lastSort,
          forceRefresh,
        });
        books.push(...page.books);
        lastSort = page.books[page.books.length - 1]?.sort ?? 0;
        hasMore = page.hasMore === 1 && page.books.length > 0;
      }

      const scoped = await buildPeriodScopedReportInputs(books, period);
      const report = buildReportData(stats, scoped.books, period, scoped.excerpts);
      cacheRef.current = {
        ...cacheRef.current,
        [period]: report,
      };
      setData(report);
      return report;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refreshVersion, loadReport };
}
