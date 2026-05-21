use super::{ParseEvent, ParseState};
use serde_json::Value;

/// 解析 Codex 的输出格式
pub fn parse_line(line: &str, _state: &mut ParseState) -> Vec<ParseEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return vec![];
    }

    let parsed: Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return vec![ParseEvent::Raw(line.to_string())],
    };

    let obj = match parsed.as_object() {
        Some(o) => o,
        None => return vec![],
    };

    let mut events = Vec::new();

    // item.completed
    if obj.get("type").and_then(|v| v.as_str()) == Some("item.completed") {
        if let Some(item) = obj.get("item").and_then(|v| v.as_object()) {
            let item_type = item
                .get("item_type")
                .or_else(|| item.get("type"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if matches!(item_type, "assistant_message" | "agent_message") {
                if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                    events.push(ParseEvent::Delta(text.to_string()));
                }
            }
        }
    }

    // item.delta
    if obj.get("type").and_then(|v| v.as_str()) == Some("item.delta") {
        if let Some(text) = obj.get("text").and_then(|v| v.as_str()) {
            events.push(ParseEvent::Delta(text.to_string()));
        }
    }

    // msg
    if let Some(msg) = obj.get("msg").and_then(|v| v.as_object()) {
        if msg.get("type").and_then(|v| v.as_str()) == Some("agent_message") {
            if let Some(message) = msg.get("message").and_then(|v| v.as_str()) {
                events.push(ParseEvent::Delta(message.to_string()));
            }
        }
    }

    // task_complete / turn.completed
    if matches!(
        obj.get("type").and_then(|v| v.as_str()),
        Some("task_complete") | Some("turn.completed")
    ) {
        if let Some(usage) = obj.get("usage") {
            events.push(ParseEvent::Meta {
                key: "usage".into(),
                value: usage.clone(),
            });
        }
    }

    events
}
