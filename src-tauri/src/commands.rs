use crate::state::RuntimeState;
use crate::types::*;
use open::that as open_path;
use std::path::Path;
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
    app: tauri::AppHandle,
    state: State<'_, RuntimeState>,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    let file_paths = crate::export::export_to_markdown(&app, state.inner(), &options).await?;
    Ok(ExportResult {
        success: true,
        message: format!("成功导出 {} 个文件", file_paths.len()),
        file_paths,
    })
}

#[tauri::command]
pub async fn open_export_folder(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let dir = if p.is_file() || !p.is_dir() {
        p.parent()
            .map(|parent| parent.to_path_buf())
            .unwrap_or_else(|| p.to_path_buf())
    } else {
        p.to_path_buf()
    };
    open_path(dir).map_err(|e| format!("无法打开导出目录: {e}"))
}

#[tauri::command]
pub async fn export_report_html(
    output_dir: String,
    title: String,
    html: String,
) -> Result<ReportHtmlExportResult, String> {
    let file_path = crate::report::export_report_html(&output_dir, &title, &html)?;
    Ok(ReportHtmlExportResult {
        success: true,
        file_path,
        message: "阅读报告已导出".to_string(),
    })
}

#[tauri::command]
pub async fn preview_report_html(
    title: String,
    html: String,
) -> Result<ReportHtmlExportResult, String> {
    let file_path = crate::report::preview_report_html(&title, &html)?;
    Ok(ReportHtmlExportResult {
        success: true,
        file_path,
        message: "阅读报告预览已生成".to_string(),
    })
}

#[tauri::command]
pub async fn open_report_file(path: String) -> Result<(), String> {
    open_path(path).map_err(|e| format!("无法打开报告: {e}"))
}

#[tauri::command]
pub async fn detect_local_agents() -> Result<Vec<crate::agent_bridge::DetectedAgentDto>, String> {
    Ok(crate::agent_bridge::list_detected_agents())
}

#[tauri::command]
pub async fn invoke_local_agent(
    app: tauri::AppHandle,
    state: State<'_, RuntimeState>,
    request: crate::agent_bridge::AgentInvokeRequest,
) -> Result<crate::agent_bridge::AgentInvokeResult, String> {
    crate::agent_bridge::invoke_local_agent(app, state, request).await
}

#[tauri::command]
pub async fn cancel_local_agent(
    state: State<'_, RuntimeState>,
    job_id: String,
) -> Result<bool, String> {
    crate::agent_bridge::cancel_local_agent(state, job_id).await
}

#[tauri::command]
pub async fn list_advanced_report_templates(
) -> Result<Vec<crate::advanced_report::AdvancedReportTemplate>, String> {
    Ok(crate::advanced_report::list_advanced_report_templates())
}

#[tauri::command]
pub async fn create_advanced_report_job(
    state: State<'_, RuntimeState>,
    request: crate::advanced_report::AdvancedReportJobRequest,
) -> Result<crate::advanced_report::AdvancedReportJob, String> {
    let client = state.client().await?;
    crate::advanced_report::create_advanced_report_job(client, request).await
}

#[tauri::command]
pub async fn read_advanced_report_output(
    job_id: String,
) -> Result<crate::advanced_report::AdvancedReportOutput, String> {
    crate::advanced_report::read_advanced_report_output(&job_id)
}

#[tauri::command]
pub async fn read_advanced_report_logs(
    job_id: String,
) -> Result<Vec<crate::advanced_report::AdvancedReportLogEvent>, String> {
    crate::advanced_report::read_advanced_report_logs(&job_id)
}

#[tauri::command]
pub async fn export_advanced_report_output(
    request: crate::advanced_report::AdvancedReportExportRequest,
) -> Result<crate::advanced_report::AdvancedReportExportResult, String> {
    crate::advanced_report::export_advanced_report_output(request)
}

#[tauri::command]
pub async fn start_advanced_report_task(
    app: tauri::AppHandle,
    state: State<'_, RuntimeState>,
    request: crate::advanced_report::StartAdvancedReportRequest,
) -> Result<crate::advanced_report::AdvancedReportTask, String> {
    let client = state.client().await?;
    crate::advanced_report::start_advanced_report_task(app, state.inner(), client, request).await
}

#[tauri::command]
pub async fn list_advanced_report_tasks(
    state: State<'_, RuntimeState>,
) -> Result<Vec<crate::advanced_report::AdvancedReportTask>, String> {
    crate::advanced_report::merge_advanced_report_tasks(state.advanced_report_tasks().await)
}

#[tauri::command]
pub async fn cancel_advanced_report_task(
    state: State<'_, RuntimeState>,
    job_id: String,
) -> Result<bool, String> {
    let canceled = state.cancel_agent_job(&job_id).await;
    if canceled {
        state
            .update_advanced_report_task_status(
                &job_id,
                crate::advanced_report::AdvancedReportTaskStatus::Canceled,
                Some("已请求取消".to_string()),
            )
            .await;
    }
    Ok(canceled)
}

#[tauri::command]
pub async fn delete_advanced_report_job(
    state: State<'_, RuntimeState>,
    job_id: String,
) -> Result<bool, String> {
    if state.has_active_advanced_report_job(&job_id).await {
        return Err("任务正在生成中，请先取消后再删除。".to_string());
    }
    let deleted = crate::advanced_report::delete_advanced_report_job(&job_id)?;
    state.remove_advanced_report_task(&job_id).await;
    Ok(deleted)
}

#[tauri::command]
pub async fn get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
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
