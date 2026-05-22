import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  ImaConnectionTestResult,
  ImaKnowledgeBaseOption,
  ImaKnowledgeBasePage,
  ImaSyncOptions,
  ImaSyncProgress,
  ImaSyncResult,
} from "@/types";
import { getErrorMessage } from "@/lib/format";

export function useImaConnector() {
  const [knowledgeBases, setKnowledgeBases] = useState<ImaKnowledgeBaseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<ImaSyncProgress | null>(null);
  const [syncResult, setSyncResult] = useState<ImaSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<ImaSyncProgress>("ima-sync-progress", (event) => {
      setSyncProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await invoke<ImaConnectionTestResult>("test_ima_connection");
      setKnowledgeBases(result.knowledgeBases);
      setMessage(result.message);
      return result;
    } catch (err) {
      const nextError = getErrorMessage(err);
      setError(nextError);
      throw err;
    } finally {
      setTesting(false);
    }
  }, []);

  const syncBooks = useCallback(async (options: ImaSyncOptions) => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    setSyncResult(null);
    setSyncProgress({
      current: 0,
      total: options.bookIds.length,
      title: "",
    });
    try {
      const result = await invoke<ImaSyncResult>("sync_books_to_ima", { options });
      setSyncResult(result);
      setMessage(`已同步 ${result.successCount} 本，跳过 ${result.skippedCount} 本，失败 ${result.failedCount} 本`);
      return result;
    } catch (err) {
      const nextError = getErrorMessage(err);
      setError(nextError);
      throw err;
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }, []);

  const loadKnowledgeBases = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const page = await invoke<ImaKnowledgeBasePage>(
        "list_addable_ima_knowledge_bases",
        { cursor: null, limit: 20, forceRefresh },
      );
      setKnowledgeBases(page.items);
      return page.items;
    } catch (err) {
      const nextError = getErrorMessage(err);
      setError(nextError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    knowledgeBases,
    loading,
    testing,
    syncing,
    syncProgress,
    error,
    message,
    syncResult,
    setKnowledgeBases,
    setMessage,
    setError,
    testConnection,
    loadKnowledgeBases,
    syncBooks,
  };
}
