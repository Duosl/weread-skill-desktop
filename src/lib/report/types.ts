import type { BookInfo } from "../../types";

export type ReportPeriod = "month" | "year" | "all";

export type ReportTemplateId = "analysis" | "journey" | "annual";

export type ReportBook = {
  bookId: string;
  title: string;
  author: string;
  cover: string;
  noteCount: number;
  bookmarkCount: number;
  reviewCount: number;
  totalNotes: number;
  readingProgress: number;
};

export type CategoryStat = {
  title: string;
  readingTime: number;
  readingCount: number;
  share: number;
};

export type TimelineStat = {
  label: string;
  timestamp: number;
  readingTime: number;
};

export type ReportRankItem = {
  title: string;
  subtitle: string;
  value: string;
  score: number;
};

export type Highlight = {
  title: string;
  description: string;
  metric: string;
};

export type ReportInsight = {
  title: string;
  summary: string;
  evidence: string;
};

export type ReportExcerpt = {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  kind: "bookmark" | "review";
  content: string;
  chapter?: string | null;
};

export type TimelineSummary = {
  totalPoints: number;
  activePoints: number;
  peakLabel: string;
  peakReadingTime: number;
  averageReadingTime: number;
  firstHalfReadingTime: number;
  secondHalfReadingTime: number;
  trend: "rising" | "falling" | "flat" | "insufficient";
};

export type ReportSourceSummary = {
  notebookBooks: number;
  sampledBooks: number;
  excerptCount: number;
  categoryCount: number;
  timelinePoints: number;
};

export type ReadingReportData = {
  profile: {
    period: ReportPeriod;
    periodLabel: string;
    generatedAt: string;
    totalReadTime: number;
    readDays: number;
    finishedBooks: number;
    readBooks: number;
    noteCount: number;
    bookmarkCount: number;
    reviewCount: number;
    extraBookmarkCount: number;
    averageReadTimePerDay: number;
    notesPerBook: number;
    completionRate: number;
  };
  books: ReportBook[];
  categories: CategoryStat[];
  timeline: TimelineStat[];
  timelineSummary: TimelineSummary;
  longest: Array<{
    book?: BookInfo | null;
    readTime: number;
    tags: string[];
  }>;
  rankings: {
    noteLeaders: ReportRankItem[];
    bookmarkLeaders: ReportRankItem[];
    reviewLeaders: ReportRankItem[];
    progressLeaders: ReportRankItem[];
    longReadLeaders: ReportRankItem[];
  };
  highlights: Highlight[];
  insights: ReportInsight[];
  excerpts: ReportExcerpt[];
  sourceSummary: ReportSourceSummary;
};
