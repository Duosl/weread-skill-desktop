use super::{rescue_html_from_tool_use, ParseEvent, ParseState};
use serde_json::Value;

/// 解析 Cursor/Gemini 的输出格式
pub fn parse_line(agent: &str, line: &str, state: &mut ParseState) -> Vec<ParseEvent> {
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

    // Stream events
    if obj.get("type").and_then(|v| v.as_str()) == Some("stream_event") {
        if let Some(event) = obj.get("event").and_then(|v| v.as_object()) {
            if let Some(delta) = event.get("delta").and_then(|v| v.as_object()) {
                if delta.get("type").and_then(|v| v.as_str()) == Some("text_delta") {
                    if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                        state.saw_stream_event_text = true;
                        events.push(ParseEvent::Delta(text.to_string()));
                    }
                }
            }
        }
    }

    // Assistant messages
    if obj.get("type").and_then(|v| v.as_str()) == Some("assistant") {
        if let Some(message) = obj.get("message").and_then(|v| v.as_object()) {
            if let Some(content) = message.get("content").and_then(|v| v.as_array()) {
                let tool_html = rescue_html_from_tool_use(content);
                if !tool_html.is_empty() {
                    events.push(ParseEvent::Html(tool_html));
                    state.saw_stream_event_text = true;
                }
            }

            if !state.saw_stream_event_text {
                if let Some(content) = message.get("content").and_then(|v| v.as_array()) {
                    let text: String = content
                        .iter()
                        .filter_map(|c| {
                            if c.get("type").and_then(|v| v.as_str()) == Some("text") {
                                c.get("text").and_then(|v| v.as_str())
                            } else {
                                None
                            }
                        })
                        .collect();
                    if !text.is_empty() {
                        events.push(ParseEvent::Delta(text));
                    }
                }
            }
        }
    }

    // Bare text field (only when no stream event text)
    if !state.saw_stream_event_text && obj.get("type").and_then(|v| v.as_str()) != Some("assistant")
    {
        if let Some(text) = obj.get("text").and_then(|v| v.as_str()) {
            events.push(ParseEvent::Delta(text.to_string()));
        }
    }

    // Copilot 特殊格式
    if agent == "copilot" {
        if let Some(response) = obj.get("response").and_then(|v| v.as_str()) {
            events.push(ParseEvent::Delta(response.to_string()));
        }
        if let Some(text) = obj.get("text").and_then(|v| v.as_str()) {
            events.push(ParseEvent::Delta(text.to_string()));
        }
    }

    // OpenCode / Qwen 格式
    if matches!(agent, "opencode" | "qwen") {
        if let Some(text) = obj.get("text").and_then(|v| v.as_str()) {
            events.push(ParseEvent::Delta(text.to_string()));
        }
        if let Some(content) = obj.get("content").and_then(|v| v.as_str()) {
            events.push(ParseEvent::Delta(content.to_string()));
        }
        if let Some(message) = obj.get("message").and_then(|v| v.as_str()) {
            events.push(ParseEvent::Delta(message.to_string()));
        }
    }

    events
}
