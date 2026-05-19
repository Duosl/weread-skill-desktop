import { useState } from "react";
import { KeyRound, Save, Trash2 } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Input } from "../components/ui/Input";
import type { AppSettings } from "../types";

type SettingsPageProps = {
  settings: AppSettings;
  error: string | null;
  onSaveApiKey: (apiKey: string) => Promise<void>;
  onClearApiKey: () => Promise<void>;
  onSaveExportSettings: (outputDir: string, defaultFormat: string) => Promise<void>;
};

export function SettingsPage({
  settings,
  error,
  onSaveApiKey,
  onClearApiKey,
  onSaveExportSettings,
}: SettingsPageProps) {
  const [apiKey, setApiKey] = useState("");
  const [outputDir, setOutputDir] = useState(settings.lastExportDir);
  const [defaultFormat, setDefaultFormat] = useState(settings.defaultFormat);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveKey() {
    setSaving(true);
    setMessage(null);
    try {
      await onSaveApiKey(apiKey);
      setApiKey("");
      setMessage("API Key 已保存");
    } finally {
      setSaving(false);
    }
  }

  async function saveExport() {
    setSaving(true);
    setMessage(null);
    try {
      await onSaveExportSettings(outputDir, defaultFormat);
      setMessage("导出偏好已保存");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell title="设置" eyebrow="Connection">
      <div className="settings-grid">
        <Card>
          <div className="section-title">
            <KeyRound size={20} />
            <div>
              <h2>API Key</h2>
              <p>用于访问 WeRead Skill Gateway，仅保存在本机配置文件。</p>
            </div>
          </div>
          <ErrorBanner message={error} />
          <Input
            label="当前状态"
            value={settings.apiKeySet ? settings.apiKeyMasked ?? "已保存" : "未配置"}
            readOnly
          />
          <Input
            label="新的 API Key"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="粘贴 Bearer Token"
            type="password"
            autoComplete="off"
          />
          <div className="button-row">
            <Button
              variant="primary"
              icon={<Save size={16} />}
              disabled={saving || apiKey.trim().length < 8}
              onClick={saveKey}
            >
              保存
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              disabled={saving || !settings.apiKeySet}
              onClick={onClearApiKey}
            >
              清除
            </Button>
          </div>
          {message ? <p className="success-text">{message}</p> : null}
        </Card>

        <Card>
          <div className="section-title">
            <Save size={20} />
            <div>
              <h2>导出偏好</h2>
              <p>用于默认填充导出中心，实际导出前仍可调整。</p>
            </div>
          </div>
          <Input
            label="默认导出目录"
            value={outputDir}
            onChange={(event) => setOutputDir(event.target.value)}
          />
          <label className="field">
            <span>默认格式</span>
            <select value={defaultFormat} onChange={(event) => setDefaultFormat(event.target.value)}>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <Button variant="primary" icon={<Save size={16} />} disabled={saving} onClick={saveExport}>
            保存偏好
          </Button>
        </Card>
      </div>
    </PageShell>
  );
}
