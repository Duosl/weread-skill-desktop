import { useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Toolbar } from "./components/layout/Toolbar";
import { DashboardPage } from "./pages/DashboardPage";
import { ExportPage } from "./pages/ExportPage";
import { NotesPage } from "./pages/NotesPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useBookshelf } from "./hooks/useBookshelf";
import { useNotebooks } from "./hooks/useNotebooks";
import { useReadingStats } from "./hooks/useReadingStats";
import { useSettings } from "./hooks/useSettings";
import "./index.css";

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const settings = useSettings();
  const shelf = useBookshelf();
  const reading = useReadingStats();
  const notebooks = useNotebooks();

  return (
    <HashRouter>
      <div className="app-shell">
        <Toolbar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        />
        <div className="app-body">
          {!sidebarCollapsed ? <Sidebar /> : null}
          <Routes>
            <Route
              path="/overview"
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
              path="/"
              element={
                <DashboardPage
                  apiKeySet={settings.settings.apiKeySet}
                  shelf={shelf}
                  reading={reading}
                />
              }
            />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/notes/:bookId" element={<NotesPage />} />
            <Route path="/export" element={<ExportPage settings={settings.settings} />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  settings={settings.settings}
                  error={settings.error}
                  onSaveApiKey={settings.saveApiKey}
                  onClearApiKey={settings.clearApiKey}
                  onSaveCacheSettings={settings.saveCacheSettings}
                />
              }
            />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
