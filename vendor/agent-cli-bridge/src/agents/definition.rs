use serde::{Deserialize, Serialize};

/// Agent 协议类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentProtocol {
    /// prompt 通过 stdin 传递
    Stdin,
    /// prompt 作为位置参数
    Argv,
    /// prompt 通过 --message 标志
    ArgvMessage,
    /// ACP JSON-RPC（暂不支持）
    Acp,
}

/// Agent 定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDef {
    pub id: String,
    pub label: String,
    pub bin: String,
    #[serde(default)]
    pub fallback_bins: Vec<String>,
    pub env_override: Option<String>,
    pub vendor: String,
    #[serde(default = "default_protocol")]
    pub protocol: AgentProtocol,
}

fn default_protocol() -> AgentProtocol {
    AgentProtocol::Stdin
}

/// 检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedAgent {
    pub id: String,
    pub label: String,
    pub vendor: String,
    pub available: bool,
    pub path: Option<String>,
    pub protocol: AgentProtocol,
    pub unsupported: Option<bool>,
}
