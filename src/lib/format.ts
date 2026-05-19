export function formatDate(timestamp?: number | null): string {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleDateString("zh-CN");
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "0分钟";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
}

export function noteTotal(book: {
  reviewCount: number;
  noteCount: number;
  bookmarkCount: number;
}): number {
  return book.reviewCount + book.noteCount + book.bookmarkCount;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "操作失败，请稍后重试";
}
