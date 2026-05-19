import type { NotebookBook } from "@/types";

export function buildJsonPreview(books: NotebookBook[]): string {
  const book = books[0];
  return JSON.stringify(
    {
      version: "1.0",
      source: "weread",
      book: {
        id: book?.bookId ?? "bookId",
        title: book?.title ?? "书名",
        author: book?.author ?? "作者",
      },
      stats: {
        totalBookmarks: book?.noteCount ?? 0,
        totalReviews: book?.reviewCount ?? 0,
      },
      chapters: [],
    },
    null,
    2,
  );
}

export function buildMarkdownPreview(books: NotebookBook[]): string {
  const book = books[0];
  return `# ${book?.title ?? "书名"} - ${book?.author ?? "作者"}

> 导出时间：YYYY-MM-DD HH:mm
> 数据来源：微信读书

---

## 章节标题

> 划线内容会显示在这里。

创建时间：YYYY-MM-DD
位置：\`900-2004\`

**我的思考：** 关联的想法或点评会显示在这里。

---

*由 WeRead Skill Desktop 导出*`;
}

export function buildExportPreview(book?: NotebookBook, format = "markdown"): string {
  if (format === "json") {
    return JSON.stringify(
      {
        version: "1.0",
        source: "weread",
        book: {
          id: book?.bookId ?? "bookId",
          title: book?.title ?? "书名",
          author: book?.author ?? "作者",
        },
        chapters: [],
      },
      null,
      2,
    );
  }

  return buildMarkdownPreview(book ? [book] : []);
}
