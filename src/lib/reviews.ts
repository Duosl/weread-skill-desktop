import { invoke } from "@tauri-apps/api/core";
import type { Review, ReviewListResult } from "@/types";

const REVIEW_PAGE_SIZE = 100;

export async function loadAllReviews(bookId: string, forceRefresh = false): Promise<Review[]> {
  const collected: Review[] = [];
  let synckey = 0;

  while (true) {
    const page = await invoke<ReviewListResult>("get_my_reviews", {
      bookId,
      synckey,
      count: REVIEW_PAGE_SIZE,
      forceRefresh,
    });
    const reviews = page.reviews ?? [];
    collected.push(...reviews);

    if (page.hasMore !== 1 || reviews.length === 0) {
      break;
    }

    synckey = page.synckey;
  }

  return collected;
}
