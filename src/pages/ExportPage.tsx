import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FileDown, FolderOpen } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Spinner } from "../components/ui/Spinner";
import { useExport } from "../hooks/useExport";
import { useNotebooks } from "../hooks/useNotebooks";
import { buildMarkdownPreview } from "../lib/preview/exportPreview";
import { noteTotal } from "../lib/format";
import type { AppSettings, BookmarkListResult, BookInfo, BookProgress, ExportOptions, ReviewListResult } from "../types";

type ExportPageProps = {
  settings: AppSettings;
};

export function ExportPage({ settings }: ExportPageProps) {
  const notebooks = useNotebooks();
  const exporter = useExport();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState(settings.lastExportDir);
  const [includeBookmarks, setIncludeBookmarks] = useState(true);
  const [includeReviews, setIncludeReviews] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    void notebooks.loadNotebooks();
  }, []);

  const selectedBooks = useMemo(
    () => notebooks.books.filter((book) => selectedIds.includes(book.bookId)),
    [notebooks.books, selectedIds],
  );

  const previewBook = selectedBooks.length === 1 ? selectedBooks[0] : null;

  const loadPreview = useCallback(async () => {
    if (!previewBook) {
      setPreviewContent(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const [bookmarkResult, reviewResult, progress, bookInfo] = await Promise.all([
        invoke<BookmarkListResult>("get_bookmarks", { bookId: previewBook.bookId }),
        invoke<ReviewListResult>("get_my_reviews", {
          bookId: previewBook.bookId,
          synckey: 0,
          count: 100,
        }),
        invoke<BookProgress>("get_book_progress", { bookId: previewBook.bookId }).catch(() => null),
        invoke<BookInfo>("get_book_info", { bookId: previewBook.bookId }).catch(() => null),
      ]);
      const markdown = buildMarkdownPreview(
        previewBook,
        bookmarkResult.bookmarks ?? [],
        reviewResult.reviews ?? [],
        bookmarkResult.chapters ?? [],
        progress,
        bookInfo?.isbn,
      );
      setPreviewContent(markdown);
    } catch {
      setPreviewContent(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewBook]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const allSelected = notebooks.books.length > 0 && selectedIds.length === notebooks.books.length;

  function toggleBook(bookId: string) {
    setSelectedIds((current) =>
      current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId],
    );
  }

  function toggleAll() {
    setSelectedIds((current) =>
      current.length === notebooks.books.length ? [] : notebooks.books.map((book) => book.bookId),
    );
  }

  async function chooseFolder() {
    const selected = await open({ directory: true, multiple: false, defaultPath: outputDir });
    if (typeof selected === "string") setOutputDir(selected);
  }

  async function runExport() {
    const options: ExportOptions = {
      bookIds: selectedIds,
      format: "markdown",
      outputDir,
      includeBookmarks,
      includeReviews,
      groupByChapter: true,
    };
    await exporter.runExport(options);
  }

  return (
    <PageShell
      title="导出"
      action={
        <Button
          variant="primary"
          icon={<FileDown size={16} />}
          disabled={selectedIds.length === 0 || !outputDir || exporter.loading}
          onClick={() => void runExport()}
        >
          导出
        </Button>
      }
    >
      <ErrorBanner message={notebooks.error ?? exporter.error} />
      <div className="export-layout">
        <Card className="export-picker">
          <div className="section-title">
            <div>
              <h2>选择导出范围</h2>
              <p>仅导出包含划线或想法的笔记本。</p>
            </div>
          </div>
          <div className="export-select-all">
            <label className="check-row compact">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={notebooks.books.length === 0}
                onChange={toggleAll}
              />
              <span>全选</span>
            </label>
            <small>{selectedIds.length} / {notebooks.books.length}</small>
          </div>
          {notebooks.loading ? (
            <Spinner label="正在读取笔记本" />
          ) : notebooks.books.length === 0 ? (
            <EmptyState title="暂无可导出书籍" description="先在设置中连接 API Key。" />
          ) : (
            <div className="export-books">
              {notebooks.books.map((book) => (
                <label key={book.bookId} className="check-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(book.bookId)}
                    onChange={() => toggleBook(book.bookId)}
                  />
                  <span>
                    <strong>{book.title}</strong>
                    <small>
                      {book.author || "未知作者"} · {noteTotal(book)} 条
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Card>

        <div className="export-settings">
          <Card>
            <div className="section-title">
              <FileDown size={20} />
              <div>
                <h2>导出选项</h2>
                <p>导出为 Markdown 格式，适合阅读归档。</p>
              </div>
            </div>
            <label className="check-row compact">
              <input
                type="checkbox"
                checked={includeBookmarks}
                onChange={(event) => setIncludeBookmarks(event.target.checked)}
              />
              <span>包含划线</span>
            </label>
            <label className="check-row compact">
              <input
                type="checkbox"
                checked={includeReviews}
                onChange={(event) => setIncludeReviews(event.target.checked)}
              />
              <span>包含想法</span>
            </label>
            <div className="folder-row">
              <input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
              <Button variant="secondary" icon={<FolderOpen size={16} />} onClick={() => void chooseFolder()}>
                浏览
              </Button>
              <Button variant="secondary" disabled={!outputDir} onClick={() => void exporter.openExportFolder(outputDir)}>
                打开目录
              </Button>
            </div>
          </Card>

          <Card className="preview-card">
            <div className="preview-header">
              <h2>预览</h2>
              {selectedBooks.length > 1 ? (
                <small className="preview-hint">选中 {selectedBooks.length} 本书，选择单本可预览内容</small>
              ) : null}
            </div>
            {previewLoading ? (
              <div className="preview-loading">
                <Spinner label="正在加载预览" />
              </div>
            ) : previewContent ? (
              <pre>{previewContent}</pre>
            ) : (
              <div className="preview-empty">选择一本书以预览导出内容</div>
            )}
          </Card>

          {exporter.loading && exporter.progress ? (
            <Card className="progress-card">
              <div className="progress-header">
                <span className="progress-label">
                  正在导出 ({exporter.progress.current}/{exporter.progress.total})
                </span>
                <span className="progress-title">{exporter.progress.title}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${(exporter.progress.current / exporter.progress.total) * 100}%` }}
                />
              </div>
            </Card>
          ) : exporter.loading ? (
            <Card>
              <Spinner label="正在导出" />
            </Card>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
