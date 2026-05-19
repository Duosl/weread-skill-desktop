import { useEffect } from "react";
import { BookOpen, Clock3, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Spinner } from "../components/ui/Spinner";
import { formatDate, formatDuration } from "../lib/format";
import type { useBookshelf } from "../hooks/useBookshelf";
import type { useReadingStats } from "../hooks/useReadingStats";

type DashboardPageProps = {
  shelf: ReturnType<typeof useBookshelf>;
  reading: ReturnType<typeof useReadingStats>;
  apiKeySet: boolean;
};

export function DashboardPage({ shelf, reading, apiKeySet }: DashboardPageProps) {
  useEffect(() => {
    if (apiKeySet && shelf.rawBooks.length === 0) {
      void shelf.syncShelf();
      void reading.loadStats();
    }
  }, [apiKeySet]);

  return (
    <PageShell
      title="书架"
      eyebrow="Library"
      action={
        <Button
          variant="primary"
          icon={<RefreshCw size={16} />}
          disabled={!apiKeySet || shelf.loading}
          onClick={() => {
            void shelf.syncShelf();
            void reading.loadStats();
          }}
        >
          同步
        </Button>
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
          <ErrorBanner message={shelf.error ?? reading.error} />
          <div className="stats-grid">
            <Card>
              <span className="metric-label">书架总数</span>
              <strong className="metric-value">{shelf.totalCount}</strong>
            </Card>
            <Card>
              <span className="metric-label">阅读天数</span>
              <strong className="metric-value">{reading.stats?.readDays ?? 0}</strong>
            </Card>
            <Card>
              <span className="metric-label">累计时长</span>
              <strong className="metric-value">
                {formatDuration(reading.stats?.totalReadTime ?? 0)}
              </strong>
            </Card>
            <Card>
              <span className="metric-label">日均阅读</span>
              <strong className="metric-value">
                {formatDuration(reading.stats?.dayAverageReadTime ?? 0)}
              </strong>
            </Card>
          </div>

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
                <Link className="book-card" to={`/notes/${book.bookId}`} key={book.bookId}>
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
                </Link>
              ))}
            </div>
          )}

          {reading.stats?.preferCategory?.length ? (
            <Card>
              <div className="section-title">
                <Clock3 size={20} />
                <div>
                  <h2>阅读偏好</h2>
                  <p>按阅读时长排序的分类倾向。</p>
                </div>
              </div>
              <div className="category-list">
                {reading.stats.preferCategory.slice(0, 5).map((item) => (
                  <div key={item.categoryTitle}>
                    <span>{item.categoryTitle}</span>
                    <strong>{formatDuration(item.readingTime)}</strong>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
