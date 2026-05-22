import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Spinner } from "@/components/ui/Spinner";
import { useImaConnector } from "@/hooks/useImaConnector";
import type { AppSettings, ImaKnowledgeBaseOption } from "@/types";

type ConnectorsPageProps = {
  settings: AppSettings;
  onSaveImaCredentials: (clientId: string, apiKey: string) => Promise<void>;
  onClearImaCredentials: () => Promise<void>;
  onSaveImaTarget: (
    knowledgeBaseId: string,
    knowledgeBaseName: string,
  ) => Promise<void>;
};

export function ConnectorsPage({
  settings,
  onSaveImaCredentials,
  onClearImaCredentials,
  onSaveImaTarget,
}: ConnectorsPageProps) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const configured = settings.imaClientIdSet && settings.imaApiKeySet;
  const syncReady = configured && Boolean(settings.imaKnowledgeBaseId);
  const targetName = settings.imaKnowledgeBaseName;

  return (
    <PageShell title="连接器" className="connectors-shell">
      <div className="connectors-page">
        <div className="connector-grid">
          <Card className="connector-card">
            <div className="connector-card-header">
              <div className="connector-icon">
                <Database size={22} strokeWidth={1.8} />
              </div>
              <div>
                <h2>ima 知识库</h2>
                <p>把微信读书划线和个人想法导入到你选择的 ima 知识库。</p>
              </div>
            </div>

            <div className="connector-status-row">
              <span className={`connector-status ${configured ? "ok" : ""}`}>
                {configured ? "已配置" : "未配置"}
              </span>
              {targetName ? (
                <span className="connector-target">已选知识库：{targetName}</span>
              ) : (
                <span className="connector-target muted">尚未选择知识库</span>
              )}
            </div>

            <div className="connector-note">
              ima 暂不支持在本应用中新建知识库。无可选知识库时，请先在 ima 中手动创建一个，推荐为微信读书创建一个独立的笔记知识库。
            </div>

            <div className="connector-actions">
              <Button
                variant="primary"
                icon={<KeyRound size={16} />}
                onClick={() => setDialogOpen(true)}
              >
                配置
              </Button>
              <Button
                variant="secondary"
                icon={<UploadCloud size={16} />}
                disabled={!syncReady}
                onClick={() => navigate("/notes?tab=export")}
              >
                去同步
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {dialogOpen ? (
        <ImaConfigDialog
          settings={settings}
          onClose={() => setDialogOpen(false)}
          onSaveCredentials={onSaveImaCredentials}
          onClearCredentials={onClearImaCredentials}
          onSaveTarget={onSaveImaTarget}
        />
      ) : null}
    </PageShell>
  );
}

type ImaConfigDialogProps = {
  settings: AppSettings;
  onClose: () => void;
  onSaveCredentials: (clientId: string, apiKey: string) => Promise<void>;
  onClearCredentials: () => Promise<void>;
  onSaveTarget: (
    knowledgeBaseId: string,
    knowledgeBaseName: string,
  ) => Promise<void>;
};

