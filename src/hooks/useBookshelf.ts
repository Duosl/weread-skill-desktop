import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ShelfBook, ShelfSyncResult } from "@/types";
import { getErrorMessage } from "@/lib/format";

export type ShelfReadingStatus = "finished" | "reading" | "unread";
export type ShelfFilter = "all" | "finished";
export type ShelfCategoryFilter = "all" | string;

export function getShelfReadingStatus(book: Pick<ShelfBook, "finishReading" | "readUpdateTime">): ShelfReadingStatus {
  if (book.finishReading === 1) return "finished";
  if (book.readUpdateTime > 0) return "reading";
  return "unread";
}

export function getPrimaryShelfCategory(category: string) {
  const normalized = category.trim();
  if (!normalized) return "未分类";
  return normalized.split(/\s*(?:\/|／|>|＞|-|－|—|–|·|\s)\s*/u).filter(Boolean)[0] ?? "未分类";
}

export function useBookshelf() {
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<ShelfFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<ShelfCategoryFilter>("all");
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
      const matchesFilter = filter === "all" || getShelfReadingStatus(book) === filter;
      const matchesCategory = categoryFilter === "all" || getPrimaryShelfCategory(book.category) === categoryFilter;
      const matchesQuery =
        !keyword ||
        book.title.toLowerCase().includes(keyword) ||
        book.author.toLowerCase().includes(keyword);
      return matchesFilter && matchesCategory && matchesQuery;
    });
  }, [books, filter, categoryFilter, query]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const book of books) {
      names.add(getPrimaryShelfCategory(book.category));
    }
    return Array.from(names).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  }, [books]);

  return {
    books: filteredBooks,
    rawBooks: books,
    totalCount,
    filter,
    setFilter,
    categoryFilter,
    setCategoryFilter,
    categories,
    query,
    setQuery,
    loading,
    error,
    syncShelf,
  };
}
