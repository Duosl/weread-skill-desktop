import type { ReportPeriod } from "../lib/report/types";

export type AdvancedReportTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  styleSummary: string;
  defaultReportPeriod: ReportPeriod;
  defaultOutputShape: string;
  outputShapes: AdvancedReportOutputShape[];
  requiresRawNotesConsent: boolean;
  defaultCapabilities: string[];
  optionalCapabilities: string[];
};

export type AdvancedReportOutputShape = {
  id: string;
  name: string;
  description: string;
};

export type AdvancedReportJobRequest = {
  templateId: string;
  rawNotesConsent: boolean;
  forceRefresh?: boolean | null;
  outputShape?: string | null;
  userPrompt?: string | null;
  reportPeriod?: ReportPeriod | string | null;
};

export type AdvancedReportTaskStatus = "preparing" | "running" | "completed" | "failed" | "canceled";

export type AdvancedReportTask = {
  jobId: string;
  templateId: string;
  templateName: string;
  status: AdvancedReportTaskStatus;
  message?: string | null;
  outputShape?: string | null;
  outputShapeName?: string | null;
  reportPeriod?: string | null;
  reportPeriodLabel?: string | null;
  agent?: string | null;
  model?: string | null;
  jobDir: string;
  reportPath: string;
  createdAt: string;
  updatedAt: string;
};

export type StartAdvancedReportRequest = {
  templateId: string;
  rawNotesConsent: boolean;
  forceRefresh?: boolean | null;
  outputShape?: string | null;
  userPrompt?: string | null;
  reportPeriod?: string | null;
  agent: string;
  model?: string | null;
  binOverride?: string | null;
};

export type AdvancedReportDataAccessPreviewRequest = {
  templateId: string;
  rawNotesConsent: boolean;
  reportPeriod?: string | null;
};

export type AdvancedReportDataAccessPreview = {
  templateId: string;
  periodLabel: string;
  willRead: string[];
  mayRead: string[];
  willNotRead: string[];
  rawNotesRequired: boolean;
  rawNotesEnabled: boolean;
  summary: string;
};

export type AdvancedReportJob = {
  jobId: string;
  templateId: string;
  templateName: string;
  jobDir: string;
  inputDir: string;
  dataDir: string;
  outputDir: string;
  promptPath: string;
  status: string;
  createdAt: string;
};

export type AdvancedReportOutput = {
  jobId: string;
  reportHtml?: string | null;
  meta?: unknown;
  reportPath: string;
  metaPath: string;
  validation: {
    ok: boolean;
    warnings: string[];
  };
};

export type AdvancedReportLogEvent = {
  jobId: string;
  kind: string;
  text: string;
  createdAt: string;
};
