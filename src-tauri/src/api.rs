use crate::cache::ApiCache;
use crate::types::AppConfig;
use crate::types::*;
use reqwest::Client;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

const GATEWAY_URL: &str = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION: &str = "1.0.3";

#[derive(Clone)]
pub struct WeReadClient {
    client: Client,
    api_key: String,
}

impl WeReadClient {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    async fn gateway_value(&self, api_name: &str, params: Value) -> Result<Value, String> {
        self.gateway_value_with_cache(api_name, params, false).await
    }

    async fn gateway_value_with_cache(
        &self,
        api_name: &str,
        params: Value,
        force_refresh: bool,
    ) -> Result<Value, String> {
        let mut body = params;
        body["api_name"] = json!(api_name);
        body["skill_version"] = json!(SKILL_VERSION);

        if !force_refresh {
            let ttl_seconds = AppConfig::load().cache_ttl_seconds();
            if let Some(cached) = ApiCache::read(api_name, &body, ttl_seconds) {
                return Ok(cached);
            }
        }

        let response = self
            .client
            .post(GATEWAY_URL)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("网络请求失败: {e}"))?;

        let status = response.status().as_u16();
        let text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {e}"))?;

        if status != 200 {
            let detail = text.chars().take(600).collect::<String>();
            return Err(match status {
                401 | 403 => {
                    format!("{api_name} 请求失败 (HTTP {status})：API Key 无效或已过期，请检查设置。响应：{detail}")
                }
                429 => format!("{api_name} 请求失败 (HTTP 429)：请求过于频繁，请稍后再试。响应：{detail}"),
                _ => format!("{api_name} 请求失败 (HTTP {status})。响应：{detail}"),
            });
        }

