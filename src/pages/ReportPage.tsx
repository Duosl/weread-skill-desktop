import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Eye, RefreshCw, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Spinner } from "../components/ui/Spinner";
import { useAgentBridge } from "../hooks/useAgentBridge";
import { useAdvancedReport } from "../hooks/useAdvancedReport";
import { useReadingReport } from "../hooks/useReadingReport";
import { getErrorMessage } from "../lib/format";
import { renderReportHtml, reportHtmlTitle } from "../lib/report/renderHtml";
import { ReportTemplate, reportTemplates } from "../lib/report/templates";
import type { ReportPeriod, ReportTemplateId } from "../lib/report/types";
import type { AdvancedReportLogEvent, AdvancedReportTask } from "../hooks/useAdvancedReport";

type ReportPageProps = {
  apiKeySet: boolean;
};

const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: "month", label: "本月" },
  { value: "year", label: "今年" },
  { value: "all", label: "全部" },
];

type ReportHtmlPreviewResult = {
  filePath: string;
};

type TemplateTab = "basic" | "advanced";
type LogViewMode = "brief" | "detail";
const USER_PROMPT_MAX_LENGTH = 2000;
const SEEN_ADVANCED_TASKS_STORAGE_KEY = "weread-desktop:seen-advanced-report-tasks";

type ModelOutputBlock = {
  kind: "thinking" | "output" | "system" | "error";
  title: string;
  text: string;
};

function advancedTaskStatus(task: AdvancedReportTask) {
  if (task.status === "completed") {
    return { label: "已完成", tone: "success" };
  }
  if (task.status === "running" || task.status === "preparing") {
    return { label: "生成中", tone: "running" };
  }
  if (task.status === "canceled") {
    return { label: "已取消", tone: "muted" };
  }
  if (task.message?.includes("中断")) {
    return { label: "已中断", tone: "danger" };
  }
  return { label: "未完成", tone: "danger" };
}

function buildModelOutputBlocks(logs: AdvancedReportLogEvent[]): ModelOutputBlock[] {
  const blocks: ModelOutputBlock[] = [];

  function append(kind: ModelOutputBlock["kind"], title: string, text: string) {
    const normalized = normalizeLogText(text, kind);
    if (!normalized.trim()) return;
    const previous = blocks[blocks.length - 1];
    if (previous?.kind === kind) {
      previous.text = joinLogText(previous.text, normalized, kind);
      return;
    }
    blocks.push({ kind, title, text: normalized });
  }

  for (const log of logs) {
    if (log.kind === "meta") {
      const parsed = parseMetaLog(log.text);
      if (!parsed || shouldHideMetaLog(parsed.key, parsed.value)) continue;
      if (parsed.key === "thinking") {
        append("thinking", "思考", parsed.value);
      }
      continue;
    }
    if (log.kind === "delta" || log.kind === "raw") {
      append("output", "输出", log.text);
      continue;
    }
    if (log.kind === "html") {
      append("system", "报告文件", "已收到报告内容片段。");
      continue;
    }
    if (log.kind === "stderr" || log.kind === "error") {
      append("error", "错误", log.text);
      continue;
    }
    if (log.kind === "start") {
      append("system", "状态", log.text);
      continue;
    }
    if (log.kind === "done" || log.kind === "canceled") {
      append("system", "状态", log.text);
    }
  }

  return blocks;
}

function parseMetaLog(text: string): { key: string; value: string } | null {
  const index = text.indexOf(":");
  if (index < 0) return null;
  const key = text.slice(0, index).trim();
  const value = decodePossiblyQuotedLogText(text.slice(index + 1).trim());
  return key ? { key, value } : null;
}

function shouldHideMetaLog(key: string, value: string) {
  if (!value) return true;
  return ["model", "session", "cwd", "usage", "usage_partial"].includes(key);
}

function normalizeLogText(text: string, kind: ModelOutputBlock["kind"]) {
  const decoded = decodeLogText(text).replace(/\r/g, "");
  return kind === "thinking" || kind === "output" ? decoded : decoded.trim();
}

function decodePossiblyQuotedLogText(text: string) {
  if (text.startsWith("\"") && text.endsWith("\"")) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "string") return parsed;
    } catch {
      // Fall back to lightweight decoding below.
    }
  }
  return decodeLogText(text.replace(/^"|"$/g, ""));
}

function decodeLogText(text: string) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"");
}

