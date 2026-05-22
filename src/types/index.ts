export interface AppSettings {
  apiKeySet: boolean;
  apiKeyMasked?: string | null;
  apiKeyFull?: string | null;
  lastExportDir: string;
  defaultFormat: string;
  cacheTtlSeconds: number;
  imaClientIdSet: boolean;
  imaClientIdMasked?: string | null;
  imaClientIdFull?: string | null;
  imaApiKeySet: boolean;
  imaApiKeyMasked?: string | null;
  imaApiKeyFull?: string | null;
  imaKnowledgeBaseId?: string | null;
  imaKnowledgeBaseName?: string | null;
}

export interface ImaKnowledgeBaseOption {
  id: string;
  name: string;
}

export interface ImaKnowledgeBasePage {
  items: ImaKnowledgeBaseOption[];
  nextCursor?: string | null;
  isEnd: boolean;
}

export interface ImaConnectionTestResult {
  ok: boolean;
  message: string;
  knowledgeBases: ImaKnowledgeBaseOption[];
}

export interface ShelfBook {
  bookId: string;
  title: string;
  author: string;
  cover: string;
  category: string;
  readUpdateTime: number;
  finishReading: number;
  updateTime: number;
  isTop: number;
  secret: number;
}

export interface ShelfSyncResult {
  books: ShelfBook[];
  albums: unknown[];
  hasMp: boolean;
  totalCount: number;
}

export interface BookInfo {
  bookId: string;
  title: string;
  author: string;
  translator: string;
  cover: string;
  intro: string;
  category: string;
  publisher: string;
  publishTime: string;
  isbn: string;
  wordCount: number;
  newRating: number;
  newRatingCount: number;
}

export interface BookProgress {
  bookId: string;
  progress: number;
  chapterUid: number;
  chapterOffset: number;
  updateTime: number;
  recordReadingTime: number;
  finishTime?: number | null;
  isStartReading: number;
}

export interface ChapterInfo {
  chapterUid: number;
  chapterIdx: number;
  title: string;
}

export interface Bookmark {
  bookmarkId: string;
  bookId: string;
  chapterUid: number;
  markText: string;
  createTime: number;
  range: string;
  colorStyle: number;
  chapterTitle?: string | null;
}

export interface BookmarkListResult {
  bookmarks: Bookmark[];
  chapters: ChapterInfo[];
  book?: BookInfo | null;
}

export interface Review {
  reviewId: string;
  content: string;
  createTime: number;
  star: number;
  chapterName?: string | null;
  range?: string | null;
}

export interface ReviewListResult {
  reviews: Review[];
  totalCount: number;
  hasMore: number;
  synckey: number;
}

export interface NotebookBook {
  bookId: string;
  title: string;
  author: string;
  cover: string;
  reviewCount: number;
  noteCount: number;
  bookmarkCount: number;
  readingProgress: number;
  markedStatus: number;
  sort: number;
}

export interface NotebooksResult {
  books: NotebookBook[];
  totalBookCount: number;
  totalNoteCount: number;
  hasMore: number;
}

export interface CategoryPref {
  categoryTitle: string;
  val: number;
  readingTime: number;
  readingCount: number;
}

export interface ReadLongestItem {
  book?: BookInfo | null;
  readTime: number;
  tags: string[];
}

export interface ReadStatItem {
  stat: string;
  counts: string;
  scheme?: string | null;
}

export interface ReadingStatsResult {
  baseTime: number;
  readDays: number;
  totalReadTime: number;
  dayAverageReadTime: number;
  compare?: number | null;
  readLongest: ReadLongestItem[];
  preferCategory: CategoryPref[];
  preferTime: number[];
  readTimes: Record<string, number>;
  dailyReadTimes: Record<string, number>;
  readStat: ReadStatItem[];
  registTime: number;
}

export interface ExportOptions {
  bookIds: string[];
  format: "markdown";
  outputDir: string;
  includeBookmarks: boolean;
  includeReviews: boolean;
  groupByChapter: boolean;
}

export interface ExportResult {
  success: boolean;
  filePaths: string[];
  message: string;
}

export interface ExportProgress {
  current: number;
  total: number;
  title: string;
}
