import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Bookmark, BookmarkListResult, ChapterInfo, Review } from "../types";
import { getErrorMessage } from "../lib/format";
import { loadAllReviews } from "../lib/reviews";

export function useNotes(bookId?: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(
    async (targetBookId = bookId) => {
      if (!targetBookId) {
        setBookmarks([]);
        setReviews([]);
        setChapters([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [bookmarkResult, reviewResult] = await Promise.all([
          invoke<BookmarkListResult>("get_bookmarks", { bookId: targetBookId }),
          loadAllReviews(targetBookId),
        ]);
        setBookmarks(bookmarkResult.bookmarks ?? []);
        setChapters(bookmarkResult.chapters ?? []);
        setReviews(reviewResult);
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [bookId],
  );

  return { bookmarks, reviews, chapters, loading, error, loadNotes };
}
