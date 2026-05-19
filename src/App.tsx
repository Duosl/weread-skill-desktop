import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { ExportPage } from "./pages/ExportPage";
import { NotesPage } from "./pages/NotesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useBookshelf } from "./hooks/useBookshelf";
import { useReadingStats } from "./hooks/useReadingStats";
import { useSettings } from "./hooks/useSettings";
import "./index.css";

function App() {
  const settings = useSettings();
  const shelf = useBookshelf();
  const reading = useReadingStats();

  return (
    <HashRouter>
      <div className="app-shell">
        <Sidebar />
        <Routes>
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
                onSaveExportSettings={settings.saveExportSettings}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
