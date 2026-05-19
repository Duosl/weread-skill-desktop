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
import { Spinner } from "../components/ui/Spinner";
import { useNotes } from "../hooks/useNotes";
import { useNotebooks } from "../hooks/useNotebooks";
import { formatDate, noteTotal } from "../lib/format";

export function NotesPage() {
  const params = useParams();
  const [selectedBookId, setSelectedBookId] = useState(params.bookId ?? "");
  const [query, setQuery] = useState("");
  const notebooks = useNotebooks();
  const notes = useNotes(selectedBookId);

  useEffect(() => {
    void notebooks.loadNotebooks();
  }, []);

  useEffect(() => {
    if (params.bookId) setSelectedBookId(params.bookId);
  }, [params.bookId]);

  useEffect(() => {
    if (selectedBookId) void notes.loadNotes(selectedBookId);
  }, [selectedBookId]);

  const selectedBook = notebooks.books.find((book) => book.bookId === selectedBookId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredBookmarks = useMemo(
    () =>
      notes.bookmarks.filter(
        (bookmark) =>
          !normalizedQuery ||
          bookmark.markText.toLowerCase().includes(normalizedQuery) ||
          bookmark.chapterTitle?.toLowerCase().includes(normalizedQuery),
      ),
    [notes.bookmarks, normalizedQuery],
  );
  const filteredReviews = useMemo(
    () =>
      notes.reviews.filter(
        (review) =>
          !normalizedQuery ||
          review.content.toLowerCase().includes(normalizedQuery) ||
          review.chapterName?.toLowerCase().includes(normalizedQuery),
      ),
    [notes.reviews, normalizedQuery],
  );

  function openInWeread() {
    if (!selectedBookId) return;
    void invoke("open_in_weread", { bookId: selectedBookId, chapterUid: null });
  }

  return (
    <PageShell
      title="笔记"
      eyebrow="Notes"
      action={
        <Button
          variant="secondary"
          icon={<ExternalLink size={16} />}
          disabled={!selectedBookId}
          onClick={openInWeread}
        >
          微信读书
        </Button>
      }
    >
      <ErrorBanner message={notebooks.error ?? notes.error} />
      <div className="notes-layout">
        <Card className="notebook-list">
          <div className="section-title">
            <MessageSquareQuote size={20} />
            <div>
              <h2>笔记本</h2>
              <p>{notebooks.books.length} 本有记录的书。</p>
            </div>
          </div>
          {notebooks.loading ? (
            <Spinner label="正在读取笔记本" />
          ) : notebooks.books.length === 0 ? (
            <EmptyState title="暂无笔记本" description="配置 API Key 后可读取笔记本列表。" />
          ) : (
            <div className="notebook-scroll">
              {notebooks.books.map((book) => (
                <button
                  key={book.bookId}
                  className={book.bookId === selectedBookId ? "notebook active" : "notebook"}
                  onClick={() => setSelectedBookId(book.bookId)}
                >
                  <span>{book.title}</span>
                  <small>{noteTotal(book)} 条</small>
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

          {!selectedBookId ? (
            <EmptyState title="选择一本书" description="从左侧笔记本选择后查看划线和想法。" />
          ) : notes.loading ? (
            <Card>
              <Spinner label="正在读取笔记" />
            </Card>
          ) : (
            <div className="note-stack">
              {filteredBookmarks.map((bookmark) => (
                <Card className="quote-card" key={bookmark.bookmarkId}>
                  <div className="note-meta">
                    <span>{bookmark.chapterTitle || "未命名章节"}</span>
                    <time>{formatDate(bookmark.createTime)}</time>
                  </div>
                  <blockquote>{bookmark.markText}</blockquote>
                </Card>
              ))}

              {filteredReviews.map((review) => (
                <Card className="review-card" key={review.reviewId}>
                  <div className="note-meta">
                    <span>{review.chapterName || "想法"}</span>
                    <time>{formatDate(review.createTime)}</time>
                  </div>
                  <p>{review.content}</p>
                </Card>
              ))}

              {filteredBookmarks.length === 0 && filteredReviews.length === 0 ? (
                <EmptyState title="没有匹配内容" description="换一个关键词，或选择其他笔记本。" />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