function ImaConfigDialog({
  settings,
  onClose,
  onSaveCredentials,
  onClearCredentials,
  onSaveTarget,
}: ImaConfigDialogProps) {
  const ima = useImaConnector();
  const [clientIdDraft, setClientIdDraft] = useState(settings.imaClientIdFull ?? "");
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.imaApiKeyFull ?? "");
  const [showClientId, setShowClientId] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetSaving, setTargetSaving] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const configured = settings.imaClientIdSet && settings.imaApiKeySet;
  const canSave = clientIdDraft.trim().length >= 4 && apiKeyDraft.trim().length >= 8;
  const visibleMessage = localMessage ?? ima.message;

  useEffect(() => {
    if (!configured) return;
    void ima.loadKnowledgeBases().catch(() => undefined);
  }, [configured, ima.loadKnowledgeBases]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setClientIdDraft(settings.imaClientIdFull ?? "");
    setApiKeyDraft(settings.imaApiKeyFull ?? "");
  }, [settings.imaApiKeyFull, settings.imaClientIdFull]);

  const selectedTarget = useMemo(
    () =>
      ima.knowledgeBases.find((item) => item.id === settings.imaKnowledgeBaseId),
    [ima.knowledgeBases, settings.imaKnowledgeBaseId],
  );

  async function saveCredentials() {
    setSaving(true);
    setLocalMessage(null);
    ima.setError(null);
    try {
      await onSaveCredentials(clientIdDraft, apiKeyDraft);
      setLocalMessage("ima 凭证已保存");
    } finally {
      setSaving(false);
    }
  }

  async function clearCredentials() {
    setSaving(true);
    setLocalMessage(null);
    ima.setError(null);
    try {
      await onClearCredentials();
      ima.setKnowledgeBases([]);
      setClientIdDraft("");
      setApiKeyDraft("");
      setLocalMessage("ima 凭证已清除");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setLocalMessage(null);
    if (!configured) {
      await saveCredentials();
    }
    await ima.testConnection().catch(() => undefined);
  }

  async function selectKnowledgeBase(item: ImaKnowledgeBaseOption) {
    setTargetSaving(item.id);
    setLocalMessage(null);
    try {
      await onSaveTarget(item.id, item.name);
      setLocalMessage(`已选择 ${item.name}`);
    } finally {
      setTargetSaving(null);
    }
  }

  return (
    <div className="connector-modal-backdrop" role="presentation">
      <div
        className="connector-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ima-config-title"
      >
        <div className="connector-modal-header">
          <div>
            <p className="eyebrow">ima 连接</p>
            <h2 id="ima-config-title">配置 ima 知识库</h2>
            <p>
              凭证只用于请求 ima 官方接口。导入时会读取所选书籍的划线原文和个人想法。
            </p>
          </div>
          <button
            type="button"
            className="connector-modal-close"
            aria-label="关闭 ima 配置"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="connector-modal-body">
          <section className="connector-panel">
            <div className="connector-panel-heading">
              <KeyRound size={18} />
              <div>
                <h3>连接凭证</h3>
                <p>从 ima 开放接口页面获取 Client ID 和 API Key。</p>
              </div>
            </div>

            <CredentialField
              label="Client ID"
              value={clientIdDraft}
              visible={showClientId}
              placeholder="粘贴 ima Client ID"
              onChange={setClientIdDraft}
              onToggleVisible={() => setShowClientId((value) => !value)}
            />
            <CredentialField
              label="API Key"
              value={apiKeyDraft}
              visible={showApiKey}
              placeholder="粘贴 ima API Key"
              onChange={setApiKeyDraft}
              onToggleVisible={() => setShowApiKey((value) => !value)}
            />

            <div className="connector-panel-actions">
              <Button
                variant="primary"
                size="small"
                icon={<CheckCircle2 size={14} />}
                disabled={saving || !canSave}
                onClick={() => void saveCredentials()}
              >
                保存凭证
              </Button>
              <Button
                variant="secondary"
                size="small"
                icon={<RefreshCw size={14} />}
                disabled={saving || ima.testing || !canSave}
                onClick={() => void testConnection()}
              >
                {ima.testing ? "测试中" : "测试连接"}
              </Button>
              {configured ? (
                <Button
                  variant="danger"
                  size="small"
                  icon={<Trash2 size={14} />}
                  disabled={saving}
                  onClick={() => void clearCredentials()}
                >
                  清除
                </Button>
              ) : null}
            </div>

            <ErrorBanner message={ima.error} />
            {visibleMessage ? <div className="connector-message">{visibleMessage}</div> : null}
          </section>

          <section className="connector-panel">
            <div className="connector-panel-heading connector-panel-heading-with-action">
              <Database size={18} />
              <div className="connector-panel-heading-content">
                <div className="connector-panel-title-row">
                  <h3>知识库</h3>
                  <Button
                    variant="secondary"
                    size="small"
                    icon={<RefreshCw size={14} />}
                    disabled={!configured || ima.loading}
                    onClick={() => void ima.loadKnowledgeBases(true)}
                  >
                    刷新知识库
                  </Button>
                </div>
                <p>只显示你自己创建的个人知识库，共享知识库不会出现在这里。</p>
              </div>
            </div>

            {!configured ? (
              <EmptyState title="先保存 ima 凭证" description="保存后可以测试连接并读取可添加的知识库。" />
            ) : ima.loading ? (
              <Spinner label="正在读取知识库" />
            ) : ima.knowledgeBases.length === 0 ? (
              <EmptyState
                title="没有你自己创建的知识库"
                description="共享知识库不会显示。ima 暂不支持在本应用中新建知识库，请先在 ima 中手动创建一个。"
              />
            ) : (
              <div className="knowledge-base-list">
                {ima.knowledgeBases.map((item) => {
                  const selected =
                    item.id === settings.imaKnowledgeBaseId ||
                    item.id === selectedTarget?.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`knowledge-base-item ${selected ? "selected" : ""}`}
                      onClick={() => void selectKnowledgeBase(item)}
                      disabled={targetSaving !== null}
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.id}</small>
                      </span>
                      {targetSaving === item.id ? (
                        <span className="connector-mini-status">保存中</span>
                      ) : selected ? (
                        <span className="connector-mini-status ok">已选择</span>
                      ) : (
                        <span className="connector-mini-status">选择</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

type CredentialFieldProps = {
  label: string;
  value: string;
  visible: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onToggleVisible: () => void;
};

function CredentialField({
  label,
  value,
  visible,
  placeholder,
  onChange,
  onToggleVisible,
}: CredentialFieldProps) {
  return (
    <label className="connector-field">
      <span>{label}</span>
      <div className="connector-secret-input">
        <input
          value={value}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? `隐藏 ${label}` : `显示 ${label}`}
          onClick={onToggleVisible}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </label>
  );
}
