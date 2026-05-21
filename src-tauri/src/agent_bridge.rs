use crate::state::RuntimeState;
use agent_cli_bridge::{detect_agents, invoke_agent_with_handle, InvokeEvent, InvokeOpts};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedAgentDto {
    pub id: String,
    pub label: String,
    pub vendor: String,
    pub available: bool,
    pub path: Option<String>,
    pub protocol: String,
    pub unsupported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInvokeRequest {
    pub agent: String,
    pub prompt: String,
    pub cwd: Option<String>,
    pub model: Option<String>,
    pub bin_override: Option<String>,
    pub job_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInvokeResult {
    pub success: bool,
    pub text: String,
    pub html: Option<String>,
    pub exit_code: Option<i32>,
    pub stderr: Vec<String>,
    pub meta: Vec<AgentMetaEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEventPayload {
    pub job_id: Option<String>,
    pub event: AgentInvokeEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMetaEvent {
    pub key: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentInvokeEvent {
    Start {
        bin: String,
        argv: Vec<String>,
        prompt_bytes: usize,
        cwd: Option<String>,
    },
    Delta {
        text: String,
    },
    Html {
        text: String,
    },
    Meta {
        key: String,
        value: Value,
    },
    Stderr {
        text: String,
    },
    Raw {
        text: String,
    },
    Canceled,
    Done {
        code: Option<i32>,
    },
    Error {
        message: String,
    },
}

pub fn list_detected_agents() -> Vec<DetectedAgentDto> {
    detect_agents()
        .into_iter()
        .map(|agent| DetectedAgentDto {
            id: agent.id,
            label: agent.label,
            vendor: agent.vendor,
            available: agent.available,
            path: agent.path,
            protocol: format!("{:?}", agent.protocol).to_lowercase(),
            unsupported: agent.unsupported.unwrap_or(false),
        })
        .collect()
}

pub async fn invoke_local_agent(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    request: AgentInvokeRequest,
) -> Result<AgentInvokeResult, String> {
    if request.agent.trim().is_empty() {
        return Err("请选择本地 Agent".to_string());
    }
    if request.prompt.trim().is_empty() {
        return Err("Prompt 不能为空".to_string());
    }

    let cwd = request.cwd.as_ref().map(PathBuf::from);
    let handle = invoke_agent_with_handle(InvokeOpts {
        agent: request.agent.clone(),
        prompt: request.prompt.clone(),
        cwd,
        model: request.model.clone(),
        bin_override: request.bin_override.clone(),
    })
    .await
    .map_err(|e| e.to_string())?;
    let mut rx = handle.events;

    if let Some(job_id) = normalized_job_id(&request.job_id) {
        state.register_agent_job(job_id, handle.cancel).await;
    }

    let mut text = String::new();
    let mut html = None;
    let mut exit_code = None;
    let mut stderr = Vec::new();
    let mut meta = Vec::new();

    while let Some(event) = rx.recv().await {
        match event {
            InvokeEvent::Start {
                bin,
                argv,
                prompt_bytes,
                cwd,
            } => {
                emit_agent_event(
                    &app,
                    &request.job_id,
                    AgentInvokeEvent::Start {
                        bin,
                        argv,
                        prompt_bytes,
                        cwd,
                    },
                );
            }
            InvokeEvent::Delta { text: delta } => {
                text.push_str(&delta);
                emit_agent_event(
                    &app,
                    &request.job_id,
                    AgentInvokeEvent::Delta { text: delta },
                );
            }
            InvokeEvent::Html { text: html_text } => {
                html = Some(html_text.clone());
                emit_agent_event(
                    &app,
                    &request.job_id,
                    AgentInvokeEvent::Html { text: html_text },
                );
            }
            InvokeEvent::Meta { key, value } => {
                meta.push(AgentMetaEvent {
                    key: key.clone(),
                    value: value.clone(),
                });
                emit_agent_event(&app, &request.job_id, AgentInvokeEvent::Meta { key, value });
            }
            InvokeEvent::Stderr { text: err } => {
                stderr.push(err.clone());
                emit_agent_event(
                    &app,
                    &request.job_id,
                    AgentInvokeEvent::Stderr { text: err },
                );
            }
            InvokeEvent::Raw { text: raw } => {
                emit_agent_event(&app, &request.job_id, AgentInvokeEvent::Raw { text: raw });
            }
            InvokeEvent::Canceled => {
                emit_agent_event(&app, &request.job_id, AgentInvokeEvent::Canceled);
                unregister_agent_job(state.inner(), &request.job_id).await;
                return Err("Agent 调用已取消".to_string());
            }
            InvokeEvent::Done { code } => {
                exit_code = code;
                emit_agent_event(&app, &request.job_id, AgentInvokeEvent::Done { code });
            }
            InvokeEvent::Error { message } => {
                emit_agent_event(
                    &app,
                    &request.job_id,
                    AgentInvokeEvent::Error {
                        message: message.clone(),
                    },
                );
                unregister_agent_job(state.inner(), &request.job_id).await;
                return Err(message);
            }
        }
    }

    unregister_agent_job(state.inner(), &request.job_id).await;

    Ok(AgentInvokeResult {
        success: exit_code.unwrap_or(0) == 0,
        text,
        html,
        exit_code,
        stderr,
        meta,
    })
}

pub async fn cancel_local_agent(
    state: State<'_, RuntimeState>,
    job_id: String,
) -> Result<bool, String> {
    let job_id = job_id.trim();
    if job_id.is_empty() {
        return Err("jobId 不能为空".to_string());
    }
    Ok(state.cancel_agent_job(job_id).await)
}

fn emit_agent_event(app: &AppHandle, job_id: &Option<String>, event: AgentInvokeEvent) {
    let _ = app.emit(
        "agent-invoke-event",
        AgentEventPayload {
            job_id: job_id.clone(),
            event,
        },
    );
}

fn normalized_job_id(job_id: &Option<String>) -> Option<String> {
    job_id
        .as_ref()
        .map(|id| id.trim())
        .filter(|id| !id.is_empty())
        .map(ToString::to_string)
}

async fn unregister_agent_job(state: &RuntimeState, job_id: &Option<String>) {
    if let Some(job_id) = normalized_job_id(job_id) {
        state.unregister_agent_job(&job_id).await;
    }
}
