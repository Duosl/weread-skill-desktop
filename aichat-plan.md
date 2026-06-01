# 书迹 AI Chat + 自定义模板实施方案

## 概述

在现有智能体报告（Agent CLI）基础上，新增 **AI Chat 对话式报告生成** 和 **自定义模板系统** 两条并行能力。AI Chat 让用户通过自己的 LLM API 直接对话生成报告；自定义模板支持从 Chat 保存或手动创建，并可在两条路线中复用。

## 关键决策汇总

| 决策项 | 结论 |
|--------|------|
| Chat UI 库 | `@assistant-ui/react` |
| Chat 入口 | 侧边栏新增「AI 对话」独立页面 |
| 上下文注入 | 渐进式披露（工具调用），不一次性灌入全量数据 |
| 工具数据源 | 本地缓存优先，未命中时走现有 `WeReadClient` + `ApiCache` |
| 工具范围 | 微信读书 Skill 全量能力（书架、笔记、统计、搜索、书评、推荐等） |
| API 调用方式 | Rust 后端代理，复用现有 `WeReadClient`，API Key 不暴露给前端 |
| LLM API 格式 | 仅支持 OpenAI Chat 兼容格式 |
| Rust SDK | `async-openai` |
| API Key 存储 | 明文存入 `~/.weread-desktop/config.json`（应用私有空间） |
| 自定义模板存储 | `~/.weread-desktop/custom-templates/*.json`，每个模板一个文件 |
| 模板创建来源 | Chat 中保存 + 模板管理页手动创建 |
| 模板兼容性 | 同时支持 Agent CLI 和 AI Chat 两条路线 |
| 自由模板输出形态 | 保留现有 `report` / `slides` / `xiaohongshu` + 新增「不限」选项 |
| 隐私说明 | 配置 LLM API 时明确告知：划线原文和个人想法会发送到用户配置的 AI 服务 |

---

## 一、Rust 后端：LLM API 客户端模块

### 1.1 依赖变更

`src-tauri/Cargo.toml` 新增：
```toml
async-openai = "0.28"  # 或最新稳定版
futures = "0.3"         # Stream 处理
```

### 1.2 新增模块 `src-tauri/src/llm_chat.rs`

核心职责：调用用户自配的 OpenAI 兼容 API，支持流式输出和工具调用循环。

**数据结构：**
```rust
pub struct LlmClient {
    client: async_openai::Client<async_openai::config::OpenAIConfig>,
    model: String,
}
```

**配置字段（新增到 `AppConfig`）：**
```rust
pub llm_base_url: Option<String>,   // e.g. "https://api.openai.com/v1"
pub llm_api_key: Option<String>,
pub llm_model: Option<String>,       // e.g. "gpt-4o"
```

**核心方法：**
- `chat_completion_stream(messages, tools, on_delta, on_tool_call)` — 流式对话，处理 tool_calls
- 内置 tool-call 循环：收到 tool_calls → 执行工具 → 将结果作为 tool message 追加 → 继续对话

**工具定义（OpenAI function calling 格式）：**

| 工具名 | 说明 | 对应 WeReadClient 方法 |
|--------|------|----------------------|
| `get_bookshelf` | 获取书架数据 | `shelf_sync` |
| `get_reading_stats` | 获取阅读统计 | `reading_stats` |
| `get_book_notes` | 获取某本书的划线和想法 | `bookmark_list_with_cache` + `my_reviews_with_cache` |
| `get_notes_summary` | 获取有笔记的书列表 | `notebooks_with_cache` |
| `get_book_info` | 获取书籍详情 | `book_info` |
| `get_book_progress` | 获取阅读进度 | `book_progress` |
| `search_books` | 搜索书籍 | 新增 `store_search` |
| `get_book_reviews` | 获取公开书评 | 新增 `book_reviews` |
| `get_recommendations` | 个性化推荐 | 新增 `book_recommend` |
| `get_similar_books` | 相似书推荐 | 新增 `book_similar` |
| `save_report` | 保存报告 HTML 到本地 | 新增（写入 output 目录） |

