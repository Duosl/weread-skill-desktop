import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ImaConnectionTestResult,
  ImaKnowledgeBaseOption,
  ImaKnowledgeBasePage,
} from "@/types";
import { getErrorMessage } from "@/lib/format";

export function useImaConnector() {
  const [knowledgeBases, setKnowledgeBases] = useState<ImaKnowledgeBaseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const loadKnowledgeBases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await invoke<ImaKnowledgeBasePage>(
        "list_addable_ima_knowledge_bases",
        { cursor: null, limit: 50 },
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
    error,
    message,
    setKnowledgeBases,
    setMessage,
    setError,
    testConnection,
    loadKnowledgeBases,
  };
}
