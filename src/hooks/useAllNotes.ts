import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Bookmark, BookmarkListResult, Review } from "../types";
import { loadAllReviews } from "../lib/reviews";

export type AllBookmark = Bookmark & { bookTitle: string; bookAuthor: string };
export type AllReview = Review & { bookId: string; bookTitle: string; bookAuthor: string };

type NotebookRef = { bookId: string; title: string; author: string };

export function useAllNotes() {
  const [bookmarks, setBookmarks] = useState<AllBookmark[]>([]);
  const [reviews, setReviews] = useState<AllReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadAll = useCallback(
    async (notebooks: NotebookRef[], forceRefresh = false) => {
      if (notebooks.length === 0) return;
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      setLoaded(0);
      setTotal(notebooks.length);

      const allBookmarks: AllBookmark[] = [];
      const allReviews: AllReview[] = [];
      let failed = 0;

      try {
        for (let i = 0; i < notebooks.length; i++) {
          const nb = notebooks[i];
          try {
            const [bmResult, rvResult] = await Promise.all([
              invoke<BookmarkListResult>("get_bookmarks", {
                bookId: nb.bookId,
                forceRefresh,
              }),
              loadAllReviews(nb.bookId, forceRefresh),
            ]);
            allBookmarks.push(
              ...(bmResult.bookmarks ?? []).map((b) => ({
                ...b,
                bookTitle: nb.title,
                bookAuthor: nb.author,
              })),
            );
            allReviews.push(
              ...rvResult.map((r) => ({
                ...r,
                bookId: nb.bookId,
                bookTitle: nb.title,
                bookAuthor: nb.author,
              })),
            );
          } catch {
            failed++;
          }
          setLoaded(i + 1);
        }

        setBookmarks(allBookmarks);
        setReviews(allReviews);
        if (failed > 0) {
          setError(`${failed} 本书的笔记加载失败`);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [],
  );

  return { bookmarks, reviews, loading, loaded, total, error, loadAll };
}
