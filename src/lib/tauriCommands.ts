import { invoke } from "@tauri-apps/api/core";
import type {
  AdvancedReportJob,
  AdvancedReportJobRequest,
  AdvancedReportLogEvent,
  AdvancedReportOutput,
  AdvancedReportTask,
  AdvancedReportTemplate,
  StartAdvancedReportRequest,
} from "../types/advancedReport";

export type ReportHtmlPreviewResult = {
  filePath: string;
};

export const tauriCommands = {
  listAdvancedReportTemplates() {
    return invoke<AdvancedReportTemplate[]>("list_advanced_report_templates");
  },
  createAdvancedReportJob(request: AdvancedReportJobRequest) {
    return invoke<AdvancedReportJob>("create_advanced_report_job", { request });
  },
  readAdvancedReportOutput(jobId: string) {
    return invoke<AdvancedReportOutput>("read_advanced_report_output", { jobId });
  },
  listAdvancedReportTasks() {
    return invoke<AdvancedReportTask[]>("list_advanced_report_tasks");
  },
  startAdvancedReportTask(request: StartAdvancedReportRequest) {
    return invoke<AdvancedReportTask>("start_advanced_report_task", { request });
  },
  cancelAdvancedReportTask(jobId: string) {
    return invoke<boolean>("cancel_advanced_report_task", { jobId });
  },
  deleteAdvancedReportJob(jobId: string) {
    return invoke<boolean>("delete_advanced_report_job", { jobId });
  },
  readAdvancedReportLogs(jobId: string) {
    return invoke<AdvancedReportLogEvent[]>("read_advanced_report_logs", { jobId });
  },
  previewReportHtml(title: string, html: string) {
    return invoke<ReportHtmlPreviewResult>("preview_report_html", { title, html });
  },
  openReportFile(path: string) {
    return invoke<void>("open_report_file", { path });
  },
};
