import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileDown, MessageSquareQuote, Search } from "lucide-react";
import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { PageShell } from "../components/layout/PageShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Spinner } from "../components/ui/Spinner";
import { useNotes } from "../hooks/useNotes";
import { useNotebooks } from "../hooks/useNotebooks";
import { formatDate, noteTotal } from "../lib/format";
import type { Bookmark, ChapterInfo, Review } from "../types";

type NoteType = "all" | "bookmarks" | "reviews";
type ViewMode = "chapter" | "timeline";

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
};

type NotesPageProps = {
  embedded?: boolean;
  initialBookId?: string;
  onExportBook?: (bookId: string) => void;
};

export function NotesPage({ embedded = false, initialBookId, onExportBook }: NotesPageProps = {}) {
  const params = useParams();
  const [selectedBookId, setSelectedBookId] = useState(initialBookId ?? params.bookId ?? "");
  const [notebookQuery, setNotebookQuery] = useState("");
  const [query, setQuery] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("chapter");
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
    if (selectedBookId) void notes.loadNotes(selectedBookId);
  }, [selectedBookId]);

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

  const filteredBookmarks = useMemo(
    () =>
      notes.bookmarks.filter(
        (bookmark) =>
          noteType !== "reviews" &&
          (!normalizedQuery ||
            bookmark.markText.toLowerCase().includes(normalizedQuery) ||
            Boolean(bookmark.chapterTitle?.toLowerCase().includes(normalizedQuery))),
      ),
    [notes.bookmarks, normalizedQuery, noteType],
  );

  const filteredReviews = useMemo(
    () =>
      notes.reviews.filter(
        (review) =>
          noteType !== "bookmarks" &&
          (!normalizedQuery ||
            review.content.toLowerCase().includes(normalizedQuery) ||
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
        })),
        ...filteredReviews.map((review) => ({
          kind: "review" as const,
          id: review.reviewId,
          chapter: review.chapterName || "想法",
          chapterUid: 0,
          time: review.createTime,
          content: review.content,
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
      {embedded ? (
        <div className="workbench-section-header">
          <div>
            <h2>浏览笔记</h2>
            <p>查看单本书的划线与想法，需要导出时可直接切到导出区。</p>
          </div>
          <div className="workbench-actions">
            {onExportBook ? (
              <Button
                variant="secondary"
                icon={<FileDown size={16} />}
                disabled={!selectedBookId}
                onClick={() => onExportBook(selectedBookId)}
              >
                导出当前书
              </Button>
            ) : null}
            <Button
              variant="secondary"
              icon={<ExternalLink size={16} />}
              disabled={!selectedBookId}
              onClick={() => void openInWeread()}
            >
              微信读书
            </Button>
          </div>
        </div>
      ) : null}
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
            <div className="segmented">
              <button className={noteType === "all" ? "active" : ""} onClick={() => setNoteType("all")}>
                全部
              </button>
              <button
                className={noteType === "bookmarks" ? "active" : ""}
                onClick={() => setNoteType("bookmarks")}
              >
                划线
              </button>
              <button
                className={noteType === "reviews" ? "active" : ""}
                onClick={() => setNoteType("reviews")}
              >
                想法
              </button>
            </div>
            <div className="segmented">
              <button
                className={viewMode === "chapter" ? "active" : ""}
                onClick={() => setViewMode("chapter")}
              >
                按章节
              </button>
              <button
                className={viewMode === "timeline" ? "active" : ""}
                onClick={() => setViewMode("timeline")}
              >
                按时间
              </button>
            </div>
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
                <span>{formatDate(bookmark.createTime)}</span>
                {bookmark.range ? <code>{bookmark.range}</code> : null}
              </div>
              <blockquote>{bookmark.markText}</blockquote>
            </Card>
          ))}
          {group.reviews.map((review) => (
            <Card className="review-card" key={review.reviewId}>
              <div className="note-meta">
                <span>{formatDate(review.createTime)}</span>
              </div>
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
            <time>{formatDate(note.time)}</time>
          </div>
          {note.kind === "bookmark" ? <blockquote>{note.content}</blockquote> : <p>{note.content}</p>}
        </Card>
      ))}
    </div>
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