        let value: Value = serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {e}"))?;
        if value.get("upgrade_info").is_some() {
            return Err("检测到微信读书 Skill 版本升级提示，请更新应用后重试".to_string());
        }
        if let Some(code) = value.get("errcode").and_then(Value::as_i64) {
            if code != 0 {
                let message = value
                    .get("errmsg")
                    .and_then(Value::as_str)
                    .unwrap_or("未知错误");
                return Err(format!("{api_name} API 错误 ({code}): {message}"));
            }
        }
        ApiCache::write(api_name, &body, &value)?;
        Ok(value)
    }

    #[allow(dead_code)]
    async fn gateway_call<T: DeserializeOwned>(
        &self,
        api_name: &str,
        params: Value,
    ) -> Result<T, String> {
        let value = self.gateway_value(api_name, params).await?;
        serde_json::from_value(value).map_err(|e| format!("解析响应结构失败: {e}"))
    }

    pub async fn shelf_sync(&self, force_refresh: bool) -> Result<ShelfSyncResult, String> {
        let value = self
            .gateway_value_with_cache("/shelf/sync", json!({}), force_refresh)
            .await?;
        let books: Vec<ShelfBook> = value
            .get("books")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_shelf_book).collect())
            .unwrap_or_default();
        let albums: Vec<ShelfAlbum> = value
            .get("albums")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_shelf_album).collect())
            .unwrap_or_default();
        let has_mp = value
            .get("mp")
            .map(|mp| !mp.is_null() && !mp.as_object().map(|o| o.is_empty()).unwrap_or(true))
            .unwrap_or(false);
        let total_count = books.len() + albums.len() + usize::from(has_mp);
        Ok(ShelfSyncResult {
            books,
            albums,
            has_mp,
            total_count,
        })
    }

    pub async fn book_info(&self, book_id: &str) -> Result<BookInfo, String> {
        let value = self
            .gateway_value("/book/info", json!({ "bookId": book_id }))
            .await?;
        Ok(parse_book_info(&value, book_id))
    }

    pub async fn book_progress(&self, book_id: &str) -> Result<BookProgress, String> {
        let value = self
            .gateway_value("/book/getprogress", json!({ "bookId": book_id }))
            .await?;
        let book = value
            .get("book")
            .or_else(|| value.get("bookProgress"))
            .or_else(|| value.get("progress"))
            .unwrap_or(&value);
        Ok(BookProgress {
            book_id: str_field(book, "bookId").if_empty_then(book_id),
            progress: first_int(book, &["progress", "readingProgress"]) as i32,
            chapter_uid: first_int(book, &["chapterUid"]),
            chapter_offset: first_int(book, &["chapterOffset"]),
            update_time: first_int(book, &["updateTime", "readUpdateTime"]),
            record_reading_time: first_int(
                book,
                &["recordReadingTime", "readingTime", "readTime", "totalReadTime"],
            ),
            finish_time: int_optional(book, "finishTime"),
            is_start_reading: first_int(book, &["isStartReading"]) as i32,
        })
    }

    pub async fn bookmark_list(&self, book_id: &str) -> Result<BookmarkListResult, String> {
        let value = self
            .gateway_value("/book/bookmarklist", json!({ "bookId": book_id }))
            .await?;
        let chapters: Vec<ChapterInfo> = value
            .get("chapters")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_chapter).collect())
            .unwrap_or_default();
        let mut bookmarks: Vec<Bookmark> = value
            .get("updated")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| parse_bookmark(item, book_id))
                    .collect()
            })
            .unwrap_or_default();

        for bookmark in &mut bookmarks {
            bookmark.chapter_title = chapters
                .iter()
                .find(|chapter| chapter.chapter_uid == bookmark.chapter_uid)
                .map(|chapter| chapter.title.clone());
        }

        let book = value.get("book").map(|book| parse_book_info(book, book_id));
        Ok(BookmarkListResult {
            bookmarks,
            chapters,
            book,
        })
    }

    pub async fn my_reviews(
        &self,
        book_id: &str,
        synckey: i64,
        count: i32,
    ) -> Result<ReviewListResult, String> {
        let value = self
            .gateway_value(
                "/review/list/mine",
                json!({ "bookid": book_id, "synckey": synckey, "count": count }),
            )
            .await?;
        let reviews = value
            .get("reviews")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_review).collect())
            .unwrap_or_default();
        Ok(ReviewListResult {
            reviews,
            total_count: value.get("totalCount").and_then(Value::as_i64).unwrap_or(0) as i32,
            has_more: value.get("hasMore").and_then(Value::as_i64).unwrap_or(0) as i32,
            synckey: value.get("synckey").and_then(Value::as_i64).unwrap_or(0),
        })
    }

    pub async fn notebooks(&self, count: i32, last_sort: i64) -> Result<NotebooksResult, String> {
        self.notebooks_with_cache(count, last_sort, false).await
    }

    pub async fn notebooks_with_cache(
        &self,
        count: i32,
        last_sort: i64,
        force_refresh: bool,
    ) -> Result<NotebooksResult, String> {
        let mut params = json!({ "count": count });
        if last_sort > 0 {
            params["lastSort"] = json!(last_sort);
        }
        let value = self
            .gateway_value_with_cache("/user/notebooks", params, force_refresh)
            .await?;
        let books = value
            .get("books")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_notebook_book).collect())
            .unwrap_or_default();
        Ok(NotebooksResult {
            books,
            total_book_count: value
                .get("totalBookCount")
                .and_then(Value::as_i64)
                .unwrap_or(0) as i32,
            total_note_count: value
                .get("totalNoteCount")
                .and_then(Value::as_i64)
                .unwrap_or(0) as i32,
            has_more: value.get("hasMore").and_then(Value::as_i64).unwrap_or(0) as i32,
        })
    }

    pub async fn reading_stats(
        &self,
        mode: &str,
        base_time: i64,
        force_refresh: bool,
    ) -> Result<ReadingStatsResult, String> {
        let value = self
            .gateway_value_with_cache(
                "/readdata/detail",
                json!({ "mode": mode, "baseTime": base_time }),
                force_refresh,
            )
            .await?;
        let read_longest = value
            .get("readLongest")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_read_longest).collect())
            .unwrap_or_default();
        let prefer_category = value
            .get("preferCategory")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_category_pref).collect())
            .unwrap_or_default();
        let prefer_time = value
            .get("preferTime")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(Value::as_i64).collect())
            .unwrap_or_default();
        let read_days = int_field(&value, "readDays") as i32;
        let total_read_time = int_field(&value, "totalReadTime");
        let day_average_read_time = int_field(&value, "dayAverageReadTime");
        let read_stat = value
            .get("readStat")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        Some(ReadStatItem {
                            stat: str_field(item, "stat"),
                            counts: str_field(item, "counts"),
                            scheme: item.get("scheme").and_then(Value::as_str).map(str::to_string),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        let read_times = value
            .get("readTimes")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .collect();
        let daily_read_times = value
            .get("dailyReadTimes")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .collect();
        let regist_time = int_field(&value, "registTime");
        Ok(ReadingStatsResult {
            base_time: value.get("baseTime").and_then(Value::as_i64).unwrap_or(0),
            read_days,
            total_read_time,
            day_average_read_time,
            compare: value.get("compare").and_then(Value::as_f64),
            read_longest,
            prefer_category,
            prefer_time,
            read_times,
            daily_read_times,
            read_stat,
            regist_time,
        })
    }
}

