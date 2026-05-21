import { useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Toolbar } from "./components/layout/Toolbar";
import { CommunityDialog, SupportDialog } from "./components/RewardDialog";
import { DashboardPage } from "./pages/DashboardPage";
import { NotesWorkbenchPage } from "./pages/NotesWorkbenchPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReportPage } from "./pages/ReportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useBookshelf } from "./hooks/useBookshelf";
import { useNotebooks } from "./hooks/useNotebooks";
import { useReadingStats } from "./hooks/useReadingStats";
import { useSettings } from "./hooks/useSettings";
import { useUpdater } from "./hooks/useUpdater";
import "./index.css";

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCommunityDialog, setShowCommunityDialog] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const settings = useSettings();
  const shelf = useBookshelf();
  const reading = useReadingStats();
  const notebooks = useNotebooks();
  const { state: updateState, checkForUpdates, downloadUpdate, installUpdate } = useUpdater();

  return (
    <HashRouter>
      <div className="app-shell">
        <Toolbar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          updateReady={updateState.status === "ready"}
          onInstallUpdate={installUpdate}
        />
        <div className="app-body">
          {!sidebarCollapsed ? (
            <Sidebar
              onOpenCommunity={() => setShowCommunityDialog(true)}
              onOpenSupport={() => setShowSupportDialog(true)}
            />
          ) : null}
          <Routes>
            <Route
              path="/"
              element={
                <OverviewPage
                  apiKeySet={settings.settings.apiKeySet}
                  shelf={shelf}
                  reading={reading}
                  notebooks={notebooks}
                />
              }
            />
            <Route
              path="/shelf"
              element={
                <DashboardPage
                  apiKeySet={settings.settings.apiKeySet}
                  shelf={shelf}
                  reading={reading}
                />
              }
            />
            <Route path="/notes" element={<NotesWorkbenchPage settings={settings.settings} />} />
            <Route path="/notes/:bookId" element={<NotesWorkbenchPage settings={settings.settings} />} />
            <Route path="/export" element={<Navigate to="/notes?tab=export" replace />} />
            <Route
              path="/reports"
              element={
                <ReportPage apiKeySet={settings.settings.apiKeySet} />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  settings={settings.settings}
                  error={settings.error}
                  onSaveApiKey={settings.saveApiKey}
                  onClearApiKey={settings.clearApiKey}
                  onSaveCacheSettings={settings.saveCacheSettings}
                  updateState={updateState}
                  onCheckUpdate={() => checkForUpdates(false)}
                  onDownloadUpdate={downloadUpdate}
                  onInstallUpdate={installUpdate}
                  onOpenCommunity={() => setShowCommunityDialog(true)}
                  onOpenSupport={() => setShowSupportDialog(true)}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <CommunityDialog
          isOpen={showCommunityDialog}
          onClose={() => setShowCommunityDialog(false)}
        />
        <SupportDialog
          isOpen={showSupportDialog}
          onClose={() => setShowSupportDialog(false)}
        />
      </div>
    </HashRouter>
  );
}

export default App;
