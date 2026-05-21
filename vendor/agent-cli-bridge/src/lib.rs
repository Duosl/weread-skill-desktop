pub mod agents;
pub mod detect;
pub mod invoke;
pub mod parser;

use thiserror::Error;

// 重新导出常用类型
pub use invoke::{InvokeCancelHandle, InvokeEvent, InvokeHandle, InvokeOpts};

/// 库错误类型
#[derive(Debug, Error)]
pub enum Error {
    #[error("unknown agent: {0}")]
    UnknownAgent(String),

    #[error("{agent}: custom path `{tried}` does not exist")]
    BinOverrideMissing { agent: String, tried: String },

    #[error("{agent} (`{bin}`) is not installed or not on PATH")]
    BinNotFound { agent: String, bin: String },

    #[error("failed to spawn process: {0}")]
    SpawnFailed(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

/// 检测所有可用的 agents
pub fn detect_agents() -> Vec<agents::DetectedAgent> {
    let defs = agents::builtin_agents();
    detect::detect_agents(&defs)
}

/// 检测指定 agent
pub fn detect_agent(agent_id: &str) -> Option<agents::DetectedAgent> {
    let defs = agents::builtin_agents();
    detect::detect_agent_by_id(&defs, agent_id)
}

/// 获取所有支持的 agent 定义
pub fn list_agents() -> Vec<agents::AgentDef> {
    agents::builtin_agents()
}

/// 调用 agent（异步版本，返回事件流）
pub async fn invoke_agent(
    opts: invoke::InvokeOpts,
) -> Result<tokio::sync::mpsc::Receiver<invoke::InvokeEvent>, Error> {
    let defs = agents::builtin_agents();
    invoke::invoke_agent(&defs, opts).await
}

/// 调用 agent（异步版本，返回事件流和取消句柄）
pub async fn invoke_agent_with_handle(
    opts: invoke::InvokeOpts,
) -> Result<invoke::InvokeHandle, Error> {
    let defs = agents::builtin_agents();
    invoke::invoke_agent_with_handle(&defs, opts).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_agents() {
        let agents = list_agents();
        assert!(!agents.is_empty());
        assert!(agents.iter().any(|a| a.id == "claude"));
        assert!(agents.iter().any(|a| a.id == "codex"));
    }

    #[test]
    fn test_detect_agents() {
        let result = detect_agents();
        assert!(!result.is_empty());
    }

    #[test]
    fn test_detect_agent() {
        let claude = detect_agent("claude");
        assert!(claude.is_some());

        let unknown = detect_agent("nonexistent");
        assert!(unknown.is_none());
    }
}
