import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MessageSquareQuote, Search, Share2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { PageShell } from "../components/layout/PageShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { IconButton } from "../components/ui/IconButton";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { ShareCardModal } from "../components/ui/ShareCardModal";
import type { ShareCardData } from "../components/ui/ShareCardModal";
import { Spinner } from "../components/ui/Spinner";
import { useAllNotes } from "../hooks/useAllNotes";
import type { AllBookmark, AllReview } from "../hooks/useAllNotes";
import { useNotes } from "../hooks/useNotes";
import { useNotebooks } from "../hooks/useNotebooks";
import { formatDateTime, noteTotal } from "../lib/format";
import type { Bookmark, ChapterInfo, Review } from "../types";

type NoteType = "all" | "bookmarks" | "reviews";
type ViewMode = "chapter" | "timeline";
type BookmarkColorFilter = "all" | "1" | "2" | "3" | "4" | "5";

type ChapterGroup = {
  chapterUid: number;
  title: string;
  bookmarks: Bookmark[];
  reviews: Review[];
};

type FlatNote = {
  kind: "bookmark" | "review";
  id: string;
  chapter: string;
  chapterUid: number;
  time: number;
  content: string;
  range?: string;
  colorStyle?: number | null;
  abstractText?: string | null;
  bookTitle?: string;
  bookAuthor?: string;
};

type BookNoteGroup = {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  chapters: ChapterGroup[];
};

type NotesPageProps = {
  embedded?: boolean;
  initialBookId?: string;
  onSelectedBookChange?: (bookId: string) => void;
};

