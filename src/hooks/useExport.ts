import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ExportOptions, ExportResult } from "../types";
import { getErrorMessage } from "../lib/format";

export function useExport() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExport(options: ExportOptions) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const command = options.format === "json" ? "export_to_json" : "export_to_markdown";
      const exportResult = await invoke<ExportResult>(command, { options });
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

  return { loading, result, error, runExport, openExportFolder };
}
