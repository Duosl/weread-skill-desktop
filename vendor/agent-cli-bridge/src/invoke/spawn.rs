use super::{build_argv, env_for, InvokeEvent};
use crate::agents::AgentProtocol;
use crate::parser;
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, watch};

/// 运行 agent 并流式输出事件
pub async fn run_agent(
    bin: &str,
    agent_id: &str,
    protocol: AgentProtocol,
    prompt: &str,
    cwd: Option<PathBuf>,
    model: Option<String>,
    mut cancel_rx: watch::Receiver<bool>,
    tx: mpsc::Sender<InvokeEvent>,
) -> Result<(), crate::Error> {
    if matches!(protocol, AgentProtocol::Acp) {
        let _ = tx
            .send(InvokeEvent::Error {
                message: format!("{agent_id}: acp protocol is not supported yet"),
            })
            .await;
        return Ok(());
    }

    let mut argv = build_argv(agent_id, model.as_deref());
    match protocol {
        AgentProtocol::Argv => argv.push(prompt.to_string()),
        AgentProtocol::ArgvMessage => argv.extend_from_slice(&["--message".into(), prompt.into()]),
        AgentProtocol::Stdin | AgentProtocol::Acp => {}
    }

    let env = env_for(agent_id);
    let cwd_for_event = cwd.as_ref().map(|p| p.to_string_lossy().to_string());
    let prompt_bytes = prompt.len();

    let mut cmd = Command::new(bin);
    cmd.args(&argv)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(if matches!(protocol, AgentProtocol::Stdin) {
            std::process::Stdio::piped()
        } else {
            std::process::Stdio::null()
        });

    if let Some(cwd) = &cwd {
        cmd.current_dir(cwd);
    }

    // 设置环境变量
    for (key, value) in &env {
        cmd.env(key, value);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| crate::Error::SpawnFailed(e.to_string()))?;

    // 先提取 stdout 和 stderr，避免部分移动问题
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // 发送 Start 事件
    let _ = tx
        .send(InvokeEvent::Start {
            bin: bin.to_string(),
            argv,
            prompt_bytes,
            cwd: cwd_for_event,
        })
        .await;

    // 处理 stdin
    let prompt_via_argv = matches!(protocol, AgentProtocol::Argv);
    let prompt_via_message = matches!(protocol, AgentProtocol::ArgvMessage);

    if !prompt_via_argv && !prompt_via_message {
        if let Some(mut stdin) = child.stdin.take() {
            let prompt_bytes = prompt.as_bytes();
            let _ = stdin.write_all(prompt_bytes).await;
            let _ = stdin.shutdown().await;
        }
    }

    // 启动 stdout 和 stderr 读取任务
    let tx_stdout = tx.clone();
    let agent_id_stdout = agent_id.to_string();

    let mut stdout_handle = Some(tokio::spawn(async move {
        read_stdout(stdout, &agent_id_stdout, tx_stdout).await;
    }));

    let tx_stderr = tx.clone();
    let mut stderr_handle = Some(tokio::spawn(async move {
        read_stderr(stderr, tx_stderr).await;
    }));

    // 等待进程完成
    let status = tokio::select! {
        result = child.wait() => {
            result.map_err(|e| crate::Error::SpawnFailed(e.to_string()))?
        }
        changed = cancel_rx.changed() => {
            if changed.is_ok() && *cancel_rx.borrow() {
                let _ = child.kill().await;
                if let Some(handle) = stdout_handle.take() {
                    let _ = handle.await;
                }
                if let Some(handle) = stderr_handle.take() {
                    let _ = handle.await;
                }
                let _ = tx.send(InvokeEvent::Canceled).await;
                let _ = tx.send(InvokeEvent::Done { code: None }).await;
                return Ok(());
            }

            child
                .wait()
                .await
                .map_err(|e| crate::Error::SpawnFailed(e.to_string()))?
        }
    };

    // 等待读取任务完成
    if let Some(handle) = stdout_handle {
        let _ = handle.await;
    }
    if let Some(handle) = stderr_handle {
        let _ = handle.await;
    }

    // 发送 Done 事件
    let _ = tx
        .send(InvokeEvent::Done {
            code: status.code(),
        })
        .await;

    Ok(())
}

/// 读取 stdout 并解析事件
async fn read_stdout(
    stdout: Option<tokio::process::ChildStdout>,
    agent_id: &str,
    tx: mpsc::Sender<InvokeEvent>,
) {
    let stdout = match stdout {
        Some(s) => s,
        None => return,
    };

    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut state = parser::ParseState::default();

    while let Ok(Some(line)) = lines.next_line().await {
        if line.is_empty() {
            continue;
        }

        let events = parser::parse_line(agent_id, &line, &mut state);

        for event in events {
            match event {
                parser::ParseEvent::Delta(text) => {
                    let _ = tx.send(InvokeEvent::Delta { text }).await;
                }
                parser::ParseEvent::Html(text) => {
                    let _ = tx.send(InvokeEvent::Html { text }).await;
                }
                parser::ParseEvent::Meta { key, value } => {
                    let _ = tx.send(InvokeEvent::Meta { key, value }).await;
                }
                parser::ParseEvent::Noise => {}
                parser::ParseEvent::Raw(text) => {
                    let _ = tx.send(InvokeEvent::Raw { text }).await;
                }
            }
        }
    }
}

/// 读取 stderr
async fn read_stderr(stderr: Option<tokio::process::ChildStderr>, tx: mpsc::Sender<InvokeEvent>) {
    let stderr = match stderr {
        Some(s) => s,
        None => return,
    };

    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if !line.is_empty() {
            let _ = tx.send(InvokeEvent::Stderr { text: line }).await;
        }
    }
}