function joinLogText(previous: string, next: string, kind: ModelOutputBlock["kind"]) {
  if (!previous) return next;
  if (kind === "thinking" || kind === "output") {
    return `${previous}${next}`;
  }
  if (/^[，。！？、；：,.!?;:)\]}]/.test(next) || previous.endsWith("\n")) {
    return `${previous}${next}`;
  }
  if (/[\s([{]$/.test(previous)) {
    return `${previous}${next}`;
  }
  return `${previous}\n${next}`;
}

function latestModelOutputBlock(blocks: ModelOutputBlock[]) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.kind === "output" || block.kind === "thinking" || block.kind === "error") {
      return block;
    }
  }
  return blocks.length ? blocks[blocks.length - 1] : null;
}

function lastVisibleLine(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

function leadingEllipsisLine(text: string, maxLength = 96) {
  const chars = Array.from(text.trim());
  if (chars.length <= maxLength) return text.trim();
  return `…${chars.slice(-maxLength).join("")}`;
}

function templateDataAccessLabel(requiresRawNotesConsent: boolean) {
  return requiresRawNotesConsent ? "需确认隐私" : "可直接生成";
}

function templateDataAccessDescription(requiresRawNotesConsent: boolean) {
  return requiresRawNotesConsent
    ? "这个模板会使用你的划线和想法，生成前会请你确认。"
    : "使用书架、阅读统计和笔记数量生成；也可以在设置里加入划线和想法。";
}

function taskCreatedTime(task: AdvancedReportTask) {
  const time = new Date(task.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function loadSeenAdvancedTaskIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_ADVANCED_TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveSeenAdvancedTaskIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEEN_ADVANCED_TASKS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export function ReportPage({ apiKeySet }: ReportPageProps) {
  const report = useReadingReport();
  const advancedReport = useAdvancedReport();
  const agentBridge = useAgentBridge();
  const [period, setPeriod] = useState<ReportPeriod>("year");
  const [templateTab, setTemplateTab] = useState<TemplateTab>("advanced");
  const [selectedTemplateId, setSelectedTemplateId] = useState<ReportTemplateId | null>(null);
  const [rawNotesConsent, setRawNotesConsent] = useState(false);
  const [openingReport, setOpeningReport] = useState(false);
  const [selectedAdvancedTemplateId, setSelectedAdvancedTemplateId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<AdvancedReportTask | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<AdvancedReportTask | null>(null);
  const [logViewMode, setLogViewMode] = useState<LogViewMode>("brief");
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [advancedOutputShapeByTemplate, setAdvancedOutputShapeByTemplate] = useState<Record<string, string>>({});
  const [advancedUserPromptByTemplate, setAdvancedUserPromptByTemplate] = useState<Record<string, string>>({});
  const [seenAdvancedTaskIds, setSeenAdvancedTaskIds] = useState<string[]>(() => loadSeenAdvancedTaskIds());
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const selectedTemplate = reportTemplates.find((item) => item.id === selectedTemplateId) ?? null;
  const taskByTemplate = new Map<string, AdvancedReportTask>();

  for (const task of advancedReport.tasks) {
    const current = taskByTemplate.get(task.templateId);
    const taskActive = task.status === "running" || task.status === "preparing";
    const currentActive = current?.status === "running" || current?.status === "preparing";
    const taskNewer = !current || taskCreatedTime(task) > taskCreatedTime(current);
    if (!current || (taskActive && !currentActive) || (taskActive === currentActive && taskNewer)) {
      taskByTemplate.set(task.templateId, task);
    }
  }
  const selectedAdvancedTemplate =
    advancedReport.templates.find((item) => item.id === selectedAdvancedTemplateId) ?? null;
  const selectedAdvancedOutputShape = selectedAdvancedTemplate
    ? (advancedOutputShapeByTemplate[selectedAdvancedTemplate.id] ?? selectedAdvancedTemplate.defaultOutputShape)
    : "";
  const selectedAdvancedUserPrompt = selectedAdvancedTemplate
    ? (advancedUserPromptByTemplate[selectedAdvancedTemplate.id] ?? "")
    : "";
  const selectedAdvancedOutputShapeName =
    selectedAdvancedTemplate?.outputShapes.find((shape) => shape.id === selectedAdvancedOutputShape)?.name ??
    selectedAdvancedOutputShape;
  const selectedPeriodLabel = periodOptions.find((item) => item.value === period)?.label ?? "今年";
  const selectedAdvancedTemplateTasks = selectedAdvancedTemplateId
    ? advancedReport.tasks
        .filter((task) => task.templateId === selectedAdvancedTemplateId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const selectedTemplateDetailTask =
    selectedAdvancedTemplateId && selectedTask?.templateId === selectedAdvancedTemplateId
      ? selectedTask
      : null;
  const selectedDetailTaskActive =
    selectedTemplateDetailTask?.status === "running" || selectedTemplateDetailTask?.status === "preparing";
  const showSelectedTemplateResult = Boolean(selectedTemplateDetailTask && !selectedDetailTaskActive);
  const selectedDetailTaskLogs = selectedTemplateDetailTask
    ? (advancedReport.logsByJob[selectedTemplateDetailTask.jobId] ?? [])
    : [];
  const selectedDetailTaskOutputBlocks = buildModelOutputBlocks(selectedDetailTaskLogs);
  const selectedDetailTaskLatestBlock = latestModelOutputBlock(selectedDetailTaskOutputBlocks);
  const selectedDetailTaskLatestLine = selectedDetailTaskLatestBlock
    ? lastVisibleLine(selectedDetailTaskLatestBlock.text)
    : "";
  const selectedDetailTaskBriefLine = leadingEllipsisLine(selectedDetailTaskLatestLine || "正在等待新的输出。");
  const shouldShowSelectedDetailTaskLogs = selectedDetailTaskActive || selectedDetailTaskLogs.length > 0;
  const selectedDetailTaskOutput =
    selectedTemplateDetailTask && advancedReport.output?.jobId === selectedTemplateDetailTask.jobId
      ? advancedReport.output
      : null;
  const selectedDetailTaskCompleted = selectedTemplateDetailTask?.status === "completed";
  const selectedDetailTaskReportAvailable =
    Boolean(selectedDetailTaskOutput?.reportHtml) || selectedDetailTaskCompleted;
  const showAdvancedSettings = Boolean(selectedAdvancedTemplate && advancedSettingsOpen);
  const supportedAgentOptions = agentBridge.agents.filter((agent) => !agent.unsupported);
  const availableAgents = agentBridge.agents.filter((agent) => agent.available && !agent.unsupported);
  const defaultAgent = agentBridge.agents.find((agent) => agent.available && !agent.unsupported) ?? null;
  const selectedAgent =
    agentBridge.agents.find((agent) => agent.id === selectedAgentId && agent.available && !agent.unsupported) ??
    defaultAgent;

  useEffect(() => {
    if (apiKeySet) {
      void report.loadReport(period);
      void agentBridge.detectAgents();
    }
  }, [apiKeySet, period]);

  useEffect(() => {
    if (!defaultAgent) return;
    if (selectedAgentId && availableAgents.some((agent) => agent.id === selectedAgentId)) return;
    setSelectedAgentId(defaultAgent.id);
  }, [availableAgents, defaultAgent, selectedAgentId]);

  useEffect(() => {
    setActionError(null);
    setActionNotice(null);
  }, [period, selectedTemplateId, report.data]);

  useEffect(() => {
    if (!selectedTemplateId && !selectedAdvancedTemplateId && !selectedTask && !taskPendingDelete) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedTemplateId(null);
        setSelectedAdvancedTemplateId(null);
        setSelectedTask(null);
        setTaskPendingDelete(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTemplateId, selectedAdvancedTemplateId, selectedTask, taskPendingDelete]);

  useEffect(() => {
    if (!selectedTask) return;
    const latest = advancedReport.tasks.find((task) => task.jobId === selectedTask.jobId);
    if (latest && latest.updatedAt !== selectedTask.updatedAt) {
      setSelectedTask(latest);
    }
  }, [advancedReport.tasks, selectedTask]);

  useEffect(() => {
    if (!selectedTemplateDetailTask) return;
    void advancedReport.readLogs(selectedTemplateDetailTask.jobId);
  }, [selectedTemplateDetailTask?.jobId]);

  useEffect(() => {
    if (!selectedTemplateDetailTask || selectedTemplateDetailTask.status !== "completed") return;
    if (advancedReport.output?.jobId === selectedTemplateDetailTask.jobId && advancedReport.output.reportHtml) return;
    void advancedReport.readOutput(selectedTemplateDetailTask.jobId).catch((error) => {
      setActionError(getErrorMessage(error));
    });
  }, [
    selectedTemplateDetailTask?.jobId,
    selectedTemplateDetailTask?.status,
    advancedReport.output?.jobId,
    advancedReport.output?.reportHtml,
  ]);

  function buildHtmlPayload() {
    if (!report.data || !selectedTemplateId) return;
    const title = reportHtmlTitle(selectedTemplateId, report.data);
    const html = renderReportHtml(selectedTemplateId, report.data);
    return { title, html };
  }

  async function previewReport() {
    const payload = buildHtmlPayload();
    if (!payload) return;

    setOpeningReport(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await invoke<ReportHtmlPreviewResult>("preview_report_html", {
        title: payload.title,
        html: payload.html,
      });
      await invoke("open_report_file", { path: result.filePath });
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setOpeningReport(false);
    }
  }

  async function startAdvancedTemplate(templateId: string) {
    const template = advancedReport.templates.find((item) => item.id === templateId);
    if (!template) return;
    if (template.requiresRawNotesConsent && !rawNotesConsent) {
      setActionError("请先确认允许读取个人划线和想法");
      return;
    }
    if (!selectedAgent) {
      setActionError("未检测到可用的本地 Agent，请先安装 Claude Code、Codex 或其他支持的 CLI");
      return;
    }
    const outputShape = advancedOutputShapeByTemplate[templateId] ?? template.defaultOutputShape;
    const userPrompt = (advancedUserPromptByTemplate[templateId] ?? "").trim();
    if (userPrompt.length > USER_PROMPT_MAX_LENGTH) {
      setActionError(`自定义要求不能超过 ${USER_PROMPT_MAX_LENGTH} 个字符`);
      return;
    }

    setActionError(null);
    setActionNotice(null);
    try {
      const task = await advancedReport.startTask({
        templateId,
        rawNotesConsent,
        forceRefresh: false,
        outputShape,
        userPrompt: userPrompt || null,
        reportPeriod: period,
        agent: selectedAgent.id,
      });
      setSelectedTask(task);
      setLogViewMode("brief");
      setActionNotice(`${task.templateName} 已开始生成，可离开当前页面`);
      void advancedReport.readLogs(task.jobId);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function openAdvancedTask(task: AdvancedReportTask) {
    setSelectedTask(task);
    setActionError(null);
    try {
      const output = await advancedReport.readOutput(task.jobId);
      if (!output.reportHtml && task.status === "completed") {
        setActionError("任务已完成，但没有找到报告");
      }
    } catch (error) {
      if (task.status === "completed") {
        setActionError(getErrorMessage(error));
      }
    }
  }

  async function cancelTask(task: AdvancedReportTask) {
    try {
      const ok = await advancedReport.cancelTask(task.jobId);
      setActionNotice(ok ? "已请求取消生成" : "任务已经结束或不可取消");
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  function requestDeleteAdvancedJob(task: AdvancedReportTask) {
    if (task.status === "running" || task.status === "preparing") {
      setActionError("任务正在生成中，请先取消后再删除。");
      return;
    }
    setActionError(null);
    setTaskPendingDelete(task);
  }

  async function confirmDeleteAdvancedJob() {
    if (!taskPendingDelete) return;
    const task = taskPendingDelete;
    setActionError(null);
    setActionNotice(null);
    try {
      const deleted = await advancedReport.deleteJob(task.jobId);
      if (selectedTask?.jobId === task.jobId) {
        setSelectedTask(null);
      }
      setTaskPendingDelete(null);
      setActionNotice(deleted ? "已删除这条历史记录" : "这条历史记录已经不存在");
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function openAdvancedTemplateDetail(templateId: string) {
    const template = advancedReport.templates.find((item) => item.id === templateId);
    if (template && !advancedOutputShapeByTemplate[templateId]) {
      setAdvancedOutputShapeByTemplate((current) => ({
        ...current,
        [templateId]: template.defaultOutputShape,
      }));
    }
    const currentTask = taskByTemplate.get(templateId);
    const currentTaskActive = currentTask?.status === "running" || currentTask?.status === "preparing";
    const currentTaskSeen = currentTask ? seenAdvancedTaskIds.includes(currentTask.jobId) : false;
    const shouldOpenTask = Boolean(currentTask && (currentTaskActive || !currentTaskSeen));
    setSelectedTask(shouldOpenTask ? currentTask ?? null : null);
    if (currentTask && currentTask.status !== "running" && currentTask.status !== "preparing") {
      setSeenAdvancedTaskIds((current) => {
        if (current.includes(currentTask.jobId)) return current;
        const next = [...current, currentTask.jobId];
        saveSeenAdvancedTaskIds(next);
        return next;
      });
    }
    setSelectedAdvancedTemplateId(templateId);
    setAdvancedSettingsOpen(!shouldOpenTask);
    setActionError(null);
    try {
      await advancedReport.loadTasks();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function openAdvancedReport(task = selectedTask) {
    if (!task) return;
    let output = advancedReport.output;
    if (output?.jobId !== task.jobId) {
      try {
        output = await advancedReport.readOutput(task.jobId);
      } catch (error) {
        setActionError(getErrorMessage(error));
        return;
      }
    }
    if (!output) return;
    const html = output.reportHtml;
    const path = output.reportPath;
    if (!html) {
      setActionError("报告尚未生成");
      return;
    }
    try {
      await invoke("open_report_file", { path });
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  if (!apiKeySet) {
    return (
      <PageShell title="阅读报告">
        <EmptyState
          title="先配置 API Key"
          description="完成连接后可以生成阅读报告。"
          action={
            <Link to="/settings">
              <Button variant="primary">去设置</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={selectedAdvancedTemplate ? selectedAdvancedTemplate.name : "阅读报告"}
      subtitle={selectedAdvancedTemplate ? selectedAdvancedTemplate.description : undefined}
      backAction={
        selectedAdvancedTemplate
          ? {
              label: "返回",
              onClick: () => {
                setSelectedAdvancedTemplateId(null);
                setSelectedTask(null);
              },
            }
          : undefined
      }
      action={
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          disabled={report.loading}
          onClick={() => void report.loadReport(period, true)}
        >
          刷新数据
        </Button>
      }
    >
      <ErrorBanner message={report.error ?? advancedReport.error ?? agentBridge.error ?? actionError} />
      {actionNotice ? <div className="success-text">{actionNotice}</div> : null}

      {selectedAdvancedTemplate ? (
        <div className="advanced-template-page">
          <section className="advanced-template-page-header">
            <div>
              <span>智能体模板</span>
              <h2>{selectedAdvancedTemplate.name}</h2>
              <p>{selectedAdvancedTemplate.styleSummary || selectedAdvancedTemplate.description}</p>
            </div>
            <div className="advanced-template-primary-actions">
              {selectedTemplateDetailTask?.status === "running" ||
              selectedTemplateDetailTask?.status === "preparing" ? (
                <Button
                  className="template-action-danger"
                  variant="danger"
                  onClick={() => void cancelTask(selectedTemplateDetailTask)}
                >
                  取消生成
                </Button>
              ) : selectedTemplateDetailTask?.status === "completed" ? (
                <>
                  <Button
                    className="template-action-main"
                    variant="primary"
                    icon={<Eye size={16} />}
                    onClick={() => void openAdvancedReport(selectedTemplateDetailTask)}
                  >
                    查看最新报告
                  </Button>
                  <Button
                    className="template-action-secondary"
                    variant="secondary"
                    onClick={() => void startAdvancedTemplate(selectedAdvancedTemplate.id)}
                  >
                    再次生成
                  </Button>
                </>
              ) : (
                <Button
                  className="template-action-main"
                  variant="primary"
                  disabled={
                    advancedReport.loading ||
                    agentBridge.agents.every((agent) => !agent.available || agent.unsupported) ||
                    !selectedAgent ||
                    (selectedAdvancedTemplate.requiresRawNotesConsent && !rawNotesConsent)
                  }
                  onClick={() => void startAdvancedTemplate(selectedAdvancedTemplate.id)}
                >
                  开始生成
                </Button>
              )}
            </div>
          </section>

          <div className="advanced-template-workspace">
            {showSelectedTemplateResult && selectedTemplateDetailTask ? (
              <section className="advanced-template-panel advanced-template-result">
                <div className="template-detail-section-title">
                  <span>当前结果</span>
                  <p>从模板卡片进入的最近一次生成结果。</p>
                </div>
                <>
                  <section className={`advanced-task-status-card ${advancedTaskStatus(selectedTemplateDetailTask).tone}`}>
                    <div>
                      <span>{advancedTaskStatus(selectedTemplateDetailTask).label}</span>
                      <h3>{selectedTemplateDetailTask.status === "completed" ? "报告已生成" : "报告未完成"}</h3>
                      <p>
                        {selectedTemplateDetailTask.status === "completed"
                          ? "可以直接用浏览器打开查看完整报告。"
                          : selectedTemplateDetailTask.message ?? "这次生成没有产出可查看的报告。"}
                      </p>
                    </div>
                    <div className="advanced-result-actions">
                      <Button
                        variant="secondary"
                        icon={<Eye size={16} />}
                        disabled={!selectedDetailTaskReportAvailable}
                        onClick={() => void openAdvancedReport(selectedTemplateDetailTask)}
                      >
                        浏览器打开
                      </Button>
                      <Button
                        variant="danger"
                        icon={<Trash2 size={16} />}
                        onClick={() => requestDeleteAdvancedJob(selectedTemplateDetailTask)}
                      >
                        删除任务
                      </Button>
                    </div>
                  </section>

                  {shouldShowSelectedDetailTaskLogs ? (
                    <section className="advanced-task-log-section">
                      <div className="advanced-task-log-header">
                        <div className="advanced-task-log-title">
                          <strong>生成过程</strong>
                          <small>
                            {logViewMode === "brief"
                              ? "简洁模式只显示状态和最新内容"
                              : selectedDetailTaskOutputBlocks.length
                                ? `${selectedDetailTaskOutputBlocks.length} 段内容`
                                : "正在等待输出"}
                          </small>
                        </div>
                        <div className="segmented advanced-task-log-mode" role="tablist" aria-label="生成过程显示模式">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={logViewMode === "brief"}
                            className={logViewMode === "brief" ? "active" : ""}
                            onClick={() => setLogViewMode("brief")}
                          >
                            简洁
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={logViewMode === "detail"}
                            className={logViewMode === "detail" ? "active" : ""}
                            onClick={() => setLogViewMode("detail")}
                          >
                            详细
                          </button>
                        </div>
                      </div>
                      <div className={`advanced-task-log-panel ${logViewMode === "brief" ? "brief" : ""}`} aria-live="off">
                        {selectedDetailTaskOutputBlocks.length === 0 ? (
                          <p className="advanced-task-log-empty">这次生成没有记录到可展示的过程。</p>
                        ) : logViewMode === "brief" ? (
                          <p className={`advanced-task-log-brief ${selectedDetailTaskLatestBlock?.kind ?? "system"}`}>
                            <strong>{advancedTaskStatus(selectedTemplateDetailTask).label}</strong>
                            <span title={selectedDetailTaskLatestLine || undefined}>{selectedDetailTaskBriefLine}</span>
                          </p>
                        ) : (
                          selectedDetailTaskOutputBlocks.map((block, index) => (
                            <article key={`${block.kind}-${index}`} className={`model-output-block ${block.kind}`}>
                              <span>{block.title}</span>
                              <p>{block.text}</p>
                            </article>
                          ))
                        )}
                      </div>
                    </section>
                  ) : null}
                </>
              </section>
            ) : null}

            <section className={`advanced-template-panel advanced-generation-config ${showAdvancedSettings ? "is-open" : ""}`}>
              <div className="advanced-generation-strip">
                <div>
                  <span>生成配置</span>
                  <strong>
                    {selectedPeriodLabel} · {selectedAdvancedOutputShapeName || "默认报告"} ·{" "}
                    {selectedAgent?.label ?? "未检测到 Agent"}
                  </strong>
                  <p>
                    {selectedAdvancedUserPrompt.trim()
                      ? `已填写自定义要求：${leadingEllipsisLine(selectedAdvancedUserPrompt, 42)}`
                      : templateDataAccessDescription(selectedAdvancedTemplate.requiresRawNotesConsent)}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setAdvancedSettingsOpen((current) => !current)}>
                  {showAdvancedSettings ? "收起设置" : "调整设置"}
                </Button>
              </div>

              {showAdvancedSettings ? (
                <div className="advanced-template-settings">
                  <p className="advanced-template-description">
                    {selectedAdvancedTemplate.styleSummary || selectedAdvancedTemplate.description}
                  </p>
                  {agentBridge.agents.length > 0 &&
                  agentBridge.agents.every((agent) => !agent.available || agent.unsupported) ? (
                    <ErrorBanner message="没有检测到可用的本地 Agent。安装 Claude Code、Codex 或其他支持的 CLI 后再生成智能体报告。" />
                  ) : null}
                  <div className="advanced-settings-strip template-settings-strip">
                    <label className="advanced-setting-block">
                      <span>
                        <strong>数据范围</strong>
                        <small>决定本次模板使用哪个时间范围的数据。</small>
                      </span>
                      <select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
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
                        onChange={(event) => setRawNotesConsent(event.target.checked)}
                      />
                      <span>
                        <strong>
                          {selectedAdvancedTemplate.requiresRawNotesConsent
                            ? "允许读取划线原文和个人想法"
                            : "加入划线原文和个人想法"}
                        </strong>
                        <small>
                          {selectedAdvancedTemplate.requiresRawNotesConsent
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
                        onChange={(event) => setSelectedAgentId(event.target.value)}
                      >
                        {supportedAgentOptions.length === 0 ? (
                          <option value="">未检测到可用 Agent</option>
                        ) : (
                          supportedAgentOptions.map((agent) => {
                            const disabled = !agent.available;
                            return (
                              <option key={agent.id} value={agent.id} disabled={disabled}>
                                {agent.label}
                                {agent.available ? "" : "（未安装）"}
                              </option>
                            );
                          })
                        )}
                      {supportedAgentOptions.length > 0 && availableAgents.length === 0 ? (
                        <option value="" disabled>
                          没有可用的本地 Agent CLI
                        </option>
                      ) : null}
                      </select>
                      <small>
                        {selectedAgent?.path ??
                          (availableAgents.length > 0
                            ? "未安装的 CLI 会显示在列表中，但不能选择。"
                            : "列表中的 CLI 都未安装，请先安装可用的本地 Agent CLI。")}
                      </small>
                    </label>
                    <label className="advanced-setting-block">
                      <span>
                        <strong>输出形态</strong>
                        <small>最终都会生成 HTML；PPT 风格不是 `.pptx`。</small>
                      </span>
                      <select
                        value={selectedAdvancedOutputShape}
                        onChange={(event) =>
                          setAdvancedOutputShapeByTemplate((current) => ({
                            ...current,
                            [selectedAdvancedTemplate.id]: event.target.value,
                          }))
                        }
                      >
                        {selectedAdvancedTemplate.outputShapes.map((shape) => (
                          <option key={shape.id} value={shape.id}>
                            {shape.name}
                          </option>
                        ))}
                      </select>
                      <small>
                        {
                          selectedAdvancedTemplate.outputShapes.find((shape) => shape.id === selectedAdvancedOutputShape)
                            ?.description
                        }
                      </small>
                    </label>
                    <label className="advanced-setting-block advanced-setting-block-wide">
                      <span>
                        <strong>自定义要求</strong>
                        <small>写本次重点、语气或结构偏好；不能覆盖隐私和输出约束。</small>
                      </span>
                      <textarea
                        value={selectedAdvancedUserPrompt}
                        maxLength={USER_PROMPT_MAX_LENGTH}
                        placeholder="例如：重点分析我为什么偏好历史与商业类书；结尾给出 3 条下一阶段阅读建议。"
                        onChange={(event) =>
                          setAdvancedUserPromptByTemplate((current) => ({
                            ...current,
                            [selectedAdvancedTemplate.id]: event.target.value,
                          }))
                        }
                      />
                      <small>
                        {selectedAdvancedUserPrompt.length}/{USER_PROMPT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>
              ) : null}
            </section>

          </div>

          <section className="advanced-template-panel advanced-template-history">
            <div className="template-detail-section-title">
              <span>历史记录</span>
            </div>
            {selectedAdvancedTemplateTasks.length === 0 ? (
              <EmptyState title="还没有历史记录" description="生成一次后，这里会显示该模板的历史报告。" />
            ) : (
              <div className="report-history-panel">
                {selectedAdvancedTemplateTasks.map((task) => {
                  const completed = task.status === "completed";
                  const active = task.status === "running" || task.status === "preparing";
                  const status = advancedTaskStatus(task);
                  return (
                    <article key={task.jobId} className="report-history-row">
                      <div>
                        <span className={`report-history-status ${status.tone}`}>{status.label}</span>
                        <small>{new Date(task.createdAt).toLocaleString()}</small>
                        {task.message ? <p>{task.message}</p> : null}
                      </div>
                      <div className="report-history-actions">
                        <button type="button" className="inline-secondary-action" onClick={() => void openAdvancedTask(task)}>
                          查看详情
                        </button>
                        <button
                          type="button"
                          className="inline-secondary-action"
                          disabled={!completed}
                          onClick={() => void openAdvancedReport(task)}
                        >
                          浏览器打开
                        </button>
                        <button
                          type="button"
                          className="inline-danger-action"
                          disabled={active}
                          onClick={() => requestDeleteAdvancedJob(task)}
                        >
                          删除
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          <div className="report-template-hub">
        {report.loading && !report.data ? (
          <Card>
            <Spinner label="正在生成报告数据" />
          </Card>
        ) : null}

        <section className="report-template-section">
          <div className="report-section-heading">
            <div>
              <div className="segmented report-template-tabs" role="tablist" aria-label="模板类型">
                <button
                  type="button"
                  role="tab"
                  aria-selected={templateTab === "basic"}
                  className={templateTab === "basic" ? "active" : ""}
                  onClick={() => setTemplateTab("basic")}
                >
                  基础模板
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={templateTab === "advanced"}
                  className={templateTab === "advanced" ? "active" : ""}
                  onClick={() => setTemplateTab("advanced")}
                >
                  智能体模板
                </button>
              </div>
              <p>
                {templateTab === "basic"
                  ? "不调用大模型，直接基于本地整理后的阅读数据生成报告，千人一面。"
                  : "使用大模型生成报告，选择一个模版，点击开始生成，千人千面。"}
              </p>
            </div>
          </div>

          {templateTab === "basic" ? (
            <div className="report-template-grid">
              {reportTemplates.map((template) => (
                <button
                  key={template.id}
                  className="report-gallery-card"
                  disabled={!report.data}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <span>{template.tagline}</span>
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                  <em>查看报告</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="report-template-grid">
              {advancedReport.templates.map((template) => {
                const task = taskByTemplate.get(template.id);
                const active = task?.status === "running" || task?.status === "preparing";
                const seen = task ? seenAdvancedTaskIds.includes(task.jobId) : false;
                const showTaskStatus = Boolean(task && (active || !seen));
                const completed = showTaskStatus && task?.status === "completed";
                const failed = showTaskStatus && (task?.status === "failed" || task?.status === "canceled");
                const interrupted = showTaskStatus && task?.message?.includes("中断");
                const status = showTaskStatus && task ? advancedTaskStatus(task) : null;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`report-gallery-card advanced-template-tile ${
                      active ? "is-running" : completed ? "is-completed" : failed ? "is-failed" : ""
                    }`}
                    onClick={() => void openAdvancedTemplateDetail(template.id)}
                  >
                    <span>{status?.label ?? templateDataAccessLabel(template.requiresRawNotesConsent)}</span>
                    <strong>{template.name}</strong>
                    <small>
                      {active
                        ? "正在后台生成，可以离开页面。"
                        : completed
                          ? "报告已生成，点击查看详情。"
                          : interrupted
                            ? "上次生成被中断，点击后可重新开始。"
                            : failed
                              ? task?.message ?? "上次生成未完成，点击后可重新开始。"
                              : template.description}
                    </small>
                    <div className="template-card-footer">
                      <em>打开模板</em>
                      {selectedAdvancedTemplateId === template.id ? <i aria-hidden="true" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
          </div>

          {selectedTemplate && selectedTemplateId ? (
            <div className="report-modal-backdrop" role="presentation">
              <section
                className="report-modal task-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${selectedTemplate.name}预览`}
              >
                <header className="report-modal-header">
                  <div>
                    <Badge>{selectedTemplate.tagline}</Badge>
                    <h2>{selectedTemplate.name}</h2>
                    <p>{selectedTemplate.description}</p>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="关闭"
                    onClick={() => setSelectedTemplateId(null)}
                  >
                    <X size={18} />
                  </button>
                </header>

                <div className="report-modal-body">
                  <div className="report-modal-preview">
                    {report.loading && !report.data ? (
                      <Card>
                        <Spinner label="正在生成报告数据" />
                      </Card>
                    ) : report.data ? (
                      <ReportTemplate id={selectedTemplateId} data={report.data} />
                    ) : (
                      <EmptyState title="等待生成报告" description="选择时间范围后会自动整理阅读统计。" />
                    )}
                  </div>

                  <aside className="report-modal-actions">
                    <div>
                      <span>时间范围</span>
                      <select
                        className="report-period-select"
                        value={period}
                        onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
                      >
                        {periodOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {report.data ? (
                      <div>
                        <span>数据覆盖</span>
                        <strong>
                          {report.data.sourceSummary.notebookBooks} 本笔记书 · {report.data.sourceSummary.excerptCount} 条摘录
                        </strong>
                      </div>
                    ) : null}
                    <Button
                      variant="secondary"
                      icon={<Eye size={16} />}
                      disabled={!report.data || openingReport}
                      onClick={() => void previewReport()}
                    >
                      浏览器打开
                    </Button>
                    <Button variant="ghost" icon={<RefreshCw size={16} />} disabled={report.loading} onClick={() => void report.loadReport(period, true)}>
                      刷新数据
                    </Button>
                    {openingReport ? <Spinner label="正在打开报告" /> : null}
                  </aside>
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}

      {taskPendingDelete ? (
        <div className="report-modal-backdrop confirm-backdrop" role="presentation">
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="确认删除报告记录"
          >
            <div>
              <span>确认删除</span>
              <h2>删除这条报告记录？</h2>
              <p>删除后会移除这次生成的本地任务记录和报告文件，无法从应用内恢复。</p>
            </div>
            <div className="confirm-dialog-actions">
              <Button variant="ghost" onClick={() => setTaskPendingDelete(null)}>
                取消
              </Button>
              <Button variant="danger" onClick={() => void confirmDeleteAdvancedJob()}>
                确认删除
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}
