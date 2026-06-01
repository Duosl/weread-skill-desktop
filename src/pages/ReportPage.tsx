import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { AdvancedTaskHistory } from "../components/report/AdvancedTaskHistory";
import { AdvancedTaskResultCard } from "../components/report/AdvancedTaskResultCard";
import { BasicReportDialog } from "../components/report/BasicReportDialog";
import { ConfirmDialog } from "../components/report/ConfirmDialog";
import { GenerationSettings } from "../components/report/GenerationSettings";
import { CustomTemplateDialog } from "../components/report/CustomTemplateDialog";
import { TemplateCard } from "../components/report/TemplateCard";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Spinner } from "../components/ui/Spinner";
import { useAgentBridge } from "../hooks/useAgentBridge";
import { useAdvancedReport } from "../hooks/useAdvancedReport";
import { useReadingReport } from "../hooks/useReadingReport";
import { getErrorMessage } from "../lib/format";
import {
  advancedTaskStatus,
  buildModelOutputBlocks,
  lastVisibleLine,
  latestModelOutputBlock,
  leadingEllipsisLine,
  trailingEllipsisLine,
} from "../lib/report/advancedTaskView";
import { renderReportHtml, reportHtmlTitle } from "../lib/report/renderHtml";
import { reportTemplates } from "../lib/report/templates";
import type { ReportPeriod, ReportTemplateId } from "../lib/report/types";
import { tauriCommands } from "../lib/tauriCommands";
import type { AdvancedReportTask, AdvancedReportTemplate } from "../hooks/useAdvancedReport";
import type { AdvancedReportDataAccessPreview } from "../types/advancedReport";
import type { ModelOutputMode } from "../types/modelOutput";
import type { CustomTemplate } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { PlusCircle } from "lucide-react";

type ReportPageProps = {
  apiKeySet: boolean;
};

const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: "last_month", label: "上个月" },
  { value: "current_month", label: "本月" },
  { value: "last_year", label: "去年" },
  { value: "current_year", label: "本年" },
  { value: "all", label: "全部" },
];

type TemplateTab = "basic" | "advanced";
const REPORT_TEMPLATE_TAB_STORAGE_KEY = "weread-desktop:report-template-tab";
const SEEN_ADVANCED_TASKS_STORAGE_KEY = "weread-desktop:seen-advanced-report-tasks";

function templateDataAccessDescription(requiresRawNotesConsent: boolean) {
  return requiresRawNotesConsent
    ? "这个模板需要读取你的划线原文和个人想法，请先完成授权。"
    : "使用书架、阅读统计和笔记数量生成；也可以在设置里加入划线和想法。";
}

function templateCategoryLabel(category: string) {
  if (category === "share-ready") return "方便分享";
  if (category === "advanced") return "深度分析";
  return "智能体模板";
}

function advancedTemplateDescription(template: AdvancedReportTemplate) {
  const description = template.description.trim();
  const styleSummary = template.styleSummary.trim();
  if (!styleSummary || styleSummary === description) return description;
  if (!description) return styleSummary;
  return `${description} ${styleSummary}`;
}

function outputShapeName(template: { defaultOutputShape: string; outputShapes: Array<{ id: string; name: string }> }) {
  return template.outputShapes.find((shape) => shape.id === template.defaultOutputShape)?.name ?? template.defaultOutputShape;
}

function taskOutputShapeLabel(task: AdvancedReportTask) {
  return task.outputShapeName?.trim() || task.outputShape?.trim() || "";
}

function taskPeriodLabel(task: AdvancedReportTask) {
  return task.reportPeriodLabel?.trim() || (periodOptions.find((option) => option.value === task.reportPeriod)?.label ?? "");
}

function taskAgentLabel(task: AdvancedReportTask, agents: Array<{ id: string; label: string }>) {
  const agentId = task.agent?.trim();
  if (!agentId) return "";
  return agents.find((agent) => agent.id === agentId)?.label ?? agentId;
}

function taskModelLabel(task: AdvancedReportTask) {
  return task.model?.trim() || "";
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

function loadReportTemplateTab(): TemplateTab {
  if (typeof window === "undefined") return "basic";
  const value = window.localStorage.getItem(REPORT_TEMPLATE_TAB_STORAGE_KEY);
  return value === "advanced" ? "advanced" : "basic";
}

function saveReportTemplateTab(tab: TemplateTab) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REPORT_TEMPLATE_TAB_STORAGE_KEY, tab);
}

