use crate::types::*;
use agent_cli_bridge::{invoke_agent_with_handle, InvokeEvent, InvokeOpts};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

const REPORT_PRIVATE_DIR: &str = ".weread-desktop";
const ADVANCED_REPORT_DIR: &str = "reports";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub style_summary: String,
    pub requires_raw_notes_consent: bool,
    pub default_capabilities: Vec<String>,
    pub optional_capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportJobRequest {
    pub template_id: String,
    pub raw_notes_consent: bool,
    pub force_refresh: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportJob {
    pub job_id: String,
    pub template_id: String,
    pub template_name: String,
    pub job_dir: String,
    pub input_dir: String,
    pub data_dir: String,
    pub output_dir: String,
    pub prompt_path: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportOutput {
    pub job_id: String,
    pub report_html: Option<String>,
    pub meta: Option<Value>,
    pub report_path: String,
    pub meta_path: String,
    pub validation: AdvancedReportValidation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportValidation {
    pub ok: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportExportRequest {
    pub job_id: String,
    pub output_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportExportResult {
    pub success: bool,
    pub file_path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AdvancedReportTaskStatus {
    Preparing,
    Running,
    Completed,
    Failed,
    Canceled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportTask {
    pub job_id: String,
    pub template_id: String,
    pub template_name: String,
    pub status: AdvancedReportTaskStatus,
    pub message: Option<String>,
    pub job_dir: String,
    pub report_path: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdvancedReportTaskSnapshot {
    job_id: String,
    template_id: String,
    template_name: String,
    status: AdvancedReportTaskStatus,
    message: Option<String>,
    job_dir: String,
    report_path: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAdvancedReportRequest {
    pub template_id: String,
    pub raw_notes_consent: bool,
    pub force_refresh: Option<bool>,
    pub agent: String,
    pub model: Option<String>,
    pub bin_override: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportTaskEvent {
    pub job_id: String,
    pub status: AdvancedReportTaskStatus,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportLogEvent {
    pub job_id: String,
    pub kind: String,
    pub text: String,
    pub created_at: String,
}

#[derive(Debug, Clone)]
struct BuiltinAdvancedTemplate {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    category: &'static str,
    style_summary: &'static str,
    style_md: &'static str,
    prompt_md: &'static str,
    requires_raw_notes_consent: bool,
    default_capabilities: &'static [&'static str],
    optional_capabilities: &'static [&'static str],
}

pub fn list_advanced_report_templates() -> Vec<AdvancedReportTemplate> {
    builtin_templates()
        .into_iter()
        .map(|template| AdvancedReportTemplate {
            id: template.id.to_string(),
            name: template.name.to_string(),
            description: template.description.to_string(),
            category: template.category.to_string(),
            style_summary: template.style_summary.to_string(),
            requires_raw_notes_consent: template.requires_raw_notes_consent,
            default_capabilities: template
                .default_capabilities
                .iter()
                .map(|item| item.to_string())
                .collect(),
            optional_capabilities: template
                .optional_capabilities
                .iter()
                .map(|item| item.to_string())
                .collect(),
        })
        .collect()
}

pub fn merge_advanced_report_tasks(
    runtime_tasks: Vec<AdvancedReportTask>,
) -> Result<Vec<AdvancedReportTask>, String> {
    let mut tasks = HashMap::new();

    for task in read_persisted_advanced_report_tasks()? {
        tasks.insert(task.job_id.clone(), task);
    }
    for task in runtime_tasks {
        tasks.insert(task.job_id.clone(), task);
    }

    let mut tasks = tasks.into_values().collect::<Vec<_>>();
    tasks.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(tasks)
}

pub async fn create_advanced_report_job(
    client: crate::api::WeReadClient,
    request: AdvancedReportJobRequest,
) -> Result<AdvancedReportJob, String> {
    let template = find_template(&request.template_id)?;
    if template.requires_raw_notes_consent && !request.raw_notes_consent {
        return Err("该智能体模板需要读取原文摘录，请先确认隐私授权。".to_string());
    }

    let created_at = Utc::now().to_rfc3339();
    let job_id = format!("{}-{}", template.id, Utc::now().timestamp_millis().max(0));
    let job_dir = advanced_report_root().join("jobs").join(&job_id);
    let input_dir = job_dir.join("input");
    let data_dir = job_dir.join("data");
    let output_dir = job_dir.join("output");

    fs::create_dir_all(&input_dir).map_err(|e| format!("创建智能体报告输入目录失败: {e}"))?;
    fs::create_dir_all(&data_dir).map_err(|e| format!("创建智能体报告数据目录失败: {e}"))?;
    fs::create_dir_all(&output_dir).map_err(|e| format!("创建智能体报告输出目录失败: {e}"))?;

    let force_refresh = request.force_refresh.unwrap_or(false);
    let data_index = prefetch_default_data(
        &client,
        &template,
        &data_dir,
        force_refresh,
        request.raw_notes_consent,
    )
    .await?;
    let template_manifest = template_manifest_json(&template);
    let user_policy = json!({
        "rawNotesConsent": request.raw_notes_consent,
        "privacy": {
            "doNotInventUserData": true
        }
    });
    let capabilities = capabilities_json(&template);
    let cache_index = json!({
        "version": 1,
        "strategy": "prefer-cache",
        "generatedAt": created_at,
        "dataFiles": data_index
    });
    let brief = build_agent_brief(
        &template,
        &template_manifest,
        &user_policy,
        &capabilities,
        &cache_index,
    );
    let prompt = build_agent_prompt();

    write_text(input_dir.join("brief.md"), &brief)?;
    write_text(input_dir.join("agent-prompt.md"), &prompt)?;
    write_json(input_dir.join("template.json"), &template_manifest)?;
    write_text(input_dir.join("style.md"), template.style_md)?;
    write_text(input_dir.join("prompt.md"), template.prompt_md)?;
    write_json(input_dir.join("user-policy.json"), &user_policy)?;
    write_json(input_dir.join("capabilities.json"), &capabilities)?;
    write_json(input_dir.join("cache-index.json"), &cache_index)?;

    let job = AdvancedReportJob {
        job_id: job_id.clone(),
        template_id: template.id.to_string(),
        template_name: template.name.to_string(),
        job_dir: path_string(&job_dir),
        input_dir: path_string(&input_dir),
        data_dir: path_string(&data_dir),
        output_dir: path_string(&output_dir),
        prompt_path: path_string(&input_dir.join("agent-prompt.md")),
        status: "prepared".to_string(),
        created_at,
    };

    write_json(job_dir.join("job.json"), &job)?;
    Ok(job)
}

pub async fn start_advanced_report_task(
    app: AppHandle,
    state: &crate::state::RuntimeState,
    client: crate::api::WeReadClient,
    request: StartAdvancedReportRequest,
) -> Result<AdvancedReportTask, String> {
    if request.agent.trim().is_empty() {
        return Err("请选择本地 Agent".to_string());
    }
    if state
        .has_active_advanced_report_template(&request.template_id)
        .await
    {
        return Err("这个模板已经在生成中，请等待完成后再重新生成。".to_string());
    }

    let job = create_advanced_report_job(
        client,
        AdvancedReportJobRequest {
            template_id: request.template_id,
            raw_notes_consent: request.raw_notes_consent,
            force_refresh: request.force_refresh,
        },
    )
    .await?;

    let task = AdvancedReportTask {
        job_id: job.job_id.clone(),
        template_id: job.template_id.clone(),
        template_name: job.template_name.clone(),
        status: AdvancedReportTaskStatus::Running,
        message: Some("正在生成报告".to_string()),
        job_dir: job.job_dir.clone(),
        report_path: path_string(&job_output_dir(&job.job_id).join("report.html")),
        created_at: job.created_at.clone(),
        updated_at: Utc::now().to_rfc3339(),
    };

    persist_task_snapshot(&task)?;
    state.upsert_advanced_report_task(task.clone()).await;
    emit_task_event(
        &app,
        &task.job_id,
        AdvancedReportTaskStatus::Running,
        Some("正在生成报告".to_string()),
    );

    let agent = request.agent;
    let model = request.model;
    let bin_override = request.bin_override;
    let job_id = job.job_id.clone();
    let job_dir = PathBuf::from(job.job_dir.clone());
    let prompt = build_runtime_prompt(&job);
    let app_for_task = app.clone();

    tokio::spawn(async move {
        let result = run_agent_for_job(
            app_for_task.clone(),
            agent,
            model,
            bin_override,
            job_id.clone(),
            job_dir,
            prompt,
        )
        .await;

        if let Err(message) = result {
            let state = app_for_task.state::<crate::state::RuntimeState>();
            state
                .update_advanced_report_task_status(
                    &job_id,
                    AdvancedReportTaskStatus::Failed,
                    Some(message.clone()),
                )
                .await;
            emit_task_event(
                &app_for_task,
                &job_id,
                AdvancedReportTaskStatus::Failed,
                Some(message),
            );
        }
    });

    Ok(task)
}

async fn run_agent_for_job(
    app: AppHandle,
    agent: String,
    model: Option<String>,
    bin_override: Option<String>,
    job_id: String,
    job_dir: PathBuf,
    prompt: String,
) -> Result<(), String> {
    let state = app.state::<crate::state::RuntimeState>();
    let handle = invoke_agent_with_handle(InvokeOpts {
        agent,
        prompt,
        cwd: Some(job_dir),
        model,
        bin_override,
    })
    .await
    .map_err(|e| e.to_string())?;
    state
        .register_agent_job(job_id.clone(), handle.cancel.clone())
        .await;

    let mut rx = handle.events;
    let mut stderr = Vec::new();
    let mut exit_code = None;

    while let Some(event) = rx.recv().await {
        match event {
            InvokeEvent::Start { .. } => {
                emit_log_event(&app, &job_id, "start", "本地 Agent 已启动");
                emit_task_event(
                    &app,
                    &job_id,
                    AdvancedReportTaskStatus::Running,
                    Some("本地 Agent 已启动".to_string()),
                );
            }
            InvokeEvent::Delta { text } => emit_log_event(&app, &job_id, "delta", &text),
            InvokeEvent::Raw { text } => emit_log_event(&app, &job_id, "raw", &text),
            InvokeEvent::Html { .. } => emit_log_event(&app, &job_id, "html", "已收到报告内容片段"),
            InvokeEvent::Meta { key, value } => {
                emit_log_event(&app, &job_id, "meta", &format!("{key}: {value}"));
            }
            InvokeEvent::Stderr { text } => {
                stderr.push(text.clone());
                emit_log_event(&app, &job_id, "stderr", &text);
            }
            InvokeEvent::Done { code } => {
                exit_code = code;
                emit_log_event(
                    &app,
                    &job_id,
                    "done",
                    &format!("本地 Agent 已结束: {:?}", code),
                );
            }
            InvokeEvent::Canceled => {
                emit_log_event(&app, &job_id, "canceled", "任务已取消");
                state.unregister_agent_job(&job_id).await;
                state
                    .update_advanced_report_task_status(
                        &job_id,
                        AdvancedReportTaskStatus::Canceled,
                        Some("已取消".to_string()),
                    )
                    .await;
                emit_task_event(
                    &app,
                    &job_id,
                    AdvancedReportTaskStatus::Canceled,
                    Some("已取消".to_string()),
                );
                return Ok(());
            }
            InvokeEvent::Error { message } => {
                emit_log_event(&app, &job_id, "error", &message);
                state.unregister_agent_job(&job_id).await;
                return Err(message);
            }
        }
    }

    state.unregister_agent_job(&job_id).await;
    let output = read_advanced_report_output(&job_id)?;
    if output.report_html.is_none() {
        let detail = if stderr.is_empty() {
            "本地 Agent 已结束，但没有生成报告".to_string()
        } else {
            format!("本地 Agent 已结束，但没有生成报告。{}", stderr.join("\n"))
        };
        return Err(detail);
    }

    if exit_code.unwrap_or(0) != 0 {
        return Err(format!("本地 Agent 异常退出: {:?}", exit_code));
    }

    let message = if output.validation.ok {
        "报告已生成".to_string()
    } else {
        format!(
            "报告已生成，有 {} 条质量提醒",
            output.validation.warnings.len()
        )
    };
    state
        .update_advanced_report_task_status(
            &job_id,
            AdvancedReportTaskStatus::Completed,
            Some(message.clone()),
        )
        .await;
    emit_task_event(
        &app,
        &job_id,
        AdvancedReportTaskStatus::Completed,
        Some(message),
    );
    Ok(())
}

fn build_runtime_prompt(job: &AdvancedReportJob) -> String {
    [
        "请在当前工作目录执行高级微信读书报告任务。",
        "",
        &format!("工作目录: {}", job.job_dir),
        &format!("任务提示词文件: {}", job.prompt_path),
        "",
        "请先读取 input/agent-prompt.md，然后读取 input/brief.md；brief.md 是唯一任务入口。",
        "必须生成 output/report.html、output/report.meta.json。",
        "HTML 必须是完整单文件，不依赖远程脚本、远程字体或远程图片。",
        "不要只在对话里输出报告内容；最终结果必须写入 output/ 文件。",
    ]
    .join("\n")
}

fn emit_task_event(
    app: &AppHandle,
    job_id: &str,
    status: AdvancedReportTaskStatus,
    message: Option<String>,
) {
    let _ = app.emit(
        "advanced-report-task-event",
        AdvancedReportTaskEvent {
            job_id: job_id.to_string(),
            status,
            message,
        },
    );
}

fn emit_log_event(app: &AppHandle, job_id: &str, kind: &str, text: &str) {
    if text.trim().is_empty() {
        return;
    }
    let event = AdvancedReportLogEvent {
        job_id: job_id.to_string(),
        kind: kind.to_string(),
        text: text.to_string(),
        created_at: Utc::now().to_rfc3339(),
    };
    append_log_event(job_id, &event);
    let _ = app.emit("advanced-report-log-event", event);
}

fn append_log_event(job_id: &str, event: &AdvancedReportLogEvent) {
    let log_path = job_log_path(job_id);
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(line) = serde_json::to_string(event) {
        use std::io::Write;
        if let Ok(mut file) = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)
        {
            let _ = writeln!(file, "{line}");
        }
    }
}

pub fn read_advanced_report_logs(job_id: &str) -> Result<Vec<AdvancedReportLogEvent>, String> {
    let job_id = normalize_job_id(job_id)?;
    let log_path = job_log_path(&job_id);
    if !log_path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(log_path).map_err(|e| format!("读取生成过程失败: {e}"))?;
    let mut events = Vec::new();
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(event) = serde_json::from_str::<AdvancedReportLogEvent>(line) {
            events.push(event);
        }
    }
    Ok(events)
}

pub fn read_advanced_report_output(job_id: &str) -> Result<AdvancedReportOutput, String> {
    let job_id = normalize_job_id(job_id)?;
    let output_dir = job_output_dir(&job_id);
    let report_path = output_dir.join("report.html");
    let meta_path = output_dir.join("report.meta.json");

    let report_html = read_optional_text(&report_path)?;
    let meta = if meta_path.exists() {
        let content =
            fs::read_to_string(&meta_path).map_err(|e| format!("读取智能体报告元数据失败: {e}"))?;
        Some(serde_json::from_str(&content).map_err(|e| format!("解析智能体报告元数据失败: {e}"))?)
    } else {
        None
    };

    let validation = validate_output(report_html.as_deref());

    Ok(AdvancedReportOutput {
        job_id,
        report_html,
        meta,
        report_path: path_string(&report_path),
        meta_path: path_string(&meta_path),
        validation,
    })
}

pub fn export_advanced_report_output(
    request: AdvancedReportExportRequest,
) -> Result<AdvancedReportExportResult, String> {
    let job_id = normalize_job_id(&request.job_id)?;
    if request.output_dir.trim().is_empty() {
        return Err("请选择导出目录".to_string());
    }

    let output_dir = resolve_output_dir(&request.output_dir).join("reports");
    fs::create_dir_all(&output_dir).map_err(|e| format!("创建报告导出目录失败: {e}"))?;

    let source = job_output_dir(&job_id).join("report.html");
    if !source.exists() {
        return Err("智能体报告尚未生成".to_string());
    }

    let file_name = format!("{job_id}.html");
    let target = unique_export_path(&output_dir, &file_name);
    fs::copy(&source, &target).map_err(|e| format!("导出智能体报告失败: {e}"))?;

    Ok(AdvancedReportExportResult {
        success: true,
        file_path: path_string(&target),
        message: "智能体报告已导出".to_string(),
    })
}

pub fn delete_advanced_report_job(job_id: &str) -> Result<bool, String> {
    let job_id = normalize_job_id(job_id)?;
    let job_dir = advanced_report_root().join("jobs").join(&job_id);
    if !job_dir.exists() {
        return Ok(false);
    }
    fs::remove_dir_all(&job_dir).map_err(|e| format!("删除智能体报告任务失败: {e}"))?;
    Ok(true)
}

fn read_persisted_advanced_report_tasks() -> Result<Vec<AdvancedReportTask>, String> {
    let jobs_dir = advanced_report_root().join("jobs");
    if !jobs_dir.exists() {
        return Ok(Vec::new());
    }

    let entries =
        fs::read_dir(&jobs_dir).map_err(|e| format!("读取智能体报告历史记录失败: {e}"))?;
    let mut tasks = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let job_dir = entry.path();
        if !job_dir.is_dir() {
            continue;
        }
        let job_path = job_dir.join("job.json");
        if !job_path.exists() {
            continue;
        }
        let content = match fs::read_to_string(&job_path) {
            Ok(content) => content,
            Err(_) => continue,
        };
        let job = match serde_json::from_str::<AdvancedReportJob>(&content) {
            Ok(job) => job,
            Err(_) => continue,
        };
        if normalize_job_id(&job.job_id).is_err() {
            continue;
        }

        let output_dir = job_output_dir(&job.job_id);
        let report_path = output_dir.join("report.html");
        if let Some(task) = read_task_snapshot(&job_dir, &report_path)? {
            tasks.push(task);
            continue;
        }

        let completed = report_path.exists();
        tasks.push(AdvancedReportTask {
            job_id: job.job_id.clone(),
            template_id: job.template_id.clone(),
            template_name: job.template_name.clone(),
            status: if completed {
                AdvancedReportTaskStatus::Completed
            } else {
                AdvancedReportTaskStatus::Failed
            },
            message: Some(if completed {
                "报告已生成".to_string()
            } else {
                "应用退出或任务中断，未生成报告".to_string()
            }),
            job_dir: job.job_dir.clone(),
            report_path: path_string(&report_path),
            created_at: job.created_at.clone(),
            updated_at: job.created_at,
        });
    }

    Ok(tasks)
}

fn read_task_snapshot(
    job_dir: &Path,
    report_path: &Path,
) -> Result<Option<AdvancedReportTask>, String> {
    let snapshot_path = job_dir.join("task.json");
    if !snapshot_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&snapshot_path)
        .map_err(|e| format!("读取智能体报告任务状态失败: {e}"))?;
    let snapshot = serde_json::from_str::<AdvancedReportTaskSnapshot>(&content)
        .map_err(|e| format!("解析智能体报告任务状态失败: {e}"))?;
    let report_exists = report_path.exists();
    let status = if report_exists {
        AdvancedReportTaskStatus::Completed
    } else if matches!(
        snapshot.status,
        AdvancedReportTaskStatus::Running | AdvancedReportTaskStatus::Preparing
    ) {
        AdvancedReportTaskStatus::Failed
    } else {
        snapshot.status.clone()
    };
    let message = if report_exists {
        snapshot.message.or_else(|| Some("报告已生成".to_string()))
    } else if matches!(
        snapshot.status,
        AdvancedReportTaskStatus::Running | AdvancedReportTaskStatus::Preparing
    ) {
        Some("应用退出或任务中断，未生成报告".to_string())
    } else {
        snapshot.message
    };

    Ok(Some(AdvancedReportTask {
        job_id: snapshot.job_id,
        template_id: snapshot.template_id,
        template_name: snapshot.template_name,
        status,
        message,
        job_dir: snapshot.job_dir,
        report_path: path_string(report_path),
        created_at: snapshot.created_at,
        updated_at: snapshot.updated_at,
    }))
}

pub(crate) fn persist_task_snapshot(task: &AdvancedReportTask) -> Result<(), String> {
    let job_id = normalize_job_id(&task.job_id)?;
    let snapshot = AdvancedReportTaskSnapshot {
        job_id: task.job_id.clone(),
        template_id: task.template_id.clone(),
        template_name: task.template_name.clone(),
        status: task.status.clone(),
        message: task.message.clone(),
        job_dir: task.job_dir.clone(),
        report_path: task.report_path.clone(),
        created_at: task.created_at.clone(),
        updated_at: task.updated_at.clone(),
    };
    write_json(
        advanced_report_root()
            .join("jobs")
            .join(job_id)
            .join("task.json"),
        &snapshot,
    )
}

async fn prefetch_default_data(
    client: &crate::api::WeReadClient,
    template: &BuiltinAdvancedTemplate,
    data_dir: &Path,
    force_refresh: bool,
    raw_notes_consent: bool,
) -> Result<Vec<Value>, String> {
    let mut data_index = Vec::new();
    let mut notebooks_for_notes = None;

    if has_capability(template.default_capabilities, "shelf.sync") {
        let result = client.shelf_sync(force_refresh).await?;
        write_data_file(data_dir, "shelf.sync.json", &result, &mut data_index)?;
    }

    if has_capability(template.default_capabilities, "notes.notebooks") {
        let notebooks = load_all_notebooks(client, force_refresh).await?;
        write_data_file(data_dir, "notebooks.all.json", &notebooks, &mut data_index)?;
        notebooks_for_notes = Some(notebooks);
    }

    if has_capability(template.default_capabilities, "reading.stats") {
        let yearly = client
            .reading_stats("annually", year_base_time(), force_refresh)
            .await?;
        write_data_file(
            data_dir,
            "reading-stats.year.json",
            &yearly,
            &mut data_index,
        )?;
        let overall = client.reading_stats("overall", 0, force_refresh).await?;
        write_data_file(
            data_dir,
            "reading-stats.overall.json",
            &overall,
            &mut data_index,
        )?;
    }

    if raw_notes_consent
        && (has_capability(template.optional_capabilities, "notes.bookmarks")
            || has_capability(template.optional_capabilities, "notes.reviews"))
    {
        let notebooks = match notebooks_for_notes {
            Some(notebooks) => notebooks,
            None => load_all_notebooks(client, force_refresh).await?,
        };
        let notes = load_raw_notes_for_report(client, &notebooks, force_refresh).await?;
        write_data_file(data_dir, "notes.raw.json", &notes, &mut data_index)?;
    }

    Ok(data_index)
}

async fn load_raw_notes_for_report(
    client: &crate::api::WeReadClient,
    notebooks: &NotebooksResult,
    force_refresh: bool,
) -> Result<Value, String> {
    let mut books = Vec::new();

    for notebook in notebooks
        .books
        .iter()
        .filter(|book| book.note_count > 0 || book.review_count > 0)
    {
        let bookmarks = if notebook.note_count > 0 {
            client
                .bookmark_list_with_cache(&notebook.book_id, force_refresh)
                .await?
        } else {
            BookmarkListResult::default()
        };
        let reviews = if notebook.review_count > 0 {
            load_all_reviews(client, &notebook.book_id, force_refresh).await?
        } else {
            Vec::new()
        };

        books.push(json!({
            "book": notebook,
            "chapters": bookmarks.chapters,
            "bookmarks": bookmarks.bookmarks,
            "reviews": reviews
        }));
    }

    Ok(json!({
        "version": 1,
        "generatedAt": Utc::now().to_rfc3339(),
        "source": "WeRead personal notes",
        "scope": {
            "bookCount": books.len(),
            "selection": "all notebooks with highlight or review content"
        },
        "books": books
    }))
}

async fn load_all_reviews(
    client: &crate::api::WeReadClient,
    book_id: &str,
    force_refresh: bool,
) -> Result<Vec<Review>, String> {
    let mut synckey = 0;
    let mut all = Vec::new();

    loop {
        let page = client
            .my_reviews_with_cache(book_id, synckey, 100, force_refresh)
            .await?;
        let has_more = page.has_more == 1 && !page.reviews.is_empty();
        synckey = page.synckey;
        all.extend(page.reviews);

        if !has_more {
            break;
        }
    }

    Ok(all)
}

async fn load_all_notebooks(
    client: &crate::api::WeReadClient,
    force_refresh: bool,
) -> Result<NotebooksResult, String> {
    let mut result = client.notebooks_with_cache(50, 0, force_refresh).await?;
    let mut last_sort = result.books.last().map(|book| book.sort).unwrap_or(0);

    while result.has_more == 1 && last_sort > 0 {
        let page = client
            .notebooks_with_cache(50, last_sort, force_refresh)
            .await?;
        if page.books.is_empty() {
            break;
        }
        last_sort = page.books.last().map(|book| book.sort).unwrap_or(0);
        result.books.extend(page.books);
        result.has_more = page.has_more;
        result.total_book_count = result.total_book_count.max(page.total_book_count);
        result.total_note_count = result.total_note_count.max(page.total_note_count);
    }

    Ok(result)
}

fn builtin_templates() -> Vec<BuiltinAdvancedTemplate> {
    vec![
        BuiltinAdvancedTemplate {
            id: "reading-personality",
            name: "阅读人格分析",
            description: "从书架、阅读统计和笔记密度中识别阅读偏好、选择模式和表达气质。",
            category: "advanced",
            style_summary: "私人档案、心理侧写、克制但有洞察。",
            style_md: PERSONALITY_STYLE,
            prompt_md: PERSONALITY_PROMPT,
            requires_raw_notes_consent: true,
            default_capabilities: &[
                "profile.summary",
                "shelf.sync",
                "notes.notebooks",
                "reading.stats",
            ],
            optional_capabilities: &[
                "book.info",
                "book.progress",
                "notes.bookmarks",
                "notes.reviews",
            ],
        },
        BuiltinAdvancedTemplate {
            id: "knowledge-map",
            name: "知识结构盲区",
            description: "识别主题分布、知识连接、重复投入区和下一阶段值得补齐的结构。",
            category: "advanced",
            style_summary: "知识地图、主题索引、结构化诊断。",
            style_md: KNOWLEDGE_STYLE,
            prompt_md: KNOWLEDGE_PROMPT,
            requires_raw_notes_consent: true,
            default_capabilities: &[
                "profile.summary",
                "shelf.sync",
                "notes.notebooks",
                "reading.stats",
            ],
            optional_capabilities: &[
                "book.info",
                "book.progress",
                "notes.bookmarks",
                "notes.reviews",
            ],
        },
        BuiltinAdvancedTemplate {
            id: "growth-path",
            name: "下一阶段阅读建议",
            description: "基于已有阅读路径生成下一阶段主题、书单方向和可执行的阅读节奏。",
            category: "advanced",
            style_summary: "路线图、阶段计划、轻量行动建议。",
            style_md: GROWTH_STYLE,
            prompt_md: GROWTH_PROMPT,
            requires_raw_notes_consent: false,
            default_capabilities: &[
                "profile.summary",
                "shelf.sync",
                "notes.notebooks",
                "reading.stats",
            ],
            optional_capabilities: &[
                "book.info",
                "book.progress",
                "notes.bookmarks",
                "notes.reviews",
            ],
        },
    ]
}

fn find_template(template_id: &str) -> Result<BuiltinAdvancedTemplate, String> {
    builtin_templates()
        .into_iter()
        .find(|template| template.id == template_id)
        .ok_or_else(|| format!("未知智能体模板: {template_id}"))
}

fn template_manifest_json(template: &BuiltinAdvancedTemplate) -> Value {
    json!({
        "id": template.id,
        "name": template.name,
        "kind": "advanced",
        "version": "0.1.0",
        "description": template.description,
        "style": "style.md",
        "prompt": "prompt.md",
        "dataPolicy": {
            "defaultCapabilities": template.default_capabilities,
            "optionalCapabilities": template.optional_capabilities,
            "requiresRawNotesConsent": template.requires_raw_notes_consent
        },
        "outputs": ["report.html", "report.meta.json"]
    })
}

fn capabilities_json(template: &BuiltinAdvancedTemplate) -> Value {
    json!({
        "version": 1,
        "progressiveDisclosure": {
            "mode": "file-workspace",
            "cache": "prefer",
            "firstPass": "Use available files in data/. If more detail is required, write output/data-requests.json for a follow-up run."
        },
        "defaultCapabilities": template.default_capabilities,
        "optionalCapabilities": template.optional_capabilities,
        "capabilities": [
            {
                "id": "shelf.sync",
                "title": "书架",
                "description": "完整书架概览，适合识别阅读范围、主题和完成状态。",
                "cache": "prefer",
                "sensitivity": "medium"
            },
            {
                "id": "notes.notebooks",
                "title": "笔记本概览",
                "description": "所有有笔记的书及笔记数量，适合判断投入深度。",
                "cache": "prefer",
                "sensitivity": "medium"
            },
            {
                "id": "reading.stats",
                "title": "阅读统计",
                "description": "年度和整体阅读时长、天数、分类偏好和排行。",
                "cache": "prefer",
                "sensitivity": "low"
            },
            {
                "id": "notes.bookmarks",
                "title": "划线",
                "description": "单本书划线原文，需要用户确认后才能用于智能体报告。",
                "cache": "prefer",
                "sensitivity": "high"
            },
            {
                "id": "notes.reviews",
                "title": "想法和点评",
                "description": "单本书个人想法和点评，需要用户确认后才能用于智能体报告。",
                "cache": "prefer",
                "sensitivity": "high"
            }
        ]
    })
}

fn build_agent_prompt() -> String {
    r#"# 高级微信读书报告任务

你正在一个本地 job 工作区中运行。请先读取 `input/brief.md`，并以它作为唯一任务入口。

关键要求：
- 只读取当前工作区内的文件。
- 不要访问网络。
- 不要加载远程脚本、远程字体或远程图片。
- 不要只在对话里输出报告内容；最终结果必须写入 output/ 文件。
- 必须生成 `output/report.html`、`output/report.meta.json`。
- 生成完成后不要打开浏览器、不要预览 HTML、不要调用 `open` / `xdg-open` / `start` / `open_report_file` 等系统打开命令；只写入文件。
"#
    .to_string()
}

fn build_agent_brief(
    template: &BuiltinAdvancedTemplate,
    template_manifest: &Value,
    user_policy: &Value,
    capabilities: &Value,
    cache_index: &Value,
) -> String {
    let default_capabilities = template.default_capabilities.join(", ");
    let optional_capabilities = template.optional_capabilities.join(", ");
    let data_files = cache_index
        .get("dataFiles")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("path").and_then(Value::as_str))
                .map(|path| format!("- `{path}`"))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let raw_notes_consent = user_policy
        .get("rawNotesConsent")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let template_json = serde_json::to_string_pretty(template_manifest).unwrap_or_default();
    let capabilities_json = serde_json::to_string_pretty(capabilities).unwrap_or_default();

    format!(
        r#"# 智能体报告任务书

## 你要为谁写

报告的主语是“你”。

请直接对读者说话，使用“你”的二人称表达，例如“你更常把阅读当作……”。不要把读者称为“这个用户”“该用户”“他/她/TA”。标题、摘要、结论都遵守这个规则。

## 任务目标

模板：{name}

{description}

你不是在填固定模板。请根据数据特征决定报告结构、叙事、视觉和模块。

## 可用数据

默认能力：{default_capabilities}

可选能力：{optional_capabilities}

当前已预取文件：
{data_files}

如果数据不足以支撑完整判断，不要硬编。可以在 `output/data-requests.json` 写出你还需要的数据。

## 隐私

- rawNotesConsent: {raw_notes_consent}
- 不要编造不存在的书、笔记、阅读行为或个人经历。
- `report.html` 必须出现清晰的软件标识：`WeRead Skill Desktop`。

## 输出文件

必须生成：

生成完成后只写入下列文件，不要自动打开浏览器，不要预览 HTML，也不要调用任何系统打开命令。

1. `output/report.html`
   - 完整分析版，内容要完整。
   - 至少包含：开场摘要、核心阅读人格判断、证据数据、阅读选择模式、注意力投入方式、表达/笔记方式、局限或盲区、下一阶段建议。
   - 不能只有概览卡片，必须有成段分析。
2. `output/report.meta.json`
   - 必须记录使用的数据文件、核心结论列表、是否包含品牌标识、是否遵守二人称。

## 视觉约束

{style}

## 具体任务

{prompt}

## 机器索引附录

除本任务书外，`input/` 中的 JSON 文件只是机器索引和策略备份，不需要逐个阅读后再开始。需要时再查。

### template.json

```json
{template_json}
```

### capabilities.json

```json
{capabilities_json}
```
"#,
        name = template.name,
        description = template.description,
        default_capabilities = default_capabilities,
        optional_capabilities = optional_capabilities,
        data_files = data_files,
        raw_notes_consent = raw_notes_consent,
        prompt = template.prompt_md,
        style = template.style_md,
        template_json = template_json,
        capabilities_json = capabilities_json
    )
}

fn write_data_file<T: Serialize>(
    data_dir: &Path,
    relative_path: &str,
    value: &T,
    data_index: &mut Vec<Value>,
) -> Result<(), String> {
    let file_path = data_dir.join(relative_path);
    write_json(&file_path, value)?;
    data_index.push(json!({
        "path": format!("data/{relative_path}"),
        "bytes": fs::metadata(&file_path).map(|meta| meta.len()).unwrap_or(0)
    }));
    Ok(())
}

fn write_json<T: Serialize>(path: impl AsRef<Path>, value: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("序列化智能体报告文件失败: {e}"))?;
    write_text(path, &content)
}

fn write_text(path: impl AsRef<Path>, content: &str) -> Result<(), String> {
    fs::write(path.as_ref(), content).map_err(|e| format!("写入智能体报告内容失败: {e}"))
}

fn advanced_report_root() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(REPORT_PRIVATE_DIR)
        .join(ADVANCED_REPORT_DIR)
}

fn job_output_dir(job_id: &str) -> PathBuf {
    advanced_report_root()
        .join("jobs")
        .join(job_id)
        .join("output")
}

fn job_log_path(job_id: &str) -> PathBuf {
    advanced_report_root()
        .join("jobs")
        .join(job_id)
        .join("logs")
        .join("agent.ndjson")
}

fn normalize_job_id(job_id: &str) -> Result<String, String> {
    let trimmed = job_id.trim();
    if trimmed.is_empty() {
        return Err("jobId 不能为空".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("jobId 不合法".to_string());
    }
    Ok(trimmed.to_string())
}

fn read_optional_text(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|e| format!("读取智能体报告内容失败: {e}"))?;
    if content.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(content))
    }
}