fn parse_shelf_book(value: &Value) -> Option<ShelfBook> {
    Some(ShelfBook {
        book_id: value.get("bookId")?.as_str()?.to_string(),
        title: value.get("title")?.as_str()?.to_string(),
        author: str_field(value, "author"),
        cover: str_field(value, "cover"),
        category: str_field(value, "category"),
        read_update_time: int_field(value, "readUpdateTime"),
        finish_reading: int_field(value, "finishReading") as i32,
        update_time: int_field(value, "updateTime"),
        is_top: int_field(value, "isTop") as i32,
        secret: int_field(value, "secret") as i32,
    })
}

fn parse_shelf_album(value: &Value) -> Option<ShelfAlbum> {
    let info = value.get("albumInfo")?;
    let extra = value.get("albumInfoExtra");
    Some(ShelfAlbum {
        album_id: info.get("albumId")?.as_str()?.to_string(),
        name: info.get("name")?.as_str()?.to_string(),
        author_name: str_field(info, "authorName"),
        cover: str_field(info, "cover"),
        track_count: int_field(info, "trackCount") as i32,
        finish_status: str_field(info, "finishStatus"),
        finish: int_field(info, "finish") as i32,
        secret: extra.and_then(|v| v.get("secret")).and_then(Value::as_i64).unwrap_or(0) as i32,
    })
}

fn parse_book_info(value: &Value, fallback_book_id: &str) -> BookInfo {
    BookInfo {
        book_id: value
            .get("bookId")
            .and_then(Value::as_str)
            .unwrap_or(fallback_book_id)
            .to_string(),
        title: str_field(value, "title"),
        author: str_field(value, "author"),
        translator: str_field(value, "translator"),
        cover: str_field(value, "cover"),
        intro: str_field(value, "intro"),
        category: str_field(value, "category"),
        publisher: str_field(value, "publisher"),
        publish_time: str_field(value, "publishTime"),
        isbn: str_field(value, "isbn"),
        word_count: int_field(value, "wordCount"),
        new_rating: int_field(value, "newRating") as i32,
        new_rating_count: int_field(value, "newRatingCount") as i32,
    }
}

trait EmptyFallback {
    fn if_empty_then(self, fallback: &str) -> String;
}

impl EmptyFallback for String {
    fn if_empty_then(self, fallback: &str) -> String {
        if self.is_empty() {
            fallback.to_string()
        } else {
            self
        }
    }
}

fn parse_chapter(value: &Value) -> Option<ChapterInfo> {
    Some(ChapterInfo {
        chapter_uid: value.get("chapterUid")?.as_i64()?,
        chapter_idx: value.get("chapterIdx").and_then(Value::as_i64).unwrap_or(0) as i32,
        title: value.get("title")?.as_str()?.to_string(),
    })
}

