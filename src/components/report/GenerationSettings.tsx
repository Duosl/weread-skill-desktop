import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import type { AdvancedReportOutputShape, AdvancedReportTemplate } from "../../hooks/useAdvancedReport";
import type { AdvancedReportDataAccessPreview } from "../../types/advancedReport";
import type { LocalAgent } from "../../hooks/useAgentBridge";
import type { ReportPeriod } from "../../lib/report/types";
import { ErrorBanner } from "../ui/ErrorBanner";
import { IconButton } from "../ui/IconButton";

type PeriodOption = {
  value: ReportPeriod;
  label: string;
};

type GenerationSettingsProps = {
  template: AdvancedReportTemplate;
  period: ReportPeriod;
  periodOptions: PeriodOption[];
  rawNotesConsent: boolean;
  supportedAgents: LocalAgent[];
  availableAgents: LocalAgent[];
  selectedAgent: LocalAgent | null;
  outputShape: string;
  userPrompt: string;
  dataAccessPreview: AdvancedReportDataAccessPreview | null;
  onPeriodChange: (period: ReportPeriod) => void;
  onRawNotesConsentChange: (value: boolean) => void;
  onAgentChange: (agentId: string) => void;
  onOutputShapeChange: (shapeId: string) => void;
  onUserPromptChange: (prompt: string) => void;
};

function selectedShape(shapes: AdvancedReportOutputShape[], id: string) {
  return shapes.find((shape) => shape.id === id);
}

export function GenerationSettings({
  template,
  period,
  periodOptions,
  rawNotesConsent,
  supportedAgents,
  availableAgents,
  selectedAgent,
  outputShape,
  userPrompt,
  dataAccessPreview,
  onPeriodChange,
  onRawNotesConsentChange,
  onAgentChange,
  onOutputShapeChange,
  onUserPromptChange,
}: GenerationSettingsProps) {
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const shape = selectedShape(template.outputShapes, outputShape);
  const rawNotesRequired = template.requiresRawNotesConsent;
  const rawNotesMissing = rawNotesRequired && !rawNotesConsent;

  return (
    <div className="advanced-template-settings">
      {supportedAgents.length > 0 && availableAgents.length === 0 ? (
        <ErrorBanner message="没有检测到可用的本地 Agent。安装 Claude Code、Codex 或其他支持的 CLI 后再生成智能体报告。" />
      ) : null}
      <div className="advanced-settings-strip template-settings-strip">
        <section className="advanced-setting-panel setting-main">
          <div className="advanced-setting-panel-title">
            <strong>报告设置</strong>
            <small>决定这次报告包含多长时间的数据、怎么输出。</small>
          </div>
          <div className="advanced-setting-row">
            <label>
              <span>数据范围</span>
              <select value={period} onChange={(event) => onPeriodChange(event.target.value as ReportPeriod)}>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>输出形态</span>
              <select value={outputShape} onChange={(event) => onOutputShapeChange(event.target.value)}>
                {template.outputShapes.map((shapeOption) => (
                  <option key={shapeOption.id} value={shapeOption.id}>
                    {shapeOption.name}
                  </option>
                ))}
              </select>
              <small>{shape?.description}</small>
            </label>
          </div>
          <div className="advanced-setting-prompt">
            <span>自定义提示词</span>
            <div className="advanced-prompt-field">
              <textarea
                value={userPrompt}
                rows={2}
                placeholder="例如：重点分析我为什么偏好历史与商业类书；结尾给出 3 条下一阶段阅读建议。"
                onChange={(event) => onUserPromptChange(event.target.value)}
              />
              <button
                type="button"
                className="advanced-prompt-expand"
                aria-label="展开编辑自定义提示词"
                title="展开编辑"
                onClick={() => setPromptEditorOpen(true)}
              >
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
          {dataAccessPreview ? (
            <div className="advanced-setting-prompt">
              <span>读取范围预览</span>
              <small>{dataAccessPreview.summary}</small>
              <div className="chat-action-details">
                <span className="chat-action-detail-item">
                  将读取：{dataAccessPreview.willRead.join("、") || "无"}
                </span>
                {dataAccessPreview.mayRead.length > 0 ? (
                  <span className="chat-action-detail-item">
                    可能读取：{dataAccessPreview.mayRead.join("、")}
                  </span>
                ) : null}
                {dataAccessPreview.willNotRead.length > 0 ? (
                  <span className="chat-action-detail-item">
                    不读取：{dataAccessPreview.willNotRead.join("、")}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="advanced-setting-panel setting-runtime">
          <div className="advanced-setting-panel-title">
            <strong>生成前提</strong>
            <small>确认数据授权和本地 Agent。</small>
          </div>
          <label
            className={`advanced-setting-consent ${
              rawNotesRequired ? "is-required" : ""
            } ${rawNotesMissing ? "is-missing-required" : ""}`}
          >
            <input
              type="checkbox"
              checked={rawNotesConsent}
              onChange={(event) => onRawNotesConsentChange(event.target.checked)}
            />
            <span>
              <strong>
                {rawNotesRequired ? "允许读取划线原文和个人想法" : "加入划线原文和个人想法"}
                {rawNotesRequired ? <em>必填</em> : null}
              </strong>
              <small>
                {rawNotesMissing
                  ? "该模版需求获取你的笔记和想法数据。"
                  : rawNotesRequired
                  ? "数据只会存在你的电脑和你的大模型服务商。"
                  : "默认关闭。开启后可获得更详细的报告哦~"}
              </small>
            </span>
          </label>
          <label className="advanced-setting-agent">
            <span>本地 Agent CLI</span>
            <select
              value={selectedAgent?.id ?? ""}
              disabled={availableAgents.length === 0}
              onChange={(event) => onAgentChange(event.target.value)}
            >
              {supportedAgents.length === 0 ? (
                <option value="">未检测到可用 Agent</option>
              ) : (
                supportedAgents.map((agent) => (
                  <option key={agent.id} value={agent.id} disabled={!agent.available}>
                    {agent.label}
                    {agent.available ? "" : "（未安装）"}
                  </option>
                ))
              )}
              {supportedAgents.length > 0 && availableAgents.length === 0 ? (
                <option value="" disabled>
                  没有可用的本地 Agent CLI
                </option>
              ) : null}
            </select>
            <small>
              {selectedAgent?.path ??
                (availableAgents.length > 0 ? "未安装的 CLI 会显示在列表中，但不能选择。" : "列表中的 CLI 都未安装，请先安装可用的本地 Agent CLI。")}
            </small>
          </label>
        </section>
      </div>
      {promptEditorOpen ? (
        <div className="report-modal-backdrop prompt-editor-backdrop" role="presentation">
          <section className="prompt-editor-modal" role="dialog" aria-modal="true" aria-labelledby="prompt-editor-title">
            <header className="prompt-editor-header">
              <div>
                <span>自定义提示词</span>
                <h2 id="prompt-editor-title">写给本次报告的重点</h2>
              </div>
              <IconButton
                aria-label="关闭自定义提示词编辑"
                icon={<X size={18} />}
                onClick={() => setPromptEditorOpen(false)}
              />
            </header>
            <textarea
              className="prompt-editor-textarea"
              value={userPrompt}
              autoFocus
              placeholder="例如：重点分析我为什么偏好历史与商业类书；结尾给出 3 条下一阶段阅读建议。"
              onChange={(event) => onUserPromptChange(event.target.value)}
            />
            <footer className="prompt-editor-actions">
              <button type="button" className="button button-primary" onClick={() => setPromptEditorOpen(false)}>
                <span>完成</span>
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
