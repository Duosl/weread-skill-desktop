use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub api_key: Option<String>,
    pub last_export_dir: Option<String>,
    pub default_format: Option<String>,
    pub cache_ttl_seconds: Option<i64>,
    #[serde(skip, default = "AppConfig::config_path")]
    pub config_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub api_key_set: bool,
    pub api_key_masked: Option<String>,
    pub last_export_dir: String,
    pub default_format: String,
    pub cache_ttl_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiCacheEntry {
    pub api_name: String,
    pub skill_version: String,
    pub request: serde_json::Value,
    pub fetched_at: i64,
    pub response: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiCacheInfo {
    pub cache_dir: String,
    pub request_log_path: String,
    pub entry_count: usize,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ShelfBook {
    pub book_id: String,
    pub title: String,
    pub author: String,
    pub cover: String,
    pub category: String,
    pub read_update_time: i64,
    pub finish_reading: i32,
    pub update_time: i64,
    pub is_top: i32,
    pub secret: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ShelfAlbum {
    pub album_id: String,
    pub name: String,
    pub author_name: String,
    pub cover: String,
    pub track_count: i32,
    pub finish_status: String,
    pub finish: i32,
    pub secret: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ShelfSyncResult {
    pub books: Vec<ShelfBook>,
    pub albums: Vec<ShelfAlbum>,
    pub has_mp: bool,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookInfo {
    pub book_id: String,
    pub title: String,
    pub author: String,
    pub translator: String,
    pub cover: String,
    pub intro: String,
    pub category: String,
    pub publisher: String,
    pub publish_time: String,
    pub isbn: String,
    pub word_count: i64,
    pub new_rating: i32,
    pub new_rating_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookProgress {
    pub book_id: String,
    pub progress: i32,
    pub chapter_uid: i64,
    pub chapter_offset: i64,
    pub update_time: i64,
    pub record_reading_time: i64,
    pub finish_time: Option<i64>,
    pub is_start_reading: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChapterInfo {
    pub chapter_uid: i64,
    pub chapter_idx: i32,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub bookmark_id: String,
    pub book_id: String,
    pub chapter_uid: i64,
    pub mark_text: String,
    pub create_time: i64,
    pub range: String,
    pub color_style: i32,
    pub chapter_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkListResult {
    pub bookmarks: Vec<Bookmark>,
    pub chapters: Vec<ChapterInfo>,
    pub book: Option<BookInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub review_id: String,
    pub content: String,
    pub create_time: i64,
    pub star: i32,
    pub chapter_name: Option<String>,
    pub range: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReviewListResult {
    pub reviews: Vec<Review>,
    pub total_count: i32,
    pub has_more: i32,
    pub synckey: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NotebookBook {
    pub book_id: String,
    pub title: String,
    pub author: String,
    pub cover: String,
    pub review_count: i32,
    pub note_count: i32,
    pub bookmark_count: i32,
    pub reading_progress: f64,
    pub marked_status: i32,
    pub sort: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NotebooksResult {
    pub books: Vec<NotebookBook>,
    pub total_book_count: i32,
    pub total_note_count: i32,
    pub has_more: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CategoryPref {
    pub category_title: String,
    pub val: f64,
    pub reading_time: i64,
    pub reading_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReadLongestItem {
    pub book: Option<BookInfo>,
    pub read_time: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReadStatItem {
    pub stat: String,
    pub counts: String,
    pub scheme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReadingStatsResult {
    pub base_time: i64,
    pub read_days: i32,
    pub total_read_time: i64,
    pub day_average_read_time: i64,
    pub compare: Option<f64>,
    pub read_longest: Vec<ReadLongestItem>,
    pub prefer_category: Vec<CategoryPref>,
    pub prefer_time: Vec<i64>,
    pub read_times: serde_json::Map<String, serde_json::Value>,
    pub daily_read_times: serde_json::Map<String, serde_json::Value>,
    pub read_stat: Vec<ReadStatItem>,
    pub regist_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub book_ids: Vec<String>,
    pub format: String,
    pub output_dir: String,
    pub include_bookmarks: bool,
    pub include_reviews: bool,
    pub group_by_chapter: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub success: bool,
    pub file_paths: Vec<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgressPayload {
    pub current: usize,
    pub total: usize,
    pub title: String,
}
