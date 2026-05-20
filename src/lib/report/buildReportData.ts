import { noteTotal } from "../format";
import type { NotebookBook, ReadingStatsResult } from "../../types";
import type {
  Highlight,
  ReadingReportData,
  ReportExcerpt,
  ReportInsight,
  ReportPeriod,
  ReportRankItem,
  TimelineStat,
  TimelineSummary,
} from "./types";

function extractReadStat(stats: ReadingStatsResult, key: string): number {
  const item = stats.readStat.find((entry) => entry.stat === key);
  const match = item?.counts.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function periodLabel(period: ReportPeriod): string {
  if (period === "month") return "本月";
  if (period === "year") return "今年";
  return "全部";
}

function buildTimeline(stats: ReadingStatsResult): TimelineStat[] {
  const source =
    Object.keys(stats.dailyReadTimes ?? {}).length > 0
      ? stats.dailyReadTimes
      : stats.readTimes;

  return Object.entries(source)
    .map(([key, value]) => {
      const timestamp = Number(key);
      return {
        label: timestamp > 0 ? new Date(timestamp * 1000).toLocaleDateString("zh-CN") : key,
        timestamp,
        readingTime: typeof value === "number" ? value : Number(value) || 0,
      };
    })
    .filter((item) => item.readingTime > 0)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-24);
}

function buildInsights(
  stats: ReadingStatsResult,
  books: NotebookBook[],
  timeline: TimelineStat[],
  timelineSummary: TimelineSummary,
): ReportInsight[] {
  const insights: ReportInsight[] = [];
  const topCategory = stats.preferCategory
    .filter((item) => item.categoryTitle)
    .sort((left, right) => right.readingTime - left.readingTime)[0];
  const totalNotes = books.reduce((sum, book) => sum + noteTotal(book), 0);
  const noteDenseBook = [...books].sort((left, right) => noteTotal(right) - noteTotal(left))[0];
  const finishedCount = extractReadStat(stats, "读完");

  if (topCategory) {
    insights.push({
      title: "阅读重心",
      summary: `你的阅读明显集中在「${topCategory.categoryTitle}」，它占据了本期最长的阅读时间。`,
      evidence: `${formatMinutes(topCategory.readingTime)}，${topCategory.readingCount} 次记录`,
    });
  }

  if (noteDenseBook && totalNotes > 0) {
    insights.push({
      title: "思考工作台",
      summary: `「${noteDenseBook.title}」留下了最多笔记，更像是本期反复思考和整理的核心书。`,
      evidence: `${noteTotal(noteDenseBook)} 条记录，占全部笔记 ${Math.round((noteTotal(noteDenseBook) / totalNotes) * 100)}%`,
    });
  }

  if (timeline.length >= 4) {
    const direction = timelineSummary.trend === "rising"
      ? "后段更密集"
      : timelineSummary.trend === "falling"
        ? "前段更密集"
        : "整体较均衡";
    insights.push({
      title: "节奏变化",
      summary: `从时间线看，你的阅读节奏呈现「${direction}」的特征。`,
      evidence: `前段 ${formatMinutes(timelineSummary.firstHalfReadingTime)}，后段 ${formatMinutes(timelineSummary.secondHalfReadingTime)}`,
    });
  }

  if (finishedCount > 0 && books.length > 0) {
    insights.push({
      title: "完成感",
      summary: `本期读完 ${finishedCount} 本书，同时有 ${books.length} 本书留下笔记，阅读结果和思考痕迹同时存在。`,
      evidence: `读完 ${finishedCount} 本，有记录 ${books.length} 本`,
    });
  }

  const reviewRichBook = [...books].sort((left, right) => right.reviewCount - left.reviewCount)[0];
  if (reviewRichBook?.reviewCount > 0) {
    insights.push({
      title: "主动表达",
      summary: `「${reviewRichBook.title}」承载了最多想法，说明它更容易触发你的判断、联想或反驳。`,
      evidence: `${reviewRichBook.reviewCount} 条想法`,
    });
  }

  const totalReadTime = stats.totalReadTime || 0;
  const topCategoryShare = topCategory && totalReadTime > 0
    ? Math.round((topCategory.readingTime / totalReadTime) * 100)
    : 0;
  if (topCategory && topCategoryShare >= 25) {
    insights.push({
      title: "偏好集中度",
      summary: `「${topCategory.categoryTitle}」占比较高，本期阅读主题比较集中。`,
      evidence: `约 ${topCategoryShare}% 阅读时长`,
    });
  }

  return insights.slice(0, 8);
}

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
  }
  return `${minutes}分钟`;
}

