import type { AdvancedReportOutputShape, AdvancedReportTemplate } from "../../hooks/useAdvancedReport";
import type { LocalAgent } from "../../hooks/useAgentBridge";
import type { ReportPeriod } from "../../lib/report/types";
import { ErrorBanner } from "../ui/ErrorBanner";

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
  maxUserPromptLength: number;
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
  maxUserPromptLength,
  onPeriodChange,
  onRawNotesConsentChange,
  onAgentChange,
  onOutputShapeChange,
  onUserPromptChange,
}: GenerationSettingsProps) {
  const shape = selectedShape(template.outputShapes, outputShape);

  return (
    <div className="advanced-template-settings">
      <p className="advanced-template-description">{template.styleSummary || template.description}</p>
      {supportedAgents.length > 0 && availableAgents.length === 0 ? (
        <ErrorBanner message="没有检测到可用的本地 Agent。安装 Claude Code、Codex 或其他支持的 CLI 后再生成智能体报告。" />
      ) : null}
      <div className="advanced-settings-strip template-settings-strip">
        <label className="advanced-setting-block">
          <span>
            <strong>数据范围</strong>
            <small>决定本次模板使用哪个时间范围的数据。</small>
          </span>
          <select value={period} onChange={(event) => onPeriodChange(event.target.value as ReportPeriod)}>
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="advanced-setting-block privacy">
          <input
            type="checkbox"
            checked={rawNotesConsent}
            onChange={(event) => onRawNotesConsentChange(event.target.checked)}
          />
          <span>
            <strong>{template.requiresRawNotesConsent ? "允许读取划线原文和个人想法" : "加入划线原文和个人想法"}</strong>
            <small>
              {template.requiresRawNotesConsent
                ? "这个模板需要这些内容才能生成；只会写入本地报告工作区。"
                : "默认关闭。开启后报告会更具体，但会读取你的原文摘录。"}
            </small>
          </span>
        </label>
        <label className="advanced-setting-block">
          <span>
            <strong>本地 Agent CLI</strong>
            <small>选择用于生成报告的本地 CLI。</small>
          </span>
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
        <label className="advanced-setting-block">
          <span>
            <strong>输出形态</strong>
            <small>最终都会生成 HTML；PPT 风格不是 `.pptx`。</small>
          </span>
          <select value={outputShape} onChange={(event) => onOutputShapeChange(event.target.value)}>
            {template.outputShapes.map((shapeOption) => (
              <option key={shapeOption.id} value={shapeOption.id}>
                {shapeOption.name}
              </option>
            ))}
          </select>
          <small>{shape?.description}</small>
        </label>
        <label className="advanced-setting-block advanced-setting-block-wide">
          <span>
            <strong>自定义要求</strong>
            <small>写本次重点、语气或结构偏好；不能覆盖隐私和输出约束。</small>
          </span>
          <textarea
            value={userPrompt}
            maxLength={maxUserPromptLength}
            placeholder="例如：重点分析我为什么偏好历史与商业类书；结尾给出 3 条下一阶段阅读建议。"
            onChange={(event) => onUserPromptChange(event.target.value)}
          />
          <small>
            {userPrompt.length}/{maxUserPromptLength}
          </small>
        </label>
      </div>
    </div>
  );
}
