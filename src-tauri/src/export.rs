use crate::state::RuntimeState;
use crate::types::*;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

pub async fn export_to_markdown(
    app: &AppHandle,
    state: &RuntimeState,
    options: &ExportOptions,
) -> Result<Vec<String>, String> {
    if options.output_dir.trim().is_empty() {
        return Err("请选择导出目录".to_string());
    }
    let output_dir = resolve_output_dir(&options.output_dir).join("markdown");
    fs::create_dir_all(&output_dir).map_err(|e| format!("创建输出目录失败: {e}"))?;

    let client = state.client().await?;
    let book_ids = resolve_book_ids(&client, options).await?;
    let total = book_ids.len();
    let mut file_paths = Vec::new();

    for (i, book_id) in book_ids.iter().enumerate() {
        let data = load_export_book(&client, book_id, options).await?;
        let content = build_markdown(&data, options);
        let file_path = unique_markdown_path(&output_dir, &data.title, &data.book_id);
        fs::write(&file_path, content).map_err(|e| format!("写入 Markdown 失败: {e}"))?;
        if !file_path.exists() {
            return Err(format!("写入验证失败，文件未生成: {}", file_path.display()));
        }
        file_paths.push(file_path.to_string_lossy().to_string());
        let _ = app.emit(
            "export-progress",
            ExportProgressPayload {
                current: i + 1,
                total,
                title: data.title.clone(),
            },
        );
    }

    Ok(file_paths)
}

pub(crate) struct ExportBook {
    pub(crate) book_id: String,
    pub(crate) isbn: String,
    pub(crate) title: String,
    pub(crate) author: String,
    pub(crate) cover: String,
    pub(crate) bookmarks: Vec<Bookmark>,
    pub(crate) reviews: Vec<Review>,
    pub(crate) chapters: Vec<ChapterInfo>,
    pub(crate) progress: Option<BookProgress>,
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

pub(crate) async fn load_export_book(
    client: &crate::api::WeReadClient,
    book_id: &str,
    options: &ExportOptions,
) -> Result<ExportBook, String> {
    let info = client
        .book_info(book_id)
        .await
        .unwrap_or_else(|_| BookInfo {
            book_id: book_id.to_string(),
            title: "未知书籍".to_string(),
            ..Default::default()
        });

    let progress = client.book_progress(book_id).await.ok();

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
        isbn: info.isbn,
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
        progress,
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

pub(crate) fn build_markdown(data: &ExportBook, options: &ExportOptions) -> String {
    let mut markdown = String::new();

    markdown.push_str("---\n");
    markdown.push_str(&format!("书籍编号: {}\n", data.book_id));
    if !data.isbn.is_empty() {
        markdown.push_str(&format!("ISBN: {}\n", data.isbn));
    }
    markdown.push_str(&format!("标题: {}\n", yaml_escape(&data.title)));
    markdown.push_str(&format!("作者: {}\n", yaml_escape(&data.author)));
    if !data.cover.is_empty() {
        markdown.push_str(&format!("封面: {}\n", data.cover));
    }
    if let Some(ref progress) = data.progress {
        if progress.update_time > 0 {
            markdown.push_str(&format!(
                "上次阅读时间: {}\n",
                format_datetime(progress.update_time)
            ));
        }
        if let Some(finish_time) = progress.finish_time {
            if finish_time > 0 {
                markdown.push_str(&format!("读完时间: {}\n", format_datetime(finish_time)));
            }
        }
        if progress.record_reading_time > 0 {
            markdown.push_str(&format!(
                "阅读时长: {}\n",
                format_duration(progress.record_reading_time)
            ));
        }
        if progress.progress > 0 {
            markdown.push_str(&format!("当前进度: {}%\n", progress.progress));
        }
    }
    markdown.push_str("---\n\n");

    markdown.push_str(&format!("# {} - {}\n\n", data.title, data.author));
    markdown.push_str(&format!(
        "> 导出时间：{}\n> 数据来源：微信读书\n\n---\n\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M")
    ));

    if options.group_by_chapter && !data.chapters.is_empty() {
        let mut emitted_bookmarks = std::collections::HashSet::new();
        let mut emitted_reviews = std::collections::HashSet::new();

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
                emitted_bookmarks.insert(bookmark.bookmark_id.clone());
                push_bookmark_markdown(&mut markdown, bookmark);
            }
            for review in reviews {
                emitted_reviews.insert(review.review_id.clone());
                push_review_markdown(&mut markdown, review);
            }
        }

