import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "../lib/format";
import { buildReportData } from "../lib/report/buildReportData";
import { noteTotal } from "../lib/format";
import type { ReadingReportData, ReportExcerpt, ReportPeriod } from "../lib/report/types";
import type { BookmarkListResult, NotebookBook, ReadingStatsResult, ReviewListResult } from "../types";

function modeForPeriod(period: ReportPeriod): "monthly" | "annually" | "overall" {
  if (period === "month") return "monthly";
  if (period === "year") return "annually";
  return "overall";
}

function baseTimeForPeriod(period: ReportPeriod): number {
  const now = new Date();
  if (period === "month") {
    return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
  }
  if (period === "year") {
    return Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);
  }
  return 0;
}

async function loadRepresentativeExcerpts(books: NotebookBook[]): Promise<ReportExcerpt[]> {
  const candidates = [...books]
    .sort((left, right) => noteTotal(right) - noteTotal(left))
    .slice(0, 10);

  const groups = await Promise.all(
    candidates.map(async (book) => {
      try {
        const [bookmarkResult, reviewResult] = await Promise.all([
          invoke<BookmarkListResult>("get_bookmarks", { bookId: book.bookId }).catch(() => ({ bookmarks: [] })),
          invoke<ReviewListResult>("get_my_reviews", { bookId: book.bookId, synckey: 0, count: 20 }).catch(() => ({ reviews: [] })),
        ]);

        const bookmarks = (bookmarkResult.bookmarks ?? [])
          .filter((item) => item.markText.trim().length >= 8)
          .sort((left, right) => right.markText.length - left.markText.length)
          .slice(0, 2);
        const reviews = (reviewResult.reviews ?? [])
          .filter((item) => item.content.trim().length >= 6)
          .sort((left, right) => right.content.length - left.content.length)
          .slice(0, 2);
        const excerpts: ReportExcerpt[] = [];

        for (const review of reviews) {
          excerpts.push({
            bookId: book.bookId,
            bookTitle: book.title,
            bookAuthor: book.author,
            kind: "review",
            content: review.content,
            chapter: review.chapterName,
          });
        }

        for (const bookmark of bookmarks) {
          excerpts.push({
            bookId: book.bookId,
            bookTitle: book.title,
            bookAuthor: book.author,
            kind: "bookmark",
            content: bookmark.markText,
            chapter: bookmark.chapterTitle,
          });
        }

        return excerpts;
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

export function useReadingReport() {
  const [data, setData] = useState<ReadingReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (period: ReportPeriod, forceRefresh = false) => {
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

      const excerpts = await loadRepresentativeExcerpts(books);
      const report = buildReportData(stats, books, period, excerpts);
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

  return { data, loading, error, loadReport };
}
