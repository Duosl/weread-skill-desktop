pub mod path;
pub mod toolchain;

use crate::agents::{AgentDef, AgentProtocol, DetectedAgent};
use std::path::Path;

/// 检测所有可用的 agents
pub fn detect_agents(agents: &[AgentDef]) -> Vec<DetectedAgent> {
    agents.iter().map(|a| detect_single(a)).collect()
}

/// 检测单个 agent
pub fn detect_single(def: &AgentDef) -> DetectedAgent {
    let unsupported = def.protocol == AgentProtocol::Acp;

    // 1. 检查环境变量覆盖
    if let Some(env_var) = &def.env_override {
        if let Ok(env_path) = std::env::var(env_var) {
            if !env_path.is_empty() && Path::new(&env_path).exists() {
                return DetectedAgent {
                    id: def.id.clone(),
                    label: def.label.clone(),
                    vendor: def.vendor.clone(),
                    available: true,
                    path: Some(env_path),
                    protocol: def.protocol,
                    unsupported: if unsupported { Some(true) } else { None },
                };
            }
        }
    }

    // 2. 扫描主二进制名
    if let Some(found) = path::resolve_on_path(&def.bin) {
        return DetectedAgent {
            id: def.id.clone(),
            label: def.label.clone(),
            vendor: def.vendor.clone(),
            available: true,
            path: Some(found),
            protocol: def.protocol,
            unsupported: if unsupported { Some(true) } else { None },
        };
    }

    // 3. 扫描备选二进制名
    for fallback in &def.fallback_bins {
        if let Some(found) = path::resolve_on_path(fallback) {
            return DetectedAgent {
                id: def.id.clone(),
                label: def.label.clone(),
                vendor: def.vendor.clone(),
                available: true,
                path: Some(found),
                protocol: def.protocol,
                unsupported: if unsupported { Some(true) } else { None },
            };
        }
    }

    // 未找到
    DetectedAgent {
        id: def.id.clone(),
        label: def.label.clone(),
        vendor: def.vendor.clone(),
        available: false,
        path: None,
        protocol: def.protocol,
        unsupported: if unsupported { Some(true) } else { None },
    }
}

/// 按 ID 检测单个 agent
pub fn detect_agent_by_id(agents: &[AgentDef], agent_id: &str) -> Option<DetectedAgent> {
    agents.iter().find(|a| a.id == agent_id).map(detect_single)
}
