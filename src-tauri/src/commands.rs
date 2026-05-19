use crate::state::RuntimeState;
use crate::types::*;
use open::that as open_path;
use tauri::State;

#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    Ok(AppConfig::load().to_settings())
}

#[tauri::command]
pub async fn save_api_key(
    state: State<'_, RuntimeState>,
    api_key: String,
) -> Result<AppSettings, String> {
    if api_key.trim().len() < 8 {
        return Err("API Key 格式不正确".to_string());
    }
    let mut config = AppConfig::load();
    config.api_key = Some(api_key.trim().to_string());
    config.save()?;
    state.set_api_key(api_key.trim().to_string()).await;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn clear_api_key(state: State<'_, RuntimeState>) -> Result<AppSettings, String> {
    let mut config = AppConfig::load();
    config.api_key = None;
    config.save()?;
    state.clear_api_key().await;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn save_export_settings(
    output_dir: String,
    default_format: String,
) -> Result<AppSettings, String> {
    let mut config = AppConfig::load();
    config.last_export_dir = Some(output_dir);
    config.default_format = Some(default_format);
    config.save()?;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn save_cache_settings(cache_ttl_seconds: i64) -> Result<AppSettings, String> {
    let mut config = AppConfig::load();
    config.cache_ttl_seconds = Some(cache_ttl_seconds.max(crate::config::MIN_CACHE_TTL_SECONDS));
    config.save()?;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn get_api_cache_info() -> Result<ApiCacheInfo, String> {
    Ok(crate::cache::ApiCache::info())
}

#[tauri::command]
pub async fn clear_api_cache() -> Result<ApiCacheInfo, String> {
    crate::cache::ApiCache::clear()?;
    Ok(crate::cache::ApiCache::info())
}

#[tauri::command]
pub async fn sync_shelf(
    state: State<'_, RuntimeState>,
    force_refresh: Option<bool>,
) -> Result<ShelfSyncResult, String> {
    state
        .client()
        .await?
        .shelf_sync(force_refresh.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn get_book_info(
    state: State<'_, RuntimeState>,
    book_id: String,
) -> Result<BookInfo, String> {
    state.client().await?.book_info(&book_id).await
}

#[tauri::command]
pub async fn get_book_progress(
    state: State<'_, RuntimeState>,
    book_id: String,
) -> Result<BookProgress, String> {
    state.client().await?.book_progress(&book_id).await
}

#[tauri::command]
pub async fn get_bookmarks(
    state: State<'_, RuntimeState>,
    book_id: String,
) -> Result<BookmarkListResult, String> {
    state.client().await?.bookmark_list(&book_id).await
}

#[tauri::command]
pub async fn get_my_reviews(
    state: State<'_, RuntimeState>,
    book_id: String,
    synckey: i64,
    count: i32,
) -> Result<ReviewListResult, String> {
    state
        .client()
        .await?
        .my_reviews(&book_id, synckey, count)
        .await
}

#[tauri::command]
pub async fn get_notebooks(
    state: State<'_, RuntimeState>,
    count: i32,
    last_sort: i64,
    force_refresh: Option<bool>,
) -> Result<NotebooksResult, String> {
    state
        .client()
        .await?
        .notebooks_with_cache(count, last_sort, force_refresh.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn get_reading_stats(
    state: State<'_, RuntimeState>,
    mode: String,
    base_time: i64,
    force_refresh: Option<bool>,
) -> Result<ReadingStatsResult, String> {
    state
        .client()
        .await?
        .reading_stats(&mode, base_time, force_refresh.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn export_to_markdown(
    state: State<'_, RuntimeState>,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    let file_paths = crate::export::export_to_markdown(state.inner(), &options).await?;
    Ok(ExportResult {
        success: true,
        message: format!("成功导出 {} 个文件", file_paths.len()),
        file_paths,
    })
}

#[tauri::command]
pub async fn export_to_json(
    state: State<'_, RuntimeState>,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    let file_paths = crate::export::export_to_json(state.inner(), &options).await?;
    Ok(ExportResult {
        success: true,
        message: format!("成功导出 {} 个文件", file_paths.len()),
        file_paths,
    })
}

#[tauri::command]
pub async fn open_export_folder(path: String) -> Result<(), String> {
    open_path(path).map_err(|e| format!("无法打开导出目录: {e}"))
}

#[tauri::command]
pub async fn open_in_weread(book_id: String, chapter_uid: Option<i64>) -> Result<(), String> {
    let url = match chapter_uid {
        Some(chapter_uid) => {
            format!("weread://reading?bId={book_id}&chapterUid={chapter_uid}")
        }
        None => format!("weread://reading?bId={book_id}"),
    };
    open_path(url).map_err(|e| format!("无法打开微信读书: {e}"))
}