fn parse_bookmark(value: &Value, fallback_book_id: &str) -> Option<Bookmark> {
    Some(Bookmark {
        bookmark_id: value.get("bookmarkId")?.as_str()?.to_string(),
        book_id: value
            .get("bookId")
            .and_then(Value::as_str)
            .unwrap_or(fallback_book_id)
            .to_string(),
        chapter_uid: int_field(value, "chapterUid"),
        mark_text: value.get("markText")?.as_str()?.to_string(),
        create_time: int_field(value, "createTime"),
        range: str_field(value, "range"),
        color_style: int_field(value, "colorStyle") as i32,
        chapter_title: None,
    })
}

fn parse_review(value: &Value) -> Option<Review> {
    let review = value.get("review")?;
    Some(Review {
        review_id: review.get("reviewId")?.as_str()?.to_string(),
        content: review.get("content")?.as_str()?.to_string(),
        create_time: int_field(review, "createTime"),
        star: int_field(review, "star") as i32,
        chapter_name: review
            .get("chapterName")
            .or_else(|| review.get("chapterTitle"))
            .and_then(Value::as_str)
            .map(str::to_string),
        range: review.get("range").and_then(Value::as_str).map(str::to_string),
    })
}

fn parse_notebook_book(value: &Value) -> Option<NotebookBook> {
    let book = value.get("book")?;
    Some(NotebookBook {
        book_id: value.get("bookId")?.as_str()?.to_string(),
        title: book.get("title")?.as_str()?.to_string(),
        author: str_field(book, "author"),
        cover: str_field(book, "cover"),
        review_count: int_field(value, "reviewCount") as i32,
        note_count: int_field(value, "noteCount") as i32,
        bookmark_count: int_field(value, "bookmarkCount") as i32,
        reading_progress: value
            .get("readingProgress")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
        marked_status: int_field(value, "markedStatus") as i32,
        sort: int_field(value, "sort"),
    })
}

fn parse_read_longest(value: &Value) -> Option<ReadLongestItem> {
    let book = value
        .get("book")
        .map(|book| parse_book_info(book, ""))
        .or_else(|| value.get("albumInfo").map(parse_album_as_book_info));
    Some(ReadLongestItem {
        book,
        read_time: value.get("readTime")?.as_i64()?,
        tags: value
            .get("tags")
            .and_then(Value::as_array)
            .map(|tags| {
                tags.iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
    })
}

fn parse_album_as_book_info(value: &Value) -> BookInfo {
    BookInfo {
        book_id: str_field(value, "albumId"),
        title: str_field(value, "name"),
        author: str_field(value, "authorName"),
        cover: str_field(value, "cover"),
        intro: str_field(value, "intro"),
        category: "有声书".to_string(),
        ..Default::default()
    }
}

fn parse_category_pref(value: &Value) -> Option<CategoryPref> {
    Some(CategoryPref {
        category_title: value.get("categoryTitle")?.as_str()?.to_string(),
        val: value.get("val").and_then(Value::as_f64).unwrap_or(0.0),
        reading_time: int_field(value, "readingTime"),
        reading_count: int_field(value, "readingCount") as i32,
    })
}

fn str_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn int_field(value: &Value, key: &str) -> i64 {
    value.get(key).map(value_to_i64).unwrap_or(0)
}

fn int_optional(value: &Value, key: &str) -> Option<i64> {
    value.get(key).map(value_to_i64).filter(|number| *number > 0)
}

fn first_int(value: &Value, keys: &[&str]) -> i64 {
    keys.iter()
        .map(|key| int_field(value, key))
        .find(|number| *number > 0)
        .unwrap_or(0)
}

fn value_to_i64(value: &Value) -> i64 {
    if let Some(number) = value.as_i64() {
        number
    } else if let Some(number) = value.as_u64() {
        number as i64
    } else if let Some(number) = value.as_f64() {
        number as i64
    } else if let Some(text) = value.as_str() {
        text.parse::<i64>().unwrap_or(0)
    } else {
        0
    }
}