**工具执行流程：**
1. AI 返回 `tool_calls`
2. Rust 后端解析工具名和参数
3. 先查 `ApiCache`，命中则直接返回
4. 未命中则调用 `WeReadClient` 对应方法，结果自动缓存
5. 将工具结果作为 `ToolMessage` 追加到对话历史
6. 继续调用 LLM 直到返回最终文本或新的 tool_calls

### 1.3 扩展现有 API 方法

在 `WeReadClient` 中新增：
- `store_search(keyword, scope, count, max_idx)` — 搜索
- `book_reviews(book_id, count, max_idx)` — 公开书评
- `book_recommend(count, max_idx)` — 个性化推荐
- `book_similar(book_id, count, max_idx, session_id)` — 相似推荐

### 1.4 系统提示词（渐进式披露）

```
你是书迹的阅读数据分析助手。用户通过微信读书积累了阅读数据，你可以通过工具获取这些数据来帮助用户分析阅读偏好、生成阅读报告。

## 可用工具

你可以调用以下工具获取用户数据：

### 书架与书籍
- get_bookshelf: 获取完整书架，包含所有在架书籍
- get_book_info: 获取某本书的详细信息（简介、目录、出版社等）
- get_book_progress: 获取某本书的阅读进度
- search_books: 在微信读书书城搜索书籍
- get_recommendations: 获取个性化推荐
- get_similar_books: 获取相似书籍推荐

### 笔记与划线
- get_notes_summary: 获取有笔记的书列表及数量
- get_book_notes: 获取某本书的具体划线和想法

### 阅读统计
- get_reading_stats: 获取阅读时长、天数、分类偏好等统计

### 书评
- get_book_reviews: 获取某本书的公开点评

## 数据使用原则

- 先获取摘要数据（如 get_notes_summary），再按需获取详情（如 get_book_notes）
- 不要一次性获取所有书的笔记，按用户需求逐步获取
- 引用数据时说明来源（书名、统计维度等）
- 时间戳转为 YYYY-MM-DD 格式，时长转为 X小时Y分钟 格式

## 报告生成

用户要求生成报告时：
1. 根据报告主题决定需要哪些数据
2. 逐步调用工具获取数据
3. 生成完整 HTML 报告
4. 调用 save_report 工具保存报告

报告必须是自包含单文件 HTML，底部标注数据来源。
```

---

## 二、前端：AI Chat 页面

### 2.1 新增依赖

`package.json` 新增：
```json
"@assistant-ui/react": "latest",
"@assistant-ui/react-markdown": "latest",
"@assistant-ui/react-ui": "latest"
```

### 2.2 新增路由 `/chat`

`src/App.tsx` 新增路由：
```tsx
<Route path="/chat" element={<ChatPage settings={settings.settings} />} />
```

### 2.3 侧边栏入口

`src/components/layout/Sidebar.tsx` 的 `navItems` 数组新增：
```tsx
{ to: "/chat", label: "AI 对话", icon: MessageCircle }
```

### 2.4 ChatPage 组件

`src/pages/ChatPage.tsx`：

- 使用 `@assistant-ui/react` 的 `Thread` 组件作为对话主界面
- 自定义 `useChatRuntime` 适配 Tauri 后端的流式 API
- 系统提示词包含工具定义和使用原则
- 对话中展示工具调用过程（用了哪个工具、获取了什么数据）
- 支持保存对话输出为报告 HTML
- 支持将当前对话的提示词保存为自定义模板

**数据流：**
```
用户输入 → 前端发送到 Tauri command
→ Rust LlmClient.chat_completion_stream()
→ 流式返回 delta + tool_calls
→ 前端实时渲染
→ tool_calls 时展示"正在查询书架..."等状态
→ 工具执行完成后继续对话
→ 最终输出报告 HTML
```

