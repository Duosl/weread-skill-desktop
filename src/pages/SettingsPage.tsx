import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  MessageCircle,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import type { AppSettings } from "../types";
import type { UpdateState } from "../hooks/useUpdater";

const GITHUB_RELEASES_URL =
  "https://github.com/Duosl/weread-skill-desktop/releases/latest";

type SettingsPageProps = {
  settings: AppSettings;
  error: string | null;
  onSaveApiKey: (apiKey: string) => Promise<void>;
  onClearApiKey: () => Promise<void>;
  onSaveCacheSettings: (cacheTtlSeconds: number) => Promise<void>;
  updateState: UpdateState;
  onCheckUpdate: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
  onOpenCommunity: () => void;
  onOpenSupport: () => void;
};

export function SettingsPage({
  settings,
  error,
  onSaveApiKey,
  onClearApiKey,
  onSaveCacheSettings,
  updateState,
  onCheckUpdate,
  onDownloadUpdate,
  onInstallUpdate,
  onOpenCommunity,
  onOpenSupport,
}: SettingsPageProps) {
  const [tokenDraft, setTokenDraft] = useState(settings.apiKeyFull ?? "");
  const [showToken, setShowToken] = useState(false);
  const [cacheTtlSeconds, setCacheTtlSeconds] = useState(
    settings.cacheTtlSeconds
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2400);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setTokenDraft(settings.apiKeyFull ?? "");
  }, [settings.apiKeyFull]);

  useEffect(() => {
    invoke<string>("get_app_version")
      .then(setAppVersion)
      .catch(() => setAppVersion("0.1.0"));
  }, []);

  const cacheTtlOptions = [
    [30 * 60, "30分钟"],
    [60 * 60, "1小时"],
    [3 * 60 * 60, "3小时"],
    [6 * 60 * 60, "6小时"],
    [12 * 60 * 60, "12小时"],
    [24 * 60 * 60, "24小时"],
    [3 * 24 * 60 * 60, "3天"],
    [7 * 24 * 60 * 60, "7天"],
    [14 * 24 * 60 * 60, "2周"],
    [28 * 24 * 60 * 60, "4周"],
  ] as const;

  async function saveKey() {
    setSaving(true);
    setMessage(null);
    try {
      await onSaveApiKey(tokenDraft);
      setShowToken(false);
      setMessage("Token 已保存");
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

  function renderUpdateStatus() {
    switch (updateState.status) {
      case "idle":
        return <span className="update-pill neutral">待检查</span>;
      case "checking":
        return <span className="update-pill checking">检查中…</span>;
      case "downloading":
        return (
          <span className="update-pill checking">
            下载中 {updateState.progress ?? 0}%
          </span>
        );
      case "available":
        return (
          <span className="update-pill info">
            v{updateState.version} 可更新
          </span>
        );
      case "ready":
        return <span className="update-pill success">更新就绪</span>;
      case "uptodate":
        return <span className="update-pill success">已是最新</span>;
      case "error":
        return (
          <span className="update-pill error" title={updateState.error}>
            {updateState.errorTitle ?? "检查失败"}
          </span>
        );
    }
  }

  const signatureMismatch =
    updateState.status === "error" &&
    updateState.errorTitle === "签名密钥不匹配";

  async function openDownloadPage() {
    await openUrl(GITHUB_RELEASES_URL);
  }

  return (
    <PageShell title="设置">
      <div className="settings-page">
        <ErrorBanner message={error} />
        {message && <div className="settings-toast">{message}</div>}

        {/* ===== API Key ===== */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <KeyRound size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="settings-card-title">API 连接</h3>
              <p className="settings-card-desc">
                配置微信读书 Skill 的 API Token
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="settings-field">
              <div className="settings-field-label-row">
                <label className="settings-field-label">API Token</label>
                <span
                  className={`settings-status-badge ${
                    settings.apiKeySet ? "ok" : ""
                  }`}
                >
                  {settings.apiKeySet ? "已连接" : "未配置"}
                </span>
              </div>
              <div className="token-input-wrap">
                <input
                  className="settings-field-input"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="粘贴 API Token"
                  type={showToken ? "text" : "password"}
                  autoComplete="off"
                />
                {tokenDraft && (
                  <button
                    type="button"
                    className="token-toggle-btn"
                    onClick={() => setShowToken((prev) => !prev)}
                    tabIndex={-1}
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
              <div className="settings-field-actions">
                <Button
                  variant="primary"
                  size="small"
                  icon={<Save size={14} />}
                  disabled={saving || tokenDraft.trim().length < 8}
                  onClick={saveKey}
                >
                  保存
                </Button>
                {settings.apiKeySet && (
                  <Button
                    variant="danger"
                    size="small"
                    icon={<Trash2 size={14} />}
                    disabled={saving}
                    onClick={onClearApiKey}
                  >
                    清除
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ===== Cache ===== */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <Settings2 size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="settings-card-title">缓存设置</h3>
              <p className="settings-card-desc">
                控制本地数据自动刷新频率
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="settings-field">
              <label className="settings-field-label">自动刷新间隔</label>
              <p className="settings-field-hint">
                超过间隔后自动请求并覆盖本地缓存
              </p>
              <div className="settings-field-row">
                <div className="select-shell compact">
                  <select
                    value={cacheTtlSeconds}
                    onChange={(e) =>
                      setCacheTtlSeconds(Number(e.target.value))
                    }
                  >
                    {cacheTtlOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
                <Button
                  variant="primary"
                  size="small"
                  icon={<Save size={14} />}
                  disabled={saving}
                  onClick={saveCache}
                >
                  保存
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ===== About ===== */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <Heart size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="settings-card-title">关于</h3>
              <p className="settings-card-desc">
                版本信息、更新检查与支持
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="about-meta">
              <div className="about-meta-item">
                <span className="about-meta-label">应用名称</span>
                <span className="about-meta-value">微信读书 Skill 桌面客户端</span>
              </div>
              <div className="about-meta-item">
                <span className="about-meta-label">当前版本</span>
                <span className="about-meta-value">
                  v{appVersion || "—"}
                </span>
              </div>
              <div className="about-meta-item">
                <span className="about-meta-label">更新状态</span>
                <span className="about-meta-value">{renderUpdateStatus()}</span>
              </div>
            </div>

            <div className="about-actions-bar">
              {updateState.status !== "available" &&
                updateState.status !== "ready" && (
                  <button
                    className="about-action-btn"
                    onClick={onCheckUpdate}
                    disabled={
                      updateState.status === "checking" ||
                      updateState.status === "downloading"
                    }
                  >
                    <RefreshCw
                      size={14}
                      className={
                        updateState.status === "checking" ? "spin" : ""
                      }
                    />
                    <span>
                      {updateState.status === "checking"
                        ? "检查中"
                        : "检查更新"}
                    </span>
                  </button>
                )}
              {updateState.status === "available" && (
                <button
                  className="about-action-btn primary"
                  onClick={onDownloadUpdate}
                >
                  <Download size={14} />
                  <span>下载更新</span>
                </button>
              )}
              {updateState.status === "ready" && (
                <button
                  className="about-action-btn primary"
                  onClick={onInstallUpdate}
                >
                  <RefreshCw size={14} />
                  <span>重启更新</span>
                </button>
              )}
              {signatureMismatch && (
                <button
                  className="about-action-btn primary"
                  onClick={openDownloadPage}
                >
                  <Download size={14} />
                  <span>手动下载最新版</span>
                </button>
              )}
              <button className="about-action-btn community-action" onClick={onOpenCommunity}>
                <MessageCircle size={14} />
                <span>加交流群</span>
              </button>
              <button className="about-action-btn support-action" onClick={onOpenSupport}>
                <Heart size={14} />
                <span>打赏支持</span>
              </button>
            </div>
            {signatureMismatch && (
              <p className="update-manual-hint">
                当前版本无法校验自动更新签名，请前往 GitHub 下载并安装最新版本。
              </p>
            )}
          </div>
        </section>

      </div>
    </PageShell>
  );
}
