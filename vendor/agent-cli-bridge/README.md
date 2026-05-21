# agent-cli-bridge

Rust 库：检测和调用本地安装的 AI 编码代理 CLI 工具。

## 核心能力

1. **CLI 检测**：扫描 PATH 和工具链目录，查找已安装的 AI CLI 二进制文件
2. **CLI 调用**：spawn 子进程，支持 stdin/argv/argv-message 三种协议
3. **流式解析**：解析 stdout 的 JSON 输出，提取增量文本、HTML、元数据

## 数据结构

### AgentDef

预定义的 agent 配置。

```rust
pub struct AgentDef {
    pub id: String,              // 唯一标识符，如 "claude"
    pub label: String,           // 显示名称，如 "Claude Code"
    pub bin: String,             // 主二进制名，如 "claude"
    pub fallback_bins: Vec<String>,  // 备选二进制名
    pub env_override: Option<String>, // 环境变量名，如 "CLAUDE_BIN"
    pub vendor: String,          // 供应商，如 "Anthropic"
    pub protocol: AgentProtocol, // 通信协议
}
```

### AgentProtocol

```rust
pub enum AgentProtocol {
    Stdin,        // prompt 通过 stdin 传递（大多数 agent）
    Argv,         // prompt 作为位置参数（deepseek）
    ArgvMessage,  // prompt 通过 --message 标志（openclaw）
    Acp,          // ACP JSON-RPC（暂不支持，仅检测）
}
```

### DetectedAgent

检测结果。

```rust
pub struct DetectedAgent {
    pub id: String,
    pub label: String,
    pub vendor: String,
    pub available: bool,         // 是否已安装
    pub path: Option<String>,    // 二进制完整路径
    pub protocol: AgentProtocol,
    pub unsupported: Option<bool>, // 协议是否不支持
}
```

### InvokeOpts

调用选项。

```rust
pub struct InvokeOpts {
    pub agent: String,           // agent id，如 "claude"
    pub prompt: String,          // 要发送的提示词
    pub cwd: Option<PathBuf>,    // 工作目录
    pub model: Option<String>,   // 模型名，如 "sonnet"
    pub bin_override: Option<String>, // 二进制路径覆盖
}
```

### InvokeEvent

流式输出事件。

```rust
pub enum InvokeEvent {
    Start {
        bin: String,
        argv: Vec<String>,
        prompt_bytes: usize,
        cwd: Option<String>,
    },                                           // 进程启动
    Delta { text: String },                       // 文本增量
    Html { text: String },                        // 完整 HTML
    Meta { key: String, value: Value },           // 元数据
    Stderr { text: String },                      // stderr 输出
    Raw { text: String },                         // 未被解析器识别的 stdout 行
    Canceled,                                     // 调用被取消
    Done { code: Option<i32> },                   // 进程退出码
    Error { message: String },                    // 错误
}
```

`Start.argv` 是实际传给子进程的参数；`Argv` 协议会把 prompt 追加为位置参数，`ArgvMessage` 协议会追加 `--message <prompt>`，`Stdin` 协议仍通过 stdin 写入 prompt。`model` 会通过对应 agent 的 `--model <model>` 参数传入。

## 公共 API

### 检测

```rust
// 检测所有 agents
pub fn detect_agents() -> Vec<DetectedAgent>

// 检测指定 agent
pub fn detect_agent(agent_id: &str) -> Option<DetectedAgent>

// 获取所有支持的 agent 定义
pub fn list_agents() -> Vec<AgentDef>
```

### 调用

```rust
// 异步调用，返回事件接收器
pub async fn invoke_agent(opts: InvokeOpts) -> Result<mpsc::Receiver<InvokeEvent>, Error>

// 异步调用，返回事件接收器和取消句柄
pub async fn invoke_agent_with_handle(opts: InvokeOpts) -> Result<InvokeHandle, Error>
```

取消示例：

```rust
let mut handle = invoke_agent_with_handle(opts).await?;
let cancel = handle.cancel.clone();

tokio::spawn(async move {
    // 在 UI 触发取消时调用
    cancel.cancel();
});

while let Some(event) = handle.events.recv().await {
    if matches!(event, InvokeEvent::Canceled) {
        break;
    }
}
```

## 错误类型

