import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BookOpen, LayoutGrid, LayoutList, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { IconButton } from "../components/ui/IconButton";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Spinner } from "../components/ui/Spinner";
import { formatDate, formatDuration, noteTotal } from "../lib/format";
import { getShelfReadingStatus } from "../hooks/useBookshelf";
import type { useBookshelf } from "../hooks/useBookshelf";
import { useNotebooks } from "../hooks/useNotebooks";
import type { useReadingStats } from "../hooks/useReadingStats";
import type { BookProgress, ShelfBook } from "../types";

type BookshelfView = "list" | "cover";

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
  const [bookshelfView, setBookshelfView] = useState<BookshelfView>("list");

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
  const selectedBookStatus = selectedBook ? getShelfReadingStatus(selectedBook) : null;
  const shelfToolbar = apiKeySet ? (
    <Card className="toolbar-card bookshelf-toolbar">
      <div className="toolbar-main-row">
        <div className="search-box">
          <Search size={18} />
          <input
            value={shelf.query}
            onChange={(event) => shelf.setQuery(event.target.value)}
            placeholder="搜索书名或作者"
          />
        </div>
        <div className="view-toggle">
          <IconButton
            aria-label="列表视图"
            icon={<LayoutList size={18} />}
            variant={bookshelfView === "list" ? "primary" : "neutral"}
            onClick={() => setBookshelfView("list")}
          />
          <IconButton
            aria-label="封面墙视图"
            icon={<LayoutGrid size={18} />}
            variant={bookshelfView === "cover" ? "primary" : "neutral"}
            onClick={() => setBookshelfView("cover")}
          />
        </div>
        <SegmentedControl
          ariaLabel="书架阅读状态"
          value={shelf.filter}
          onChange={(value) => shelf.setFilter(value)}
          options={[
            { value: "all", label: "全部" },
            { value: "finished", label: "已读完" },
          ]}
        />
      </div>
      {shelf.categories.length > 0 ? (
        <div className="category-filter-row" aria-label="类别筛选">
          <button
            type="button"
            className={shelf.categoryFilter === "all" ? "active" : ""}
            onClick={() => shelf.setCategoryFilter("all")}
          >
            全部类别
          </button>
          {shelf.categories.map((category) => (
            <button
              type="button"
              key={category}
              className={shelf.categoryFilter === category ? "active" : ""}
              onClick={() => shelf.setCategoryFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  ) : null;

  return (
    <PageShell
      title={
        <>
          我的书架
          {shelf.totalCount > 0 ? <small className="page-title-count">{shelf.totalCount}本</small> : null}
        </>
      }
      toolbar={shelfToolbar}
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
          {shelf.loading ? (
            <Card>
              <Spinner label="正在同步书架" />
            </Card>
          ) : shelf.books.length === 0 ? (
            <EmptyState title="暂无书籍" description="同步后会在这里显示书架书籍。" />
          ) : (
            <div className={bookshelfView === "cover" ? "cover-wall-grid" : "book-grid"}>
              {shelf.books.map((book) => {
                const status = getShelfReadingStatus(book);
                return bookshelfView === "cover" ? (
                  <button
                    type="button"
                    className="cover-wall-item"
                    key={book.bookId}
                    onClick={() => void openBookDetail(book)}
                    title={`${book.title}${book.author ? ` - ${book.author}` : ""}`}
                  >
                    <div className="cover-wall-cover">
                      {book.cover ? <img src={book.cover} alt="" /> : <BookOpen size={28} />}
                    </div>
                    <div className="cover-wall-overlay">
                      <span className="cover-wall-title">{book.title}</span>
                      {book.author ? <span className="cover-wall-author">{book.author}</span> : null}
                      {status === "finished" ? <Badge>读完</Badge> : null}
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="book-card"
                    key={book.bookId}
                    onClick={() => void openBookDetail(book)}
                  >
                    <div className="cover">
                      {book.cover ? <img src={book.cover} alt="" /> : <BookOpen size={28} />}
                    </div>
                    <div className="book-meta">
                      <h2>{book.title}</h2>
                      <p>{book.author || "未知作者"}</p>
                      <span className="book-category">{book.category.trim() || "未分类"}</span>
                      <div className="book-footer">
                        {status === "finished" ? <Badge>读完</Badge> : null}
                        <span>{formatDate(book.readUpdateTime || book.updateTime)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedBook ? (
            <div className="detail-backdrop" onClick={() => setSelectedBook(null)}>
              <aside className="book-detail-panel" onClick={(event) => event.stopPropagation()}>
                <IconButton
                  className="detail-close"
                  icon={<X size={18} />}
                  onClick={() => setSelectedBook(null)}
                  aria-label="关闭书籍详情"
                />
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
                    {selectedBookStatus === "finished" ? <Badge>读完</Badge> : null}
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
                    <strong>{bookProgress?.progress ?? (selectedBookStatus === "finished" ? 100 : 0)}%</strong>
                  </div>
                  <div>
                    <span>阅读时长</span>
                    <strong>{formatDuration(bookProgress?.recordReadingTime ?? 0)}</strong>
                  </div>
                  <div>
                    <span>最近阅读</span>
                    <strong>{formatDate(bookProgress?.updateTime || selectedBook.readUpdateTime || selectedBook.updateTime)}</strong>
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
