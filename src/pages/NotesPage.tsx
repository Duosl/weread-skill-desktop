import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MessageSquareQuote, Search } from "lucide-react";
import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { PageShell } from "../components/layout/PageShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Spinner } from "../components/ui/Spinner";
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
  const notebooks = useNotebooks();
  const notes = useNotes(selectedBookId);

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
    const colors = new Set<BookmarkColorFilter>();
    for (const bookmark of notes.bookmarks) {
      if (isBookmarkColorFilter(bookmark.colorStyle)) {
        colors.add(String(bookmark.colorStyle) as BookmarkColorFilter);
      }
    }
    return BOOKMARK_COLOR_OPTIONS.filter((option) => option.value === "all" || colors.has(option.value));
  }, [notes.bookmarks]);
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
    () =>
      notes.bookmarks.filter(
        (bookmark) =>
          noteType !== "reviews" &&
          (!isColorScoped || String(bookmark.colorStyle) === bookmarkColorFilter) &&
          (!normalizedQuery ||
            bookmark.markText.toLowerCase().includes(normalizedQuery) ||
            Boolean(bookmark.chapterTitle?.toLowerCase().includes(normalizedQuery))),
      ),
    [bookmarkColorFilter, isColorScoped, notes.bookmarks, normalizedQuery, noteType],
  );

  const filteredReviews = useMemo(
    () =>
      notes.reviews.filter(
        (review) =>
          noteType !== "bookmarks" &&
          (!normalizedQuery ||
            review.content.toLowerCase().includes(normalizedQuery) ||
            Boolean(review.abstractText?.toLowerCase().includes(normalizedQuery)) ||
            Boolean(review.chapterName?.toLowerCase().includes(normalizedQuery))),
      ),
    [notes.reviews, normalizedQuery, noteType],
  );

  const chapterGroups = useMemo(
    () => buildChapterGroups(notes.chapters, filteredBookmarks, filteredReviews),
    [notes.chapters, filteredBookmarks, filteredReviews],
  );

  const flatNotes = useMemo(
    () =>
      [
        ...filteredBookmarks.map((bookmark) => ({
          kind: "bookmark" as const,
          id: bookmark.bookmarkId,
          chapter: bookmark.chapterTitle || "未命名章节",
          chapterUid: bookmark.chapterUid,
          time: bookmark.createTime,
          content: bookmark.markText,
          range: bookmark.range,
          colorStyle: bookmark.colorStyle,
        })),
        ...filteredReviews.map((review) => ({
          kind: "review" as const,
          id: review.reviewId,
          chapter: review.chapterName || "想法",
          chapterUid: 0,
          time: review.createTime,
          content: review.content,
          abstractText: review.abstractText,
        })),
      ].sort((left, right) => right.time - left.time),
    [filteredBookmarks, filteredReviews],
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
      <ErrorBanner message={notebooks.error ?? notes.error ?? actionError} />
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
            <div className="notebook-scroll">
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
            {selectedBook ? (
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

          {!selectedBookId ? (
            <EmptyState title="选择一本书" description="从左侧笔记本选择后查看划线和想法。" />
          ) : notes.loading ? (
            <Card>
              <Spinner label="正在读取笔记" />
            </Card>
          ) : viewMode === "chapter" ? (
            <ChapterView groups={chapterGroups} />
          ) : (
            <TimelineView notes={flatNotes} />
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

function ChapterView({ groups }: { groups: ChapterGroup[] }) {
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

function TimelineView({ notes }: { notes: FlatNote[] }) {
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
