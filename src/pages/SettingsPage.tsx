import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  Heart,
  KeyRound,
  MessageCircle,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import type { AppSettings, LlmTestResult } from "../types";
import type { UpdateState } from "../hooks/useUpdater";

const GITHUB_RELEASES_URL =
  "https://github.com/Duosl/weread-skill-desktop/releases/latest";
const WEREAD_SKILL_SETUP_URL = "https://weread.qq.com/r/weread-skills#setup";

type SettingsPageProps = {
  settings: AppSettings;
  error: string | null;
  onSaveApiKey: (apiKey: string) => Promise<void>;
  onClearApiKey: () => Promise<void>;
  onSaveCacheSettings: (cacheTtlSeconds: number) => Promise<void>;
  onSaveLlmConfig: (baseUrl: string, apiKey: string, model: string) => Promise<void>;
  onClearLlmConfig: () => Promise<void>;
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
  onSaveLlmConfig,
  onClearLlmConfig,
  updateState,
  onCheckUpdate,
  onDownloadUpdate,
  onInstallUpdate,
  onOpenCommunity,
  onOpenSupport,
}: SettingsPageProps) {
  const [tokenDraft, setTokenDraft] = useState(settings.apiKeyFull ?? "");
  const [showToken, setShowToken] = useState(false);
  const [tokenGuideExpanded, setTokenGuideExpanded] = useState(
    !settings.apiKeySet
  );
  const [cacheTtlSeconds, setCacheTtlSeconds] = useState(
    settings.cacheTtlSeconds
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");

  // LLM config state
  const [llmBaseUrl, setLlmBaseUrl] = useState(settings.llmBaseUrl ?? "");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState(settings.llmModel ?? "");
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<LlmTestResult | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2400);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setTokenDraft(settings.apiKeyFull ?? "");
  }, [settings.apiKeyFull]);

  useEffect(() => {
    if (!settings.apiKeySet) {
      setTokenGuideExpanded(true);
    }
  }, [settings.apiKeySet]);

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
      setTokenGuideExpanded(false);
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

  async function saveLlmConfig() {
    setSaving(true);
    setMessage(null);
    setLlmTestResult(null);
    try {
      await onSaveLlmConfig(llmBaseUrl, llmApiKey, llmModel);
      setShowLlmApiKey(false);
      setLlmApiKey("");
      setMessage("AI 服务配置已保存");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function autoSaveLlmConfig() {
    if (!llmBaseUrl.trim() || !llmModel.trim()) return;
    // 已配置过 LLM 但 API Key 字段为空时，不要自动保存（会误清 Key）
    if (!llmApiKey.trim()) return;
    try {
      await onSaveLlmConfig(llmBaseUrl, llmApiKey, llmModel);
    } catch {
      // silent fail for auto-save
    }
  }

  async function clearLlmConfig() {
    setSaving(true);
    setMessage(null);
    try {
      await onClearLlmConfig();
      setLlmBaseUrl("");
      setLlmApiKey("");
      setLlmModel("");
      setLlmTestResult(null);
      setMessage("AI 服务配置已清除");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function testLlmConnection() {
    setLlmTesting(true);
    setLlmTestResult(null);
    try {
      // 先保存再测试
      if (llmBaseUrl.trim() && llmModel.trim() && (llmApiKey.trim() || settings.llmConfigured)) {
        await onSaveLlmConfig(llmBaseUrl, llmApiKey, llmModel);
      }
      const result = await invoke<LlmTestResult>("test_llm_connection");
      setLlmTestResult(result);
    } catch (e) {
      setLlmTestResult({ ok: false, message: String(e) });
    } finally {
      setLlmTesting(false);
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
            {updateState.errorTitle ?? "检查失败，请稍后再试"}
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

  async function openWereadSkillSetup() {
    await openUrl(WEREAD_SKILL_SETUP_URL);
  }

  return (
    <PageShell title="设置" className="settings-shell">
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

              <div className="api-token-guide">
                <div className="api-token-guide-header">
                  <button
                    type="button"
                    className="api-token-guide-toggle"
                    aria-expanded={tokenGuideExpanded}
                    onClick={() => setTokenGuideExpanded((prev) => !prev)}
                  >
                    <span>
                      <span className="api-token-guide-title">
                        如何获取 API Token
                      </span>
                      <span className="api-token-guide-desc">
                        参考微信读书官方 Skill 配置页的授权流程复制 API Key。
                      </span>
                    </span>
                  </button>
                  <div className="api-token-guide-actions">
                    {tokenGuideExpanded && (
                      <Button
                        variant="secondary"
                        size="small"
                        icon={<ExternalLink size={14} />}
                        onClick={openWereadSkillSetup}
                      >
                        去获取
                      </Button>
                    )}
                    <button
                      type="button"
                      className="api-token-guide-collapse"
                      aria-label={
                        tokenGuideExpanded ? "收起获取说明" : "展开获取说明"
                      }
                      aria-expanded={tokenGuideExpanded}
                      onClick={() => setTokenGuideExpanded((prev) => !prev)}
                    >
                      <ChevronDown
                        className="api-token-guide-chevron"
                        size={16}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
                {tokenGuideExpanded && (
                  <>
                    <ol className="api-token-steps">
                      <li>点击右侧「去获取」按钮，打开微信读书官方 Skill 页面。</li>
                      <li>按页面提示登录并完成授权，复制 API Key。</li>
                      <li>回到这里粘贴 API Token，然后点击「保存」。</li>
                    </ol>
                    <p className="api-token-guide-note">
                      Token 不会离开你的电脑，用于读取你的书架、笔记和阅读统计。
                    </p>
                  </>
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

        {/* ===== AI Service ===== */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <Sparkles size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="settings-card-title">AI 服务配置</h3>
              <p className="settings-card-desc">
                配置你自己的 OpenAI 兼容 AI 服务，用于 AI 对话和报告生成
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="settings-field">
              <div className="settings-field-label-row">
                <label className="settings-field-label">Base URL</label>
                <span
                  className={`settings-status-badge ${
                    settings.llmConfigured ? "ok" : ""
                  }`}
                >
                  {settings.llmConfigured ? "已配置" : "未配置"}
                </span>
              </div>
              <input
                className="settings-field-input"
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
                onBlur={autoSaveLlmConfig}
                placeholder="https://api.openai.com/v1"
                autoComplete="off"
              />
            </div>

            <div className="settings-field">
              <label className="settings-field-label">API Key</label>
              <div className="token-input-wrap">
                <input
                  className="settings-field-input"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  onBlur={autoSaveLlmConfig}
                  placeholder={settings.llmConfigured ? "已保存，留空则不更新" : "输入 API Key"}
                  type={showLlmApiKey ? "text" : "password"}
                  autoComplete="off"
                />
                {llmApiKey && (
                  <button
                    type="button"
                    className="token-toggle-btn"
                    onClick={() => setShowLlmApiKey((prev) => !prev)}
                    tabIndex={-1}
                  >
                    {showLlmApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-field-label">模型名称</label>
              <input
                className="settings-field-input"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                onBlur={autoSaveLlmConfig}
                placeholder="gpt-4o"
                autoComplete="off"
              />
            </div>

            <div className="settings-field-actions">
              <Button
                variant="primary"
                size="small"
                icon={<Save size={14} />}
                disabled={
                  saving ||
                  !llmBaseUrl.trim() ||
                  (!settings.llmConfigured && !llmApiKey.trim()) ||
                  !llmModel.trim()
                }
                onClick={saveLlmConfig}
              >
                保存
              </Button>
              {settings.llmConfigured && (
                <Button
                  variant="secondary"
                  size="small"
                  icon={<Zap size={14} />}
                  disabled={llmTesting}
                  onClick={testLlmConnection}
                >
                  {llmTesting ? "测试中…" : "测试连接"}
                </Button>
              )}
              {settings.llmConfigured && (
                <Button
                  variant="danger"
                  size="small"
                  icon={<Trash2 size={14} />}
                  disabled={saving}
                  onClick={clearLlmConfig}
                >
                  清除
                </Button>
              )}
            </div>

            {llmTestResult && (
              <div
                className={`settings-field-hint ${
                  llmTestResult.ok ? "is-success" : "is-error"
                }`}
                style={{
                  color: llmTestResult.ok
                    ? "var(--color-success, #22c55e)"
                    : "var(--color-danger, #ef4444)",
                  marginTop: "8px",
                }}
              >
                {llmTestResult.message}
              </div>
            )}

            <div
              className="api-token-guide"
              style={{ marginTop: "12px" }}
            >
              <p
                className="api-token-guide-note"
                style={{ marginBottom: 0 }}
              >
                <strong>数据边界说明</strong>
                <br />
                书迹不提供内置模型。只有当你授权 AI 分析相关内容时，相关划线或想法才会发送到你配置的
                AI 服务用于分析，不会发送到书迹服务器。
                <br />
                · 书架、阅读统计等概览信息会用于回答你的问题
                <br />
                · 划线和个人想法属于你的私人阅读内容，读取前会尽量说明用途
                <br />
                · 请确保你信任所配置的 AI 服务
              </p>
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
                <span className="about-meta-value">书迹</span>
              </div>
              <div className="about-meta-item about-meta-item--slogan">
                <span className="about-meta-label">产品标语</span>
                <span className="about-meta-value about-meta-value--slogan">
                  把微信读书笔记整理成
                  <br />
                  <b>可归档、可复盘、可分享</b>的阅读资产
                </span>
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
                  <Button
                    variant="secondary"
                    size="small"
                    icon={
                      <RefreshCw
                        size={14}
                        className={
                          updateState.status === "checking" ? "spin" : ""
                        }
                      />
                    }
                    onClick={onCheckUpdate}
                    disabled={
                      updateState.status === "checking" ||
                      updateState.status === "downloading"
                    }
                  >
                    {updateState.status === "checking"
                      ? "检查中"
                      : "检查更新"}
                  </Button>
                )}
              {updateState.status === "available" && (
                <Button
                  variant="primary"
                  size="small"
                  icon={<Download size={14} />}
                  onClick={onDownloadUpdate}
                >
                  下载更新
                </Button>
              )}
              {updateState.status === "ready" && (
                <Button
                  variant="primary"
                  size="small"
                  icon={<RefreshCw size={14} />}
                  onClick={onInstallUpdate}
                >
                  重启更新
                </Button>
              )}
              {signatureMismatch && (
                <Button
                  variant="primary"
                  size="small"
                  icon={<Download size={14} />}
                  onClick={openDownloadPage}
                >
                  手动下载最新版
                </Button>
              )}
              <Button
                className="community-action"
                variant="secondary"
                size="small"
                icon={<MessageCircle size={14} />}
                onClick={onOpenCommunity}
              >
                加交流群
              </Button>
              <Button
                className="support-action"
                variant="secondary"
                size="small"
                icon={<Heart size={14} />}
                onClick={onOpenSupport}
              >
                打赏支持
              </Button>
            </div>
            {signatureMismatch && (
              <p className="update-manual-hint">
                当前版本无法校验自动更新签名，请前往 GitHub 下载并安装最新版本。
              </p>
            )}
            <p className="about-privacy-note">
              应用会发送匿名版本统计，用于了解安装量和系统分布；不会上传 API Key、书籍、划线、笔记或导出文件。
            </p>
          </div>
        </section>

      </div>
    </PageShell>
  );
}
