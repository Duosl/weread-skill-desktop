import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { FileDown, MessageSquareQuote } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { ExportPage } from "./ExportPage";
import { NotesPage } from "./NotesPage";
import type { AppSettings } from "../types";

type WorkbenchTab = "browse" | "export";

type NotesWorkbenchPageProps = {
  settings: AppSettings;
};

export function NotesWorkbenchPage({ settings }: NotesWorkbenchPageProps) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: WorkbenchTab = rawTab === "export" ? "export" : "browse";
  const exportBookId = searchParams.get("bookId");
  const routeBookId = params.bookId ?? "";
  const [selectedBookId, setSelectedBookId] = useState(routeBookId);
  const [exportAction, setExportAction] = useState<ReactNode>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tabs = useMemo(
    () => [
      { id: "browse" as const, label: "浏览", icon: MessageSquareQuote },
      { id: "export" as const, label: "导出", icon: FileDown },
    ],
    [],
  );

  function setTab(tab: WorkbenchTab, bookId?: string) {
    setActionError(null);
    const next = new URLSearchParams(searchParams);
    if (tab === "browse") {
      next.delete("tab");
      next.delete("bookId");
    } else {
      next.set("tab", "export");
      if (bookId) next.set("bookId", bookId);
    }
    setSearchParams(next, { replace: false });
  }

  function exportCurrentBook(bookId?: string) {
    setTab("export", bookId);
  }

  useEffect(() => {
    setSelectedBookId(routeBookId);
  }, [routeBookId]);

  if (rawTab && rawTab !== "export" && rawTab !== "browse") {
    return <Navigate to="/notes" replace />;
  }

  return (
    <PageShell
      title="划线与想法"
      subtitle="查看单本书的划线与想法，需要导出时可直接切到导出区。"
      titleAccessory={
        <SegmentedControl
          ariaLabel="划线与想法"
          value={activeTab}
          onChange={setTab}
          options={tabs.map(({ id, label, icon: Icon }) => ({
            value: id,
            label,
            icon: <Icon size={16} />,
          }))}
        />
      }
      actions={
        activeTab === "browse" ? (
          <div className="workbench-actions">
            <Button
              variant="secondary"
              icon={<FileDown size={16} />}
              onClick={() => exportCurrentBook(selectedBookId || undefined)}
            >
              {selectedBookId ? "导出当前书" : "导出全部笔记"}
            </Button>
          </div>
        ) : exportAction
      }
    >
      <ErrorBanner message={actionError} />
      {activeTab === "browse" ? (
        <NotesPage
          embedded
          initialBookId={routeBookId}
          onSelectedBookChange={setSelectedBookId}
        />
      ) : (
        <ExportPage
          embedded
          settings={settings}
          initialSelectedBookId={exportBookId}
          onHeaderActionChange={setExportAction}
        />
      )}
    </PageShell>
  );
}
