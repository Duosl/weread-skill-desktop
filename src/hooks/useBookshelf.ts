import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ShelfBook, ShelfSyncResult } from "@/types";
import { getErrorMessage } from "@/lib/format";

export type ShelfFilter = "all" | "finished" | "reading";

export function useBookshelf() {
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<ShelfFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncShelf = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ShelfSyncResult>("sync_shelf", { forceRefresh });
      setBooks(result.books);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredBooks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return books.filter((book) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "finished" && book.finishReading === 1) ||
        (filter === "reading" && book.finishReading !== 1);
      const matchesQuery =
        !keyword ||
        book.title.toLowerCase().includes(keyword) ||
        book.author.toLowerCase().includes(keyword);
      return matchesFilter && matchesQuery;
    });
  }, [books, filter, query]);

  return {
    books: filteredBooks,
    rawBooks: books,
    totalCount,
    filter,
    setFilter,
    query,
    setQuery,
    loading,
    error,
    syncShelf,
  };
}
