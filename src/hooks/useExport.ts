import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ExportOptions, ExportProgress, ExportResult } from "../types";
import { getErrorMessage } from "../lib/format";

export function useExport() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  useEffect(() => {
    const unlisten = listen<ExportProgress>("export-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function runExport(options: ExportOptions) {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const exportResult = await invoke<ExportResult>("export_to_markdown", { options });
      setResult(exportResult);
      return exportResult;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function openExportFolder(path: string) {
    await invoke("open_export_folder", { path });
  }

  return { loading, result, error, progress, runExport, openExportFolder };
}
