import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NotebookBook } from "../types";
import { getErrorMessage } from "../lib/format";

export function useNotebooks() {
  const [books, setBooks] = useState<NotebookBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotebooks = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const collected: NotebookBook[] = [];
      let lastSort = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await invoke<{ books: NotebookBook[]; hasMore: number }>(
          "get_notebooks",
          { count: 50, lastSort, forceRefresh },
        );
        collected.push(...result.books);
        hasMore = result.hasMore === 1 && result.books.length > 0;
        lastSort = result.books[result.books.length - 1]?.sort ?? 0;
      }

      setBooks(collected);
      return collected;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { books, loading, error, loadNotebooks };
}
