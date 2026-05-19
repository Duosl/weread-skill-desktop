import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ReadingStatsResult } from "../types";
import { getErrorMessage } from "../lib/format";

export function useReadingStats() {
  const [stats, setStats] = useState<ReadingStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ReadingStatsResult>("get_reading_stats", {
        mode: "overall",
        baseTime: 0,
        forceRefresh,
      });
      setStats(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, loadStats };
}