function buildHighlights(
  stats: ReadingStatsResult,
  books: NotebookBook[],
): Highlight[] {
  const highlights: Highlight[] = [];
  const topCategory = stats.preferCategory
    .filter((item) => item.categoryTitle)
    .sort((left, right) => right.readingTime - left.readingTime)[0];
  const topNoteBook = [...books].sort((left, right) => noteTotal(right) - noteTotal(left))[0];
  const longest = stats.readLongest[0];

  if (topCategory) {
    highlights.push({
      title: "最稳定的阅读方向",
      description: topCategory.categoryTitle,
      metric: `${topCategory.readingCount} 次记录`,
    });
  }

  if (topNoteBook) {
    highlights.push({
      title: "笔记密度最高的书",
      description: `${topNoteBook.title} · ${topNoteBook.author || "未知作者"}`,
      metric: `${noteTotal(topNoteBook)} 条记录`,
    });
  }

  if (longest?.book) {
    highlights.push({
      title: "投入最多时间的书",
      description: `${longest.book.title} · ${longest.book.author || "未知作者"}`,
      metric: `${Math.round(longest.readTime / 60)} 分钟`,
    });
  }

  return highlights;
}

function buildTimelineSummary(timeline: TimelineStat[]): TimelineSummary {
  if (timeline.length === 0) {
    return {
      totalPoints: 0,
      activePoints: 0,
      peakLabel: "",
      peakReadingTime: 0,
      averageReadingTime: 0,
      firstHalfReadingTime: 0,
      secondHalfReadingTime: 0,
      trend: "insufficient",
    };
  }

  const active = timeline.filter((item) => item.readingTime > 0);
  const peak = active.reduce((best, item) => item.readingTime > best.readingTime ? item : best, active[0]);
  const midpoint = Math.floor(active.length / 2);
  const firstHalf = active.slice(0, midpoint).reduce((sum, item) => sum + item.readingTime, 0);
  const secondHalf = active.slice(midpoint).reduce((sum, item) => sum + item.readingTime, 0);
  const delta = Math.abs(secondHalf - firstHalf);
  const trend = active.length < 4
    ? "insufficient"
    : delta < Math.max(firstHalf, secondHalf) * 0.12
      ? "flat"
      : secondHalf > firstHalf
        ? "rising"
        : "falling";

  return {
    totalPoints: timeline.length,
    activePoints: active.length,
    peakLabel: peak?.label ?? "",
    peakReadingTime: peak?.readingTime ?? 0,
    averageReadingTime: active.reduce((sum, item) => sum + item.readingTime, 0) / Math.max(active.length, 1),
    firstHalfReadingTime: firstHalf,
    secondHalfReadingTime: secondHalf,
    trend,
  };
}