export function ReportPage({ apiKeySet }: ReportPageProps) {
  const report = useReadingReport();
  const advancedReport = useAdvancedReport();
  const agentBridge = useAgentBridge();
  const [templateTab, setTemplateTab] = useState<TemplateTab>(() => loadReportTemplateTab());
  const [selectedTemplateId, setSelectedTemplateId] = useState<ReportTemplateId | null>(null);
  const [rawNotesConsent, setRawNotesConsent] = useState(false);
  const [openingReport, setOpeningReport] = useState(false);
  const [selectedAdvancedTemplateId, setSelectedAdvancedTemplateId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<AdvancedReportTask | null>(null);
  const [expandedHistoryTask, setExpandedHistoryTask] = useState<AdvancedReportTask | null>(null);
  const [detailModelOutputMode, setDetailModelOutputMode] = useState<ModelOutputMode>("brief");
  const [historyModelOutputMode, setHistoryModelOutputMode] = useState<ModelOutputMode>("detail");
  const [taskPendingDelete, setTaskPendingDelete] = useState<AdvancedReportTask | null>(null);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [basicPeriodByTemplate, setBasicPeriodByTemplate] = useState<Partial<Record<ReportTemplateId, ReportPeriod>>>({});
  const [advancedPeriodByTemplate, setAdvancedPeriodByTemplate] = useState<Record<string, ReportPeriod>>({});
  const [advancedOutputShapeByTemplate, setAdvancedOutputShapeByTemplate] = useState<Record<string, string>>({});
  const [advancedUserPromptByTemplate, setAdvancedUserPromptByTemplate] = useState<Record<string, string>>({});
  const [seenAdvancedTaskIds, setSeenAdvancedTaskIds] = useState<string[]>(() => loadSeenAdvancedTaskIds());
  const [actionError, setActionError] = useState<string | null>(null);
  const [dataAccessPreview, setDataAccessPreview] = useState<AdvancedReportDataAccessPreview | null>(null);
  const [showCustomTemplateDialog, setShowCustomTemplateDialog] = useState(false);
  const [editingCustomTemplate, setEditingCustomTemplate] = useState<CustomTemplate | null>(null);
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
  const selectedAdvancedPeriod = selectedAdvancedTemplate
    ? (advancedPeriodByTemplate[selectedAdvancedTemplate.id] ?? selectedAdvancedTemplate.defaultReportPeriod)
    : "all";
  const selectedAdvancedOutputShape = selectedAdvancedTemplate
    ? (advancedOutputShapeByTemplate[selectedAdvancedTemplate.id] ?? selectedAdvancedTemplate.defaultOutputShape)
    : "";
  const selectedAdvancedUserPrompt = selectedAdvancedTemplate
    ? (advancedUserPromptByTemplate[selectedAdvancedTemplate.id] ?? "")
    : "";
  const selectedAdvancedOutputShapeName =
    selectedAdvancedTemplate?.outputShapes.find((shape) => shape.id === selectedAdvancedOutputShape)?.name ??
    selectedAdvancedOutputShape;
  const selectedBasicPeriod = selectedTemplateId ? (basicPeriodByTemplate[selectedTemplateId] ?? "all") : "all";
  const selectedAdvancedPeriodLabel = periodOptions.find((item) => item.value === selectedAdvancedPeriod)?.label ?? "全部";
  const selectedTemplateDetailTask =
    selectedAdvancedTemplateId && selectedTask?.templateId === selectedAdvancedTemplateId
      ? selectedTask
      : null;
  const selectedAdvancedTemplateTasks = selectedAdvancedTemplateId
    ? advancedReport.tasks
        .filter((task) => task.templateId === selectedAdvancedTemplateId)
        .filter((task) => task.jobId !== selectedTemplateDetailTask?.jobId)
        .filter((task) => task.status !== "running" && task.status !== "preparing")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const expandedTemplateHistoryTask =
    selectedAdvancedTemplateId && expandedHistoryTask?.templateId === selectedAdvancedTemplateId
      ? expandedHistoryTask
      : null;
  const selectedTemplateLatestTask = selectedAdvancedTemplateId ? taskByTemplate.get(selectedAdvancedTemplateId) : null;
  const selectedTemplateLatestTaskActive =
    selectedTemplateLatestTask?.status === "running" || selectedTemplateLatestTask?.status === "preparing";
  const selectedTemplateLatestTaskSeen = selectedTemplateLatestTask
    ? seenAdvancedTaskIds.includes(selectedTemplateLatestTask.jobId)
    : false;
  const selectedTemplateCurrentTask =
    selectedTemplateLatestTask && (selectedTemplateLatestTaskActive || !selectedTemplateLatestTaskSeen)
      ? selectedTemplateLatestTask
      : null;
  const selectedTemplateCurrentTaskActive =
    selectedTemplateCurrentTask?.status === "running" || selectedTemplateCurrentTask?.status === "preparing";
  const selectedDetailTaskActive =
    selectedTemplateDetailTask?.status === "running" || selectedTemplateDetailTask?.status === "preparing";
  const selectedDetailTaskLogs = selectedTemplateDetailTask
    ? (advancedReport.logsByJob[selectedTemplateDetailTask.jobId] ?? [])
    : [];
  const selectedDetailTaskOutputBlocks = buildModelOutputBlocks(selectedDetailTaskLogs, selectedTemplateDetailTask);
  const selectedDetailTaskLatestBlock = latestModelOutputBlock(selectedDetailTaskOutputBlocks);
  const selectedDetailTaskLatestLine = selectedDetailTaskLatestBlock
    ? lastVisibleLine(selectedDetailTaskLatestBlock.text)
    : "";
  const selectedDetailTaskBriefLine = leadingEllipsisLine(selectedDetailTaskLatestLine || "正在等待新的输出。");
  const selectedDetailTaskOutput =
    selectedTemplateDetailTask && advancedReport.output?.jobId === selectedTemplateDetailTask.jobId
      ? advancedReport.output
      : null;
  const selectedDetailTaskReportAvailable =
    Boolean(selectedDetailTaskOutput?.reportHtml) || selectedTemplateDetailTask?.status === "completed";
  const showAdvancedSettings = Boolean(selectedAdvancedTemplate && advancedSettingsOpen);
  const supportedAgentOptions = agentBridge.agents.filter((agent) => !agent.unsupported);
  const availableAgents = agentBridge.agents.filter((agent) => agent.available && !agent.unsupported);
  const defaultAgent = agentBridge.agents.find((agent) => agent.available && !agent.unsupported) ?? null;
  const selectedAgent =
    agentBridge.agents.find((agent) => agent.id === selectedAgentId && agent.available && !agent.unsupported) ??
    defaultAgent;
  const taskTraceLabels = (task: AdvancedReportTask) =>
    [
      taskOutputShapeLabel(task),
      taskPeriodLabel(task) ? `${taskPeriodLabel(task)}数据` : "",
      taskAgentLabel(task, agentBridge.agents),
      taskModelLabel(task),
    ].filter((label) => label.trim().length > 0);
  const taskTrace = (task: AdvancedReportTask, className = "") => {
    const labels = taskTraceLabels(task);
    if (labels.length === 0) return null;
    return (
      <div className={`task-trace-list ${className}`.trim()} aria-label="任务配置">
        {labels.map((label) => (
          <small key={label}>{label}</small>
        ))}
      </div>
    );
  };
  useEffect(() => {
    if (apiKeySet) {
      void report.loadReport(selectedBasicPeriod);
      void agentBridge.detectAgents();
    }
  }, [apiKeySet, selectedBasicPeriod]);

  useEffect(() => {
    saveReportTemplateTab(templateTab);
  }, [templateTab]);

  useEffect(() => {
    if (!selectedAdvancedTemplate) {
      setDataAccessPreview(null);
      return;
    }
    let canceled = false;
    tauriCommands
      .previewAdvancedReportDataAccess({
        templateId: selectedAdvancedTemplate.id,
        rawNotesConsent,
        reportPeriod: selectedAdvancedPeriod,
      })
      .then((preview) => {
        if (!canceled) setDataAccessPreview(preview);
      })
      .catch(() => {
        if (!canceled) setDataAccessPreview(null);
      });
    return () => {
      canceled = true;
    };
  }, [selectedAdvancedTemplate?.id, selectedAdvancedPeriod, rawNotesConsent]);

  useEffect(() => {
    if (!apiKeySet || report.refreshVersion === 0) return;
    void report.loadReport(selectedBasicPeriod, true);
  }, [apiKeySet, report.refreshVersion, selectedBasicPeriod]);

  useEffect(() => {
    if (!defaultAgent) return;
    if (selectedAgentId && availableAgents.some((agent) => agent.id === selectedAgentId)) return;
    setSelectedAgentId(defaultAgent.id);
  }, [availableAgents, defaultAgent, selectedAgentId]);

  useEffect(() => {
    setActionError(null);
  }, [selectedBasicPeriod, selectedTemplateId, report.data]);

  useEffect(() => {
    if (!selectedTemplateId && !selectedAdvancedTemplateId && !selectedTask && !expandedHistoryTask && !taskPendingDelete) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedTemplateId(null);
        setSelectedAdvancedTemplateId(null);
        setSelectedTask(null);
        setExpandedHistoryTask(null);
        setTaskPendingDelete(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTemplateId, selectedAdvancedTemplateId, selectedTask, expandedHistoryTask, taskPendingDelete]);

  useEffect(() => {
    if (!selectedTask) return;
    const latest = advancedReport.tasks.find((task) => task.jobId === selectedTask.jobId);
    if (latest && latest.updatedAt !== selectedTask.updatedAt) {
      setSelectedTask(latest);
    }
  }, [advancedReport.tasks, selectedTask]);

  useEffect(() => {
    if (!expandedHistoryTask) return;
    const latest = advancedReport.tasks.find((task) => task.jobId === expandedHistoryTask.jobId);
    if (latest && latest.updatedAt !== expandedHistoryTask.updatedAt) {
      setExpandedHistoryTask(latest);
    }
  }, [advancedReport.tasks, expandedHistoryTask]);

  useEffect(() => {
    if (!selectedTemplateDetailTask) return;
    void advancedReport.readLogs(selectedTemplateDetailTask.jobId);
  }, [selectedTemplateDetailTask?.jobId]);

  useEffect(() => {
    if (!expandedTemplateHistoryTask) return;
    void advancedReport.readLogs(expandedTemplateHistoryTask.jobId);
  }, [expandedTemplateHistoryTask?.jobId]);

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
    try {
      const result = await tauriCommands.previewReportHtml(payload.title, payload.html);
      await tauriCommands.openReportFile(result.filePath);
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

    setActionError(null);
    try {
      const task = await advancedReport.startTask({
        templateId,
        rawNotesConsent,
        forceRefresh: false,
        outputShape,
        userPrompt: userPrompt || null,
        reportPeriod: selectedAdvancedPeriod,
        agent: selectedAgent.id,
      });
      setSelectedTask(task);
      void advancedReport.readLogs(task.jobId);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function toggleHistoryTask(task: AdvancedReportTask) {
    if (expandedHistoryTask?.jobId === task.jobId) {
      setExpandedHistoryTask(null);
      return;
    }
    setExpandedHistoryTask(task);
    setActionError(null);
    try {
      await advancedReport.readLogs(task.jobId);
      if (task.status === "completed") {
        await advancedReport.readOutput(task.jobId);
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
      if (!ok) {
        setActionError("任务已经结束或不可取消");
      }
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
    try {
      await advancedReport.deleteJob(task.jobId);
      if (selectedTask?.jobId === task.jobId) {
        setSelectedTask(null);
      }
      if (expandedHistoryTask?.jobId === task.jobId) {
        setExpandedHistoryTask(null);
      }
      setTaskPendingDelete(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  function markAdvancedTaskSeen(jobId: string) {
    setSeenAdvancedTaskIds((current) => {
      if (current.includes(jobId)) return current;
      const next = [...current, jobId];
      saveSeenAdvancedTaskIds(next);
      return next;
    });
  }

  async function openAdvancedTemplateDetail(templateId: string) {
    const template = advancedReport.templates.find((item) => item.id === templateId);
    if (template && !advancedPeriodByTemplate[templateId]) {
      setAdvancedPeriodByTemplate((current) => ({
        ...current,
        [templateId]: template.defaultReportPeriod,
      }));
    }
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
    setExpandedHistoryTask(null);
    if (currentTask && currentTask.status !== "running" && currentTask.status !== "preparing") {
      markAdvancedTaskSeen(currentTask.jobId);
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
      await tauriCommands.openReportFile(path);
      if (selectedTemplateDetailTask?.jobId === task.jobId) {
        markAdvancedTaskSeen(task.jobId);
        setSelectedTask(null);
        setAdvancedSettingsOpen(true);
      }
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
      titleAccessory={
        selectedAdvancedTemplate ? undefined : (
          <SegmentedControl
            className="report-template-tabs"
            ariaLabel="模板类型"
            value={templateTab}
            onChange={setTemplateTab}
            options={[
              { value: "basic", label: "基础模板" },
              { value: "advanced", label: "智能体模板" },
            ]}
          />
        )
      }
      subtitle={
        selectedAdvancedTemplate
          ? selectedAdvancedTemplate.description
          : templateTab === "basic"
            ? "不调用大模型，直接基于本地整理后的阅读数据生成报告，千人一面。"
            : "使用大模型生成报告，选择一个模版，点击开始生成，千人千面。"
      }
      backAction={
        selectedAdvancedTemplate
          ? {
              label: "返回",
              onClick: () => {
                setSelectedAdvancedTemplateId(null);
                setSelectedTask(null);
                setExpandedHistoryTask(null);
              },
            }
          : undefined
      }
      actions={
        selectedAdvancedTemplate && !selectedTemplateDetailTask ? (
          <div className="advanced-template-primary-actions">
            {selectedTemplateCurrentTaskActive && selectedTemplateLatestTask ? (
              <Button
                className="template-action-danger"
                variant="danger"
                onClick={() => void cancelTask(selectedTemplateLatestTask)}
              >
                取消生成
              </Button>
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
        ) : undefined
      }
    >
      <ErrorBanner message={report.error ?? advancedReport.error ?? agentBridge.error ?? actionError} />

      {selectedAdvancedTemplate ? (
        <div className="advanced-template-page">
          <div className="advanced-template-workspace">
            {selectedTemplateDetailTask ? (
              <section className="advanced-template-panel advanced-template-result">
                <div className="template-detail-section-title">
                  <span>{selectedDetailTaskActive ? "生成过程" : "上次生成"}</span>
                  <p>{selectedDetailTaskActive ? "Agent 正在努力生成报告中..." : ""}</p>
                </div>
                <AdvancedTaskResultCard
                  task={selectedTemplateDetailTask}
                  outputBlocks={selectedDetailTaskOutputBlocks}
                  outputMode={detailModelOutputMode}
                  reportAvailable={selectedDetailTaskReportAvailable}
                  latestLine={selectedDetailTaskLatestLine}
                  briefLine={selectedDetailTaskBriefLine}
                  latestKind={selectedDetailTaskLatestBlock?.kind}
                  meta={taskTrace(selectedTemplateDetailTask)}
                  onOutputModeChange={setDetailModelOutputMode}
                  onCancel={(task) => void cancelTask(task)}
                  onOpen={(task) => void openAdvancedReport(task)}
                  onDelete={requestDeleteAdvancedJob}
                  onRegenerate={() => void startAdvancedTemplate(selectedAdvancedTemplate.id)}
                />
              </section>
            ) : null}

            <section className={`advanced-template-panel advanced-generation-config ${showAdvancedSettings ? "is-open" : ""}`}>
              <div className="advanced-generation-strip">
                <div>
                  <span>生成配置</span>
                  <strong>
                    {selectedAdvancedPeriodLabel} · {selectedAdvancedOutputShapeName || ""} ·{" "}
                    {selectedAgent?.label ?? ""}
                  </strong>
                  <p
                    className={
                      selectedAdvancedTemplate.requiresRawNotesConsent && !rawNotesConsent
                        ? "is-warning"
                        : undefined
                    }
                  >
                    {selectedAdvancedUserPrompt.trim()
                      ? `自定义提示词：${trailingEllipsisLine(selectedAdvancedUserPrompt, 42)}`
                      : templateDataAccessDescription(selectedAdvancedTemplate.requiresRawNotesConsent)}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setAdvancedSettingsOpen((current) => !current)}>
                  {showAdvancedSettings ? "收起" : "调整设置"}
                </Button>
              </div>

              {showAdvancedSettings ? (
                <GenerationSettings
                  template={selectedAdvancedTemplate}
                  period={selectedAdvancedPeriod}
                  periodOptions={periodOptions}
                  rawNotesConsent={rawNotesConsent}
                  supportedAgents={supportedAgentOptions}
                  availableAgents={availableAgents}
                  selectedAgent={selectedAgent}
                  outputShape={selectedAdvancedOutputShape}
                  userPrompt={selectedAdvancedUserPrompt}
                  dataAccessPreview={dataAccessPreview}
                  onPeriodChange={(nextPeriod) =>
                    setAdvancedPeriodByTemplate((current) => ({
                      ...current,
                      [selectedAdvancedTemplate.id]: nextPeriod,
                    }))
                  }
                  onRawNotesConsentChange={setRawNotesConsent}
                  onAgentChange={setSelectedAgentId}
                  onOutputShapeChange={(shapeId) =>
                    setAdvancedOutputShapeByTemplate((current) => ({
                      ...current,
                      [selectedAdvancedTemplate.id]: shapeId,
                    }))
                  }
                  onUserPromptChange={(prompt) =>
                    setAdvancedUserPromptByTemplate((current) => ({
                      ...current,
                      [selectedAdvancedTemplate.id]: prompt,
                    }))
                  }
                />
              ) : null}
            </section>

          </div>

          <AdvancedTaskHistory
            tasks={selectedAdvancedTemplateTasks}
            expandedTask={expandedTemplateHistoryTask}
            logsByJob={advancedReport.logsByJob}
            mode={historyModelOutputMode}
            onModeChange={setHistoryModelOutputMode}
            renderTrace={taskTrace}
            onToggleTask={(task) => void toggleHistoryTask(task)}
            onOpen={(task) => void openAdvancedReport(task)}
            onDelete={requestDeleteAdvancedJob}
          />
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
          {templateTab === "basic" ? (
            <div className="report-template-grid">
              {reportTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  label={template.tagline}
                  title={template.name}
                  description={template.description}
                  footer=""
                  disabled={!report.data}
                  onClick={() => setSelectedTemplateId(template.id)}
                  meta={
                    <>
                      <small>无需大模型</small>
                      <small>
                        {periodOptions.find((option) => option.value === (basicPeriodByTemplate[template.id] ?? "all"))?.label ?? "全部"}
                      </small>
                    </>
                  }
                />
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
                const description = advancedTemplateDescription(template);
                return (
                  <TemplateCard
                    key={template.id}
                    label={status?.label ?? ""}
                    title={template.name}
                    description={
                      active
                        ? "正在后台生成，可以离开页面。"
                        : completed
                          ? "报告已生成，点击查看详情。"
                          : interrupted
                            ? "上次生成被中断，点击后可重新开始。"
                            : failed
                              ? task?.message ?? "上次生成未完成，点击后可重新开始。"
                              : description
                    }
                    statusTone={active ? "running" : completed ? "success" : failed ? "danger" : undefined}
                    selected={selectedAdvancedTemplateId === template.id}
                    footer=""
                    onClick={() => void openAdvancedTemplateDetail(template.id)}
                    meta={
                      <>
                        <small>{templateCategoryLabel(template.category)}</small>
                        <small>{outputShapeName(template)}</small>
                      </>
                    }
                  />
                );
              })}
              <button
                type="button"
                className="custom-template-create-card"
                onClick={() => {
                  setEditingCustomTemplate(null);
                  setShowCustomTemplateDialog(true);
                }}
              >
                <PlusCircle size={24} />
                <span>创建模板</span>
              </button>
            </div>
          )}
        </section>
          </div>

          {selectedTemplate && selectedTemplateId ? (
            <BasicReportDialog
              template={selectedTemplate}
              templateId={selectedTemplateId}
              data={report.data}
              loading={report.loading}
              openingReport={openingReport}
              selectedPeriod={selectedBasicPeriod}
              periodOptions={periodOptions}
              onPeriodChange={(period) => {
                setBasicPeriodByTemplate((current) => ({
                  ...current,
                  [selectedTemplateId]: period,
                }));
              }}
              onPreview={() => void previewReport()}
              onClose={() => setSelectedTemplateId(null)}
            />
          ) : null}
        </>
      )}

      {taskPendingDelete ? (
        <ConfirmDialog
          eyebrow="确认删除"
          title="删除这条报告记录？"
          description="删除后会移除这次生成的本地任务记录和报告文件，无法从应用内恢复。"
          confirmLabel="确认删除"
          onCancel={() => setTaskPendingDelete(null)}
          onConfirm={() => void confirmDeleteAdvancedJob()}
        />
      ) : null}

      {showCustomTemplateDialog ? (
        <CustomTemplateDialog
          template={editingCustomTemplate}
          onSave={async (request) => {
            if (editingCustomTemplate) {
              await invoke("update_custom_template", {
                templateId: editingCustomTemplate.id,
                request,
              });
            } else {
              await invoke("create_custom_template", { request });
            }
            await advancedReport.loadTemplates();
          }}
          onClose={() => {
            setShowCustomTemplateDialog(false);
            setEditingCustomTemplate(null);
          }}
        />
      ) : null}
    </PageShell>
  );
}
