import type { Bookmark, ChapterInfo, NotebookBook, Review, BookProgress } from "@/types";

export function buildMarkdownPreview(
  book: NotebookBook,
  bookmarks: Bookmark[],
  reviews: Review[],
  chapters: ChapterInfo[],
  progress: BookProgress | null,
  isbn?: string | null,
): string {
  const lines: string[] = [];

  lines.push("---");
  lines.push(`书籍编号: ${book.bookId}`);
  if (isbn) lines.push(`ISBN: ${isbn}`);
  lines.push(`标题: ${yamlEscape(book.title)}`);
  lines.push(`作者: ${yamlEscape(book.author || "未知作者")}`);
  if (book.cover) lines.push(`封面: ${book.cover}`);
  if (progress) {
    if (progress.updateTime > 0) {
      lines.push(`上次阅读时间: ${formatDateTime(progress.updateTime)}`);
    }
    if (progress.finishTime && progress.finishTime > 0) {
      lines.push(`读完时间: ${formatDateTime(progress.finishTime)}`);
    }
    if (progress.recordReadingTime > 0) {
      lines.push(`阅读时长: ${formatDuration(progress.recordReadingTime)}`);
    }
    if (progress.progress > 0) {
      lines.push(`当前进度: ${progress.progress}%`);
    }
  }
  lines.push("---");
  lines.push("");

  lines.push(`# ${book.title} - ${book.author || "未知作者"}`);
  lines.push("");
  lines.push(`> 导出时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push("> 数据来源：微信读书");
  lines.push("");
  lines.push("---");
  lines.push("");

  if (chapters.length > 0) {
    const emittedBookmarkIds = new Set<string>();
    const emittedReviewIds = new Set<string>();

    for (const chapter of chapters) {
      const chapterBookmarks = bookmarks.filter((b) => b.chapterUid === chapter.chapterUid);
      const chapterReviews = reviews.filter(
        (r) => r.chapterName === chapter.title,
      );
      if (chapterBookmarks.length === 0 && chapterReviews.length === 0) continue;

      lines.push(`## ${chapter.title}`);
      lines.push("");

      for (const bookmark of chapterBookmarks) {
        emittedBookmarkIds.add(bookmark.bookmarkId);
        pushBookmark(lines, bookmark);
      }

      for (const review of chapterReviews) {
        emittedReviewIds.add(review.reviewId);
        lines.push(`**我的思考：** ${review.content}`);
        lines.push("");
      }
    }

    const unmatchedBookmarks = bookmarks.filter((bookmark) => !emittedBookmarkIds.has(bookmark.bookmarkId));
    const unmatchedReviews = reviews.filter((review) => !emittedReviewIds.has(review.reviewId));
    if (unmatchedBookmarks.length > 0 || unmatchedReviews.length > 0) {
      lines.push("## 其他笔记");
      lines.push("");
      for (const bookmark of unmatchedBookmarks) {
        pushBookmark(lines, bookmark);
      }
      for (const review of unmatchedReviews) {
        lines.push(`**我的思考：** ${review.content}`);
        lines.push("");
      }
    }
  } else {
    for (const bookmark of bookmarks) {
      pushBookmark(lines, bookmark);
    }
    for (const review of reviews) {
      lines.push(`**我的思考：** ${review.content}`);
      lines.push("");
    }
  }

  if (bookmarks.length === 0 && reviews.length === 0) {
    lines.push("> 暂无可导出的划线或想法。");
    lines.push("");
  }

  lines.push("---");
  lines.push("*由 WeRead Skill Desktop 导出*");

  return lines.join("\n");
}

function pushBookmark(lines: string[], bookmark: Bookmark) {
  lines.push(`> ${bookmark.markText}`);
  lines.push("");
  lines.push(`创建时间：${formatDate(bookmark.createTime)}`);
  if (bookmark.range) {
    lines.push(`位置：\`${bookmark.range}\``);
  }
  lines.push("");
}

function yamlEscape(value: string): string {
  if (/[:#"'{}\[\],&*!|>%@`\n]/.test(value) || value.startsWith(" ") || value.startsWith("-")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(ts: number): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(ts: number): string {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0分钟";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (hours > 0) {
    return `${hours}小时`;
  }
  return `${minutes}分钟`;
}
