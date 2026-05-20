import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Download, Eye, RefreshCw, Share2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Spinner } from "../components/ui/Spinner";
import { useReadingReport } from "../hooks/useReadingReport";
import { getErrorMessage } from "../lib/format";
import { renderReportHtml, reportHtmlTitle } from "../lib/report/renderHtml";
import { ReportTemplate, reportTemplates } from "../lib/report/templates";
import type { ReportPeriod, ReportTemplateId } from "../lib/report/types";
import type { AppSettings } from "../types";

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

export function ReportPage({ apiKeySet, settings }: ReportPageProps) {
  const report = useReadingReport();
  const [period, setPeriod] = useState<ReportPeriod>("year");
  const [selectedTemplateId, setSelectedTemplateId] = useState<ReportTemplateId | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const selectedTemplate = reportTemplates.find((item) => item.id === selectedTemplateId) ?? null;

  useEffect(() => {
    if (apiKeySet) {
      void report.loadReport(period);
    }
  }, [apiKeySet, period]);

  useEffect(() => {
    setExportedPath(null);
    setActionError(null);
    setActionNotice(null);
  }, [period, selectedTemplateId, report.data]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedTemplateId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTemplateId]);

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

  if (!apiKeySet) {
    return (
      <PageShell title="阅读报告">
        <EmptyState
          title="先配置 API Key"
          description="完成连接后可以生成 HTML 阅读报告。"
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
      title="导出模板"
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
      <ErrorBanner message={report.error ?? actionError} />
      {actionNotice ? <div className="success-text">{actionNotice}</div> : null}
      {exportedPath ? <div className="success-text">已导出：{exportedPath}</div> : null}

      <div className="report-template-hub">
        <Card className="report-hub-toolbar">
          <div>
            <Badge>HTML 报告</Badge>
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
              <h2>基础模板</h2>
              <p>不调用大模型，直接基于本地整理后的阅读数据生成 HTML。</p>
            </div>
          </div>
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
                <em>打开模板</em>
              </button>
            ))}
          </div>
        </section>

        <section className="report-template-section">
          <div className="report-section-heading">
            <div>
              <h2>高级模板</h2>
              <p>后续接入本地 CLI 与提示词模板，生成解释型报告和分享版本。</p>
            </div>
          </div>
          <div className="report-template-grid">
            {["阅读人格分析", "知识结构盲区", "下一阶段阅读建议"].map((name) => (
              <button key={name} className="report-gallery-card pending" disabled>
                <span>本地 CLI</span>
                <strong>{name}</strong>
                <small>将通过封装库调用本地命令，读取模板输入目录并产出可预览 HTML。</small>
                <em>规划中</em>
              </button>
            ))}
          </div>
        </section>
      </div>

      {selectedTemplate && selectedTemplateId ? (
        <div className="report-modal-backdrop" role="presentation">
          <section
            className="report-modal"
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
                  icon={<Download size={16} />}
                  disabled={!report.data || exporting}
                  onClick={() => void exportHtml()}
                >
                  导出 HTML
                </Button>
                <Button variant="ghost" icon={<RefreshCw size={16} />} disabled={report.loading} onClick={() => void report.loadReport(period, true)}>
                  刷新数据
                </Button>
                <Button variant="ghost" icon={<Share2 size={16} />} disabled title="分享能力将在高级报告方案中实现">
                  分享版本
                </Button>
                {exporting ? <Spinner label="正在处理报告" /> : null}
                <p>分享版本会在后续生成带应用署名的 HTML，用于用户传播和回链。</p>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}