### 2.5 Tauri Commands 新增

```rust
#[tauri::command]
async fn start_llm_chat(
    app: AppHandle,
    messages: Vec<LlmMessage>,
    system_prompt: Option<String>,
) -> Result<String, String>

#[tauri::command]
async fn cancel_llm_chat(job_id: String) -> Result<bool, String>

#[tauri::command]
async fn save_llm_report(html: String, title: String) -> Result<String, String>

#[tauri::command]
async fn save_chat_as_template(
    name: String,
    description: String,
    prompt: String,
    style: Option<String>,
    output_shape: String,
    requires_raw_notes_consent: bool,
) -> Result<CustomTemplate, String>
```

---

## 三、自定义模板系统

### 3.1 存储格式

`~/.weread-desktop/custom-templates/*.json`：
```json
{
  "id": "custom-reading-habits-2026",
  "name": "我的阅读习惯分析",
  "description": "从时间分布、主题偏好和笔记方式分析个人阅读习惯",
  "category": "custom",
  "styleSummary": "私人档案、数据驱动",
  "styleMd": "整体风格克制...",
  "promptMd": "请分析我的阅读习惯...",
  "defaultReportPeriod": "all",
  "defaultOutputShape": "report",
  "outputShapes": ["report", "slides", "xiaohongshu", "free"],
  "requiresRawNotesConsent": true,
  "defaultCapabilities": ["profile.summary", "shelf.sync", "notes.notebooks", "reading.stats"],
  "optionalCapabilities": ["notes.bookmarks", "notes.reviews"],
  "createdAt": "2026-05-29T10:00:00+08:00",
  "source": "chat"
}
```

### 3.2 新增输出形态 `free`（不限）

在 `templates.rs` 的 `output_shapes()` 中新增：
```rust
BuiltinOutputShape {
    id: "free",
    name: "不限",
    description: "不约束输出形态，由内容决定最佳呈现方式",
    brief_md: "- 不限制版式、布局和视觉风格。\n- 根据内容特征自行决定最佳呈现方式。\n- 可以是长文、卡片、图表、清单或任何适合的形式。",
}
```

### 3.3 模板管理页面

在报告页的模板选择区域新增：
- 「我的模板」分组，展示用户自定义模板
- 「创建模板」按钮，打开创建弹窗
- 模板卡片支持编辑、删除、导出（JSON 文件）

### 3.4 模板在两条路线中的使用

**Agent CLI 路线：**
- 自定义模板出现在智能体模板列表中
- 点击后进入现有的 GenerationSettings 配置界面
- 生成流程与内置模板完全一致

**AI Chat 路线：**
- 选择自定义模板后，将 promptMd 注入为系统提示词的一部分
- 用户在 Chat 中继续对话、调整、迭代

---

## 四、设置页：LLM API 配置

### 4.1 新增配置区域

`src/pages/SettingsPage.tsx` 新增「AI 服务配置」区块：

- **Base URL** 输入框（placeholder: "https://api.openai.com/v1"）
- **API Key** 输入框（带显示/隐藏切换）
- **模型名称** 输入框（placeholder: "gpt-4o"）
- **测试连接** 按钮（发送一条简单消息验证配置）
- **隐私说明文案**：

> **数据边界说明**
>
> 配置 AI 服务后，你在对话中请求分析阅读数据时，划线原文和个人想法会发送到你配置的 AI 服务（如 OpenAI）。这些数据不会发送到书迹的服务器。
>
> - 书架、阅读统计等摘要数据风险较低
> - 划线原文和个人想法属于较私密的内容
> - 请确保你信任所配置的 AI 服务

### 4.2 AppConfig 扩展

`src-tauri/src/types.rs` 的 `AppConfig` 新增字段：
```rust
pub llm_base_url: Option<String>,
pub llm_api_key: Option<String>,
pub llm_model: Option<String>,
```

