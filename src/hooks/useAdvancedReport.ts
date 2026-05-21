import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getErrorMessage } from "../lib/format";

export type AdvancedReportTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  styleSummary: string;
  requiresRawNotesConsent: boolean;
  defaultCapabilities: string[];
  optionalCapabilities: string[];
};

export type AdvancedReportJobRequest = {
  templateId: string;
  rawNotesConsent: boolean;
  forceRefresh?: boolean | null;
};

export type AdvancedReportTaskStatus = "preparing" | "running" | "completed" | "failed" | "canceled";

export type AdvancedReportTask = {
  jobId: string;
  templateId: string;
  templateName: string;
  status: AdvancedReportTaskStatus;
  message?: string | null;
  jobDir: string;
  reportPath: string;
  createdAt: string;
  updatedAt: string;
};

export type StartAdvancedReportRequest = {
  templateId: string;
  rawNotesConsent: boolean;
  forceRefresh?: boolean | null;
  agent: string;
  model?: string | null;
  binOverride?: string | null;
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

export type AdvancedReportExportResult = {
  success: boolean;
  filePath: string;
  message: string;
};

export type AdvancedReportLogEvent = {
  jobId: string;
  kind: string;
  text: string;
  createdAt: string;
};

export function useAdvancedReport() {
  const [templates, setTemplates] = useState<AdvancedReportTemplate[]>([]);
  const [tasks, setTasks] = useState<AdvancedReportTask[]>([]);
  const [job, setJob] = useState<AdvancedReportJob | null>(null);
  const [output, setOutput] = useState<AdvancedReportOutput | null>(null);
  const [logsByJob, setLogsByJob] = useState<Record<string, AdvancedReportLogEvent[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setError(null);
    try {
      const result = await invoke<AdvancedReportTemplate[]>("list_advanced_report_templates");
      setTemplates(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const createJob = useCallback(async (request: AdvancedReportJobRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AdvancedReportJob>("create_advanced_report_job", { request });
      setJob(result);
      setOutput(null);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const readOutput = useCallback(async (jobId: string) => {
    setError(null);
    try {
      const result = await invoke<AdvancedReportOutput>("read_advanced_report_output", { jobId });
      setOutput(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const exportOutput = useCallback(
    async (request: { jobId: string; outputDir: string }) => {
      setError(null);
      try {
        return await invoke<AdvancedReportExportResult>("export_advanced_report_output", { request });
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      }
    },
    [],
  );

  const loadTasks = useCallback(async () => {
    setError(null);
    try {
      const result = await invoke<AdvancedReportTask[]>("list_advanced_report_tasks");
      setTasks(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const unlisten = listen<{ jobId: string; status: AdvancedReportTaskStatus; message?: string | null }>(
      "advanced-report-task-event",
      () => {
        void loadTasks();
      },
    );
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [loadTasks]);

  useEffect(() => {
    const unlisten = listen<AdvancedReportLogEvent>("advanced-report-log-event", (event) => {
      const log = event.payload;
      setLogsByJob((current) => ({
        ...current,
        [log.jobId]: [...(current[log.jobId] ?? []), log],
      }));
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  const startTask = useCallback(async (request: StartAdvancedReportRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AdvancedReportTask>("start_advanced_report_task", { request });
      setTasks((current) => [result, ...current.filter((task) => task.jobId !== result.jobId)]);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelTask = useCallback(async (jobId: string) => {
    setError(null);
    try {
      const result = await invoke<boolean>("cancel_advanced_report_task", { jobId });
      await loadTasks();
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, [loadTasks]);

  const deleteJob = useCallback(async (jobId: string) => {
    setError(null);
    try {
      const result = await invoke<boolean>("delete_advanced_report_job", { jobId });
      setLogsByJob((current) => {
        const next = { ...current };
        delete next[jobId];
        return next;
      });
      await loadTasks();
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, [loadTasks]);

  const readLogs = useCallback(async (jobId: string) => {
    setError(null);
    try {
      const result = await invoke<AdvancedReportLogEvent[]>("read_advanced_report_logs", { jobId });
      setLogsByJob((current) => ({ ...current, [jobId]: result }));
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  return {
    templates,
    tasks,
    job,
    output,
    logsByJob,
    loading,
    error,
    loadTemplates,
    loadTasks,
    createJob,
    startTask,
    cancelTask,
    deleteJob,
    readOutput,
    readLogs,
    exportOutput,
  };
}
