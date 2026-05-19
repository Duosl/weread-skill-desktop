import { useState } from "react";
import { ChevronDown, Database, KeyRound, Save, Trash2 } from "lucide-react";
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
  onSaveCacheSettings: (cacheTtlSeconds: number) => Promise<void>;
};

export function SettingsPage({
  settings,
  error,
  onSaveApiKey,
  onClearApiKey,
  onSaveCacheSettings,
}: SettingsPageProps) {
  const [apiKey, setApiKey] = useState("");
  const [cacheTtlSeconds, setCacheTtlSeconds] = useState(settings.cacheTtlSeconds);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const cacheTtlOptions = [
    [30 * 60, "30分钟"],
    [60 * 60, "1小时"],
    [3 * 60 * 60, "3小时"],
    [6 * 60 * 60, "6小时"],
    [12 * 60 * 60, "12小时"],
    [24 * 60 * 60, "24小时（1天）"],
    [3 * 24 * 60 * 60, "3天"],
    [7 * 24 * 60 * 60, "7天（1周）"],
    [14 * 24 * 60 * 60, "2周"],
    [28 * 24 * 60 * 60, "4周"],
  ] as const;

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

  async function saveCache() {
    setSaving(true);
    setMessage(null);
    try {
      await onSaveCacheSettings(cacheTtlSeconds);
      setMessage("缓存刷新间隔已保存");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell title="设置">
      <div className="settings-stack">
        <Card className="settings-panel">
          <div className="settings-panel-aside">
            <div className="settings-icon">
              <KeyRound size={20} />
            </div>
            <h2>API Key</h2>
            <p>连接微信读书 Skill Gateway。密钥只保存在本机配置文件。</p>
            <span className={settings.apiKeySet ? "settings-status ok" : "settings-status"}>
              {settings.apiKeySet ? "已连接" : "未配置"}
            </span>
          </div>

          <div className="settings-panel-main">
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
          </div>
        </Card>

        <Card className="settings-panel">
          <div className="settings-panel-aside">
            <div className="settings-icon">
              <Database size={20} />
            </div>
            <h2>缓存刷新</h2>
            <p>超过间隔后自动请求微信读书并覆盖本地缓存；同步按钮始终强制刷新。</p>
            <span className="settings-status ok">当前 {cacheTtlOptions.find(([value]) => value === settings.cacheTtlSeconds)?.[1] ?? "自定义"}</span>
          </div>

          <div className="settings-panel-main">
            <label className="settings-label" htmlFor="cache-ttl">
              自动刷新间隔
            </label>
            <div className="select-shell">
              <select
                id="cache-ttl"
                value={cacheTtlSeconds}
                onChange={(event) => setCacheTtlSeconds(Number(event.target.value))}
              >
                {cacheTtlOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
            <div className="button-row">
              <Button variant="primary" icon={<Save size={16} />} disabled={saving} onClick={saveCache}>
                保存间隔
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
