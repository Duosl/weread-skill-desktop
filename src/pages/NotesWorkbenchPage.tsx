import { useMemo } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { FileDown, MessageSquareQuote } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
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

  const tabs = useMemo(
    () => [
      { id: "browse" as const, label: "浏览", icon: MessageSquareQuote },
      { id: "export" as const, label: "导出", icon: FileDown },
    ],
    [],
  );

  function setTab(tab: WorkbenchTab, bookId?: string) {
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

  function exportCurrentBook(bookId: string) {
    setTab("export", bookId);
  }

  if (rawTab && rawTab !== "export" && rawTab !== "browse") {
    return <Navigate to="/notes" replace />;
  }

  return (
    <PageShell
      title="笔记"
      action={
        <div className="workbench-tabs" role="tablist" aria-label="笔记工作台">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activeTab === id ? "active" : ""}
              onClick={() => setTab(id)}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      }
    >
      {activeTab === "browse" ? (
        <NotesPage
          embedded
          initialBookId={routeBookId}
          onExportBook={exportCurrentBook}
        />
      ) : (
        <ExportPage
          embedded
          settings={settings}
          initialSelectedBookId={exportBookId}
        />
      )}
    </PageShell>
  );
}