`AppSettings` 新增对应字段：
```rust
pub llm_configured: bool,
pub llm_base_url: Option<String>,
pub llm_model: Option<String>,
// 注意：不暴露 llm_api_key 给前端，只暴露是否已配置
```

---

## 五、隐私与安全

| 项目 | 处理方式 |
|------|----------|
| LLM API Key | 明文存入 `~/.weread-desktop/config.json`（用户决策） |
| 微信读书 API Key | 不暴露给前端，Rust 后端代理所有请求 |
| 数据传输 | 用户配置 LLM API 后，划线原文会发送到第三方服务 |
| 隐私披露 | 设置页配置时显示数据边界说明；Chat 页面顶部显示当前 AI 服务信息 |
| 本地缓存 | 工具调用结果缓存在 `~/.weread-desktop/cache/api/`，复用现有缓存机制 |

---

## 六、实现顺序

### Phase 1：基础搭建
1. `AppConfig` 新增 LLM 配置字段
2. 设置页新增 AI 服务配置 UI + 隐私说明
3. 新增 `free` 输出形态

### Phase 2：Rust 后端 LLM 模块
4. 引入 `async-openai` 依赖
5. 实现 `llm_chat.rs`（LlmClient + 工具定义 + 工具执行 + 流式输出）
6. 扩展 `WeReadClient`（搜索、书评、推荐接口）
7. 注册 Tauri Commands

### Phase 3：AI Chat 前端
8. 引入 `@assistant-ui/react` 依赖
9. 实现 `ChatPage.tsx`（对话界面 + 流式渲染 + 工具调用展示）
10. 侧边栏新增入口 + 路由注册

### Phase 4：自定义模板
11. 实现 `custom_templates.rs`（CRUD + 文件读写）
12. 前端模板管理 UI（创建、编辑、删除、导出）
13. 自定义模板在 Agent CLI 和 AI Chat 中的复用
14. Chat 中「保存为模板」功能

### Phase 5：验收
15. `./init.sh` 全量验证
16. 更新 `feature_list.json`、`progress.md`、`session-handoff.md`

---

## 七、测试计划

| 场景 | 验证方式 |
|------|----------|
| LLM API 配置 | 填入 base URL + key + model，点击测试连接，验证返回 |
| 基础对话 | 发送"帮我看看今年读了多久"，验证 AI 调用 get_reading_stats 并返回结果 |
| 工具调用链 | 发送"分析我的阅读偏好"，验证 AI 依次调用多个工具并综合分析 |
| 流式输出 | 验证对话内容实时逐字显示 |
| 工具调用状态 | 验证工具执行时显示"正在查询书架..."等状态提示 |
| 报告生成 | 要求生成报告，验证 HTML 保存到本地并可打开 |
| 保存为模板 | 从 Chat 保存为模板，验证出现在自定义模板列表中 |
| 自定义模板 + CLI | 用自定义模板通过 Agent CLI 生成报告，验证流程正常 |
| 自定义模板 + Chat | 用自定义模板在 Chat 中生成报告，验证 prompt 注入正确 |
| free 输出形态 | 选择「不限」形态生成报告，验证 AI 自由决定输出形式 |
| 隐私说明 | 验证设置页和 Chat 页的数据边界说明正确显示 |
| 缓存命中 | 重复请求同一数据，验证第二次走缓存（检查日志） |
| 缓存未命中 | 请求未缓存数据，验证自动调用 WeRead API |

---

## 八、假设与约束

- 用户已配置微信读书 API Key（否则工具调用无法获取数据）
- 用户自备 OpenAI 兼容 API 的 base URL 和 key
- 仅支持 OpenAI Chat Completions 格式，不支持 Anthropic、Gemini 等其他格式
- 工具调用依赖 LLM 支持 function calling（如 GPT-4o、Claude via proxy 等）
- 自定义模板的 `requiresRawNotesConsent` 由创建者自行设定
