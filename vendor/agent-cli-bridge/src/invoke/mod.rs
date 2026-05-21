pub mod spawn;

use crate::agents::AgentDef;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tokio::sync::{mpsc, watch};

/// 调用事件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InvokeEvent {
    /// 进程启动
    Start {
        bin: String,
        argv: Vec<String>,
        prompt_bytes: usize,
        cwd: Option<String>,
    },
    /// 文本增量
    Delta { text: String },
    /// 完整 HTML
    Html { text: String },
    /// 元数据
    Meta { key: String, value: Value },
    /// stderr 输出
    Stderr { text: String },
    /// 未被解析器识别的 stdout 原始行
    Raw { text: String },
    /// 调用被取消
    Canceled,
    /// 进程完成
    Done { code: Option<i32> },
    /// 错误
    Error { message: String },
}

/// 调用选项
#[derive(Debug, Clone, Default)]
pub struct InvokeOpts {
    pub agent: String,
    pub prompt: String,
    pub cwd: Option<PathBuf>,
    pub model: Option<String>,
    pub bin_override: Option<String>,
}

/// 可取消的 agent 调用句柄
pub struct InvokeHandle {
    pub events: mpsc::Receiver<InvokeEvent>,
    pub cancel: InvokeCancelHandle,
}

/// 调用取消句柄
#[derive(Clone)]
pub struct InvokeCancelHandle {
    tx: watch::Sender<bool>,
}

impl InvokeCancelHandle {
    /// 请求取消正在运行的 agent 进程。
    pub fn cancel(&self) {
        let _ = self.tx.send(true);
    }

    /// 当前是否已经请求取消。
    pub fn is_canceled(&self) -> bool {
        *self.tx.borrow()
    }
}

/// 二进制解析结果
#[derive(Debug)]
enum BinResolution {
    Ok(String),
    OverrideMissing(String),
    NotFound,
}

/// 解析二进制路径
fn resolve_bin_for_agent(def: &AgentDef, bin_override: Option<&str>) -> BinResolution {
    // 1. 用户自定义路径
    if let Some(override_path) = bin_override {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            if std::path::Path::new(trimmed).exists() {
                return BinResolution::Ok(trimmed.to_string());
            }
            return BinResolution::OverrideMissing(trimmed.to_string());
        }
    }

    // 2. 环境变量
    if let Some(env_var) = &def.env_override {
        if let Ok(env_path) = std::env::var(env_var) {
            let trimmed = env_path.trim();
            if !trimmed.is_empty() && std::path::Path::new(trimmed).exists() {
                return BinResolution::Ok(trimmed.to_string());
            }
        }
    }

    // 3. PATH 扫描
    if let Some(found) = crate::detect::path::resolve_on_path(&def.bin) {
        return BinResolution::Ok(found);
    }

    for fallback in &def.fallback_bins {
        if let Some(found) = crate::detect::path::resolve_on_path(fallback) {
            return BinResolution::Ok(found);
        }
    }

    BinResolution::NotFound
}