export function NotesPage({
  embedded = false,
  initialBookId,
  onSelectedBookChange,
}: NotesPageProps = {}) {
  const params = useParams();
  const [selectedBookId, setSelectedBookId] = useState(initialBookId ?? params.bookId ?? "");
  const [notebookQuery, setNotebookQuery] = useState("");
  const [query, setQuery] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("chapter");
  const [bookmarkColorFilter, setBookmarkColorFilter] = useState<BookmarkColorFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<ShareCardData | null>(null);
  const notebooks = useNotebooks();
  const notes = useNotes(selectedBookId);
  const allNotes = useAllNotes();
  const isAllNotesMode = !selectedBookId;
  const notebookScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void notebooks.loadNotebooks();
  }, []);

  useEffect(() => {
    if (params.bookId) setSelectedBookId(params.bookId);
  }, [params.bookId]);

  useEffect(() => {
    if (initialBookId) setSelectedBookId(initialBookId);
  }, [initialBookId]);

  useEffect(() => {
    if (selectedBookId) void notes.loadNotes(selectedBookId, true);
  }, [selectedBookId]);

  useEffect(() => {
    if (embedded) onSelectedBookChange?.(selectedBookId);
  }, [embedded, onSelectedBookChange, selectedBookId]);

  useEffect(() => {
    if (isAllNotesMode && !notebooks.loading && notebooks.books.length > 0 && !allNotes.loading && allNotes.bookmarks.length === 0) {
      void allNotes.loadAll(notebooks.books);
    }
  }, [isAllNotesMode, notebooks.books, notebooks.loading]);

  useEffect(() => {
    if (!selectedBookId || notebooks.loading || notebooks.books.length === 0) return;
    const timer = setTimeout(() => {
      const container = notebookScrollRef.current;
      if (!container) return;
      const active = container.querySelector<HTMLElement>(".notebook.active");
      if (!active) return;
      const nextTop = active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedBookId, notebooks.books, notebooks.loading]);

  const selectedBook = notebooks.books.find((book) => book.bookId === selectedBookId);
  const filteredNotebooks = useMemo(() => {
    const keyword = notebookQuery.trim().toLowerCase();
    if (!keyword) return notebooks.books;
    return notebooks.books.filter(
      (book) =>
        book.title.toLowerCase().includes(keyword) ||
        book.author.toLowerCase().includes(keyword),
    );
  }, [notebooks.books, notebookQuery]);
  const normalizedQuery = query.trim().toLowerCase();
  const availableBookmarkColors = useMemo(() => {
    const source = isAllNotesMode ? allNotes.bookmarks : notes.bookmarks;
    const colors = new Set<BookmarkColorFilter>();
    for (const bookmark of source) {
      if (isBookmarkColorFilter(bookmark.colorStyle)) {
        colors.add(String(bookmark.colorStyle) as BookmarkColorFilter);
      }
    }
    return BOOKMARK_COLOR_OPTIONS.filter((option) => option.value === "all" || colors.has(option.value));
  }, [isAllNotesMode, allNotes.bookmarks, notes.bookmarks]);
  const isColorScoped = bookmarkColorFilter !== "all";

  useEffect(() => {
    if (
      bookmarkColorFilter !== "all" &&
      !availableBookmarkColors.some((option) => option.value === bookmarkColorFilter)
    ) {
      setBookmarkColorFilter("all");
    }
  }, [availableBookmarkColors, bookmarkColorFilter]);

  useEffect(() => {
    if (noteType !== "bookmarks" && bookmarkColorFilter !== "all") {
      setBookmarkColorFilter("all");
    }
  }, [bookmarkColorFilter, noteType]);

  const filteredBookmarks = useMemo(
    () => {
      if (isAllNotesMode) {
        return allNotes.bookmarks.filter(
          (bookmark) =>
            noteType !== "reviews" &&
            (!isColorScoped || String(bookmark.colorStyle) === bookmarkColorFilter) &&
            (!normalizedQuery ||
              bookmark.markText.toLowerCase().includes(normalizedQuery) ||
              Boolean(bookmark.chapterTitle?.toLowerCase().includes(normalizedQuery)) ||
              bookmark.bookTitle.toLowerCase().includes(normalizedQuery) ||
              bookmark.bookAuthor.toLowerCase().includes(normalizedQuery)),
        );
      }
      return notes.bookmarks.filter(
        (bookmark) =>
          noteType !== "reviews" &&
          (!isColorScoped || String(bookmark.colorStyle) === bookmarkColorFilter) &&
          (!normalizedQuery ||
            bookmark.markText.toLowerCase().includes(normalizedQuery) ||
            Boolean(bookmark.chapterTitle?.toLowerCase().includes(normalizedQuery))),
      );
    },
    [bookmarkColorFilter, isAllNotesMode, allNotes.bookmarks, isColorScoped, notes.bookmarks, normalizedQuery, noteType],
  );

  const filteredReviews = useMemo(
    () => {
      if (isAllNotesMode) {
        return allNotes.reviews.filter(
          (review) =>
            noteType !== "bookmarks" &&
            (!normalizedQuery ||
              review.content.toLowerCase().includes(normalizedQuery) ||
              Boolean(review.abstractText?.toLowerCase().includes(normalizedQuery)) ||
              Boolean(review.chapterName?.toLowerCase().includes(normalizedQuery)) ||
              review.bookTitle.toLowerCase().includes(normalizedQuery) ||
              review.bookAuthor.toLowerCase().includes(normalizedQuery)),
        );
      }
      return notes.reviews.filter(
        (review) =>
          noteType !== "bookmarks" &&
          (!normalizedQuery ||
            review.content.toLowerCase().includes(normalizedQuery) ||
            Boolean(review.abstractText?.toLowerCase().includes(normalizedQuery)) ||
            Boolean(review.chapterName?.toLowerCase().includes(normalizedQuery))),
      );
    },
    [isAllNotesMode, allNotes.reviews, notes.reviews, normalizedQuery, noteType],
  );

  const chapterGroups = useMemo(
    () => isAllNotesMode ? [] : buildChapterGroups(notes.chapters, filteredBookmarks, filteredReviews),
    [isAllNotesMode, notes.chapters, filteredBookmarks, filteredReviews],
  );

  const bookNoteGroups = useMemo(() => {
    if (!isAllNotesMode) return [];
    const allBm = filteredBookmarks as AllBookmark[];
    const allRv = filteredReviews as AllReview[];
    const bookMap = new Map<string, { bookmarks: AllBookmark[]; reviews: AllReview[] }>();
    for (const bm of allBm) {
      const key = bm.bookId;
      if (!bookMap.has(key)) bookMap.set(key, { bookmarks: [], reviews: [] });
      bookMap.get(key)!.bookmarks.push(bm);
    }
    for (const rv of allRv) {
      const key = rv.bookId;
      if (!bookMap.has(key)) bookMap.set(key, { bookmarks: [], reviews: [] });
      bookMap.get(key)!.reviews.push(rv);
    }
    const groups: BookNoteGroup[] = [];
    for (const [bookId, data] of bookMap) {
      const firstBm = data.bookmarks[0];
      const firstRv = data.reviews[0];
      groups.push({
        bookId,
        bookTitle: firstBm?.bookTitle ?? firstRv?.bookTitle ?? "",
        bookAuthor: firstBm?.bookAuthor ?? firstRv?.bookAuthor ?? "",
        chapters: buildChapterGroups([], data.bookmarks, data.reviews),
      });
    }
    return groups;
  }, [isAllNotesMode, filteredBookmarks, filteredReviews]);

  const flatNotes = useMemo(
    () => {
      const allBm = filteredBookmarks as AllBookmark[];
      const allRv = filteredReviews as AllReview[];
      return [
        ...allBm.map((bookmark) => ({
          kind: "bookmark" as const,
          id: bookmark.bookmarkId,
          chapter: bookmark.chapterTitle || "未命名章节",
          chapterUid: bookmark.chapterUid,
          time: bookmark.createTime,
          content: bookmark.markText,
          range: bookmark.range,
          colorStyle: bookmark.colorStyle,
          bookTitle: isAllNotesMode ? bookmark.bookTitle : undefined,
          bookAuthor: isAllNotesMode ? bookmark.bookAuthor : undefined,
        })),
        ...allRv.map((review) => ({
          kind: "review" as const,
          id: review.reviewId,
          chapter: review.chapterName || "想法",
          chapterUid: 0,
          time: review.createTime,
          content: review.content,
          abstractText: review.abstractText,
          bookTitle: isAllNotesMode ? review.bookTitle : undefined,
          bookAuthor: isAllNotesMode ? review.bookAuthor : undefined,
        })),
      ].sort((left, right) => right.time - left.time);
    },
    [filteredBookmarks, filteredReviews, isAllNotesMode],
  );

  async function openInWeread() {
    if (!selectedBookId) return;
    setActionError(null);
    try {
      await invoke("open_in_weread", { bookId: selectedBookId, chapterUid: null });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  const content = (
    <>
      <ErrorBanner message={notebooks.error ?? allNotes.error ?? notes.error ?? actionError} />
      <ShareCardModal data={shareData} onClose={() => setShareData(null)} />
      <div className="notes-layout">
        <Card className="notebook-list">
          <div className="section-title">
            <MessageSquareQuote size={20} />
            <div>
              <h2>笔记本</h2>
              <p>{filteredNotebooks.length} / {notebooks.books.length} 本有记录的书。</p>
            </div>
          </div>
          <div className="search-box list-search">
            <Search size={16} />
            <input
              value={notebookQuery}
              onChange={(event) => setNotebookQuery(event.target.value)}
              placeholder="搜索书名或作者"
            />
          </div>
          {notebooks.loading ? (
            <Spinner label="正在读取笔记本" />
          ) : notebooks.books.length === 0 ? (
            <EmptyState title="暂无笔记本" description="配置 API Key 后可读取笔记本列表。" />
          ) : filteredNotebooks.length === 0 ? (
            <EmptyState title="没有匹配笔记本" description="换一个关键词继续筛选。" />
          ) : (
            <div className="notebook-scroll" ref={notebookScrollRef}>
              <button
                type="button"
                className={!selectedBookId ? "notebook active" : "notebook"}
                onClick={() => setSelectedBookId("")}
              >
                <span className="notebook-title">全部笔记</span>
                <small>{notebooks.books.reduce((sum, b) => sum + noteTotal(b), 0)}</small>
              </button>
              {filteredNotebooks.map((book) => (
                <button
                  type="button"
                  key={book.bookId}
                  className={book.bookId === selectedBookId ? "notebook active" : "notebook"}
                  onClick={() => setSelectedBookId(book.bookId)}
                >
                  <span className="notebook-title">{book.title}</span>
                  <small>{noteTotal(book)}</small>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="notes-main">
          <Card className="toolbar-card">
            <div className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索划线或想法"
              />
            </div>
            {selectedBook || isAllNotesMode ? (
              <Badge>
                {filteredBookmarks.length} 划线 / {filteredReviews.length} 想法
              </Badge>
            ) : null}
          </Card>

          <Card className="notes-filter-card">
            <div className="notes-filter-row">
              <SegmentedControl
                ariaLabel="笔记类型"
                value={noteType}
                onChange={setNoteType}
                options={[
                  { value: "all", label: "全部" },
                  { value: "bookmarks", label: "划线" },
                  { value: "reviews", label: "想法" },
                ]}
              />
              <SegmentedControl
                ariaLabel="笔记视图"
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: "chapter", label: "按章节" },
                  { value: "timeline", label: "按时间" },
                ]}
              />
            </div>
            {noteType === "bookmarks" && availableBookmarkColors.length > 1 ? (
              <SegmentedControl
                ariaLabel="划线颜色"
                value={bookmarkColorFilter}
                onChange={setBookmarkColorFilter}
                options={availableBookmarkColors}
              />
            ) : null}
          </Card>

          {isAllNotesMode && allNotes.loading ? (
            <Card>
              <Spinner label={`正在加载笔记 ${allNotes.loaded}/${allNotes.total}`} />
            </Card>
          ) : isAllNotesMode ? (
            viewMode === "chapter" ? (
              <AllNotesChapterView
                groups={bookNoteGroups}
                onShare={setShareData}
              />
            ) : (
              <TimelineView
                notes={flatNotes}
                bookTitle=""
                bookAuthor=""
                showBookName
                onShare={setShareData}
              />
            )
          ) : notes.loading ? (
            <Card>
              <Spinner label="正在读取笔记" />
            </Card>
          ) : viewMode === "chapter" ? (
            <ChapterView
              groups={chapterGroups}
              bookTitle={selectedBook?.title ?? ""}
              bookAuthor={selectedBook?.author ?? ""}
              onShare={setShareData}
            />
          ) : (
            <TimelineView
              notes={flatNotes}
              bookTitle={selectedBook?.title ?? ""}
              bookAuthor={selectedBook?.author ?? ""}
              onShare={setShareData}
            />
          )}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <PageShell
      title="笔记"
      action={
        <Button
          variant="secondary"
          icon={<ExternalLink size={16} />}
          disabled={!selectedBookId}
          onClick={() => void openInWeread()}
        >
          微信读书
        </Button>
      }
    >
      {content}
    </PageShell>
  );
}

function ChapterView({
  groups,
  bookTitle,
  bookAuthor,
  onShare,
}: {
  groups: ChapterGroup[];
  bookTitle: string;
  bookAuthor: string;
  onShare: (data: ShareCardData) => void;
}) {
  if (groups.length === 0) {
    return <EmptyState title="没有匹配内容" description="换一个关键词，或选择其他笔记本。" />;
  }

  return (
    <div className="note-stack">
      {groups.map((group) => (
        <div key={group.chapterUid} className="chapter-group">
          <div className="chapter-group-header">
            <h3>{group.title}</h3>
            <Badge>
              {group.bookmarks.length} 划线 / {group.reviews.length} 想法
            </Badge>
          </div>
          {group.bookmarks.map((bookmark) => (
            <Card className="quote-card" key={bookmark.bookmarkId}>
              <div className="note-meta">
                <span>{formatDateTime(bookmark.createTime)}</span>
                {bookmark.range ? <code>{bookmark.range}</code> : null}
                <IconButton
                  className="note-share-btn"
                  icon={<Share2 size={14} />}
                  aria-label="分享"
                  size="small"
                  onClick={() =>
                    onShare({
                      kind: "bookmark",
                      bookTitle,
                      bookAuthor,
                      content: bookmark.markText,
                      chapter: group.title,
                      time: bookmark.createTime,
                    })
                  }
                />
              </div>
              <blockquote
                className={bookmark.colorStyle ? `bookmark-text-color-${bookmark.colorStyle}` : undefined}
              >
                {bookmark.markText}
              </blockquote>
            </Card>
          ))}
          {group.reviews.map((review) => (
            <Card className="review-card" key={review.reviewId}>
              <div className="note-meta">
                <span>{formatDateTime(review.createTime)}</span>
                {review.range ? <code>{review.range}</code> : null}
                <IconButton
                  className="note-share-btn"
                  icon={<Share2 size={14} />}
                  aria-label="分享"
                  size="small"
                  onClick={() =>
                    onShare({
                      kind: "review",
                      bookTitle,
                      bookAuthor,
                      content: review.content,
                      chapter: review.chapterName ?? undefined,
                      time: review.createTime,
                      abstractText: review.abstractText ?? undefined,
                    })
                  }
                />
              </div>
              {review.abstractText ? <blockquote className="review-abstract">{review.abstractText}</blockquote> : null}
              <p>{review.content}</p>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

function AllNotesChapterView({
  groups,
  onShare,
}: {
  groups: BookNoteGroup[];
  onShare: (data: ShareCardData) => void;
}) {
  if (groups.length === 0) {
    return <EmptyState title="没有匹配内容" description="换一个关键词，或选择其他笔记本。" />;
  }

  return (
    <div className="note-stack">
      {groups.map((group) => (
        <div key={group.bookId} className="book-note-group">
          <div className="book-note-group-header">
            <h3>{group.bookTitle}</h3>
            <span className="book-note-group-author">{group.bookAuthor}</span>
          </div>
          {group.chapters.map((chapter) => (
            <div key={`${group.bookId}-${chapter.chapterUid}`} className="chapter-group">
              <div className="chapter-group-header">
                <h4>{chapter.title}</h4>
                <Badge>
                  {chapter.bookmarks.length} 划线 / {chapter.reviews.length} 想法
                </Badge>
              </div>
              {chapter.bookmarks.map((bookmark) => (
                <Card className="quote-card" key={bookmark.bookmarkId}>
                  <div className="note-meta">
                    <span>{formatDateTime(bookmark.createTime)}</span>
                    {bookmark.range ? <code>{bookmark.range}</code> : null}
                    <IconButton
                      className="note-share-btn"
                      icon={<Share2 size={14} />}
                      aria-label="分享"
                      size="small"
                      onClick={() =>
                        onShare({
                          kind: "bookmark",
                          bookTitle: group.bookTitle,
                          bookAuthor: group.bookAuthor,
                          content: bookmark.markText,
                          chapter: chapter.title,
                          time: bookmark.createTime,
                        })
                      }
                    />
                  </div>
                  <blockquote
                    className={bookmark.colorStyle ? `bookmark-text-color-${bookmark.colorStyle}` : undefined}
                  >
                    {bookmark.markText}
                  </blockquote>
                </Card>
              ))}
              {chapter.reviews.map((review) => (
                <Card className="review-card" key={review.reviewId}>
                  <div className="note-meta">
                    <span>{formatDateTime(review.createTime)}</span>
                    {review.range ? <code>{review.range}</code> : null}
                    <IconButton
                      className="note-share-btn"
                      icon={<Share2 size={14} />}
                      aria-label="分享"
                      size="small"
                      onClick={() =>
                        onShare({
                          kind: "review",
                          bookTitle: group.bookTitle,
                          bookAuthor: group.bookAuthor,
                          content: review.content,
                          chapter: review.chapterName ?? undefined,
                          time: review.createTime,
                          abstractText: review.abstractText ?? undefined,
                        })
                      }
                    />
                  </div>
                  {review.abstractText ? <blockquote className="review-abstract">{review.abstractText}</blockquote> : null}
                  <p>{review.content}</p>
                </Card>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TimelineView({
  notes,
  bookTitle,
  bookAuthor,
  showBookName,
  onShare,
}: {
  notes: FlatNote[];
  bookTitle: string;
  bookAuthor: string;
  showBookName?: boolean;
  onShare: (data: ShareCardData) => void;
}) {
  if (notes.length === 0) {
    return <EmptyState title="没有匹配内容" description="换一个关键词，或选择其他笔记本。" />;
  }

  return (
    <div className="note-stack">
      {notes.map((note) => (
        <Card className={note.kind === "bookmark" ? "quote-card" : "review-card"} key={`${note.kind}-${note.id}`}>
          <div className="note-meta">
            <span>{note.chapter}</span>
            <NoteMetaDetails time={note.time} range={note.range} />
            {showBookName && note.bookTitle ? (
              <span className="note-book-tag">{note.bookTitle}</span>
            ) : null}
            <IconButton
              className="note-share-btn"
              icon={<Share2 size={14} />}
              aria-label="分享"
              size="small"
              onClick={() =>
                onShare({
                  kind: note.kind,
                  bookTitle: note.bookTitle ?? bookTitle,
                  bookAuthor: note.bookAuthor ?? bookAuthor,
                  content: note.content,
                  chapter: note.chapter,
                  time: note.time,
                  abstractText: note.abstractText,
                })
              }
            />
          </div>
          {note.kind === "bookmark" ? (
            <blockquote className={note.colorStyle ? `bookmark-text-color-${note.colorStyle}` : undefined}>
              {note.content}
            </blockquote>
          ) : (
            <>
              {note.abstractText ? <blockquote className="review-abstract">{note.abstractText}</blockquote> : null}
              <p>{note.content}</p>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

const BOOKMARK_COLOR_OPTIONS: Array<{ value: BookmarkColorFilter; label: string }> = [
  { value: "all", label: "全部颜色" },
  { value: "1", label: "红" },
  { value: "2", label: "紫" },
  { value: "3", label: "蓝" },
  { value: "4", label: "绿" },
  { value: "5", label: "黄" },
];

function isBookmarkColorFilter(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function NoteMetaDetails({
  range,
  time,
}: {
  range?: string;
  time?: number;
}) {
  return (
    <span className="note-meta-details">
      {time ? <time>{formatDateTime(time)}</time> : null}
      {range ? <code>{range}</code> : null}
    </span>
  );
}

function buildChapterGroups(
  chapters: ChapterInfo[],
  bookmarks: Bookmark[],
  reviews: Review[],
): ChapterGroup[] {
  const chapterMap = new Map<number, string>();
  for (const chapter of chapters) {
    chapterMap.set(chapter.chapterUid, chapter.title);
  }

  const bookmarkByChapter = new Map<number, Bookmark[]>();
  for (const bookmark of bookmarks) {
    const uid = bookmark.chapterUid;
    if (!bookmarkByChapter.has(uid)) {
      bookmarkByChapter.set(uid, []);
    }
    bookmarkByChapter.get(uid)!.push(bookmark);
  }

  const reviewByChapterName = new Map<string, Review[]>();
  const unmatchedReviews: Review[] = [];
  for (const review of reviews) {
    if (review.chapterName) {
      if (!reviewByChapterName.has(review.chapterName)) {
        reviewByChapterName.set(review.chapterName, []);
      }
      reviewByChapterName.get(review.chapterName)!.push(review);
    } else {
      unmatchedReviews.push(review);
    }
  }

  const groups: ChapterGroup[] = [];

  for (const chapter of chapters) {
    const chapterBookmarks = bookmarkByChapter.get(chapter.chapterUid) ?? [];
    const chapterReviews = reviewByChapterName.get(chapter.title) ?? [];
    if (chapterBookmarks.length === 0 && chapterReviews.length === 0) continue;
    groups.push({
      chapterUid: chapter.chapterUid,
      title: chapter.title,
      bookmarks: chapterBookmarks,
      reviews: chapterReviews,
    });
  }

  const coveredChapterUids = new Set(chapters.map((c) => c.chapterUid));
  const coveredChapterTitles = new Set(chapters.map((c) => c.title));

  for (const [uid, chapterBookmarks] of bookmarkByChapter) {
    if (coveredChapterUids.has(uid)) continue;
    groups.push({
      chapterUid: uid,
      title: chapterBookmarks[0]?.chapterTitle || "未命名章节",
      bookmarks: chapterBookmarks,
      reviews: [],
    });
  }

  for (const [chapterName, chapterReviews] of reviewByChapterName) {
    if (coveredChapterTitles.has(chapterName)) continue;
    groups.push({
      chapterUid: 0,
      title: chapterName,
      bookmarks: [],
      reviews: chapterReviews,
    });
  }

  if (unmatchedReviews.length > 0) {
    groups.push({
      chapterUid: -1,
      title: "其他想法",
      bookmarks: [],
      reviews: unmatchedReviews,
    });
  }

  return groups;
}
