import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BookOpen, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Spinner } from "../components/ui/Spinner";
import { formatDate, formatDuration, noteTotal } from "../lib/format";
import type { useBookshelf } from "../hooks/useBookshelf";
import { useNotebooks } from "../hooks/useNotebooks";
import type { useReadingStats } from "../hooks/useReadingStats";
import type { BookProgress, ShelfBook } from "../types";

type DashboardPageProps = {
  shelf: ReturnType<typeof useBookshelf>;
  reading: ReturnType<typeof useReadingStats>;
  apiKeySet: boolean;
};

export function DashboardPage({ shelf, reading, apiKeySet }: DashboardPageProps) {
  const notebooks = useNotebooks();
  const [selectedBook, setSelectedBook] = useState<ShelfBook | null>(null);
  const [bookProgress, setBookProgress] = useState<BookProgress | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (apiKeySet) {
      if (shelf.rawBooks.length === 0) void shelf.syncShelf();
      if (!reading.stats) void reading.loadStats();
      if (notebooks.books.length === 0) void notebooks.loadNotebooks();
    }
  }, [apiKeySet]);

  const notebookByBookId = useMemo(
    () => new Map(notebooks.books.map((book) => [book.bookId, book])),
    [notebooks.books],
  );

  async function openBookDetail(book: ShelfBook) {
    setSelectedBook(book);
    setBookProgress(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const progress = await invoke<BookProgress>("get_book_progress", { bookId: book.bookId });
      setBookProgress(progress);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }

  const selectedNotebook = selectedBook ? notebookByBookId.get(selectedBook.bookId) : undefined;

  return (
    <PageShell
      title={
        <>
          书架
          {shelf.totalCount > 0 ? <small className="page-title-count">{shelf.totalCount}本</small> : null}
        </>
      }
    >
      {!apiKeySet ? (
        <EmptyState
          title="先配置 API Key"
          description="完成连接后可以同步书架、笔记和阅读统计。"
          action={
            <Link to="/settings">
              <Button variant="primary">去设置</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ErrorBanner message={shelf.error} />
          <ErrorBanner message={notebooks.error} />
          <Card className="toolbar-card">
            <div className="search-box">
              <Search size={18} />
              <input
                value={shelf.query}
                onChange={(event) => shelf.setQuery(event.target.value)}
                placeholder="搜索书名或作者"
              />
            </div>
            <div className="segmented">
              {[
                ["all", "全部"],
                ["reading", "在读"],
                ["finished", "已读"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={shelf.filter === value ? "active" : ""}
                  onClick={() => shelf.setFilter(value as never)}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>

          {shelf.loading ? (
            <Card>
              <Spinner label="正在同步书架" />
            </Card>
          ) : shelf.books.length === 0 ? (
            <EmptyState title="暂无书籍" description="同步后会在这里显示已读和在读书籍。" />
          ) : (
            <div className="book-grid">
              {shelf.books.map((book) => (
                <button className="book-card" key={book.bookId} onClick={() => void openBookDetail(book)}>
                  <div className="cover">
                    {book.cover ? <img src={book.cover} alt="" /> : <BookOpen size={28} />}
                  </div>
                  <div className="book-meta">
                    <h2>{book.title}</h2>
                    <p>{book.author || "未知作者"}</p>
                    <div className="book-footer">
                      <Badge>{book.finishReading === 1 ? "已读" : "在读"}</Badge>
                      <span>{formatDate(book.updateTime || book.readUpdateTime)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedBook ? (
            <div className="detail-backdrop" onClick={() => setSelectedBook(null)}>
              <aside className="book-detail-panel" onClick={(event) => event.stopPropagation()}>
                <button className="detail-close" onClick={() => setSelectedBook(null)} aria-label="关闭">
                  <X size={18} />
                </button>
                <div className="detail-hero">
                  <div className="cover large">
                    {selectedBook.cover ? (
                      <img src={selectedBook.cover} alt="" />
                    ) : (
                      <BookOpen size={32} />
                    )}
                  </div>
                  <div>
                    <h2>{selectedBook.title}</h2>
                    <p>{selectedBook.author || "未知作者"}</p>
                    {selectedBook.category ? <Badge>{selectedBook.category}</Badge> : null}
                  </div>
                </div>

                {detailLoading ? <Spinner label="正在读取书籍信息" /> : null}
                <ErrorBanner message={detailError} />

                <div className="detail-metrics">
                  <div>
                    <span>划线</span>
                    <strong>{selectedNotebook?.noteCount ?? 0}</strong>
                  </div>
                  <div>
                    <span>想法</span>
                    <strong>{selectedNotebook?.reviewCount ?? 0}</strong>
                  </div>
                  <div>
                    <span>书签</span>
                    <strong>{selectedNotebook?.bookmarkCount ?? 0}</strong>
                  </div>
                  <div>
                    <span>总计</span>
                    <strong>{selectedNotebook ? noteTotal(selectedNotebook) : 0}</strong>
                  </div>
                </div>

                <div className="detail-progress">
                  <div>
                    <span>阅读进度</span>
                    <strong>{bookProgress?.progress ?? (selectedBook.finishReading === 1 ? 100 : 0)}%</strong>
                  </div>
                  <div>
                    <span>阅读时长</span>
                    <strong>{formatDuration(bookProgress?.recordReadingTime ?? 0)}</strong>
                  </div>
                  <div>
                    <span>最近阅读</span>
                    <strong>{formatDate(bookProgress?.updateTime || selectedBook.updateTime || selectedBook.readUpdateTime)}</strong>
                  </div>
                </div>

                <Link to={`/notes/${selectedBook.bookId}`} className="detail-action">
                  <Button variant="primary">查看笔记详情</Button>
                </Link>
              </aside>
            </div>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
