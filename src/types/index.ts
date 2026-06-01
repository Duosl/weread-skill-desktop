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
  telemetryEnabled: boolean;
  telemetryInstallationId?: string | null;
  telemetryEndpointConfigured: boolean;
  llmConfigured: boolean;
  llmBaseUrl?: string | null;
  llmModel?: string | null;
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

export interface ImaSyncOptions {
  bookIds: string[];
  includeBookmarks: boolean;
  includeReviews: boolean;
  groupByChapter: boolean;
}

export interface ImaSyncBookResult {
  bookId: string;
  title: string;
  status: "success" | "skipped" | "failed" | string;
  message: string;
  noteId?: string | null;
  mediaId?: string | null;
}

export interface ImaSyncResult {
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: ImaSyncBookResult[];
}

export interface ImaSyncProgress {
  current: number;
  total: number;
  title: string;
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
  colorStyle?: number | null;
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
  abstractText?: string | null;
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

// ========== LLM Chat Types ==========

export interface LlmMessage {
  role: string;
  content?: string | null;
  toolCalls?: LlmToolCall[] | null;
  toolCallId?: string | null;
}

export interface LlmToolCall {
  id: string;
  type: string;
  function: LlmFunctionCall;
}

export interface LlmFunctionCall {
  name: string;
  arguments: string;
}

export interface LlmChatRequest {
  messages: LlmMessage[];
  systemPrompt?: string | null;
}

export interface LlmChatEvent {
  type: string;
  jobId: string;
  callId?: string | null;
  content?: string | null;
  skillName?: string | null;
  title?: string | null;
  summary?: string | null;
  copy?: string | null;
  filePath?: string | null;
  error?: string | null;
  question?: string | null;
  options?: Array<{ label: string; description?: string }> | null;
  responseType?: string | null;
  accessRecords?: DataAccessRecord[] | null;
  consentRequest?: ConsentRequest | null;
}

export interface LlmTestResult {
  ok: boolean;
  message: string;
  model?: string | null;
}

export interface DataAccessRecord {
  callId: string;
  apiName: string;
  displayName: string;
  purpose: string;
  dataCategories: string[];
  dataCategoryLabels: string[];
  privacyLevel: string;
  containsRawText: boolean;
  destination: "local_only" | "user_configured_llm" | string;
  scope?: string | null;
  status: "completed" | "denied" | "failed" | "pending" | string;
  denialEffect: string;
  summaryText: string;
}

export interface ConsentRequest {
  title: string;
  purpose: string;
  readDescription: string;
  destinationDescription: string;
  denialEffect: string;
}

// ========== Chat History Types ==========

export interface ChatHistoryEntry {
  sessionId: string;
  date: string | null;
  messageCount: number;
  updatedAt: string | null;
}

export interface ChatHistory {
  sessionId: string | null;
  messages: any[];
}

// ========== Custom Template Types ==========

export interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  styleSummary: string;
  styleMd: string;
  promptMd: string;
  defaultReportPeriod: string;
  defaultOutputShape: string;
  outputShapes: string[];
  requiresRawNotesConsent: boolean;
  defaultCapabilities: string[];
  optionalCapabilities: string[];
  createdAt: string;
  source: string;
  intent?: TemplateIntent | null;
}

export interface CreateCustomTemplateRequest {
  name: string;
  description: string;
  styleMd?: string | null;
  promptMd: string;
  defaultOutputShape?: string | null;
  outputShapes?: string[] | null;
  requiresRawNotesConsent?: boolean | null;
  intent?: TemplateIntent | null;
}

export interface TemplateIntent {
  question: string;
  useCase: string;
  outputUse: string;
  tone: string;
  rawTextPolicy: "none" | "optional" | "required" | string;
}