```rust
pub enum Error {
    UnknownAgent(String),                    // 未知 agent id
    BinOverrideMissing { agent, tried },     // 自定义路径不存在
    BinNotFound { agent, bin },             // 二进制未找到
    SpawnFailed(String),                     // 进程启动失败
    Io(std::io::Error),                      // IO 错误
}
```

## 检测逻辑

二进制查找优先级：

1. `opts.bin_override`（用户自定义路径）
2. `process.env[agent.env_override]`（环境变量）
3. PATH 扫描 `agent.bin`
4. PATH 扫描 `agent.fallback_bins`

PATH 扫描顺序：
- `PATH` 环境变量中的所有目录
- `~/.local/bin`, `~/.bun/bin`, `~/.volta/bin`
- `~/.cargo/bin`, `~/.npm-global/bin`
- `~/.claude/local`, `~/Library/pnpm`
- `/opt/homebrew/bin`, `/usr/local/bin`（macOS/Linux）
- Windows Scoop 目录

## 支持的 Agents

| id | 二进制 | 协议 | 环境变量 |
|----|--------|------|----------|
| claude | claude, openclaude | stdin | CLAUDE_BIN |
| openclaw | openclaw | argv-message | OPENCLAW_BIN |
| codex | codex | stdin | CODEX_BIN |
| cursor-agent | cursor-agent | stdin | CURSOR_AGENT_BIN |
| gemini | gemini | stdin | GEMINI_BIN |
| copilot | copilot | stdin | COPILOT_BIN |
| opencode | opencode-cli, opencode | stdin | OPENCODE_BIN |
| qwen | qwen | stdin | QWEN_BIN |
| qoder | qodercli | stdin | QODER_BIN |
| deepseek | deepseek | argv | DEEPSEEK_BIN |
| aider | aider | stdin | - |
| hermes | hermes | acp (不支持) | HERMES_BIN |
| kimi | kimi | acp (不支持) | KIMI_BIN |
| devin | devin | acp (不支持) | DEVIN_BIN |

## 输出格式

各 agent 的 stdout JSON 格式不同，parser 模块负责统一解析：

### Claude

```json
{"type": "system", "subtype": "init", "model": "claude-sonnet-4-6"}
{"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}}}
{"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}}
{"type": "result", "usage": {...}, "duration_ms": 1234, "total_cost_usd": 0.01}
```

### Codex

```json
{"type": "item.completed", "item": {"item_type": "assistant_message", "text": "..."}}
{"type": "item.delta", "text": "incremental text"}
{"type": "task_complete", "usage": {...}}
```

### Gemini / Cursor

```json
{"type": "stream_event", "event": {"delta": {"type": "text_delta", "text": "..."}}}
{"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}}
```

## 使用示例

### Tauri 集成

```rust
use agent_cli_bridge::{detect_agents, invoke_agent, InvokeOpts, InvokeEvent};
use tauri::command;

#[command]
async fn get_agents() -> Vec<agent_cli::DetectedAgent> {
    detect_agents()
}

#[command]
async fn run_agent(agent: String, prompt: String) -> Result<String, String> {
    let mut rx = invoke_agent(InvokeOpts {
        agent,
        prompt,
        ..Default::default()
    }).await.map_err(|e| e.to_string())?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            InvokeEvent::Delta { text } => output.push_str(&text),
            InvokeEvent::Html { text } => return Ok(text),
            InvokeEvent::Error { message } => return Err(message),
            _ => {}
        }
    }
    Ok(output)
}
```

### 事件流处理

```rust
let mut rx = invoke_agent(opts).await?;

while let Some(event) = rx.recv().await {
    match event {
        InvokeEvent::Start { bin, argv, prompt_bytes, cwd } => {
            // 进程启动
        }
        InvokeEvent::Delta { text } => {
            // 增量文本，可直接拼接
        }
        InvokeEvent::Html { text } => {
            // 完整 HTML，替换之前的 delta
        }
        InvokeEvent::Meta { key, value } => {
            // key 可能是: "model", "session", "usage", "cost_usd", "duration_ms"
        }
        InvokeEvent::Done { code } => {
            // 进程结束
        }
        InvokeEvent::Error { message } => {
            // 错误处理
        }
        InvokeEvent::Raw { text } => {
            // 未解析 stdout，可用于调试或兜底展示
        }
        InvokeEvent::Canceled => {
            // 用户取消
        }
        _ => {}
    }
}
```

## 运行测试

```bash
cargo test
cargo run --example detect
cargo run --example invoke -- claude "hello"
```
