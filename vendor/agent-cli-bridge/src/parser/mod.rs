pub mod claude;
pub mod codex;
pub mod gemini;

use serde_json::Value;

/// 解析事件类型
#[derive(Debug, Clone)]
pub enum ParseEvent {
    /// 文本增量
    Delta(String),
    /// 完整 HTML（从 tool_use 中提取）
    Html(String),
    /// 元数据
    Meta { key: String, value: Value },
    /// 未被解析器识别的原始输出
    Raw(String),
    /// 需要忽略的内容
    Noise,
}

/// 解析器状态（用于跨行去重）
#[derive(Debug, Default)]
pub struct ParseState {
    pub saw_stream_event_text: bool,
}

/// 解析单行输出
pub fn parse_line(agent: &str, line: &str, state: &mut ParseState) -> Vec<ParseEvent> {
    match agent {
        "claude" => claude::parse_line(line, state),
        "codex" => codex::parse_line(line, state),
        "cursor-agent" | "gemini" | "copilot" | "opencode" | "qwen" => {
            gemini::parse_line(agent, line, state)
        }
        "qoder" => claude::parse_line(line, state), // qoder 使用与 claude 相同的格式
        _ => vec![ParseEvent::Raw(line.to_string())],
    }
}

/// 从 tool_use 中提取 HTML
pub fn rescue_html_from_tool_use(content: &[Value]) -> String {
    let mut parts = Vec::new();

    for block in content {
        let obj = match block.as_object() {
            Some(o) => o,
            None => continue,
        };

        if obj.get("type").and_then(|v| v.as_str()) != Some("tool_use") {
            continue;
        }

        let name = obj
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase();

        if !matches!(
            name.as_str(),
            "write" | "create_file" | "createfile" | "writefile" | "write_file" | "filewrite"
        ) {
            continue;
        }

        if let Some(input) = obj.get("input").and_then(|v| v.as_object()) {
            let path = input
                .get("file_path")
                .or_else(|| input.get("path"))
                .or_else(|| input.get("filename"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();

            if !path.ends_with(".html") && !path.ends_with(".htm") {
                continue;
            }

            let text = input
                .get("content")
                .or_else(|| input.get("text"))
                .or_else(|| input.get("file_content"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if !text.is_empty() {
                parts.push(text);
            }
        }
    }

    parts.join("")
}
