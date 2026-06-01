use crate::state::RuntimeState;
use crate::types::*;
use base64::Engine;
use open::that as open_path;
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

static REPORT_PREVIEW_SERVER: OnceLock<ReportPreviewServer> = OnceLock::new();
static REPORT_PREVIEW_COUNTER: AtomicU64 = AtomicU64::new(1);

struct ReportPreviewServer {
    base_url: String,
    routes: Arc<Mutex<HashMap<String, PathBuf>>>,
}

impl ReportPreviewServer {
    fn register(&self, path: PathBuf) -> Result<String, String> {
        let token = new_report_preview_token();
        self.routes
            .lock()
            .map_err(|_| "报告预览服务状态异常".to_string())?
            .insert(token.clone(), path);
        Ok(format!("{}/report/{}", self.base_url, token))
    }
}

#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    Ok(AppConfig::load().to_settings())
}

#[tauri::command]
pub async fn save_api_key(
    state: State<'_, Arc<RuntimeState>>,
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
pub async fn clear_api_key(state: State<'_, Arc<RuntimeState>>) -> Result<AppSettings, String> {
    let mut config = AppConfig::load();
    config.api_key = None;
    config.save()?;
    state.clear_api_key().await;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn save_ima_credentials(
    client_id: String,
    api_key: String,
) -> Result<AppSettings, String> {
    if client_id.trim().len() < 4 {
        return Err("ima Client ID 格式不正确".to_string());
    }
    if api_key.trim().len() < 8 {
        return Err("ima API Key 格式不正确".to_string());
    }
    let mut config = AppConfig::load();
    config.ima_client_id = Some(client_id.trim().to_string());
    config.ima_api_key = Some(api_key.trim().to_string());
    config.save()?;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn clear_ima_credentials() -> Result<AppSettings, String> {
    let mut config = AppConfig::load();
    config.ima_client_id = None;
    config.ima_api_key = None;
    config.ima_knowledge_base_id = None;
    config.ima_knowledge_base_name = None;
    config.save()?;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn test_ima_connection() -> Result<ImaConnectionTestResult, String> {
    let config = AppConfig::load();
    crate::ima::ImaClient::from_config(&config)?
        .test_connection()
        .await
}

#[tauri::command]
pub async fn list_addable_ima_knowledge_bases(
    cursor: Option<String>,
    limit: Option<u32>,
    force_refresh: Option<bool>,
) -> Result<ImaKnowledgeBasePage, String> {
    let config = AppConfig::load();
    crate::ima::ImaClient::from_config(&config)?
        .list_own_knowledge_bases(cursor, limit, force_refresh.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn save_ima_target(
    knowledge_base_id: String,
    knowledge_base_name: String,
) -> Result<AppSettings, String> {
    if knowledge_base_id.trim().is_empty() {
        return Err("请选择 ima 知识库".to_string());
    }
    let mut config = AppConfig::load();
    config.ima_knowledge_base_id = Some(knowledge_base_id.trim().to_string());
    config.ima_knowledge_base_name = Some(knowledge_base_name.trim().to_string());
    config.save()?;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn sync_books_to_ima(
    app: AppHandle,
    state: State<'_, Arc<RuntimeState>>,
    options: ImaSyncOptions,
) -> Result<ImaSyncResult, String> {
    let config = AppConfig::load();
    let knowledge_base_id = config
        .ima_knowledge_base_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "请先选择要同步到的 ima 知识库".to_string())?
        .to_string();
    let ima_client = crate::ima::ImaClient::from_config(&config)?;
    let weread_client = state.client().await?;

    let book_ids = if options.book_ids.is_empty() {
        load_all_notebook_book_ids(&weread_client).await?
    } else {
        options.book_ids.clone()
    };
    if book_ids.is_empty() {
        return Err("没有找到可同步的微信读书笔记".to_string());
    }

    let export_options = ExportOptions {
        book_ids: book_ids.clone(),
        format: "markdown".to_string(),
        output_dir: String::new(),
        include_bookmarks: options.include_bookmarks,
        include_reviews: options.include_reviews,
        group_by_chapter: options.group_by_chapter,
    };

    let total = book_ids.len();
    let mut results = Vec::new();
    for (index, book_id) in book_ids.iter().enumerate() {
        let result =
            match crate::export::load_export_book(&weread_client, book_id, &export_options).await {
                Ok(book) => {
                    let display_title = display_book_title(&book.title);
                    if book.bookmarks.is_empty() && book.reviews.is_empty() {
                        ImaSyncBookResult {
                            book_id: book.book_id,
                            title: display_title,
                            status: "skipped".to_string(),
                            message: "这本书没有可同步的划线或想法".to_string(),
                            note_id: None,
                            media_id: None,
                        }
                    } else {
                        match sync_one_book_to_ima(
                            &ima_client,
                            &knowledge_base_id,
                            &display_title,
                            build_ima_markdown(
                                &display_title,
                                &crate::export::build_markdown(&book, &export_options),
                            ),
                        )
                        .await
                        {
                            Ok((note_id, media_id, reused_note)) => ImaSyncBookResult {
                                book_id: book.book_id,
                                title: display_title,
                                status: "success".to_string(),
                                message: if reused_note {
                                    "已将已有 ima 笔记重新加入知识库".to_string()
                                } else {
                                    "已同步到 ima 知识库".to_string()
                                },
                                note_id: Some(note_id),
                                media_id: Some(media_id),
                            },
                            Err(error) => ImaSyncBookResult {
                                book_id: book.book_id,
                                title: display_title,
                                status: "failed".to_string(),
                                message: error,
                                note_id: None,
                                media_id: None,
                            },
                        }
                    }
                }
                Err(error) => ImaSyncBookResult {
                    book_id: book_id.clone(),
                    title: fallback_book_title(&weread_client, book_id).await,
                    status: "failed".to_string(),
                    message: error,
                    note_id: None,
                    media_id: None,
                },
            };
        let progress_title = result.title.clone();
        results.push(result);
        let _ = app.emit(
            "ima-sync-progress",
            ImaSyncProgressPayload {
                current: index + 1,
                total,
                title: progress_title,
            },
        );
    }

    Ok(ImaSyncResult {
        success_count: results
            .iter()
            .filter(|item| item.status == "success")
            .count(),
        skipped_count: results
            .iter()
            .filter(|item| item.status == "skipped")
            .count(),
        failed_count: results
            .iter()
            .filter(|item| item.status == "failed")
            .count(),
        results,
    })
}

async fn load_all_notebook_book_ids(
    client: &crate::api::WeReadClient,
) -> Result<Vec<String>, String> {
    let mut book_ids = Vec::new();
    let mut last_sort = 0;
    loop {
        let page = client.notebooks_with_cache(100, last_sort, false).await?;
        if page.books.is_empty() {
            break;
        }
        last_sort = page.books.last().map(|book| book.sort).unwrap_or(0);
        book_ids.extend(
            page.books
                .into_iter()
                .filter(|book| {
                    book.bookmark_count > 0 || book.review_count > 0 || book.note_count > 0
                })
                .map(|book| book.book_id),
        );
        if page.has_more != 1 {
            break;
        }
    }
    Ok(book_ids)
}

async fn sync_one_book_to_ima(
    ima_client: &crate::ima::ImaClient,
    knowledge_base_id: &str,
    title: &str,
    markdown: String,
) -> Result<(String, String, bool), String> {
    let note_id = match ima_client.find_note_by_title(title).await? {
        Some(existing_note_id) => {
            let media_id = ima_client
                .add_note_to_knowledge_base(knowledge_base_id, title, &existing_note_id)
                .await?;
            return Ok((existing_note_id, media_id, true));
        }
        None => ima_client.import_markdown_note(&markdown).await?,
    };
    let media_id = ima_client
        .add_note_to_knowledge_base(knowledge_base_id, title, &note_id)
        .await?;
    Ok((note_id, media_id, false))
}

async fn fallback_book_title(client: &crate::api::WeReadClient, book_id: &str) -> String {
    client
        .book_info(book_id)
        .await
        .map(|book| display_book_title(&book.title))
        .unwrap_or_else(|_| "未知书籍".to_string())
}

fn display_book_title(title: &str) -> String {
    let title = title.trim();
    if title.is_empty() {
        "未知书籍".to_string()
    } else {
        title.to_string()
    }
}

fn build_ima_markdown(title: &str, markdown: &str) -> String {
    let trimmed = markdown.trim_start();
    if trimmed.starts_with(&format!("# {title}")) {
        return markdown.to_string();
    }
    format!("# {title}\n\n{trimmed}")
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
pub async fn save_telemetry_enabled(enabled: bool) -> Result<AppSettings, String> {
    Ok(crate::telemetry::set_enabled(enabled)?.to_settings())
}

#[tauri::command]
pub async fn reset_telemetry_installation_id() -> Result<AppSettings, String> {
    Ok(crate::telemetry::reset_installation_id()?.to_settings())
}

#[tauri::command]
pub async fn send_telemetry_ping() -> Result<TelemetryPingResult, String> {
    crate::telemetry::send_startup_ping().await
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
    state: State<'_, Arc<RuntimeState>>,
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
    state: State<'_, Arc<RuntimeState>>,
    book_id: String,
) -> Result<BookInfo, String> {
    state.client().await?.book_info(&book_id).await
}

#[tauri::command]
pub async fn get_book_progress(
    state: State<'_, Arc<RuntimeState>>,
    book_id: String,
) -> Result<BookProgress, String> {
    state.client().await?.book_progress(&book_id).await
}

#[tauri::command]
pub async fn get_bookmarks(
    state: State<'_, Arc<RuntimeState>>,
    book_id: String,
    force_refresh: Option<bool>,
) -> Result<BookmarkListResult, String> {
    state
        .client()
        .await?
        .bookmark_list_with_cache(&book_id, force_refresh.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn get_my_reviews(
    state: State<'_, Arc<RuntimeState>>,
    book_id: String,
    synckey: i64,
    count: i32,
    force_refresh: Option<bool>,
) -> Result<ReviewListResult, String> {
    state
        .client()
        .await?
        .my_reviews_with_cache(&book_id, synckey, count, force_refresh.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn get_notebooks(
    state: State<'_, Arc<RuntimeState>>,
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
    state: State<'_, Arc<RuntimeState>>,
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
    state: State<'_, Arc<RuntimeState>>,
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
    let report_path = PathBuf::from(path);
    if !report_path.exists() {
        return Err("报告文件不存在".to_string());
    }
    if report_path.extension().and_then(|value| value.to_str()) == Some("html") {
        let url = report_preview_url(report_path)?;
        return open_path(url).map_err(|e| format!("无法打开报告: {e}"));
    }
    open_path(report_path).map_err(|e| format!("无法打开报告: {e}"))
}

#[tauri::command]
pub async fn open_report_folder(path: String) -> Result<(), String> {
    let report_path = PathBuf::from(path);
    if !report_path.exists() {
        return Err("报告文件不存在".to_string());
    }
    let folder = report_path
        .parent()
        .ok_or_else(|| "无法定位报告所在文件夹".to_string())?;
    open_path(folder).map_err(|e| format!("无法打开报告所在文件夹: {e}"))
}

fn report_preview_url(path: PathBuf) -> Result<String, String> {
    if REPORT_PREVIEW_SERVER.get().is_none() {
        let server = start_report_preview_server()?;
        let _ = REPORT_PREVIEW_SERVER.set(server);
    }
    let server = REPORT_PREVIEW_SERVER
        .get()
        .ok_or_else(|| "报告预览服务未启动".to_string())?;
    server.register(path)
}

fn start_report_preview_server() -> Result<ReportPreviewServer, String> {
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|e| format!("启动报告预览服务失败: {e}"))?;
    let addr = listener
        .local_addr()
        .map_err(|e| format!("读取报告预览服务地址失败: {e}"))?;
    let server = ReportPreviewServer {
        base_url: format!("http://{}", addr),
        routes: Arc::new(Mutex::new(HashMap::new())),
    };
    let routes = Arc::clone(&server.routes);

    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            handle_report_preview_request(stream, &routes);
        }
    });

    Ok(server)
}

fn handle_report_preview_request(mut stream: TcpStream, routes: &Mutex<HashMap<String, PathBuf>>) {
    let mut buffer = [0_u8; 2048];
    let Ok(size) = stream.read(&mut buffer) else {
        return;
    };
    let request = String::from_utf8_lossy(&buffer[..size]);
    let Some(path) = request
        .lines()
        .next()
        .and_then(parse_report_preview_request_path)
    else {
        let _ = write_http_response(
            &mut stream,
            400,
            "text/plain; charset=utf-8",
            b"Bad Request",
        );
        return;
    };
    let Some(token) = path.strip_prefix("/report/") else {
        let _ = write_http_response(&mut stream, 404, "text/plain; charset=utf-8", b"Not Found");
        return;
    };
    let Some(file_path) = routes.lock().ok().and_then(|map| map.get(token).cloned()) else {
        let _ = write_http_response(&mut stream, 404, "text/plain; charset=utf-8", b"Not Found");
        return;
    };
    let Ok(content) = fs::read(file_path) else {
        let _ = write_http_response(&mut stream, 404, "text/plain; charset=utf-8", b"Not Found");
        return;
    };
    let _ = write_http_response(&mut stream, 200, "text/html; charset=utf-8", &content);
}

fn parse_report_preview_request_path(line: &str) -> Option<String> {
    let mut parts = line.split_whitespace();
    let method = parts.next()?;
    let path = parts.next()?;
    if method != "GET" && method != "HEAD" {
        return None;
    }
    Some(path.to_string())
}

fn write_http_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Error",
    };
    write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    )?;
    stream.write_all(body)
}

fn new_report_preview_token() -> String {
    let counter = REPORT_PREVIEW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("{millis}-{counter}")
}

#[tauri::command]
pub async fn detect_local_agents() -> Result<Vec<crate::agent_bridge::DetectedAgentDto>, String> {
    Ok(crate::agent_bridge::list_detected_agents())
}

#[tauri::command]
pub async fn invoke_local_agent(
    app: tauri::AppHandle,
    state: State<'_, Arc<RuntimeState>>,
    request: crate::agent_bridge::AgentInvokeRequest,
) -> Result<crate::agent_bridge::AgentInvokeResult, String> {
    crate::agent_bridge::invoke_local_agent(app, state, request).await
}

#[tauri::command]
pub async fn cancel_local_agent(
    state: State<'_, Arc<RuntimeState>>,
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
pub async fn preview_advanced_report_data_access(
    request: crate::advanced_report::AdvancedReportDataAccessPreviewRequest,
) -> Result<crate::advanced_report::AdvancedReportDataAccessPreview, String> {
    crate::advanced_report::preview_advanced_report_data_access(request)
}

#[tauri::command]
pub async fn create_advanced_report_job(
    state: State<'_, Arc<RuntimeState>>,
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
    state: State<'_, Arc<RuntimeState>>,
    request: crate::advanced_report::StartAdvancedReportRequest,
) -> Result<crate::advanced_report::AdvancedReportTask, String> {
    let client = state.client().await?;
    crate::advanced_report::start_advanced_report_task(app, state.inner(), client, request).await
}

#[tauri::command]
pub async fn list_advanced_report_tasks(
    state: State<'_, Arc<RuntimeState>>,
) -> Result<Vec<crate::advanced_report::AdvancedReportTask>, String> {
    crate::advanced_report::merge_advanced_report_tasks(state.advanced_report_tasks().await)
}

#[tauri::command]
pub async fn cancel_advanced_report_task(
    state: State<'_, Arc<RuntimeState>>,
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
    state: State<'_, Arc<RuntimeState>>,
    job_id: String,
) -> Result<bool, String> {
    if state.has_active_advanced_report_job(&job_id).await {
        return Err("任务正在生成中，请先取消后再删除。".to_string());
    }
    let deleted = crate::advanced_report::delete_advanced_report_job(&job_id)?;
    state.remove_advanced_report_task(&job_id).await;
    Ok(deleted)
}

// ========== LLM Chat Commands ==========

#[tauri::command]
pub async fn save_llm_config(
    base_url: String,
    api_key: String,
    model: String,
) -> Result<AppSettings, String> {
    let base_url = base_url.trim().to_string();
    let api_key = api_key.trim().to_string();
    let model = model.trim().to_string();
    if base_url.is_empty() {
        return Err("Base URL 不能为空".to_string());
    }
    if model.is_empty() {
        return Err("模型名称不能为空".to_string());
    }
    let mut config = AppConfig::load();
    if api_key.is_empty() && config.llm_api_key.is_none() {
        return Err("API Key 不能为空".to_string());
    }
    config.llm_base_url = Some(base_url);
    if !api_key.is_empty() {
        config.llm_api_key = Some(api_key);
    }
    config.llm_model = Some(model);
    config.save()?;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn clear_llm_config() -> Result<AppSettings, String> {
    let mut config = AppConfig::load();
    config.llm_base_url = None;
    config.llm_api_key = None;
    config.llm_model = None;
    config.save()?;
    Ok(config.to_settings())
}

#[tauri::command]
pub async fn test_llm_connection() -> Result<LlmTestResult, String> {
    let config = AppConfig::load();
    let base_url = config
        .llm_base_url
        .as_deref()
        .ok_or_else(|| "请先配置 LLM Base URL".to_string())?;
    let api_key = config
        .llm_api_key
        .as_deref()
        .ok_or_else(|| "请先配置 LLM API Key".to_string())?;
    let model = config
        .llm_model
        .as_deref()
        .unwrap_or("gpt-4o");

    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5,
    });

    let response = client
        .post(&url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("连接失败: {e}"))?;

    let status = response.status().as_u16();
    if status == 200 || status == 201 {
        Ok(LlmTestResult {
            ok: true,
            message: format!("连接成功 (模型: {})", model),
            model: Some(model.to_string()),
        })
    } else {
        let text = response
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(300)
            .collect::<String>();
        Ok(LlmTestResult {
            ok: false,
            message: format!("连接失败 (HTTP {}): {}", status, text),
            model: None,
        })
    }
}

// ========== Custom Template Commands ==========

#[tauri::command]
pub async fn list_custom_templates() -> Result<Vec<CustomTemplate>, String> {
    crate::custom_templates::list_custom_templates()
}

#[tauri::command]
pub async fn create_custom_template(
    request: CreateCustomTemplateRequest,
) -> Result<CustomTemplate, String> {
    crate::custom_templates::create_custom_template(request)
}

#[tauri::command]
pub async fn delete_custom_template(template_id: String) -> Result<bool, String> {
    crate::custom_templates::delete_custom_template(&template_id)
}

#[tauri::command]
pub async fn update_custom_template(
    template_id: String,
    request: CreateCustomTemplateRequest,
) -> Result<CustomTemplate, String> {
    crate::custom_templates::update_custom_template(&template_id, request)
}

// ========== LLM Chat Commands ==========

#[tauri::command]
pub async fn start_llm_chat(
    app: AppHandle,
    state: State<'_, Arc<RuntimeState>>,
    request: LlmChatRequest,
) -> Result<String, String> {
    let config = AppConfig::load();
    crate::llm_chat::start_llm_chat(app, state.inner(), &config, request).await
}

#[tauri::command]
pub async fn cancel_llm_chat(
    state: State<'_, Arc<RuntimeState>>,
    job_id: String,
) -> Result<bool, String> {
    crate::llm_chat::cancel_llm_chat(state.inner(), &job_id).await
}

#[tauri::command]
pub async fn grant_consent(
    state: State<'_, Arc<RuntimeState>>,
    job_id: String,
    api_name: String,
    scope: Option<String>,
) -> Result<bool, String> {
    state.grant_api_consent(&job_id, &api_name, scope.as_deref()).await;
    Ok(state.resolve_consent(&job_id, true).await)
}

#[tauri::command]
pub async fn deny_consent(
    state: State<'_, Arc<RuntimeState>>,
    job_id: String,
) -> Result<bool, String> {
    Ok(state.resolve_consent(&job_id, false).await)
}

#[tauri::command]
pub async fn clear_conversation_consents(
    state: State<'_, Arc<RuntimeState>>,
) -> Result<(), String> {
    state.clear_conversation_consents().await;
    Ok(())
}

#[tauri::command]
pub async fn respond_ask_user(
    state: State<'_, Arc<RuntimeState>>,
    job_id: String,
    response: String,
) -> Result<bool, String> {
    Ok(state.respond_ask_user(&job_id, response).await)
}

#[tauri::command]
pub async fn save_llm_report(html: String, title: String) -> Result<String, String> {
    let config = AppConfig::load();
    let output_dir = config
        .last_export_dir
        .clone()
        .unwrap_or_else(|| AppConfig::default_export_dir().to_string_lossy().to_string());
    crate::report::export_report_html(&output_dir, &title, &html)
}

#[tauri::command]
pub async fn save_chat_as_template(
    name: String,
    description: String,
    prompt: String,
    style: Option<String>,
    output_shape: String,
    requires_raw_notes_consent: bool,
) -> Result<CustomTemplate, String> {
    let request = CreateCustomTemplateRequest {
        name,
        description,
        style_md: style,
        prompt_md: prompt,
        default_output_shape: Some(output_shape),
        output_shapes: None,
        requires_raw_notes_consent: Some(requires_raw_notes_consent),
        intent: None,
    };
    crate::custom_templates::create_custom_template(request)
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

#[tauri::command]
pub fn save_image_file(
    app: AppHandle,
    file_name: String,
    data_url: String,
) -> Result<String, String> {
    let parts: Vec<&str> = data_url.splitn(2, ',').collect();
    if parts.len() != 2 {
        return Err("图片数据格式不正确".to_string());
    }
    let base64_data = parts[1];
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("图片数据解码失败: {e}"))?;

    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .add_filter("图片", &["png"])
        .set_file_name(file_name)
        .blocking_save_file()
        .ok_or_else(|| "用户取消".to_string())?;

    let path = file_path.as_path().ok_or_else(|| "路径无效".to_string())?;
    fs::write(path, bytes).map_err(|e| format!("保存图片失败: {e}"))?;

    Ok(path.to_string_lossy().to_string())
}

// ========== 聊天历史 (JSONL) ==========

const CHAT_HISTORY_DIR: &str = "chat-history";

fn sessions_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".weread-desktop")
        .join(CHAT_HISTORY_DIR)
        .join("sessions")
}

/// 从文件名解析 session id：rollout-2026-05-29T14-30-00-{uuid}.jsonl -> 文件名本身（不含扩展名）
fn session_id_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string()
}

/// 从文件名解析日期：rollout-2026-05-29T14-30-00-... -> "2026-05-29"
fn date_from_filename(name: &str) -> Option<String> {
    // 格式：rollout-YYYY-MM-DDTHH-MM-SS-uuid.jsonl
    let rest = name.strip_prefix("rollout-")?;
    let date_part = rest.get(..10)?; // "2026-05-29"
    Some(date_part.to_string())
}

/// 扫描所有 session 文件，返回按修改时间倒序的路径列表
fn scan_session_files() -> Result<Vec<PathBuf>, String> {
    let base = sessions_dir();
    if !base.exists() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    scan_dir_recursive(&base, &mut files);
    // 预取修改时间，避免 sort_by 内重复 stat 系统调用
    let mut with_time: Vec<(PathBuf, std::time::SystemTime)> = files
        .into_iter()
        .map(|p| {
            let t = p
                .metadata()
                .and_then(|m| m.modified())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            (p, t)
        })
        .collect();
    with_time.sort_by(|a, b| b.1.cmp(&a.1));
    let files = with_time.into_iter().map(|(p, _)| p).collect();
    Ok(files)
}

fn scan_dir_recursive(dir: &Path, out: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_dir() {
                scan_dir_recursive(&path, out);
            } else if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
                out.push(path);
            }
        }
    }
}