        let unmatched_bookmarks = data
            .bookmarks
            .iter()
            .filter(|bookmark| !emitted_bookmarks.contains(&bookmark.bookmark_id))
            .collect::<Vec<_>>();
        let unmatched_reviews = data
            .reviews
            .iter()
            .filter(|review| !emitted_reviews.contains(&review.review_id))
            .collect::<Vec<_>>();

        if !unmatched_bookmarks.is_empty() || !unmatched_reviews.is_empty() {
            markdown.push_str("## 其他笔记\n\n");
            for bookmark in unmatched_bookmarks {
                push_bookmark_markdown(&mut markdown, bookmark);
            }
            for review in unmatched_reviews {
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

    if data.bookmarks.is_empty() && data.reviews.is_empty() {
        markdown.push_str("> 暂无可导出的划线或想法。\n\n");
    }
    markdown.push_str("---\n");
    markdown.push_str("*由「书迹」桌面端导出*\n");
    markdown
}

fn push_bookmark_markdown(markdown: &mut String, bookmark: &Bookmark) {
    markdown.push_str(&format!("> {}\n\n", bookmark.mark_text));
    markdown.push_str(&format!("创建时间：{}", format_date(bookmark.create_time)));
    if !bookmark.range.is_empty() {
        markdown.push_str(&format!("  \n位置：`{}`", bookmark.range));
    }
    markdown.push_str("\n\n");
}

fn push_review_markdown(markdown: &mut String, review: &Review) {
    markdown.push_str(&format!("**我的思考：** {}\n\n", review.content));
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

fn unique_markdown_path(output_dir: &Path, title: &str, book_id: &str) -> PathBuf {
    let base = safe_file_name(title, book_id);
    let mut candidate = output_dir.join(format!("{base}.md"));
    if !candidate.exists() {
        return candidate;
    }

    for index in 2..1000 {
        candidate = output_dir.join(format!("{base}-{index}.md"));
        if !candidate.exists() {
            return candidate;
        }
    }

    output_dir.join(format!("{base}-{book_id}.md"))
}

fn safe_file_name(title: &str, fallback: &str) -> String {
    let cleaned = title
        .chars()
        .map(|ch| {
            if ch.is_control() {
                '_'
            } else if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == ' ' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>();
    let collapsed = cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .trim_matches('_')
        .to_string();
    let source = if collapsed.is_empty() {
        if fallback.is_empty() {
            "未知书籍".to_string()
        } else {
            fallback.to_string()
        }
    } else {
        collapsed
    };
    source.chars().take(80).collect()
}

fn yaml_escape(value: &str) -> String {
    if value.contains(':')
        || value.contains('#')
        || value.contains('"')
        || value.contains('\'')
        || value.contains('\n')
        || value.contains('{')
        || value.contains('}')
        || value.contains('[')
        || value.contains(']')
        || value.contains(',')
        || value.contains('&')
        || value.contains('*')
        || value.contains('!')
        || value.contains('|')
        || value.contains('>')
        || value.contains('%')
        || value.contains('@')
        || value.contains('`')
        || value.starts_with(' ')
        || value.starts_with('-')
    {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn format_datetime(ts: i64) -> String {
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|| ts.to_string())
}

fn format_date(ts: i64) -> String {
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| ts.to_string())
}

fn format_duration(seconds: i64) -> String {
    if seconds <= 0 {
        return "0分钟".to_string();
    }
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    if hours > 0 && minutes > 0 {
        format!("{}小时{}分钟", hours, minutes)
    } else if hours > 0 {
        format!("{}小时", hours)
    } else {
        format!("{}分钟", minutes)
    }
}
