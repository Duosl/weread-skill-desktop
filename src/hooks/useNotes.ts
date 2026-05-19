import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Bookmark, BookmarkListResult, Review, ReviewListResult } from "../types";
import { getErrorMessage } from "../lib/format";

export function useNotes(bookId?: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(
    async (targetBookId = bookId) => {
      if (!targetBookId) {
        setBookmarks([]);
        setReviews([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [bookmarkResult, reviewResult] = await Promise.all([
          invoke<BookmarkListResult>("get_bookmarks", { bookId: targetBookId }),
          invoke<ReviewListResult>("get_my_reviews", {
            bookId: targetBookId,
            synckey: 0,
            count: 100,
          }),
        ]);
        setBookmarks(bookmarkResult.bookmarks ?? []);
        setReviews(reviewResult.reviews ?? []);
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

  return { bookmarks, reviews, loading, error, loadNotes };
}