/// 生成 session 文件路径：sessions/YYYY/MM/DD/rollout-{datetime}-{uuid}.jsonl
fn new_session_path() -> PathBuf {
    let now = chrono::Local::now();
    let uuid = uuid::Uuid::new_v4();
    let datetime = now.format("%Y-%m-%dT%H-%M-%S").to_string();
    let filename = format!("rollout-{}-{}.jsonl", datetime, uuid);
    sessions_dir()
        .join(now.format("%Y").to_string())
        .join(now.format("%m").to_string())
        .join(now.format("%d").to_string())
        .join(filename)
}

#[tauri::command]
pub async fn save_chat_history(
    session_id: String,
    message: serde_json::Value,
) -> Result<String, String> {
    // 找到已有文件或创建新文件，返回 session_id
    let (path, sid) = if session_id.is_empty() {
        let p = new_session_path();
        let s = session_id_from_path(&p);
        (p, s)
    } else {
        let files = scan_session_files().unwrap_or_default();
        let existing = files
            .into_iter()
            .find(|p| session_id_from_path(p) == session_id);
        match existing {
            Some(p) => (p, session_id),
            None => {
                let p = new_session_path();
                let s = session_id_from_path(&p);
                (p, s)
            }
        }
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建会话目录失败: {e}"))?;
    }

    // 追加一行
    let line = serde_json::to_string(&message)
        .map_err(|e| format!("序列化消息失败: {e}"))?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("打开聊天历史文件失败: {e}"))?;
    use std::io::Write;
    writeln!(file, "{}", line).map_err(|e| format!("写入聊天历史失败: {e}"))?;

    Ok(sid)
}

