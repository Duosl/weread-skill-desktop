import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getErrorMessage } from "../lib/format";
import { tauriCommands } from "../lib/tauriCommands";
import type {
  AdvancedReportJob,
  AdvancedReportJobRequest,
  AdvancedReportLogEvent,
  AdvancedReportOutput,
  AdvancedReportTask,
  AdvancedReportTaskStatus,
  AdvancedReportTemplate,
  StartAdvancedReportRequest,
} from "../types/advancedReport";
export type {
  AdvancedReportJob,
  AdvancedReportJobRequest,
  AdvancedReportLogEvent,
  AdvancedReportOutput,
  AdvancedReportOutputShape,
  AdvancedReportTask,
  AdvancedReportTaskStatus,
  AdvancedReportTemplate,
  StartAdvancedReportRequest,
} from "../types/advancedReport";

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
      const result = await tauriCommands.listAdvancedReportTemplates();
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
      const result = await tauriCommands.createAdvancedReportJob(request);
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
      const result = await tauriCommands.readAdvancedReportOutput(jobId);
      setOutput(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setError(null);
    try {
      const result = await tauriCommands.listAdvancedReportTasks();
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
      const result = await tauriCommands.startAdvancedReportTask(request);
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
      const result = await tauriCommands.cancelAdvancedReportTask(jobId);
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
      const result = await tauriCommands.deleteAdvancedReportJob(jobId);
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
      const result = await tauriCommands.readAdvancedReportLogs(jobId);
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
  };
}