fn validate_output(report_html: Option<&str>) -> AdvancedReportValidation {
    let mut warnings = Vec::new();

    match report_html {
        Some(html) => {
            if html.chars().count() < 12_000 {
                warnings.push("分析版内容偏短，可能不完整".to_string());
            }
            if !html.contains("你") {
                warnings.push("分析版没有使用“你”作为报告主语".to_string());
            }
            if html.contains("这个用户") || html.contains("该用户") {
                warnings.push("分析版仍包含第三人称用户称呼".to_string());
            }
            if !html.contains("WeRead Skill Desktop") {
                warnings.push("分析版缺少 WeRead Skill Desktop 软件标识".to_string());
            }
        }
        None => warnings.push("缺少报告".to_string()),
    }

    AdvancedReportValidation {
        ok: warnings.is_empty(),
        warnings,
    }
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

fn unique_export_path(output_dir: &Path, file_name: &str) -> PathBuf {
    let candidate = output_dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = file_name.trim_end_matches(".html");
    for index in 2..1000 {
        let next = output_dir.join(format!("{stem}-{index}.html"));
        if !next.exists() {
            return next;
        }
    }

    output_dir.join(format!("{stem}-report.html"))
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn has_capability(capabilities: &[&str], target: &str) -> bool {
    capabilities.iter().any(|item| *item == target)
}

fn year_base_time() -> i64 {
    Utc::now()
        .date_naive()
        .with_month(1)
        .and_then(|date| date.with_day(1))
        .and_then(|date| date.and_hms_opt(0, 0, 0))
        .map(|date| date.and_utc().timestamp())
        .unwrap_or(0)
}

use chrono::Datelike;

const PERSONALITY_STYLE: &str = r#"# 阅读人格分析风格

整体像一份私人阅读侧写档案。允许使用人物画像、阅读倾向坐标、证据摘录、节奏曲线和书目索引。避免泛 SaaS 卡片堆叠、大面积渐变、夸张心理诊断和无证据判断。
"#;

const PERSONALITY_PROMPT: &str = r#"# 阅读人格分析

请根据可用数据判断这个用户如何选书、如何投入注意力、如何表达想法。报告结构由你决定，不要套固定模板。结论必须能回到数据证据。
"#;

const KNOWLEDGE_STYLE: &str = r#"# 知识结构盲区风格

整体像知识地图和研究索引。允许使用主题地图、连接关系、盲区雷达、书目矩阵和下一步路径。避免把分类列表机械堆成表格。
"#;

const KNOWLEDGE_PROMPT: &str = r#"# 知识结构盲区

请识别用户已经投入的主题、主题之间的连接、重复投入区域、薄弱区域和下一阶段可以补齐的知识结构。不要伪造不存在的阅读经历。
"#;

const GROWTH_STYLE: &str = r#"# 下一阶段阅读建议风格

整体像可执行的私人阅读路线图。允许使用阶段计划、主题路径、节奏建议和轻量书单方向。保持克制、具体、可行动。
"#;

const GROWTH_PROMPT: &str = r#"# 下一阶段阅读建议

请基于已有阅读轨迹生成下一阶段阅读方向。重点是方向和策略，不要凭空指定用户没有兴趣的路线。
"#;
