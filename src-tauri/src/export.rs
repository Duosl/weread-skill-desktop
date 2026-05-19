use crate::state::RuntimeState;
use crate::types::*;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

pub async fn export_to_markdown(
    app: &AppHandle,
    state: &RuntimeState,
    options: &ExportOptions,
) -> Result<Vec<String>, String> {
    let output_dir = resolve_output_dir(&options.output_dir).join("markdown");
    fs::create_dir_all(&output_dir).map_err(|e| format!("创建输出目录失败: {e}"))?;

    let client = state.client().await?;
    let book_ids = resolve_book_ids(&client, options).await?;
    let total = book_ids.len();
    let mut file_paths = Vec::new();

    for (i, book_id) in book_ids.iter().enumerate() {
        let data = load_export_book(&client, book_id, options).await?;
        let content = build_markdown(&data, options);
        let file_path = output_dir.join(format!("{}.md", safe_file_name(&data.title)));
        fs::write(&file_path, content).map_err(|e| format!("写入 Markdown 失败: {e}"))?;
        if !file_path.exists() {
            return Err(format!("写入验证失败，文件未生成: {}", file_path.display()));
        }
        file_paths.push(file_path.to_string_lossy().to_string());
        let _ = app.emit("export-progress", ExportProgressPayload {
            current: i + 1,
            total,
            title: data.title.clone(),
        });
    }

    Ok(file_paths)
}

pub async fn export_to_json(
    app: &AppHandle,
    state: &RuntimeState,
    options: &ExportOptions,
) -> Result<Vec<String>, String> {
    let output_dir = resolve_output_dir(&options.output_dir).join("json");
    fs::create_dir_all(&output_dir).map_err(|e| format!("创建输出目录失败: {e}"))?;

    let client = state.client().await?;
    let book_ids = resolve_book_ids(&client, options).await?;
    let total = book_ids.len();
    let mut file_paths = Vec::new();

    for (i, book_id) in book_ids.iter().enumerate() {
        let data = load_export_book(&client, book_id, options).await?;
        let value = build_json(&data, options);
        let content = serde_json::to_string_pretty(&value)
            .map_err(|e| format!("序列化 JSON 失败: {e}"))?;
        let file_path = output_dir.join(format!("{}.json", safe_file_name(&data.title)));
        fs::write(&file_path, content).map_err(|e| format!("写入 JSON 失败: {e}"))?;
        if !file_path.exists() {
            return Err(format!("写入验证失败，文件未生成: {}", file_path.display()));
        }
        file_paths.push(file_path.to_string_lossy().to_string());
        let _ = app.emit("export-progress", ExportProgressPayload {
            current: i + 1,
            total,
            title: data.title.clone(),
        });
    }

    Ok(file_paths)
}

struct ExportBook {
    book_id: String,
    title: String,
    author: String,
    cover: String,
    bookmarks: Vec<Bookmark>,
    reviews: Vec<Review>,
    chapters: Vec<ChapterInfo>,
}

async fn resolve_book_ids(
    client: &crate::api::WeReadClient,
    options: &ExportOptions,
) -> Result<Vec<String>, String> {
    if !options.book_ids.is_empty() {
        return Ok(options.book_ids.clone());
    }

    let mut all = Vec::new();
    let mut last_sort = 0;
    loop {
        let page = client.notebooks(100, last_sort).await?;
        if page.books.is_empty() {
            break;
        }
        last_sort = page.books.last().map(|book| book.sort).unwrap_or(0);
        all.extend(page.books.into_iter().map(|book| book.book_id));
        if page.has_more != 1 {
            break;
        }
    }
    Ok(all)
}

async fn load_export_book(
    client: &crate::api::WeReadClient,
    book_id: &str,
    options: &ExportOptions,
) -> Result<ExportBook, String> {
    let info = client.book_info(book_id).await.unwrap_or_else(|_| BookInfo {
        book_id: book_id.to_string(),
        title: "未知书籍".to_string(),
        ..Default::default()
    });

    let bookmark_result = if options.include_bookmarks {
        client.bookmark_list(book_id).await?
    } else {
        BookmarkListResult::default()
    };

    let reviews = if options.include_reviews {
        load_all_reviews(client, book_id).await?
    } else {
        Vec::new()
    };

    Ok(ExportBook {
        book_id: info.book_id,
        title: if info.title.is_empty() {
            "未知书籍".to_string()
        } else {
            info.title
        },
        author: info.author,
        cover: info.cover,
        bookmarks: bookmark_result.bookmarks,
        chapters: bookmark_result.chapters,
        reviews,
    })
}

async fn load_all_reviews(
    client: &crate::api::WeReadClient,
    book_id: &str,
) -> Result<Vec<Review>, String> {
    let mut all = Vec::new();
    let mut synckey = 0;
    loop {
        let page = client.my_reviews(book_id, synckey, 100).await?;
        let has_more = page.has_more == 1 && !page.reviews.is_empty();
        synckey = page.synckey;
        all.extend(page.reviews);
        if !has_more {
            break;
        }
    }
    Ok(all)
}