/// 构建 agent 的命令行参数
pub fn build_argv(agent: &str, model: Option<&str>) -> Vec<String> {
    let mut argv = Vec::new();

    match agent {
        "claude" => {
            argv.extend_from_slice(&[
                "-p".into(),
                "--output-format".into(),
                "stream-json".into(),
                "--verbose".into(),
                "--include-partial-messages".into(),
                "--permission-mode".into(),
                "bypassPermissions".into(),
            ]);
        }
        "openclaw" => {
            argv.extend_from_slice(&[
                "agent".into(),
                "--local".into(),
                "--json".into(),
                "--agent".into(),
                "main".into(),
            ]);
        }
        "codex" => {
            argv.extend_from_slice(&[
                "exec".into(),
                "--json".into(),
                "--skip-git-repo-check".into(),
                "--sandbox".into(),
                "workspace-write".into(),
                "-c".into(),
                "sandbox_workspace_write.network_access=true".into(),
            ]);
        }
        "cursor-agent" => {
            argv.extend_from_slice(&[
                "--print".into(),
                "--output-format".into(),
                "stream-json".into(),
                "--stream-partial-output".into(),
                "--force".into(),
                "--trust".into(),
            ]);
        }
        "gemini" => {
            argv.extend_from_slice(&[
                "--output-format".into(),
                "stream-json".into(),
                "--yolo".into(),
            ]);
        }
        "copilot" => {
            argv.extend_from_slice(&[
                "--allow-all-tools".into(),
                "--output-format".into(),
                "json".into(),
            ]);
        }
        "opencode" => {
            argv.extend_from_slice(&[
                "run".into(),
                "--format".into(),
                "json".into(),
                "--dangerously-skip-permissions".into(),
                "-".into(),
            ]);
        }
        "qwen" => {
            argv.extend_from_slice(&["--yolo".into(), "-".into()]);
        }
        "qoder" => {
            argv.extend_from_slice(&[
                "-p".into(),
                "--output-format".into(),
                "stream-json".into(),
                "--yolo".into(),
            ]);
        }
        "deepseek" => {
            argv.extend_from_slice(&["exec".into(), "--auto".into()]);
        }
        "aider" => {
            argv.extend_from_slice(&[
                "--no-pretty".into(),
                "--no-stream".into(),
                "--yes-always".into(),
                "--message-file".into(),
                "-".into(),
            ]);
        }
        _ => {}
    }

    if let Some(model) = model {
        argv.extend_from_slice(&["--model".into(), model.to_string()]);
    }

    argv
}

/// 获取 agent 特定的环境变量
pub fn env_for(agent: &str) -> std::collections::HashMap<String, String> {
    let mut env = std::collections::HashMap::new();
    if agent == "gemini" {
        env.insert("GEMINI_CLI_TRUST_WORKSPACE".into(), "true".into());
    }
    env
}

/// 调用 agent（异步版本，返回事件接收器）
pub async fn invoke_agent(
    agents: &[AgentDef],
    opts: InvokeOpts,
) -> Result<mpsc::Receiver<InvokeEvent>, crate::Error> {
    Ok(invoke_agent_with_handle(agents, opts).await?.events)
}

/// 调用 agent（异步版本，返回事件接收器与取消句柄）
pub async fn invoke_agent_with_handle(
    agents: &[AgentDef],
    opts: InvokeOpts,
) -> Result<InvokeHandle, crate::Error> {
    let def = agents
        .iter()
        .find(|a| a.id == opts.agent)
        .ok_or_else(|| crate::Error::UnknownAgent(opts.agent.clone()))?;

    let resolved = resolve_bin_for_agent(def, opts.bin_override.as_deref());
    let bin = match resolved {
        BinResolution::Ok(b) => b,
        BinResolution::OverrideMissing(tried) => {
            return Err(crate::Error::BinOverrideMissing {
                agent: def.label.clone(),
                tried,
            });
        }
        BinResolution::NotFound => {
            return Err(crate::Error::BinNotFound {
                agent: def.label.clone(),
                bin: def.bin.clone(),
            });
        }
    };

    let (tx, rx) = mpsc::channel(100);
    let (cancel_tx, cancel_rx) = watch::channel(false);

    let agent_id = def.id.clone();
    let protocol = def.protocol;
    let prompt = opts.prompt.clone();
    let cwd = opts.cwd.clone();
    let model = opts.model.clone();

    tokio::spawn(async move {
        if let Err(e) = spawn::run_agent(
            &bin,
            &agent_id,
            protocol,
            &prompt,
            cwd,
            model,
            cancel_rx,
            tx.clone(),
        )
        .await
        {
            let _ = tx
                .send(InvokeEvent::Error {
                    message: e.to_string(),
                })
                .await;
        }
    });

    Ok(InvokeHandle {
        events: rx,
        cancel: InvokeCancelHandle { tx: cancel_tx },
    })
}
