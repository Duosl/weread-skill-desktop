use crate::types::*;
use agent_cli_bridge::{invoke_agent_with_handle, InvokeEvent, InvokeOpts};
use chrono::{Datelike, Local, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

mod templates;
use tauri::{AppHandle, Emitter, Manager};
use templates::{builtin_templates, output_shapes, BuiltinAdvancedTemplate, BuiltinOutputShape};

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
    pub default_report_period: String,
    pub default_output_shape: String,
    pub output_shapes: Vec<AdvancedReportOutputShape>,
    pub requires_raw_notes_consent: bool,
    pub default_capabilities: Vec<String>,
    pub optional_capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportOutputShape {
    pub id: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportJobRequest {
    pub template_id: String,
    pub raw_notes_consent: bool,
    pub force_refresh: Option<bool>,
    pub output_shape: Option<String>,
    pub user_prompt: Option<String>,
    pub report_period: Option<String>,
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

#[derive(Debug)]
struct ReportMetaReadResult {
    meta: Option<Value>,
    warning: Option<String>,
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
    pub output_shape: Option<String>,
    pub output_shape_name: Option<String>,
    pub report_period: Option<String>,
    pub report_period_label: Option<String>,
    pub agent: Option<String>,
    pub model: Option<String>,
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
    output_shape: Option<String>,
    output_shape_name: Option<String>,
    report_period: Option<String>,
    report_period_label: Option<String>,
    agent: Option<String>,
    model: Option<String>,
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
    pub output_shape: Option<String>,
    pub user_prompt: Option<String>,
    pub report_period: Option<String>,
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

pub fn list_advanced_report_templates() -> Vec<AdvancedReportTemplate> {
    builtin_templates()
        .into_iter()
        .map(|template| AdvancedReportTemplate {
            id: template.id.to_string(),
            name: template.name.to_string(),
            description: template.description.to_string(),
            category: template.category.to_string(),
            style_summary: template.style_summary.to_string(),
            default_report_period: template.default_report_period.to_string(),
            default_output_shape: template.default_output_shape.to_string(),
            output_shapes: output_shapes()
                .into_iter()
                .map(|shape| AdvancedReportOutputShape {
                    id: shape.id.to_string(),
                    name: shape.name.to_string(),
                    description: shape.description.to_string(),
                })
                .collect(),
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
        tasks.insert(task.job_id.clone(), normalize_task_with_report_file(task));
    }

    let mut tasks = tasks.into_values().collect::<Vec<_>>();
    tasks.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(tasks)
}

fn normalize_task_with_report_file(mut task: AdvancedReportTask) -> AdvancedReportTask {
    let report_path = PathBuf::from(&task.report_path);
    if task.status == AdvancedReportTaskStatus::Failed && report_path.exists() {
        task.status = AdvancedReportTaskStatus::Completed;
        task.message = Some(report_available_warning_message(task.message.as_deref()));
        let _ = persist_task_snapshot(&task);
    }
    task
}

pub async fn create_advanced_report_job(
    client: crate::api::WeReadClient,
    request: AdvancedReportJobRequest,
) -> Result<AdvancedReportJob, String> {
    let template = find_template(&request.template_id)?;
    let output_shape = resolve_output_shape(request.output_shape.as_deref(), &template)?;
    let user_prompt = normalize_user_prompt(request.user_prompt.as_deref());
    let report_period = normalize_report_period(request.report_period.as_deref())?;
    if template.requires_raw_notes_consent && !request.raw_notes_consent {
        return Err("该智能体模板需要读取原文摘录，请先确认隐私授权。".to_string());
    }

    let created_at = Utc::now().to_rfc3339();
    let local_context = local_time_context_json();
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
        report_period,
    )
    .await?;
    let template_manifest = template_manifest_json(&template, &output_shape);
    let user_policy = json!({
        "rawNotesConsent": request.raw_notes_consent,
        "customRequirementProvided": !user_prompt.is_empty(),
        "privacy": {
            "doNotInventUserData": true
        }
    });
    let generation_settings = json!({
        "version": 1,
        "localTimeContext": local_context.clone(),
        "reportPeriod": {
            "id": report_period,
            "label": report_period_label(report_period)
        },
        "outputShape": {
            "id": output_shape.id,
            "name": output_shape.name,
            "description": output_shape.description
        },
        "userPromptPath": if user_prompt.is_empty() { Value::Null } else { json!("input/user-prompt.md") },
        "userPromptPolicy": {
            "role": "preference",
            "cannotOverride": [
                "privacy",
                "workspaceReadBoundary",
                "networkDisabled",
                "mustWriteOutputFiles",
                "rawNotesConsent"
            ]
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
        &generation_settings,
        &output_shape,
        &user_prompt,
        &capabilities,
        &cache_index,
        &local_context,
    );
    let prompt = build_agent_prompt();

    write_text(input_dir.join("brief.md"), &brief)?;
    write_text(input_dir.join("agent-prompt.md"), &prompt)?;
    write_json(input_dir.join("template.json"), &template_manifest)?;
    write_text(input_dir.join("style.md"), template.style_md)?;
    write_text(input_dir.join("prompt.md"), template.prompt_md)?;
    if !user_prompt.is_empty() {
        write_text(input_dir.join("user-prompt.md"), &user_prompt)?;
    }
    write_json(input_dir.join("user-policy.json"), &user_policy)?;
    write_json(
        input_dir.join("generation-settings.json"),
        &generation_settings,
    )?;
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
            output_shape: request.output_shape,
            user_prompt: request.user_prompt,
            report_period: request.report_period,
        },
    )
    .await?;

    let task = AdvancedReportTask {
        job_id: job.job_id.clone(),
        template_id: job.template_id.clone(),
        template_name: job.template_name.clone(),
        status: AdvancedReportTaskStatus::Running,
        message: Some("正在生成报告".to_string()),
        output_shape: generation_setting_string(
            &PathBuf::from(&job.job_dir),
            &["outputShape", "id"],
        ),
        output_shape_name: generation_setting_string(
            &PathBuf::from(&job.job_dir),
            &["outputShape", "name"],
        ),
        report_period: generation_setting_string(
            &PathBuf::from(&job.job_dir),
            &["reportPeriod", "id"],
        ),
        report_period_label: generation_setting_string(
            &PathBuf::from(&job.job_dir),
            &["reportPeriod", "label"],
        ),
        agent: Some(request.agent.clone()),
        model: request.model.clone(),
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
    let Some(mut output) = run_agent_once_for_job(
        app.clone(),
        agent.clone(),
        model.clone(),
        bin_override.clone(),
        job_id.clone(),
        job_dir.clone(),
        prompt,
        "本地 Agent 已启动...",
    )
    .await?
    else {
        return Ok(());
    };

    if !output.validation.ok {
        let warning_count = output.validation.warnings.len();
        emit_log_event(
            &app,
            &job_id,
            "system",
            &format!("报告已生成，但发现 {warning_count} 条质量提醒，正在自动修正..."),
        );
        emit_task_event(
            &app,
            &job_id,
            AdvancedReportTaskStatus::Running,
            Some(format!("发现 {warning_count} 条质量提醒，正在自动修正...")),
        );
        write_quality_fix_prompt(&job_dir, &output.validation)?;
        let Some(fixed_output) = run_agent_once_for_job(
            app.clone(),
            agent,
            model,
            bin_override,
            job_id.clone(),
            job_dir.clone(),
            build_quality_fix_runtime_prompt(&job_dir),
            "本地 Agent 已启动质量修正...",
        )
        .await?
        else {
            return Ok(());
        };
        output = fixed_output;
    }

    let message = if output.validation.ok {
        "报告已生成".to_string()
    } else {
        format!(
            "报告已生成，有 {} 条质量提醒",
            output.validation.warnings.len()
        )
    };
    let state = app.state::<crate::state::RuntimeState>();
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

async fn run_agent_once_for_job(
    app: AppHandle,
    agent: String,
    model: Option<String>,
    bin_override: Option<String>,
    job_id: String,
    job_dir: PathBuf,
    prompt: String,
    start_message: &str,
) -> Result<Option<AdvancedReportOutput>, String> {
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
                emit_log_event(&app, &job_id, "start", start_message);
                emit_task_event(
                    &app,
                    &job_id,
                    AdvancedReportTaskStatus::Running,
                    Some(start_message.to_string()),
                );
            }
            InvokeEvent::Delta { text } => emit_log_event(&app, &job_id, "delta", &text),
            InvokeEvent::Raw { text } => emit_log_event(&app, &job_id, "raw", &text),
            InvokeEvent::Html { .. } => {
                emit_log_event(&app, &job_id, "html", "正在生成 HTML 报告...")
            }
            InvokeEvent::Meta { key, value } => {
                emit_log_event(&app, &job_id, "meta", &format!("{key}: {value}"));
            }
            InvokeEvent::Stderr { text } => {
                stderr.push(text.clone());
                emit_log_event(&app, &job_id, "stderr", &text);
            }
            InvokeEvent::Done { code } => {
                exit_code = code;
                emit_log_event(&app, &job_id, "done", &format!("任务已结束: {:?}", code));
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
                return Ok(None);
            }
            InvokeEvent::Error { message } => {
                emit_log_event(&app, &job_id, "error", &message);
                state.unregister_agent_job(&job_id).await;
                return Err(message);
            }
        }
    }

    state.unregister_agent_job(&job_id).await;
    let mut output = read_advanced_report_output(&job_id)?;
    if output.report_html.is_none() {
        let detail = if stderr.is_empty() {
            "任务失败，未生成报告".to_string()
        } else {
            format!("任务失败，未生成报告。{}", stderr.join("\n"))
        };
        return Err(detail);
    }

    if exit_code.unwrap_or(0) != 0 {
        let mut warning = format!(
            "报告已生成，但任务结束时返回异常状态 {:?}。这不影响打开 HTML 报告。",
            exit_code
        );
        if !stderr.is_empty() {
            warning.push_str(&format!(" 结束信息：{}", stderr.join("\n")));
        }
        output.validation.warnings.push(warning);
        output.validation.ok = false;
    }

    Ok(Some(output))
}

fn build_runtime_prompt(job: &AdvancedReportJob) -> String {
    [
        "请在当前工作目录执行高级微信读书报告任务。",
        "",
        &format!("当前电脑时间: {}", local_time_display()),
        &format!("工作目录: {}", job.job_dir),
        &format!("任务提示词文件: {}", job.prompt_path),
        "",
        "请先读取 input/agent-prompt.md，然后读取 input/brief.md；brief.md 是唯一任务入口。",
        "必须生成 output/report.html、output/report.meta.json。",
        "HTML 必须是完整单文件，不依赖远程脚本、远程字体、远程图片或任何 file:// 本地资源。",
        "不要在 HTML 中写入本地绝对路径，不要用 iframe/fetch/XHR/window.open/location 读取或跳转本地文件。",
        "不要只在对话里输出报告内容；最终结果必须写入 output/ 文件。",
    ]
    .join("\n")
}

fn quality_fix_prompt_path(job_dir: &Path) -> PathBuf {
    job_dir.join("input").join("quality-fix.md")
}

fn write_quality_fix_prompt(
    job_dir: &Path,
    validation: &AdvancedReportValidation,
) -> Result<(), String> {
    let warnings = validation
        .warnings
        .iter()
        .enumerate()
        .map(|(index, warning)| format!("{}. {}", index + 1, warning))
        .collect::<Vec<_>>()
        .join("\n");
    let prompt = format!(
        r#"# 报告质量修正

刚才生成的 `output/report.html` 已存在，但自动质量检查发现以下问题：

{warnings}

请基于当前工作目录直接修正 `output/report.html` 和必要的 `output/report.meta.json`。

要求：
- 不要重新发明报告主题，不要删除已有有效内容。
- 只针对上述质量提醒补齐或调整。
- 修正后仍保持单文件 HTML，不依赖远程脚本、远程字体、远程图片或任何 file:// 本地资源。
- 不要在 HTML 中写入本地绝对路径，不要用 iframe/fetch/XHR/window.open/location 读取或跳转本地文件。
- 底部必须保留 `数据来源：微信读书官方 Skill`、大模型风险提示和 GitHub 项目地址 `https://github.com/Duosl/weread-skill-desktop`。
- 不要只在对话里说明修正方案，必须写回 `output/report.html`。
"#
    );
    write_text(quality_fix_prompt_path(job_dir), &prompt)
}

fn build_quality_fix_runtime_prompt(job_dir: &Path) -> String {
    [
        "请在当前工作目录修正高级微信读书报告。",
        "",
        &format!("当前电脑时间: {}", local_time_display()),
        &format!("工作目录: {}", path_string(job_dir)),
        &format!(
            "质量修正提示词文件: {}",
            path_string(&quality_fix_prompt_path(job_dir))
        ),
        "",
        "请先读取 input/quality-fix.md，然后读取当前 output/report.html。",
        "你只需要根据质量提醒修正 output/report.html 和必要的 output/report.meta.json。",
        "HTML 必须是完整单文件，不依赖远程脚本、远程字体、远程图片或任何 file:// 本地资源。",
        "不要在 HTML 中写入本地绝对路径，不要用 iframe/fetch/XHR/window.open/location 读取或跳转本地文件。",
        "不要只在对话里输出修正说明；最终结果必须写回 output/ 文件。",
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
    let ReportMetaReadResult { meta, warning } = read_report_meta(&meta_path)?;

    let mut validation = validate_output(report_html.as_deref());
    if let Some(warning) = warning {
        validation.warnings.push(warning);
        validation.ok = false;
    }

    Ok(AdvancedReportOutput {
        job_id,
        report_html,
        meta,
        report_path: path_string(&report_path),
        meta_path: path_string(&meta_path),
        validation,
    })
}

fn read_report_meta(meta_path: &Path) -> Result<ReportMetaReadResult, String> {
    if !meta_path.exists() {
        return Ok(ReportMetaReadResult {
            meta: None,
            warning: None,
        });
    }

    let content =
        fs::read_to_string(meta_path).map_err(|e| format!("读取智能体报告元数据失败: {e}"))?;
    match serde_json::from_str(&content) {
        Ok(meta) => Ok(ReportMetaReadResult {
            meta: Some(meta),
            warning: None,
        }),
        Err(error) => Ok(ReportMetaReadResult {
            meta: None,
            warning: Some(format!(
                "附加信息读取失败：report.meta.json 格式不完整（{error}）。这不影响打开 HTML 报告；如果再次生成，可以让 AI 修正报告元数据 JSON 格式。"
            )),
        }),
    }
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
            output_shape: generation_setting_string(&job_dir, &["outputShape", "id"]),
            output_shape_name: generation_setting_string(&job_dir, &["outputShape", "name"]),
            report_period: generation_setting_string(&job_dir, &["reportPeriod", "id"]),
            report_period_label: generation_setting_string(&job_dir, &["reportPeriod", "label"]),
            agent: None,
            model: None,
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
        if snapshot.status == AdvancedReportTaskStatus::Failed {
            Some(report_available_warning_message(
                snapshot.message.as_deref(),
            ))
        } else {
            snapshot.message.or_else(|| Some("".to_string()))
        }
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
        output_shape: snapshot
            .output_shape
            .or_else(|| generation_setting_string(job_dir, &["outputShape", "id"])),
        output_shape_name: snapshot
            .output_shape_name
            .or_else(|| generation_setting_string(job_dir, &["outputShape", "name"])),
        report_period: snapshot
            .report_period
            .or_else(|| generation_setting_string(job_dir, &["reportPeriod", "id"])),
        report_period_label: snapshot
            .report_period_label
            .or_else(|| generation_setting_string(job_dir, &["reportPeriod", "label"])),
        agent: snapshot.agent,
        model: snapshot.model,
        job_dir: snapshot.job_dir,
        report_path: path_string(report_path),
        created_at: snapshot.created_at,
        updated_at: snapshot.updated_at,
    }))
}

fn report_available_warning_message(message: Option<&str>) -> String {
    match message.map(str::trim).filter(|value| !value.is_empty()) {
        Some(message)
            if message.contains("解析智能体报告元数据失败")
                || message.contains("report.meta.json")
                || message.contains("元数据") =>
        {
            format!(
                "报告已生成，但附加信息读取失败。可以先打开 HTML 报告；再次生成时可让 AI 修正 report.meta.json 格式。原始错误：{message}"
            )
        }
        Some(message) => format!("报告已生成，但仍有附加问题：{message}"),
        None => "报告已生成，但附加信息读取失败。可以先打开 HTML 报告。".to_string(),
    }
}

fn generation_setting_string(job_dir: &Path, path: &[&str]) -> Option<String> {
    let content =
        fs::read_to_string(job_dir.join("input").join("generation-settings.json")).ok()?;
    let mut value = serde_json::from_str::<Value>(&content).ok()?;
    for key in path {
        value = value.get(*key)?.clone();
    }
    value.as_str().map(str::to_string)
}

pub(crate) fn persist_task_snapshot(task: &AdvancedReportTask) -> Result<(), String> {
    let job_id = normalize_job_id(&task.job_id)?;
    let snapshot = AdvancedReportTaskSnapshot {
        job_id: task.job_id.clone(),
        template_id: task.template_id.clone(),
        template_name: task.template_name.clone(),
        status: task.status.clone(),
        message: task.message.clone(),
        output_shape: task.output_shape.clone(),
        output_shape_name: task.output_shape_name.clone(),
        report_period: task.report_period.clone(),
        report_period_label: task.report_period_label.clone(),
        agent: task.agent.clone(),
        model: task.model.clone(),
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
    report_period: &str,
) -> Result<Vec<Value>, String> {
    let mut data_index = Vec::new();
    let mut notebooks_for_notes = None;
    let mut shelf_context = None;
    let mut scoped_notebooks_context = None;
    let mut scoped_stats_context = None;
    let mut overall_stats_context = None;
    let (period_start, period_end) = report_period_bounds(report_period);

    if has_capability(template.default_capabilities, "shelf.sync") {
        let result = client.shelf_sync(force_refresh).await?;
        write_data_file(data_dir, "shelf.context.json", &result, &mut data_index)?;
        shelf_context = Some(result);
    }

    if has_capability(template.default_capabilities, "notes.notebooks") {
        let notebooks = load_all_notebooks(client, force_refresh).await?;
        let scoped_notebooks =
            scope_notebooks_for_period(client, notebooks, force_refresh, period_start, period_end)
                .await?;
        write_data_file(
            data_dir,
            "notebooks.selected.json",
            &scoped_notebooks,
            &mut data_index,
        )?;
        scoped_notebooks_context = Some(scoped_notebooks.clone());
        notebooks_for_notes = Some(scoped_notebooks);
    }

    if has_capability(template.default_capabilities, "reading.stats") {
        let (mode, base_time, file_name) = reading_stats_request_for_period(report_period);
        let scoped = client.reading_stats(mode, base_time, force_refresh).await?;
        let scoped_for_agent = reading_stats_for_agent(&scoped);
        write_data_file(data_dir, file_name, &scoped_for_agent, &mut data_index)?;
        scoped_stats_context = Some(scoped);
        if report_period != "all" {
            let overall = client.reading_stats("overall", 0, force_refresh).await?;
            let overall_for_agent = reading_stats_for_agent(&overall);
            write_data_file(
                data_dir,
                "reading-stats.overall.json",
                &overall_for_agent,
                &mut data_index,
            )?;
            overall_stats_context = Some(overall);
        }
    }

    if raw_notes_consent
        && (has_capability(template.optional_capabilities, "notes.bookmarks")
            || has_capability(template.optional_capabilities, "notes.reviews"))
    {
        let notebooks = match notebooks_for_notes {
            Some(notebooks) => notebooks,
            None => {
                scope_notebooks_for_period(
                    client,
                    load_all_notebooks(client, force_refresh).await?,
                    force_refresh,
                    period_start,
                    period_end,
                )
                .await?
            }
        };
        let notes =
            load_raw_notes_for_report(client, &notebooks, force_refresh, period_start, period_end)
                .await?;
        write_data_file(data_dir, "notes.raw.json", &notes, &mut data_index)?;
    }

    let profile_summary = build_profile_summary(
        report_period,
        shelf_context.as_ref(),
        scoped_notebooks_context.as_ref(),
        scoped_stats_context.as_ref(),
        overall_stats_context.as_ref(),
    );
    write_data_file(
        data_dir,
        "profile.summary.json",
        &profile_summary,
        &mut data_index,
    )?;

    Ok(data_index)
}

fn build_profile_summary(
    report_period: &str,
    shelf: Option<&ShelfSyncResult>,
    notebooks: Option<&NotebooksResult>,
    scoped_stats: Option<&ReadingStatsResult>,
    overall_stats: Option<&ReadingStatsResult>,
) -> Value {
    let stats_for_canonical = if report_period == "all" {
        scoped_stats
    } else {
        overall_stats.or(scoped_stats)
    };
    let scoped_reading_seconds = scoped_stats.map(|stats| stats.total_read_time).unwrap_or(0);
    let canonical_reading_seconds = stats_for_canonical
        .map(|stats| stats.total_read_time)
        .unwrap_or(scoped_reading_seconds);
    let note_totals = notebooks.map(notebook_note_totals);
    let selected_note_count = if report_period == "all" {
        read_stat_number(scoped_stats, "笔记")
            .or_else(|| note_totals.as_ref().map(|totals| totals.total))
            .unwrap_or(0)
    } else {
        note_totals
            .as_ref()
            .map(|totals| totals.total)
            .or_else(|| read_stat_number(scoped_stats, "笔记"))
            .unwrap_or(0)
    };

    json!({
        "version": 1,
        "generatedAt": Utc::now().to_rfc3339(),
        "sourceOfTruth": "WeRead Skill Desktop normalized summary",
        "displayRules": [
            "Key metrics in this file are authoritative. Use them exactly when rendering counts.",
            "All raw reading time fields from reading-stats are seconds. Never treat them as minutes or hours.",
            "shelf.totalItems is the bookshelf total. notebooks.bookCount is only books with notes in the selected report range.",
            "Do not label notebooks.bookCount as bookshelf books, shelf collection, or total books.",
            "Use formatted reading time labels from readingTime.display when writing user-facing HTML."
        ],
        "period": {
            "id": report_period,
            "label": report_period_label(report_period)
        },
        "canonicalMetrics": {
            "bookshelfTotal": shelf.map(|item| item.total_count).unwrap_or(0),
            "readBooks": read_stat_number(stats_for_canonical, "读过"),
            "finishedBooks": read_stat_number(stats_for_canonical, "读完"),
            "readDays": stats_for_canonical.map(|stats| stats.read_days).unwrap_or(0),
            "noteCount": read_stat_number(stats_for_canonical, "笔记")
                .or_else(|| note_totals.as_ref().map(|totals| totals.total))
                .unwrap_or(0),
            "readingTime": reading_time_display(canonical_reading_seconds)
        },
        "canonicalDisplay": {
            "bookshelfTotal": count_label_usize(shelf.map(|item| item.total_count).unwrap_or(0), "本"),
            "readBooks": optional_count_label(read_stat_number(stats_for_canonical, "读过"), "本"),
            "finishedBooks": optional_count_label(read_stat_number(stats_for_canonical, "读完"), "本"),
            "readDays": count_label_i32(stats_for_canonical.map(|stats| stats.read_days).unwrap_or(0), "天"),
            "noteCount": count_label_i32(
                read_stat_number(stats_for_canonical, "笔记")
                    .or_else(|| note_totals.as_ref().map(|totals| totals.total))
                    .unwrap_or(0),
                "条"
            ),
            "readingTime": reading_time_display(canonical_reading_seconds)
        },
        "selectedPeriodMetrics": {
            "readBooks": read_stat_number(scoped_stats, "读过"),
            "finishedBooks": read_stat_number(scoped_stats, "读完"),
            "readDays": scoped_stats.map(|stats| stats.read_days).unwrap_or(0),
            "noteCount": selected_note_count,
            "readingTime": reading_time_display(scoped_reading_seconds)
        },
        "selectedPeriodDisplay": {
            "readBooks": optional_count_label(read_stat_number(scoped_stats, "读过"), "本"),
            "finishedBooks": optional_count_label(read_stat_number(scoped_stats, "读完"), "本"),
            "readDays": count_label_i32(scoped_stats.map(|stats| stats.read_days).unwrap_or(0), "天"),
            "noteCount": count_label_i32(selected_note_count, "条"),
            "readingTime": reading_time_display(scoped_reading_seconds)
        },
        "shelf": shelf.map(|item| json!({
            "totalItems": item.total_count,
            "ebookItems": item.books.len(),
            "albumItems": item.albums.len(),
            "hasArticleCollection": item.has_mp,
            "finishedEbookItems": item.books.iter().filter(|book| book.finish_reading == 1).count()
        })),
        "notebooks": notebooks.map(|item| {
            let totals = notebook_note_totals(item);
            json!({
                "bookCount": item.books.len(),
                "totalBookCountFromApi": item.total_book_count,
                "totalNoteCountFromApi": item.total_note_count,
                "highlightCount": totals.highlights,
                "reviewCount": totals.reviews,
                "bookmarkCount": totals.bookmarks,
                "totalNoteCountComputed": totals.total,
                "meaning": "books with notes in the selected report range, not bookshelf total"
            })
        }),
        "fieldMeanings": {
            "bookshelfTotal": "书架总数，来自 /shelf/sync 的 books + albums + mp",
            "readBooks": "读过的书，来自 /readdata/detail readStat",
            "finishedBooks": "读完的书，来自 /readdata/detail readStat",
            "readDays": "阅读天数，来自 /readdata/detail readDays",
            "noteCount": "笔记总数，优先来自 /readdata/detail readStat 的 笔记；缺失时用 reviewCount + noteCount + bookmarkCount",
            "readingTime.seconds": "阅读时长秒数，来自 /readdata/detail totalReadTime"
        }
    })
}

#[derive(Debug)]
struct NotebookNoteTotals {
    highlights: i32,
    reviews: i32,
    bookmarks: i32,
    total: i32,
}

fn notebook_note_totals(notebooks: &NotebooksResult) -> NotebookNoteTotals {
    let highlights = notebooks.books.iter().map(|book| book.note_count).sum();
    let reviews = notebooks.books.iter().map(|book| book.review_count).sum();
    let bookmarks = notebooks.books.iter().map(|book| book.bookmark_count).sum();
    NotebookNoteTotals {
        highlights,
        reviews,
        bookmarks,
        total: highlights + reviews + bookmarks,
    }
}

fn read_stat_number(stats: Option<&ReadingStatsResult>, name: &str) -> Option<i32> {
    stats.and_then(|stats| {
        stats
            .read_stat
            .iter()
            .find(|item| item.stat == name)
            .and_then(|item| parse_count_prefix(&item.counts))
    })
}

fn parse_count_prefix(value: &str) -> Option<i32> {
    let digits = value
        .chars()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>();
    digits.parse::<i32>().ok()
}

fn reading_time_display(seconds: i64) -> String {
    let safe_seconds = seconds.max(0);
    let hours = safe_seconds / 3600;
    let minutes = (safe_seconds % 3600) / 60;
    if hours > 0 && minutes > 0 {
        format!("{hours}小时{minutes}分钟")
    } else if hours > 0 {
        format!("{hours}小时")
    } else {
        format!("{minutes}分钟")
    }
}

fn count_label_i32(value: i32, unit: &str) -> String {
    format!("{value}{unit}")
}

fn count_label_usize(value: usize, unit: &str) -> String {
    format!("{value}{unit}")
}

fn optional_count_label(value: Option<i32>, unit: &str) -> Option<String> {
    value.map(|value| count_label_i32(value, unit))
}

fn reading_stats_for_agent(stats: &ReadingStatsResult) -> Value {
    let read_times = stats
        .read_times
        .iter()
        .map(|(key, value)| {
            let seconds = value.as_i64().unwrap_or(0);
            json!({
                "bucket": key,
                "readingTime": reading_time_display(seconds)
            })
        })
        .collect::<Vec<_>>();
    let daily_read_times = stats
        .daily_read_times
        .iter()
        .map(|(key, value)| {
            let seconds = value.as_i64().unwrap_or(0);
            json!({
                "day": key,
                "readingTime": reading_time_display(seconds)
            })
        })
        .collect::<Vec<_>>();
    let read_longest = stats
        .read_longest
        .iter()
        .map(|item| {
            json!({
                "book": item.book,
                "readingTime": reading_time_display(item.read_time),
                "tags": item.tags
            })
        })
        .collect::<Vec<_>>();
    let prefer_category = stats
        .prefer_category
        .iter()
        .map(|item| {
            json!({
                "categoryTitle": item.category_title,
                "val": item.val,
                "readingTime": reading_time_display(item.reading_time),
                "readingCount": item.reading_count
            })
        })
        .collect::<Vec<_>>();
    let prefer_time = stats
        .prefer_time
        .iter()
        .enumerate()
        .map(|(index, seconds)| {
            json!({
                "hourIndexFrom6": index,
                "readingTime": reading_time_display(*seconds)
            })
        })
        .collect::<Vec<_>>();

    json!({
        "baseTime": stats.base_time,
        "readDays": count_label_i32(stats.read_days, "天"),
        "totalReadTime": reading_time_display(stats.total_read_time),
        "dayAverageReadTime": reading_time_display(stats.day_average_read_time),
        "compare": stats.compare,
        "readStat": stats.read_stat,
        "readLongest": read_longest,
        "preferCategory": prefer_category,
        "preferTime": prefer_time,
        "readTimes": read_times,
        "dailyReadTimes": daily_read_times,
        "registTime": stats.regist_time,
        "unitNote": "本文件中的阅读时长均已转换为中文展示值，报告中请直接使用，不要改写为小数小时。"
    })
}

async fn load_raw_notes_for_report(
    client: &crate::api::WeReadClient,
    notebooks: &NotebooksResult,
    force_refresh: bool,
    period_start: Option<i64>,
    period_end: Option<i64>,
) -> Result<Value, String> {
    let mut books = Vec::new();

    for notebook in notebooks
        .books
        .iter()
        .filter(|book| book.note_count > 0 || book.review_count > 0)
    {
        let bookmarks = if notebook.note_count > 0 {
            let mut result = client
                .bookmark_list_with_cache(&notebook.book_id, force_refresh)
                .await?;
            result.bookmarks =
                filter_by_period(result.bookmarks, period_start, period_end, |bookmark| {
                    bookmark.create_time
                });
            result
        } else {
            BookmarkListResult::default()
        };
        let reviews = if notebook.review_count > 0 {
            filter_by_period(
                load_all_reviews(client, &notebook.book_id, force_refresh).await?,
                period_start,
                period_end,
                |review| review.create_time,
            )
        } else {
            Vec::new()
        };
        if bookmarks.bookmarks.is_empty() && reviews.is_empty() {
            continue;
        }

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

async fn scope_notebooks_for_period(
    client: &crate::api::WeReadClient,
    mut notebooks: NotebooksResult,
    force_refresh: bool,
    period_start: Option<i64>,
    period_end: Option<i64>,
) -> Result<NotebooksResult, String> {
    if period_start.is_none() && period_end.is_none() {
        return Ok(notebooks);
    }

    let mut scoped_books = Vec::new();
    for mut book in notebooks
        .books
        .into_iter()
        .filter(|book| period_start.map(|start| book.sort >= start).unwrap_or(true))
    {
        let bookmark_count = if book.note_count > 0 {
            let result = client
                .bookmark_list_with_cache(&book.book_id, force_refresh)
                .await?;
            filter_by_period(result.bookmarks, period_start, period_end, |bookmark| {
                bookmark.create_time
            })
            .len() as i32
        } else {
            0
        };
        let review_count = if book.review_count > 0 {
            filter_by_period(
                load_all_reviews(client, &book.book_id, force_refresh).await?,
                period_start,
                period_end,
                |review| review.create_time,
            )
            .len() as i32
        } else {
            0
        };

        book.note_count = bookmark_count;
        book.review_count = review_count;
        book.bookmark_count = 0;

        if book.note_count > 0 || book.review_count > 0 {
            scoped_books.push(book);
        }
    }

    notebooks.books = scoped_books;
    notebooks.total_book_count = notebooks.books.len() as i32;
    notebooks.total_note_count = notebooks
        .books
        .iter()
        .map(|book| book.review_count + book.note_count + book.bookmark_count)
        .sum();
    notebooks.has_more = 0;
    Ok(notebooks)
}

fn filter_by_period<T>(
    items: Vec<T>,
    period_start: Option<i64>,
    period_end: Option<i64>,
    timestamp: impl Fn(&T) -> i64,
) -> Vec<T> {
    if period_start.is_none() && period_end.is_none() {
        return items;
    }
    items
        .into_iter()
        .filter(|item| timestamp_in_period(timestamp(item), period_start, period_end))
        .collect()
}

fn timestamp_in_period(timestamp: i64, period_start: Option<i64>, period_end: Option<i64>) -> bool {
    period_start.map(|start| timestamp >= start).unwrap_or(true)
        && period_end.map(|end| timestamp < end).unwrap_or(true)
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

fn resolve_output_shape(
    requested_shape: Option<&str>,
    template: &BuiltinAdvancedTemplate,
) -> Result<BuiltinOutputShape, String> {
    let shape_id = requested_shape
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(template.default_output_shape);
    output_shapes()
        .into_iter()
        .find(|shape| shape.id == shape_id)
        .ok_or_else(|| format!("未知报告形态: {shape_id}"))
}

fn normalize_user_prompt(user_prompt: Option<&str>) -> String {
    user_prompt
        .unwrap_or_default()
        .trim()
        .replace("\r\n", "\n")
        .replace('\r', "\n")
}

fn normalize_report_period(report_period: Option<&str>) -> Result<&'static str, String> {
    match report_period
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("current_year")
    {
        "month" | "current_month" => Ok("current_month"),
        "year" | "current_year" => Ok("current_year"),
        "last_month" => Ok("last_month"),
        "last_year" => Ok("last_year"),
        "all" => Ok("all"),
        other => Err(format!("未知报告数据范围: {other}")),
    }
}

fn report_period_label(report_period: &str) -> &'static str {
    match report_period {
        "last_month" => "上个月",
        "current_month" => "本月",
        "last_year" => "去年",
        "current_year" => "今年",
        "all" => "全部",
        _ => "今年",
    }
}

fn find_template(template_id: &str) -> Result<BuiltinAdvancedTemplate, String> {
    builtin_templates()
        .into_iter()
        .find(|template| template.id == template_id)
        .ok_or_else(|| format!("未知智能体模板: {template_id}"))
}

fn template_manifest_json(
    template: &BuiltinAdvancedTemplate,
    output_shape: &BuiltinOutputShape,
) -> Value {
    json!({
        "id": template.id,
        "name": template.name,
        "kind": "advanced",
        "version": "0.1.0",
        "description": template.description,
        "style": "style.md",
        "prompt": "prompt.md",
        "outputShape": {
            "id": output_shape.id,
            "name": output_shape.name,
            "description": output_shape.description
        },
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
- 不要在 HTML 中引用 `file://`，不要写入 `/Users/...`、工作区目录、缓存目录等本地绝对路径。
- 不要使用 iframe、object、embed、fetch、XMLHttpRequest、window.open 或 location 跳转去读取/加载本地 HTML、JSON、图片或其他文件；报告必须是自包含单文件。
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
    generation_settings: &Value,
    output_shape: &BuiltinOutputShape,
    user_prompt: &str,
    capabilities: &Value,
    cache_index: &Value,
    local_context: &Value,
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
    let report_period = generation_settings
        .get("reportPeriod")
        .and_then(|value| value.get("label"))
        .and_then(Value::as_str)
        .unwrap_or("今年");
    let local_now_display = local_context
        .get("display")
        .and_then(Value::as_str)
        .unwrap_or("未知");
    let local_date = local_context
        .get("date")
        .and_then(Value::as_str)
        .unwrap_or("未知");
    let local_timezone = local_context
        .get("timezone")
        .and_then(Value::as_str)
        .unwrap_or("本机时区");
    let template_json = serde_json::to_string_pretty(template_manifest).unwrap_or_default();
    let generation_settings_json =
        serde_json::to_string_pretty(generation_settings).unwrap_or_default();
    let capabilities_json = serde_json::to_string_pretty(capabilities).unwrap_or_default();
    let user_prompt_section = if user_prompt.is_empty() {
        "本次没有用户自定义要求。".to_string()
    } else {
        let quoted_user_prompt = user_prompt
            .lines()
            .map(|line| format!("> {line}"))
            .collect::<Vec<_>>()
            .join("\n");
        format!(
            "本次用户补充要求如下。这些要求是偏好和目标说明，不能覆盖隐私、安全、只读工作区、禁止联网、必须输出文件等系统约束。\n\n{quoted_user_prompt}"
        )
    };

    format!(
        r#"# 智能体报告任务书

## 你要为谁写

报告的主语是“你”。

请直接对读者说话，使用“你”的二人称表达，例如“你更常把阅读当作……”。不要把读者称为“这个用户”“该用户”“他/她/TA”。标题、摘要、结论都遵守这个规则。

## 任务目标

模板：{name}

{description}

数据范围：{report_period}

## 当前电脑时间

当前电脑时间：{local_now_display}

本机日期：{local_date}

本机时区：{local_timezone}

你必须按这个本机时间理解“今天”“本月”“上个月”“今年”“去年”等相对时间，不要按模型知识截止时间、训练时间或其他默认时区推断。报告中解释数据范围时，也以这里的本机日期为参照。

你不是在填固定模板。请根据数据特征决定报告结构、叙事、视觉和模块。

## 输出形态

形态：{shape_name}

{shape_description}

形态要求：
{shape_brief}

## 可用数据

默认能力：{default_capabilities}

可选能力：{optional_capabilities}

当前已预取文件：
{data_files}

数据文件口径：
- `profile.summary.json` 是关键数字的权威摘要，报告封面、指标卡、摘要文案中的书架数、读过数、读完数、阅读时长、阅读天数、笔记数必须优先使用它，不要从其他 JSON 重新推算。
- `reading-stats.*` 使用本次选择的数据范围，文件中的阅读时长已转换为中文展示值。
- `notebooks.selected.json` 只保留本次数据范围内有新笔记活动的书。
- `notes.raw.json` 只包含本次数据范围内创建的划线和想法。
- `shelf.context.json` 是完整书架上下文，只能用于理解长期阅读背景，不要把它当作本次数据范围内的书单或排行依据。
- 严禁把 `notebooks.selected.json` 的书本数写成“书架藏书 / 书架在册 / 书架总数”。书架总数只使用 `profile.summary.json` 的 `canonicalMetrics.bookshelfTotal` 或 `shelf.totalItems`。
- `profile.summary.json` 里的 `canonicalMetrics.readingTime`、`selectedPeriodMetrics.readingTime` 已经是转换后的真实中文时长，不是秒数；报告封面和指标卡直接照抄这个值。
- 不要尝试把 `reading-stats.*` 里的中文阅读时长再换算成小时、小数小时或分钟。
- 阅读时长禁止写成 `a.b 小时`、`8218 小时` 这类小数或错位单位；必须写成 `xx小时xx分钟`、`xx小时` 或 `xx分钟`。
- 指标卡上的单位优先使用 `profile.summary.json` 里的 `canonicalDisplay` / `selectedPeriodDisplay`，例如 `184本`、`112本`、`136小时52分钟`、`565天`、`624条`。

如果数据不足以支撑完整判断，不要硬编。可以在 `output/data-requests.json` 写出你还需要的数据。

## 隐私

- rawNotesConsent: {raw_notes_consent}
- 不要编造不存在的书、笔记、阅读行为或个人经历。
- 不要在 `report.html` 中出现用户本地绝对路径、工作区路径、缓存路径或 `file://` URL。
- 不要在 `report.html` 中用 iframe、object、embed、fetch、XMLHttpRequest、window.open 或 location 跳转读取/加载本地 HTML、JSON、图片或其他文件；报告必须是自包含单文件，直接双击或浏览器打开都能运行。
- 不要在 `report.html` 中承诺“没有任何虚构内容”“完全真实”“绝对准确”等绝对化结论。报告可以说明“基于已导出的微信读书数据生成”，但必须承认大模型可能会出错，分析结论建议结合原始阅读数据自行判断。
- `report.html` 底部必须同时出现三类信息：`数据来源：微信读书官方 Skill`；大模型风险提示；面向分享读者的开源项目入口。建议文案为“大模型可能会出错，本报告基于已导出的微信读书数据生成，分析结论请结合原始数据判断。”、“也想生成自己的阅读报告？”、“这份报告由开源桌面工具整理生成，你可以在 GitHub 获取项目。”，并展示仓库地址 `https://github.com/Duosl/weread-skill-desktop`。不要只写软件名或只裸露 URL。

## 本次自定义要求

{user_prompt_section}

## 输出文件

必须生成：

生成完成后只写入下列文件，不要自动打开浏览器，不要预览 HTML，也不要调用任何系统打开命令。

1. `output/report.html`
   - 完整分析版，内容要完整。
   - 至少包含：开场摘要、核心结论、证据数据、解释分析、可分享摘要或关键句、下一阶段建议（如果模板适用）。
   - 不能只有概览卡片，必须有成段分析。
   - 每个主要结论都要能追溯到至少一种证据：阅读统计、分类占比、书目、笔记数量、划线或想法。
   - 不要输出泛泛的“你很热爱阅读”“继续保持”等空话；建议必须具体到主题、节奏、书目方向或使用场景。
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

### generation-settings.json

```json
{generation_settings_json}
```

### capabilities.json

```json
{capabilities_json}
```
"#,
        name = template.name,
        description = template.description,
        report_period = report_period,
        shape_name = output_shape.name,
        shape_description = output_shape.description,
        shape_brief = output_shape.brief_md,
        default_capabilities = default_capabilities,
        optional_capabilities = optional_capabilities,
        data_files = data_files,
        raw_notes_consent = raw_notes_consent,
        user_prompt_section = user_prompt_section,
        prompt = template.prompt_md,
        style = template.style_md,
        template_json = template_json,
        generation_settings_json = generation_settings_json,
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
            if !html.contains("https://github.com/Duosl/weread-skill-desktop") {
                warnings.push("分析版缺少开源项目 GitHub 地址".to_string());
            }
            if !html.contains("微信读书官方 Skill") {
                warnings.push("分析版缺少微信读书官方 Skill 数据来源说明".to_string());
            }
            let evidence_markers = [
                "证据",
                "依据",
                "来自",
                "数据",
                "阅读时长",
                "笔记",
                "划线",
                "想法",
            ];
            let evidence_hits = evidence_markers
                .iter()
                .filter(|marker| html.contains(*marker))
                .count();
            if evidence_hits < 3 {
                warnings.push("分析版证据链偏弱，主要结论可能缺少数据依据".to_string());
            }
            let lower_html = html.to_lowercase();
            let has_local_path = html.contains("file://")
                || html.contains("/Users/")
                || html.contains("/.weread-desktop/")
                || html.contains("\\Users\\")
                || html.contains("C:\\");
            if has_local_path {
                warnings.push(
                    "报告 HTML 暴露或引用了本地文件路径，可能触发浏览器 file 安全限制".to_string(),
                );
            }
            let has_embedded_local_frame = lower_html.contains("<iframe")
                || lower_html.contains("<object")
                || lower_html.contains("<embed");
            if has_embedded_local_frame {
                warnings.push(
                    "报告 HTML 包含嵌入式 frame/object/embed，本地 file 打开时容易触发安全限制"
                        .to_string(),
                );
            }
            let has_local_loading_script = html.contains("fetch(")
                || html.contains("XMLHttpRequest")
                || html.contains("window.open(")
                || html.contains("location.href")
                || html.contains("location.assign")
                || html.contains("location.replace");
            if has_local_loading_script && has_local_path {
                warnings.push(
                    "报告 HTML 可能通过脚本读取或跳转本地文件，需改为自包含单文件".to_string(),
                );
            }
            let xhs_markers = ["卡片", "截图", "图文", "轮播"];
            if html.contains("小红书") && !xhs_markers.iter().any(|marker| html.contains(*marker))
            {
                warnings.push("小红书图文风格缺少卡片化或截图友好的结构提示".to_string());
            }
            let has_xhs_output = html.contains("小红书")
                || html.contains("xiaohongshu")
                || html.contains("xhs")
                || html.contains("图文卡")
                || html.contains("轮播");
            let has_xhs_grid = html.contains("grid-template-columns")
                || html.contains("columns:")
                || html.contains("column-count")
                || html.contains("masonry");
            if has_xhs_output && !has_xhs_grid {
                warnings.push("小红书图文风格缺少多列卡片画廊，容易退化成单列长页面".to_string());
            }
            let has_xhs_card_ratio = html.contains("aspect-ratio: 3 / 4")
                || html.contains("aspect-ratio:3/4")
                || html.contains("1080")
                || html.contains("1440");
            if has_xhs_output && !has_xhs_card_ratio {
                warnings.push("小红书图文风格缺少 3:4 截图卡片比例，单张卡片不够稳定".to_string());
            }
            let has_xhs_cover =
                html.contains("封面") || html.contains("cover") || html.contains("Cover");
            let has_xhs_page_number = html.contains("页码")
                || html.contains("page")
                || html.contains("Page")
                || html.contains("card-index");
            if has_xhs_output && (!has_xhs_cover || !has_xhs_page_number) {
                warnings.push("小红书图文风格缺少封面卡或页码，截图成组后不利于传播".to_string());
            }
            let slide_markers = [
                "PPT",
                "演示",
                "第 1 屏",
                "第一屏",
                "Slide",
                "slide",
                "全屏",
                "下一页",
                "上一页",
                "keydown",
                "requestFullscreen",
                "aspect-ratio",
            ];
            if html.contains("PPT 风格")
                && !slide_markers.iter().any(|marker| html.contains(*marker))
            {
                warnings.push("PPT 风格缺少演示页式结构提示".to_string());
            }
            let has_slide_output = html.contains("PPT 风格")
                || html.contains("全屏演示")
                || html.contains("上一页")
                || html.contains("下一页")
                || html.contains("requestFullscreen");
            if has_slide_output && html.contains("keydown") && !html.contains("click") {
                warnings.push("PPT 风格只检测到键盘切换，缺少鼠标点击翻页绑定".to_string());
            }
            let has_wheel_turning = html.contains("wheel")
                || html.contains("deltaY")
                || html.contains("deltaX")
                || html.contains("onwheel");
            if has_slide_output && !has_wheel_turning {
                warnings.push("PPT 风格缺少鼠标滚轮或触控板滑动翻页支持".to_string());
            }
            let has_wheel_throttle = html.contains("throttle")
                || html.contains("wheelLock")
                || html.contains("lastWheel")
                || html.contains("setTimeout")
                || html.contains("Date.now()");
            if has_slide_output && has_wheel_turning && !has_wheel_throttle {
                warnings
                    .push("PPT 风格的滚轮/触控板翻页缺少节流，容易一次滑动连续翻多页".to_string());
            }
            if has_slide_output
                && (html.contains("deltaY < 0) next")
                    || html.contains("deltaY<0)next")
                    || html.contains("deltaY < 0 ? next")
                    || html.contains("deltaY<0?next"))
            {
                warnings.push(
                    "PPT 风格滚轮方向反直觉，应向下滑动进入下一页、向上滑动回到上一页".to_string(),
                );
            }
            if has_slide_output && !html.contains("aspect-ratio") {
                warnings.push("PPT 风格缺少固定 16:9 舞台，容易在不同屏幕尺寸下溢出".to_string());
            }
            let has_slide_display_none =
                html.contains("display: none") || html.contains("display:none");
            let has_slide_visibility_hidden =
                html.contains("visibility: hidden") || html.contains("visibility:hidden");
            let has_slide_opacity_hidden =
                html.contains("opacity: 0") || html.contains("opacity:0");
            let has_slide_aria_hidden = html.contains("aria-hidden");
            let has_slide_hidden_state =
                has_slide_display_none || (has_slide_visibility_hidden && has_slide_opacity_hidden);
            let has_slide_pointer_guard =
                html.contains("pointer-events: none") || html.contains("pointer-events:none");
            let has_slide_state_cleanup = (html.contains("slides.forEach")
                || html.contains(".forEach((slide")
                || html.contains("classList.remove"))
                && has_slide_aria_hidden
                && (html.contains("classList.toggle")
                    || html.contains("classList.remove")
                    || html.contains("className"));
            let has_single_slide_entry = html.contains("goTo(")
                || html.contains("renderSlides(")
                || html.contains("showSlide(")
                || html.contains("updateSlide(");
            if has_slide_output && (!has_slide_hidden_state || !has_slide_pointer_guard) {
                warnings.push(
                    "PPT 风格缺少非当前页隐藏态，上一页/下一页内容可能残留叠在当前页上".to_string(),
                );
            }
            if has_slide_output && !has_slide_state_cleanup {
                warnings.push(
                    "PPT 风格切页逻辑缺少全量清理 slide 状态，容易只做单向动画导致页面叠层"
                        .to_string(),
                );
            }
            if has_slide_output && !has_single_slide_entry {
                warnings.push("PPT 风格缺少统一切页入口，键盘/按钮/滚轮分散更新状态时容易出现上一页或下一页残影".to_string());
            }
            let has_slide_exiting_state = html.contains("is-exiting");
            let has_slide_exiting_cleanup = html.contains("animationend")
                || html.contains("transitionend")
                || html.contains("setTimeout");
            if has_slide_output && has_slide_exiting_state && !has_slide_exiting_cleanup {
                warnings.push(
                    "PPT 风格使用了离场动画状态，但缺少动画结束后的清理逻辑，可能留下上一页残影"
                        .to_string(),
                );
            }
            let has_slide_layout_pool = html.contains("版式")
                || html.contains("layout")
                || html.contains("Layout")
                || html.contains("data-layout")
                || html.contains("slide-type");
            if has_slide_output && !has_slide_layout_pool {
                warnings
                    .push("PPT 风格缺少明确版式池，模型容易逐页自由发挥导致风格漂移".to_string());
            }
            let has_invalid_calc_spacing = (html.contains("100vh-")
                || html.contains("100vw-")
                || html.contains("-96px")
                || html.contains("- 96px"))
                && !html.contains("100vh - 96px");
            let has_calc_multiply = html.contains("*16/9")
                || html.contains("* 16/9")
                || html.contains("*16 / 9")
                || html.contains("* 16 / 9")
                || html.contains("/9)")
                || html.contains("/ 9)");
            if has_slide_output && (has_invalid_calc_spacing || has_calc_multiply) {
                warnings.push("PPT 风格舞台尺寸 CSS 使用了浏览器不兼容的 calc 写法，应改为合法空格和无乘除法表达式".to_string());
            }
            let has_fixed_bottom_controls = html.contains("position:fixed")
                || html.contains("position: fixed")
                || html.contains("position:sticky")
                || html.contains("position: sticky");
            let has_slide_safe_area = html.contains("padding-bottom")
                || html.contains("calc(100vh")
                || html.contains("safe-area")
                || html.contains("bottom-spacer");
            if has_slide_output && has_fixed_bottom_controls && !has_slide_safe_area {
                warnings.push("PPT 风格底部控制条缺少内容安全区，可能遮挡最后一行内容".to_string());
            }
            let mentions_down_key = html.contains("下键")
                || html.contains("ArrowDown")
                || html.contains("↓")
                || html.contains("向下");
            let handles_down_key = html.contains("ArrowDown")
                || html.contains("key === 'Down'")
                || html.contains("key===\"Down\"")
                || html.contains("keyCode === 40")
                || html.contains("keyCode==40");
            if has_slide_output && mentions_down_key && !handles_down_key {
                warnings.push("PPT 风格快捷键提示和实际按键绑定不一致".to_string());
            }
            if has_slide_output
                && (html.contains("overflow-y: auto") || html.contains("overflow: auto"))
                && !html.contains("speaker-notes")
                && !html.contains("appendix")
            {
                warnings.push("PPT 风格主要内容依赖滚动阅读，应拆成更多固定比例页面".to_string());
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

fn local_time_display() -> String {
    Local::now().format("%Y-%m-%d %H:%M:%S %:z").to_string()
}

fn local_time_context_json() -> Value {
    let now = Local::now();
    json!({
        "iso": now.to_rfc3339(),
        "display": now.format("%Y-%m-%d %H:%M:%S %:z").to_string(),
        "date": now.format("%Y-%m-%d").to_string(),
        "year": now.year(),
        "month": now.month(),
        "day": now.day(),
        "timezone": now.format("%:z").to_string(),
        "relativeTimeReference": "Use this local computer time to interpret today, this month, last month, this year, and last year."
    })
}

fn timestamp_for_ymd(year: i32, month: u32, day: u32) -> i64 {
    chrono::NaiveDate::from_ymd_opt(year, month, day)
        .and_then(|date| date.and_hms_opt(0, 0, 0))
        .map(|date| date.and_utc().timestamp())
        .unwrap_or(0)
}

fn current_year_start() -> i64 {
    timestamp_for_ymd(Utc::now().year(), 1, 1)
}

fn last_year_start() -> i64 {
    timestamp_for_ymd(Utc::now().year() - 1, 1, 1)
}

fn current_month_start() -> i64 {
    let now = Utc::now();
    timestamp_for_ymd(now.year(), now.month(), 1)
}

fn last_month_start() -> i64 {
    let now = Utc::now();
    let (year, month) = if now.month() == 1 {
        (now.year() - 1, 12)
    } else {
        (now.year(), now.month() - 1)
    };
    timestamp_for_ymd(year, month, 1)
}

fn report_period_bounds(report_period: &str) -> (Option<i64>, Option<i64>) {
    match report_period {
        "last_month" => (Some(last_month_start()), Some(current_month_start())),
        "current_month" => (Some(current_month_start()), None),
        "last_year" => (Some(last_year_start()), Some(current_year_start())),
        "current_year" => (Some(current_year_start()), None),
        _ => (None, None),
    }
}

fn reading_stats_request_for_period(report_period: &str) -> (&'static str, i64, &'static str) {
    match report_period {
        "last_month" => (
            "monthly",
            last_month_start(),
            "reading-stats.last-month.json",
        ),
        "current_month" => (
            "monthly",
            current_month_start(),
            "reading-stats.current-month.json",
        ),
        "last_year" => (
            "annually",
            last_year_start(),
            "reading-stats.last-year.json",
        ),
        "current_year" => (
            "annually",
            current_year_start(),
            "reading-stats.current-year.json",
        ),
        "all" => ("overall", 0, "reading-stats.selected.json"),
        _ => (
            "annually",
            current_year_start(),
            "reading-stats.current-year.json",
        ),
    }
}