fn build_markdown(data: &ExportBook, options: &ExportOptions) -> String {
    let mut markdown = String::new();
    markdown.push_str(&format!("# {} - {}\n\n", data.title, data.author));
    markdown.push_str(&format!(
        "> 导出时间：{}\n> 数据来源：微信读书\n\n---\n\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M")
    ));

    if options.group_by_chapter && !data.chapters.is_empty() {
        for chapter in &data.chapters {
            let bookmarks = data
                .bookmarks
                .iter()
                .filter(|bookmark| bookmark.chapter_uid == chapter.chapter_uid)
                .collect::<Vec<_>>();
            let reviews = data
                .reviews
                .iter()
                .filter(|review| review.chapter_name.as_deref() == Some(&chapter.title))
                .collect::<Vec<_>>();
            if bookmarks.is_empty() && reviews.is_empty() {
                continue;
            }
            markdown.push_str(&format!("## {}\n\n", chapter.title));
            for bookmark in bookmarks {
                push_bookmark_markdown(&mut markdown, bookmark);
            }
            for review in reviews {
                push_review_markdown(&mut markdown, review);
            }
        }
    } else {
        for bookmark in &data.bookmarks {
            push_bookmark_markdown(&mut markdown, bookmark);
        }
        for review in &data.reviews {
            push_review_markdown(&mut markdown, review);
        }
    }
    markdown
}

fn push_bookmark_markdown(markdown: &mut String, bookmark: &Bookmark) {
    markdown.push_str(&format!("> {}\n\n", bookmark.mark_text));
    markdown.push_str(&format!(
        "创建时间：{}  \n位置：`{}`\n\n",
        format_timestamp(bookmark.create_time),
        bookmark.range
    ));
}

fn push_review_markdown(markdown: &mut String, review: &Review) {
    markdown.push_str(&format!("**我的思考：** {}\n\n", review.content));
    markdown.push_str(&format!("创建时间：{}\n\n", format_timestamp(review.create_time)));
}

fn build_json(data: &ExportBook, _options: &ExportOptions) -> serde_json::Value {
    let chapters = data
        .chapters
        .iter()
        .map(|chapter| {
            let bookmarks = data
                .bookmarks
                .iter()
                .filter(|bookmark| bookmark.chapter_uid == chapter.chapter_uid)
                .map(bookmark_json)
                .collect::<Vec<_>>();
            let reviews = data
                .reviews
                .iter()
                .filter(|review| review.chapter_name.as_deref() == Some(&chapter.title))
                .map(review_json)
                .collect::<Vec<_>>();
            json!({
                "chapterUid": chapter.chapter_uid,
                "title": chapter.title,
                "bookmarks": bookmarks,
                "reviews": reviews,
            })
        })
        .collect::<Vec<_>>();

    json!({
        "version": "1.0",
        "exportTime": chrono::Utc::now().to_rfc3339(),
        "source": "weread",
        "book": {
            "id": data.book_id,
            "title": data.title,
            "author": data.author,
            "cover": data.cover,
        },
        "stats": {
            "totalBookmarks": data.bookmarks.len(),
            "totalReviews": data.reviews.len(),
            "chaptersCount": data.chapters.len(),
        },
        "chapters": chapters,
    })
}

fn bookmark_json(bookmark: &Bookmark) -> serde_json::Value {
    let (range_start, range_end) = parse_range(&bookmark.range);
    json!({
        "id": bookmark.bookmark_id,
        "content": bookmark.mark_text,
        "rangeStart": range_start,
        "rangeEnd": range_end,
        "range": bookmark.range,
        "createdAt": chrono::DateTime::from_timestamp(bookmark.create_time, 0).map(|dt| dt.to_rfc3339()),
        "reviews": [],
    })
}

fn review_json(review: &Review) -> serde_json::Value {
    json!({
        "id": review.review_id,
        "content": review.content,
        "createdAt": chrono::DateTime::from_timestamp(review.create_time, 0).map(|dt| dt.to_rfc3339()),
        "chapterName": review.chapter_name,
    })
}

fn parse_range(range: &str) -> (Option<i64>, Option<i64>) {
    let mut parts = range.split('-');
    let start = parts.next().and_then(|value| value.parse::<i64>().ok());
    let end = parts.next().and_then(|value| value.parse::<i64>().ok());
    (start, end)
}

fn format_timestamp(timestamp: i64) -> String {
    chrono::DateTime::from_timestamp(timestamp, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

fn resolve_output_dir(path: &str) -> PathBuf {
    if path == "~" || path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return if path == "~" {
                home
            } else {
                home.join(path.trim_start_matches("~/"))
            };
        }
    }
    Path::new(path).to_path_buf()
}

fn safe_file_name(title: &str) -> String {
    let cleaned = title
        .chars()
        .map(|ch| {
            if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == ' ' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>();
    if cleaned.trim().is_empty() {
        "未知书籍".to_string()
    } else {
        cleaned
    }
}
