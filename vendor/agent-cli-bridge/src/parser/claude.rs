use super::{rescue_html_from_tool_use, ParseEvent, ParseState};
use serde_json::Value;

/// 解析 Claude 的输出格式
pub fn parse_line(line: &str, state: &mut ParseState) -> Vec<ParseEvent> {
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

    // Init / system metadata
    if obj.get("type").and_then(|v| v.as_str()) == Some("system")
        && obj.get("subtype").and_then(|v| v.as_str()) == Some("init")
    {
        if let Some(model) = obj.get("model") {
            events.push(ParseEvent::Meta {
                key: "model".into(),
                value: model.clone(),
            });
        }
        if let Some(session_id) = obj.get("session_id") {
            events.push(ParseEvent::Meta {
                key: "session".into(),
                value: session_id.clone(),
            });
        }
        if let Some(cwd) = obj.get("cwd") {
            events.push(ParseEvent::Meta {
                key: "cwd".into(),
                value: cwd.clone(),
            });
        }
    }

    // Stream events
    if obj.get("type").and_then(|v| v.as_str()) == Some("stream_event") {
        if let Some(event) = obj.get("event").and_then(|v| v.as_object()) {
            if event.get("type").and_then(|v| v.as_str()) == Some("content_block_delta") {
                if let Some(delta) = event.get("delta").and_then(|v| v.as_object()) {
                    if delta.get("type").and_then(|v| v.as_str()) == Some("text_delta") {
                        if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                            state.saw_stream_event_text = true;
                            events.push(ParseEvent::Delta(text.to_string()));
                        }
                    } else if delta.get("type").and_then(|v| v.as_str()) == Some("thinking_delta") {
                        if let Some(thinking) = delta.get("thinking").and_then(|v| v.as_str()) {
                            events.push(ParseEvent::Meta {
                                key: "thinking".into(),
                                value: Value::String(thinking.to_string()),
                            });
                        }
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

            if let Some(usage) = message.get("usage") {
                events.push(ParseEvent::Meta {
                    key: "usage_partial".into(),
                    value: usage.clone(),
                });
            }
        }
    }

    // Result
    if obj.get("type").and_then(|v| v.as_str()) == Some("result") {
        if let Some(usage) = obj.get("usage") {
            events.push(ParseEvent::Meta {
                key: "usage".into(),
                value: usage.clone(),
            });
        }
        if let Some(duration_ms) = obj.get("duration_ms").and_then(|v| v.as_f64()) {
            if let Some(num) = serde_json::Number::from_f64(duration_ms) {
                events.push(ParseEvent::Meta {
                    key: "duration_ms".into(),
                    value: Value::Number(num),
                });
            }
        }
        if let Some(cost) = obj.get("total_cost_usd").and_then(|v| v.as_f64()) {
            if let Some(num) = serde_json::Number::from_f64(cost) {
                events.push(ParseEvent::Meta {
                    key: "cost_usd".into(),
                    value: Value::Number(num),
                });
            }
        }
        if let Some(subtype) = obj.get("subtype").and_then(|v| v.as_str()) {
            events.push(ParseEvent::Meta {
                key: "result".into(),
                value: Value::String(subtype.to_string()),
            });
        }
    }

    // Rate limit
    if obj.get("type").and_then(|v| v.as_str()) == Some("rate_limit_event") {
        if let Some(rate_limit_info) = obj.get("rate_limit_info") {
            events.push(ParseEvent::Meta {
                key: "rate_limit".into(),
                value: rate_limit_info.clone(),
            });
        }
    }

    events
}