#[tauri::command]
pub async fn load_chat_history(session_id: Option<String>) -> Result<serde_json::Value, String> {
    let files = scan_session_files().unwrap_or_default();

    let path = match session_id {
        Some(ref id) if !id.is_empty() => {
            files
                .into_iter()
                .find(|p| session_id_from_path(p) == *id)
        }
        _ => files.into_iter().next(), // 最近的文件
    };

    let path = match path {
        Some(p) => p,
        None => return Ok(serde_json::json!({ "sessionId": null, "messages": [] })),
    };

    let content = fs::read_to_string(&path).map_err(|e| format!("读取聊天历史失败: {e}"))?;
    let mut messages = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            messages.push(val);
        }
    }

    let sid = session_id_from_path(&path);
    Ok(serde_json::json!({
        "sessionId": sid,
        "messages": messages,
    }))
}

#[tauri::command]
pub async fn list_chat_histories() -> Result<Vec<serde_json::Value>, String> {
    let files = scan_session_files()?;
    let mut result = Vec::new();

    for path in &files {
        let sid = session_id_from_path(path);
        let date = path
            .file_name()
            .and_then(|n| n.to_str())
            .and_then(date_from_filename);
        let line_count = fs::read_to_string(path)
            .map(|c| c.lines().filter(|l| !l.trim().is_empty()).count())
            .unwrap_or(0);
        let modified = path
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                Some(datetime.format("%Y-%m-%dT%H:%M:%S").to_string())
            });

        result.push(serde_json::json!({
            "sessionId": sid,
            "date": date,
            "messageCount": line_count,
            "updatedAt": modified,
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn delete_chat_history(session_id: String) -> Result<(), String> {
    let files = scan_session_files().unwrap_or_default();
    if let Some(path) = files
        .into_iter()
        .find(|p| session_id_from_path(p) == session_id)
    {
        fs::remove_file(&path).map_err(|e| format!("删除聊天历史失败: {e}"))?;
    }
    Ok(())
}
