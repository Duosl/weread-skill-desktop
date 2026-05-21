import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Download, Eye, RefreshCw, Trash2, X } from "lucide-react";
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
import type { AppSettings } from "../types";
import type { AdvancedReportLogEvent, AdvancedReportTask } from "../hooks/useAdvancedReport";

type ReportPageProps = {
  apiKeySet: boolean;
  settings: AppSettings;
};

const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: "month", label: "本月" },
  { value: "year", label: "今年" },
  { value: "all", label: "全部" },
];

type ReportHtmlExportResult = {
  success: boolean;
  filePath: string;
  message: string;
};

type TemplateTab = "basic" | "advanced";
type LogViewMode = "brief" | "detail";

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

export function ReportPage({ apiKeySet, settings }: ReportPageProps) {
  const report = useReadingReport();
  const advancedReport = useAdvancedReport();
  const agentBridge = useAgentBridge();
  const [period, setPeriod] = useState<ReportPeriod>("year");
  const [templateTab, setTemplateTab] = useState<TemplateTab>("advanced");
  const [selectedTemplateId, setSelectedTemplateId] = useState<ReportTemplateId | null>(null);
  const [rawNotesConsent, setRawNotesConsent] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [selectedAdvancedTemplateId, setSelectedAdvancedTemplateId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<AdvancedReportTask | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<AdvancedReportTask | null>(null);
  const [logViewMode, setLogViewMode] = useState<LogViewMode>("brief");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const selectedTemplate = reportTemplates.find((item) => item.id === selectedTemplateId) ?? null;
  const taskByTemplate = new Map<string, AdvancedReportTask>();

  for (const task of advancedReport.tasks) {
    const current = taskByTemplate.get(task.templateId);
    const taskActive = task.status === "running" || task.status === "preparing";
    const currentActive = current?.status === "running" || current?.status === "preparing";
    if (!current || (taskActive && !currentActive)) {
      taskByTemplate.set(task.templateId, task);
    }
  }
  const selectedAdvancedTemplate =
    advancedReport.templates.find((item) => item.id === selectedAdvancedTemplateId) ?? null;
  const selectedAdvancedTemplateTasks = selectedAdvancedTemplateId
    ? advancedReport.tasks
        .filter((task) => task.templateId === selectedAdvancedTemplateId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const selectedAdvancedTemplateTask = selectedAdvancedTemplateId
    ? (taskByTemplate.get(selectedAdvancedTemplateId) ?? null)
    : null;
  const selectedTaskActive = selectedTask?.status === "running" || selectedTask?.status === "preparing";
  const selectedTaskLogs = selectedTask ? (advancedReport.logsByJob[selectedTask.jobId] ?? []) : [];
  const selectedTaskOutputBlocks = buildModelOutputBlocks(selectedTaskLogs);
  const selectedTaskLatestBlock = latestModelOutputBlock(selectedTaskOutputBlocks);
  const selectedTaskLatestLine = selectedTaskLatestBlock ? lastVisibleLine(selectedTaskLatestBlock.text) : "";
  const selectedTaskBriefLine = leadingEllipsisLine(selectedTaskLatestLine || "正在等待新的输出。");
  const shouldShowSelectedTaskLogs = selectedTaskActive || selectedTaskLogs.length > 0;
  const selectedTaskOutput =
    selectedTask && advancedReport.output?.jobId === selectedTask.jobId ? advancedReport.output : null;
  const selectedTaskCompleted = selectedTask?.status === "completed";
  const selectedTaskReportAvailable = Boolean(selectedTaskOutput?.reportHtml) || selectedTaskCompleted;
  const defaultAgent = agentBridge.agents.find((agent) => agent.available && !agent.unsupported) ?? null;

  useEffect(() => {
    if (apiKeySet) {
      void report.loadReport(period);
      void agentBridge.detectAgents();
    }
  }, [apiKeySet, period]);

  useEffect(() => {
    setExportedPath(null);
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
    if (!selectedTask) return;
    void advancedReport.readLogs(selectedTask.jobId);
  }, [selectedTask?.jobId]);

  useEffect(() => {
    if (!selectedTask || selectedTask.status !== "completed") return;
    if (advancedReport.output?.jobId === selectedTask.jobId && advancedReport.output.reportHtml) return;
    void advancedReport.readOutput(selectedTask.jobId).catch((error) => {
      setActionError(getErrorMessage(error));
    });
  }, [selectedTask?.jobId, selectedTask?.status, advancedReport.output?.jobId, advancedReport.output?.reportHtml]);

  function buildHtmlPayload() {
    if (!report.data || !selectedTemplateId) return;
    const title = reportHtmlTitle(selectedTemplateId, report.data);
    const html = renderReportHtml(selectedTemplateId, report.data);
    return { title, html };
  }

  async function exportHtml() {
    const payload = buildHtmlPayload();
    if (!payload) return;

    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: settings.lastExportDir,
    });
    if (typeof selected !== "string") {
      setActionError(null);
      setActionNotice("已取消选择导出目录");
      return;
    }

    setExporting(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await invoke<ReportHtmlExportResult>("export_report_html", {
        outputDir: selected,
        title: payload.title,
        html: payload.html,
      });
      setExportedPath(result.filePath);
      setActionNotice(result.message);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  async function previewReport() {
    const payload = buildHtmlPayload();
    if (!payload) return;

    setExporting(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await invoke<ReportHtmlExportResult>("preview_report_html", {
        title: payload.title,
        html: payload.html,
      });
      await invoke("open_report_file", { path: result.filePath });
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  async function startAdvancedTemplate(templateId: string) {
    const template = advancedReport.templates.find((item) => item.id === templateId);
    if (!template) return;
    if (template.requiresRawNotesConsent && !rawNotesConsent) {
      setActionError("请先确认允许读取个人划线和想法");
      return;
    }
    if (!defaultAgent) {
      setActionError("未检测到可用的本地 Agent，请先安装 Claude Code、Codex 或其他支持的 CLI");
      return;
    }

    setActionError(null);
    setActionNotice(null);
    try {
      const task = await advancedReport.startTask({
        templateId,
        rawNotesConsent,
        forceRefresh: false,
        agent: defaultAgent.id,
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
    setSelectedAdvancedTemplateId(templateId);
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

  async function exportAdvancedReport(task = selectedTask) {
    const jobId = task?.jobId;
    if (!jobId) return;

    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: settings.lastExportDir,
    });
    if (typeof selected !== "string") {
      setActionError(null);
      setActionNotice("已取消选择导出目录");
      return;
    }

    setExporting(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await advancedReport.exportOutput({
        jobId,
        outputDir: selected,
      });
      setExportedPath(result.filePath);
      setActionNotice(result.message);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setExporting(false);
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
      title="阅读报告"
      action={
        <Button
          variant="primary"
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
      {exportedPath ? <div className="success-text">报告已导出到所选目录</div> : null}

      <div className="report-template-hub">
        <Card className="report-hub-toolbar">
          <div>
            <Badge>阅读报告</Badge>
            <span>{report.data ? `数据生成于 ${report.data.profile.generatedAt}` : "选择时间范围后整理阅读数据"}</span>
          </div>
          <div className="segmented report-period-tabs">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                className={period === option.value ? "active" : ""}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>

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
                const completed = task?.status === "completed";
                const failed = task?.status === "failed" || task?.status === "canceled";
                const interrupted = task?.message?.includes("中断");
                const status = task ? advancedTaskStatus(task) : null;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`report-gallery-card advanced-template-tile ${
                      active ? "is-running" : completed ? "is-completed" : failed ? "is-failed" : ""
                    }`}
                    onClick={() => void openAdvancedTemplateDetail(template.id)}
                  >
                    <span>
                      {status?.label ?? (template.requiresRawNotesConsent ? "深度分析" : "轻量建议")}
                    </span>
                    <strong>{template.name}</strong>
                    <small>
                      {active
                        ? "正在后台生成，可以离开页面。"
                        : completed
                          ? "报告已生成，点击查看详情。"
                          : interrupted
                            ? "上次生成被中断，点击后可重新开始。"
                            : task?.message ?? template.description}
                    </small>
                    <div className="template-card-footer">
                      <em>{completed ? "查看详情" : active ? "查看进度" : failed ? "重新处理" : "打开模板"}</em>
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
                  <strong>{periodOptions.find((item) => item.value === period)?.label}</strong>
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
                  disabled={!report.data || exporting}
                  onClick={() => void previewReport()}
                >
                  浏览器打开
                </Button>
                <Button
                  variant="primary"
                  className="report-action-primary"
                  icon={<Download size={16} />}
                  disabled={!report.data || exporting}
                  onClick={() => void exportHtml()}
                >
                  导出报告
                </Button>
                <Button variant="ghost" icon={<RefreshCw size={16} />} disabled={report.loading} onClick={() => void report.loadReport(period, true)}>
                  刷新数据
                </Button>
                {exporting ? <Spinner label="正在处理报告" /> : null}
              </aside>
            </div>
          </section>
        </div>
      ) : null}

      {selectedAdvancedTemplate ? (
        <div className="report-modal-backdrop" role="presentation">
          <section
            className="report-modal compact-report-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedAdvancedTemplate.name}模板详情`}
          >
            <header className="report-modal-header">
              <div>
                <h2>{selectedAdvancedTemplate.name}</h2>
                <p>{selectedAdvancedTemplateTask?.message ?? selectedAdvancedTemplate.description}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭"
                onClick={() => setSelectedAdvancedTemplateId(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="advanced-template-detail">
              <section className="advanced-template-summary">
                <div>
                  <span>模板说明</span>
                  <p>{selectedAdvancedTemplate.styleSummary || selectedAdvancedTemplate.description}</p>
                </div>
                <div className="advanced-template-primary-actions">
                  {selectedAdvancedTemplateTask?.status === "running" ||
                  selectedAdvancedTemplateTask?.status === "preparing" ? (
                    <>
                      <Button
                        className="template-action-main"
                        variant="primary"
                        onClick={() => void openAdvancedTask(selectedAdvancedTemplateTask)}
                      >
                        查看进度
                      </Button>
                      <Button
                        className="template-action-danger"
                        variant="danger"
                        onClick={() => void cancelTask(selectedAdvancedTemplateTask)}
                      >
                        取消生成
                      </Button>
                    </>
                  ) : selectedAdvancedTemplateTask?.status === "completed" ? (
                    <>
                      <Button
                        className="template-action-main"
                        variant="primary"
                        icon={<Eye size={16} />}
                        onClick={() => void openAdvancedReport(selectedAdvancedTemplateTask)}
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
                        (selectedAdvancedTemplate.requiresRawNotesConsent && !rawNotesConsent)
                      }
                      onClick={() => void startAdvancedTemplate(selectedAdvancedTemplate.id)}
                    >
                      开始生成
                    </Button>
                  )}
                </div>
              </section>

              <section className="advanced-template-settings">
                <div className="template-detail-section-title">
                  <span>生成设置</span>
                  <p>默认使用全部可用阅读数据；需要调整时，只影响这个模板接下来的生成。</p>
                </div>
                {agentBridge.agents.length > 0 &&
                agentBridge.agents.every((agent) => !agent.available || agent.unsupported) ? (
                  <ErrorBanner message="没有检测到可用的本地 Agent。安装 Claude Code、Codex 或其他支持的 CLI 后再生成智能体报告。" />
                ) : null}
                <div className="advanced-settings-strip template-settings-strip">
                  <label className="advanced-setting-block privacy">
                    <input
                      type="checkbox"
                      checked={rawNotesConsent}
                      onChange={(event) => setRawNotesConsent(event.target.checked)}
                    />
                    <span>
                      <strong>使用个人划线和想法</strong>
                      <small>默认开启，用于生成更完整的个人阅读分析。</small>
                    </span>
                  </label>
                </div>
              </section>

              <section className="advanced-template-history">
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
          </section>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="report-modal-backdrop" role="presentation">
          <section
            className="report-modal task-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedTask.templateName}报告`}
          >
            <header className="report-modal-header">
              <div>
                <Badge className={`task-status-badge ${advancedTaskStatus(selectedTask).tone}`}>
                  {advancedTaskStatus(selectedTask).label}
                </Badge>
                <h2>{selectedTask.templateName}</h2>
                <p>{selectedTask.message ?? "报告任务正在后台处理。"}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭"
                onClick={() => setSelectedTask(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="advanced-task-detail">
              <div className="advanced-task-main">
                <section className={`advanced-task-status-card ${advancedTaskStatus(selectedTask).tone}`}>
                  <div>
                    <span>当前状态</span>
                    <h3>
                      {selectedTask.status === "completed"
                        ? "报告已生成"
                        : selectedTaskActive
                          ? "正在后台生成"
                          : "报告未完成"}
                    </h3>
                    <p>
                      {selectedTask.status === "completed"
                        ? "报告已经生成完成，可直接用浏览器打开查看。"
                        : selectedTaskActive
                          ? "生成任务仍在后台运行，关闭这个窗口不会取消任务。"
                          : selectedTask.message ?? "这次生成没有产出可查看的报告。"}
                    </p>
                  </div>
                  <Button
                    className="task-action-main"
                    variant="primary"
                    icon={<Eye size={16} />}
                    disabled={!selectedTaskReportAvailable}
                    onClick={() => void openAdvancedReport()}
                  >
                    浏览器打开
                  </Button>
                </section>

                {shouldShowSelectedTaskLogs ? (
                  <section className="advanced-task-log-section">
                    <div className="advanced-task-log-header">
                      <div className="advanced-task-log-title">
                        <strong>生成过程</strong>
                        <small>
                          {logViewMode === "brief"
                            ? "简洁模式只显示状态和最新内容"
                            : selectedTaskOutputBlocks.length
                              ? `${selectedTaskOutputBlocks.length} 段内容`
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
                    <div
                      className={`advanced-task-log-panel ${logViewMode === "brief" ? "brief" : ""}`}
                      aria-live={selectedTaskActive ? "polite" : "off"}
                    >
                      {selectedTaskOutputBlocks.length === 0 ? (
                        <p className="advanced-task-log-empty">本地 Agent 启动后，这里会显示生成过程。</p>
                      ) : logViewMode === "brief" ? (
                        <p className={`advanced-task-log-brief ${selectedTaskLatestBlock?.kind ?? "system"}`}>
                          <strong>{advancedTaskStatus(selectedTask).label}</strong>
                          <span title={selectedTaskLatestLine || undefined}>{selectedTaskBriefLine}</span>
                        </p>
                      ) : (
                        selectedTaskOutputBlocks.map((block, index) => (
                          <article key={`${block.kind}-${index}`} className={`model-output-block ${block.kind}`}>
                            <span>{block.title}</span>
                            <p>{block.text}</p>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="report-modal-actions">
                <div className="task-action-group">
                  <span>常用操作</span>
                  <Button
                    variant="secondary"
                    icon={<Download size={16} />}
                    disabled={!selectedTaskReportAvailable || exporting}
                    onClick={() => void exportAdvancedReport()}
                  >
                    导出报告
                  </Button>
                </div>
                <div className="task-action-group danger-zone">
                  <span>任务管理</span>
                  {selectedTask.status === "running" || selectedTask.status === "preparing" ? (
                    <Button variant="danger" icon={<X size={16} />} onClick={() => void cancelTask(selectedTask)}>
                      取消生成
                    </Button>
                  ) : null}
                  {selectedTask.status !== "running" && selectedTask.status !== "preparing" ? (
                    <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => requestDeleteAdvancedJob(selectedTask)}>
                      删除任务
                    </Button>
                  ) : null}
                </div>
                {advancedReport.loading ? <Spinner label="正在准备智能体报告工作区" /> : null}
                {(selectedTask.status === "running" || selectedTask.status === "preparing") ? (
                  <Spinner label="本地 Agent 正在生成报告" />
                ) : null}
                <p>报告正文不在应用内预览，完成后请用浏览器查看完整效果。</p>
              </aside>
            </div>
          </section>
        </div>
      ) : null}

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