function rankBooks(
  books: NotebookBook[],
  getScore: (book: NotebookBook) => number,
  value: (book: NotebookBook) => string,
): ReportRankItem[] {
  return [...books]
    .map((book) => ({
      title: book.title,
      subtitle: book.author || "未知作者",
      score: getScore(book),
      value: value(book),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
}

function buildLongReadLeaders(stats: ReadingStatsResult): ReportRankItem[] {
  return stats.readLongest
    .filter((item) => item.book && item.readTime > 0)
    .slice(0, 8)
    .map((item) => ({
      title: item.book?.title ?? "未知书名",
      subtitle: item.book?.author ?? "未知作者",
      value: formatMinutes(item.readTime),
      score: item.readTime,
    }));
}

export function buildReportData(
  stats: ReadingStatsResult,
  notebooks: NotebookBook[],
  period: ReportPeriod,
  excerpts: ReportExcerpt[] = [],
): ReadingReportData {
  const sortedBooks = [...notebooks].sort((left, right) => noteTotal(right) - noteTotal(left));
  const bookmarkCount = notebooks.reduce((sum, book) => sum + book.noteCount, 0);
  const reviewCount = notebooks.reduce((sum, book) => sum + book.reviewCount, 0);
  const extraBookmarkCount = notebooks.reduce((sum, book) => sum + book.bookmarkCount, 0);
  const timeline = buildTimeline(stats);
  const timelineSummary = buildTimelineSummary(timeline);
  const totalReadTime = stats.totalReadTime || 0;
  const readBooks = extractReadStat(stats, "读过");
  const finishedBooks = extractReadStat(stats, "读完");
  const totalNoteCount = bookmarkCount + reviewCount + extraBookmarkCount;

  return {
    profile: {
      period,
      periodLabel: periodLabel(period),
      generatedAt: new Date().toLocaleString("zh-CN"),
      totalReadTime: stats.totalReadTime,
      readDays: stats.readDays,
      finishedBooks,
      readBooks,
      noteCount: totalNoteCount,
      bookmarkCount,
      reviewCount,
      extraBookmarkCount,
      averageReadTimePerDay: stats.readDays > 0 ? Math.round(stats.totalReadTime / stats.readDays) : 0,
      notesPerBook: notebooks.length > 0 ? Math.round((totalNoteCount / notebooks.length) * 10) / 10 : 0,
      completionRate: readBooks > 0 ? Math.round((finishedBooks / readBooks) * 100) : 0,
    },
    books: sortedBooks.slice(0, 24).map((book) => ({
      bookId: book.bookId,
      title: book.title,
      author: book.author,
      cover: book.cover,
      noteCount: book.noteCount,
      bookmarkCount: book.bookmarkCount,
      reviewCount: book.reviewCount,
      totalNotes: noteTotal(book),
      readingProgress: book.readingProgress,
    })),
    categories: stats.preferCategory
      .filter((item) => item.categoryTitle)
      .sort((left, right) => right.readingTime - left.readingTime)
      .slice(0, 8)
      .map((item) => ({
        title: item.categoryTitle,
        readingTime: item.readingTime,
        readingCount: item.readingCount,
        share: totalReadTime > 0 ? Math.round((item.readingTime / totalReadTime) * 1000) / 10 : 0,
      })),
    timeline,
    timelineSummary,
    longest: stats.readLongest.slice(0, 8),
    rankings: {
      noteLeaders: rankBooks(sortedBooks, noteTotal, (book) => `${noteTotal(book)} 条记录`),
      bookmarkLeaders: rankBooks(sortedBooks, (book) => book.noteCount, (book) => `${book.noteCount} 条划线`),
      reviewLeaders: rankBooks(sortedBooks, (book) => book.reviewCount, (book) => `${book.reviewCount} 条想法`),
      progressLeaders: rankBooks(sortedBooks, (book) => book.readingProgress, (book) => `${book.readingProgress}%`),
      longReadLeaders: buildLongReadLeaders(stats),
    },
    highlights: buildHighlights(stats, sortedBooks),
    insights: buildInsights(stats, sortedBooks, timeline, timelineSummary),
    excerpts,
    sourceSummary: {
      notebookBooks: notebooks.length,
      sampledBooks: new Set(excerpts.map((item) => item.bookId)).size,
      excerptCount: excerpts.length,
      categoryCount: stats.preferCategory.filter((item) => item.categoryTitle).length,
      timelinePoints: timeline.length,
    },
  };
}
