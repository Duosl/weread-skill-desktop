# AI Chat Skill-aware Agent 实施方案

最后更新：2026-05-29

## 目标

把 AI Chat 从“手写工具循环原型”调整为“内嵌式 Skill-aware Agent”。

新方案保留当前原型中有价值的部分：LLM 配置入口、Chat 页面雏形和 Tauri 后端代理。同时复用书迹现有 `WeReadClient` 数据访问层、`ApiCache` 请求缓存/日志和报告导出模块。AI Chat 新增的是 Skill-aware 编排层、统一网关、隐私授权和对话展示，不新增另一套微信读书数据层或缓存层。需要替换的是当前 `llm_chat.rs` 中硬编码 system prompt、硬编码工具 schema、手写 tool-call loop 以及前端拼接 tool_call 历史的实现方式。

最终形态：

```text
React Chat UI
  -> Tauri command: start_ai_chat
  -> Embedded Agent Runtime
  -> invoke_data_gateway unified gateway
  -> Bundled Markdown Skill + allowlist validation + privacy gates
  -> existing WeReadClient gateway + ApiCache / report export / template storage
  -> streamed events back to UI
```

## 产品边界

书迹仍然是微信读书数据导出与管理桌面工具，不扩展成微信读书客户端。

基础页面继续不提供书城推荐、相似书推荐、公共书评浏览或社交社区功能。

AI Chat 可以提供 AI-only 能力，例如：

- 基于用户书架和阅读统计给出下一本书建议。
- 用户明确指定某本书时，查询相似书用于辅助推荐。
- 用户明确要求参考公共反馈时，摘要公开书评。

这些能力只在对话中按用户意图触发，不新增浏览型页面，不做信息流、榜单、书城入口或公共书评页。

## 核心判断

Skill 是能力说明书，不是执行器。

AI 能通过 Skill 调用应用内服务，但必须经过统一工具网关：

```text
Bundled Skill 告诉 AI：有什么能力、什么时候用、参数怎么填、回包怎么解释、分页和单位是什么
Agent runtime 决定：调用 invoke_data_gateway
Rust gateway 执行：校验 api_name、校验 request、检查隐私授权、调用白名单服务
```

不要实现开放插件系统。V1 是闭合、内嵌、可审计的系统：

- 技能配置随 Tauri resources 打包。
- 不扫描外部任意目录。
- Markdown skill 可以动态调整能力说明、接口参数、回包解释、分页规则、单位口径和工作流。
- 机器可读 manifest 只作为 Rust 侧白名单、隐私等级和参数校验的辅助，不替代 Markdown skill。
- 新增真实能力仍然需要 Rust gateway 显式实现分支。

## 技术路线

推荐路线：

1. 保留现有 React Chat 页面作为 UI 原型，但重写事件协议。
2. 保留 `AppConfig` 中 LLM 配置字段，并修复已配置后 API Key 留空更新的问题。
3. 新增 `src-tauri/skills/weread/SKILL.md` 和能力说明文件，作为内置 Markdown Skill 声明；这些文档说明接口语义，不直接代替统一数据网关执行。
4. 新增 `skill_registry.rs`，启动时加载 skill 文档和可选 manifest。
5. 新增 `agent_gateway.rs`，实现统一数据网关工具 `invoke_data_gateway`；Skill 文档只定义接口语义，网关负责校验、授权和执行。
6. 新增或重写 `ai_chat.rs`，用 Agent SDK 或受控 runtime 管理 tool loop。
7. Gateway 内部复用现有 `WeReadClient` 的统一 gateway 请求链路和 `ApiCache`，不重写微信读书 API 层和缓存逻辑。

推荐、相似书、公开书评即使当前基础页面没有入口，也可以作为 AI-only 能力走同一条内部请求链路。实现上优先让 `agent_gateway` 调用 `WeReadClient` 的通用 gateway 方法，自动复用 `skill_version` 注入、错误处理、`upgrade_info` 检查、请求日志和 `ApiCache`。只有某些结果需要强类型解析或复用已有业务模型时，才补充轻量 `WeReadClient` 包装方法。它们不由 Chat 前端直接实现，也不绕过统一网关。

当前 `WeReadClient` 已有 `gateway_value_with_cache(api_name, params, force_refresh)` 作为真实请求与缓存入口。后续实现时应把它调整为 `pub(crate)` 或提供等价的 crate 内部方法给 `agent_gateway` 使用，而不是在 AI Chat 模块复制 HTTP 请求、错误处理或缓存写入代码。

如果 SDK 兼容用户自定义 OpenAI-compatible Base URL 和流式工具调用，优先用 SDK 管理 agent loop。若 Rig 或 OpenAI Agents SDK 在桌面端、Base URL、流式事件上存在限制，允许保留一个极薄 runtime，但必须把工具定义、参数校验、隐私拦截和执行路由移出 LLM loop。

## 当前 ChatPage 评估

当前 `src/pages/ChatPage.tsx` 可以作为原型验证入口，但不适合作为正式功能直接交付。

可保留：

- `/chat` 路由和侧边栏入口。
- 未配置 LLM 时的空状态和跳转设置入口。
- 基础对话布局：消息列表、输入框、发送、停止。
- Assistant 流式文本渲染。
- 复制回答、清空对话等低风险交互。

必须重做：

- 工具调用历史：前端当前用时间戳伪造 tool call id，并按工具名匹配结果；同名多次调用时会错配，后续对话可能失败。
- 事件隔离：当前 `llm-chat-event` 没有 `jobId`，旧任务、并发任务或页面重进后的事件可能污染当前会话。
- 报告保存：当前 `save_report` 只是伪工具，用户要求保存报告时不会真实落盘。
- 隐私授权：读取划线原文和个人想法前缺少本轮显式确认。
- 工具状态展示：只显示“正在查询数据…”，没有说明正在读取什么、是否涉及敏感数据、数据来自哪里。
- 保存模板：当前使用 `prompt()` / `alert()`，不符合正式桌面产品体验，也缺少隐私和输出形态确认。
- 调试日志：生产界面不应默认暴露“显示日志”和内部事件文本。
- 前端拼接 tool history：正式实现中应由 agent runtime 管理工具调用历史，前端只负责展示消息和事件。

正式体验要求：

- 用户能看见 AI 正在调用的具体能力，例如“读取阅读统计”“查询有笔记的书”“读取《某书》的划线原文”。
- 涉及敏感数据时，界面要说明会读取什么、为什么需要、会发送到哪里，并让用户确认。
- 报告保存成功后展示文件路径和后续动作。
- AI 回答中引用用户数据时，要能表达来源，不把内部字段名暴露给普通用户。
- 推荐、相似书和公开书评必须以 AI-only 形式呈现，不新增基础浏览页面。

结论：保留页面骨架，按本文档的事件协议、隐私授权和 Skill Gateway 重新实现交互内核。

## Bundled Skill 格式

内置技能应采用和 `~/.agents/skills/weread-skills/` 接近的 Markdown skill 包，而不是把能力拆成一组孤立 JSON。Markdown 是给 AI 和开发者看的操作手册，负责解释接口入参、回包、分页、单位、统计口径和工作流。

推荐目录：

```text
src-tauri/skills/weread/
  SKILL.md
  search.md
  book.md
  shelf.md
  readdata.md
  notes.md
  review.md
  discover.md
  manifest.json       # 可选：给 Rust 做白名单和隐私校验，不替代 Markdown 文档
```

Tauri 配置中打包：

```json
{
  "bundle": {
    "resources": ["skills/**/*"]
  }
}
```

关键变化不是把接口文档改成 JSON，而是把原 `weread-skills` 的远程统一入口换成书迹应用内统一入口：

```text
原 weread-skills:
POST https://i.weread.qq.com/api/agent/gateway
Authorization: Bearer $WEREAD_API_KEY
Body: { "api_name": "/store/search", ... }

书迹 AI Chat:
tool invoke_data_gateway
arguments: { "api_name": "/store/search", ... }
Rust gateway 从 AppConfig / RuntimeState 使用已配置的 WeReadClient 执行
```

`SKILL.md` 仍然负责：

- 支持能力表。
- 统一入口说明。
- 通用调用规则。
- `upgrade_info` 处理规则。
- 参数平铺规则。
- 能力文档预检规则。
- 字段解释优先级。
- bookId 解析规则。
- 时间戳、阅读时长和计数口径。
- 深度链接格式。

能力文件仍然负责：

- 每个接口的 `api_name`。
- 入参、必填项和 few-shot。
- 回包结构和字段含义。
- 分页规则。
- 工作流。
- 输出展示规范。

需要替换或删除：

- 不再要求用户设置 `WEREAD_API_KEY` 环境变量。
- 不再暴露远程 base URL 给 AI。
- 不再让 AI 自己处理 HTTP Header。
- 统一入口改为 `invoke_data_gateway`。
- `skill_version` 可以保留为 skill 文档版本，用于本地 prompt 和 gateway 兼容检查；不要求模型每次手写，最好由 gateway 自动补齐。

`SKILL.md` 示例片段：

````markdown
---
name: shuji-weread
description: 书迹内置微信读书数据能力声明。Skill 文档定义接口语义、参数、返回值和工作流；实际数据获取通过应用内统一数据网关执行。
version: 1.0.0
---

# 书迹 WeRead Skill

所有数据获取都必须通过统一数据网关，不得直接拼请求或绕过网关。需要读取数据时，调用 `invoke_data_gateway`。

## 统一入口

工具名：`invoke_data_gateway`

参数：

```json
{
  "api_name": "/store/search",
  "keyword": "三体",
  "scope": 10
}
```

业务参数必须平铺在同一层，不要包在 `params`、`data` 或 `body` 里。

## 支持能力

| 能力 | 说明 | 用户示例 | 详细说明 |
| --- | --- | --- | --- |
| 搜索书籍 | 搜索书籍、作者、文章等 | "帮我搜一下三体" | `search.md` |
| 书籍信息 | 详情、目录、阅读进度 | "我读到哪了" | `book.md` |
| 书架 | 查看书架 | "看看我的书架" | `shelf.md` |
| 阅读统计 | 阅读时长、天数、偏好 | "今年读了多久" | `readdata.md` |
| 笔记划线 | 笔记概览、划线和想法 | "看看我在三体里的笔记" | `notes.md` |
| 公开书评 | 摘要公开点评 | "这本书大家怎么评价" | `review.md` |
| 推荐 | 个性化推荐、相似推荐 | "给我推荐几本书" | `discover.md` |
````

可选 `manifest.json` 只给 Rust 使用，帮助 registry 快速得到白名单、隐私等级和 handler 映射：

```json
{
  "name": "shuji-weread",
  "version": "1.0.0",
  "gateway_tool": "invoke_data_gateway",
  "apis": {
    "/book/bookmarklist": {
      "handler": "book_bookmark_list",
      "doc": "notes.md",
      "privacy_level": "sensitive",
      "requires_consent": true,
      "visibility": "core",
      "required": ["bookId"]
    },
    "/review/list/mine": {
      "handler": "review_list_mine",
      "doc": "notes.md",
      "privacy_level": "sensitive",
      "requires_consent": true,
      "visibility": "core",
      "required": ["bookid"]
    },
    "/store/recommend": {
      "handler": "store_recommend",
      "doc": "discover.md",
      "privacy_level": "low",
      "requires_consent": false,
      "visibility": "ai-only",
      "required": []
    }
  }
}
```

`manifest.json` 约束：

| 字段 | 说明 |
| --- | --- |
| `apis` | Rust gateway 允许调用的 API 白名单。 |
| `handler` | Rust gateway 中的静态 handler 名，不允许模型动态决定。 |
| `doc` | 对应 Markdown 能力文档。 |
| `privacy_level` | `low`、`medium`、`sensitive`、`local-write`。 |
| `requires_consent` | 是否需要前端本轮授权。 |
| `visibility` | `core`、`ai-only` 或 `internal`。 |
| `required` | 最小必填参数检查；详细语义仍以 Markdown 文档为准。 |

## 首批技能清单

Core 数据能力：

| Skill | 隐私 | 说明 |
| --- | --- | --- |
| `get_bookshelf` | low | 获取书架概览，用于阅读偏好、已读/在读分析。 |
| `get_reading_stats` | low | 获取阅读时长、天数、分类等统计。 |
| `get_notes_summary` | medium | 获取有笔记的书列表和数量，不读取原文。 |
| `get_book_info` | low | 获取指定书籍基础信息。 |
| `get_book_progress` | low | 获取指定书籍阅读进度。 |
| `get_book_notes` | sensitive | 获取指定书籍划线原文和个人想法。 |
| `search_books` | low | 在用户要求查找书籍或 bookId 时使用。 |
| `export_report_html` | local-write | 保存 AI 生成的报告 HTML。 |

AI-only 推荐能力：

| Skill | 隐私 | 说明 |
| --- | --- | --- |
| `get_recommendations` | low | 用户明确要求推荐时使用。 |
| `get_similar_books` | low | 用户围绕指定书籍要求相似阅读时使用。 |
| `get_public_reviews` | medium | 用户明确要求参考公开评价时使用，只做摘要，不做公共书评浏览页。 |

## 统一网关

Agent 只看到一个工具。它传入的参数形态应尽量接近原 `weread-skills` 远程 gateway 的 body，只是入口从 HTTP 变成应用内工具：

```text
invoke_data_gateway(request)
```

工具 schema：

```json
{
  "type": "object",
  "properties": {
    "api_name": {
      "type": "string",
      "description": "微信读书能力接口名，例如 /store/search、/shelf/sync、/review/list/mine"
    }
  },
  "required": ["api_name"],
  "additionalProperties": true
}
```

Gateway 执行顺序：

1. 检查 `api_name` 是否在 manifest 白名单中。
2. 按 manifest 做最小必填参数检查；详细语义以对应 Markdown 文档为准。
3. 自动补齐本地需要的 `skill_version`、缓存策略或上下文字段，不要求模型手写。
4. 根据 `privacy_level` 和 `requires_consent` 检查本轮授权状态。
5. 检查产品边界和调用上下文，例如 AI-only 能力只能来自 Chat。
6. 根据 manifest 中的静态 `handler` 进入 Rust `match` 分支。
7. 调用 `WeReadClient::gateway_value_with_cache` 或现有强类型包装方法、报告导出或模板模块。
8. 对大结果做结构化摘要或截断，避免把全量数据塞回模型。
9. 记录审计日志并向前端发事件。

Gateway 不允许：

- 让模型传任意 API path。
- 读取未注册资源文件。
- 访问任意本地文件。
- 绕过原文授权读取划线原文和个人想法。
- 根据模型传入的 handler 名动态执行函数。

## Agent Prompt 组合

不要继续把所有工具说明硬编码在 `llm_chat.rs`。

每轮 Chat 启动时动态组合：

1. 固定基础身份：
   - 你是书迹的阅读数据分析助手。
   - 使用中文回答。
   - 不编造数据，不展示内部字段名给普通用户。
   - 时长字段按 weread skill 文档解释，输出为易读时长。

2. 产品边界：
   - 书迹不是微信读书客户端。
   - 基础浏览能力不扩展到书城页面。
   - AI-only 推荐能力只在用户明确请求时调用。

3. Skill registry 摘要：
   - `SKILL.md` 总规范、能力表、相关能力文档摘要、manifest 中的隐私等级和可调用 API 白名单。

4. 隐私规则：
   - `sensitive` 技能需要用户授权。
   - 未授权时不能调用，也不能编造原文证据。

5. 输出规则：
   - 普通问答输出 Markdown。
   - 用户要求报告时生成完整自包含 HTML，并调用 `export_report_html`。
   - 引用用户数据时说明数据来源，如“书架”“阅读统计”“某书划线”。

## 隐私与授权

隐私等级：

| 等级 | 示例 | 默认行为 |
| --- | --- | --- |
| `low` | 书架、阅读统计、书籍基础信息、相似书、推荐 | 可直接调用，但需在设置页说明会发送给用户配置的 AI 服务。 |
| `medium` | 笔记数量、公开书评摘要 | 可调用，但回答中避免暗示这是用户私人内容。 |
| `sensitive` | 划线原文、个人想法、书摘、读后感 | 必须本轮显式确认。 |
| `local-write` | 保存报告、保存模板 | 需要展示保存结果和路径。 |

前端需要支持授权事件：

```text
agent requests sensitive skill
  -> backend emits consent_required
  -> frontend shows modal with consent_copy
  -> user approves or denies
  -> backend resumes or returns denial tool result
```

V1 可以先做简化：如果 Chat 请求 sensitive 技能而本轮未授权，后端返回结构化错误，前端弹出授权确认后让用户重新发送或自动重试。后续再做可暂停/恢复的 agent run。

## 事件协议

建议替换当前无 job 隔离的事件：

```ts
type AiChatEvent =
  | { type: "run_started"; jobId: string }
  | { type: "message_delta"; jobId: string; content: string }
  | { type: "skill_started"; jobId: string; callId: string; skillName: string; title: string }
  | { type: "skill_completed"; jobId: string; callId: string; skillName: string; summary: string }
  | { type: "consent_required"; jobId: string; callId: string; skillName: string; copy: string }
  | { type: "report_saved"; jobId: string; title: string; filePath: string }
  | { type: "run_completed"; jobId: string }
  | { type: "run_failed"; jobId: string; error: string }
  | { type: "run_canceled"; jobId: string };
```

要求：

- 所有事件必须带 `jobId`。
- 工具事件必须带真实 `callId`，不能由前端用时间戳伪造。
- 前端只展示当前 job 的事件。
- 历史对话不需要由前端拼接 raw tool messages，agent runtime 自己维护内部 tool history。

## 模块拆分

建议新增或调整：

```text
src-tauri/src/skill_registry.rs
  - SkillPackage
  - load_bundled_skills(app)
  - load_markdown_docs()
  - load_manifest()
  - render_skills_prompt()
  - validate_gateway_request(request)

src-tauri/src/agent_gateway.rs
  - GatewayArgs
  - GatewayResult
  - invoke_data_gateway()
  - handler match 分支

src-tauri/src/ai_chat.rs
  - start_ai_chat()
  - cancel_ai_chat()
  - agent runtime / SDK adapter
  - event emission

src-tauri/skills/weread/
  - SKILL.md
  - search.md / book.md / shelf.md / readdata.md / notes.md / review.md / discover.md
  - manifest.json（可选，Rust 白名单和隐私校验）
```

当前原型中需要迁移：

| 当前位置 | 处理 |
| --- | --- |
| `src-tauri/src/llm_chat.rs` | 替换为 `ai_chat.rs` 或大幅缩减为 SDK adapter。 |
| `build_tools()` | 删除，改为 registry 渲染 Markdown skill prompt + 单 gateway tool。 |
| 硬编码 `SYSTEM_PROMPT` | 拆成固定基础 prompt + skills prompt。 |
| `ChatPage` 拼接 tool history | 删除，改为只发送用户/助手文本历史或 thread id。 |
| `save_report` 假工具 | 改为 gateway 真实保存，并发 `report_saved` 事件。 |
| `store_search` scope 字符串 | 改为 weread skill 文档要求的整数枚举。 |

## SDK 选择

优先级：

1. 能使用用户配置的 OpenAI-compatible Base URL、API Key、Model。
2. 支持流式输出。
3. 支持工具调用循环。
4. 支持 Rust / Tauri async 环境。
5. 不强制把用户数据发送到第三方平台以外的遥测系统。

候选：

- Rig：Rust 原生，适合 Tauri 后端；需要验证 OpenAI-compatible Base URL、streaming tool-call、统一 gateway 的实现成本。
- OpenAI Agents SDK：Agent 能力成熟；需要验证 Rust/Tauri 集成路径和自定义 Base URL 支持。
- 保留 `async-openai`：兼容当前代码；如果继续使用，必须只保留最薄 runtime，不再把工具定义和执行规则写死在 loop 内。

V1 决策建议：

- 先做一个 `AgentRuntime` trait，隔离 SDK。
- 默认实现可以用 Rig 或 `async-openai` thin runtime。
- Gateway、Markdown skill registry、隐私拦截不依赖具体 SDK。

```rust
#[async_trait]
pub trait AgentRuntime {
    async fn run(
        &self,
        input: AiChatInput,
        gateway: Arc<AgentGateway>,
        events: AiChatEventSink,
    ) -> Result<(), String>;
}
```

## 迁移步骤

### 阶段 0：清理原型风险

- 删除未跟踪的临时测试文件。
- 保留 `aichat-plan.md` 仅作历史草案，后续入口改为本文档。
- 修复 LLM 设置页 API Key 留空更新问题。

### 阶段 1：Skill registry

- 新增 `src-tauri/skills/weread/`。
- 复制并改写 `weread-skills` 的 Markdown skill 结构：`SKILL.md`、`search.md`、`book.md`、`shelf.md`、`readdata.md`、`notes.md`、`review.md`、`discover.md`。
- 删除远程 gateway、环境变量和 HTTP Header 说明，改为应用内 `invoke_data_gateway`。
- 添加可选 `manifest.json`，用于 Rust 白名单、handler 映射、隐私等级和最小必填参数校验。
- 配置 Tauri resources。
- 启动时加载 Markdown 文档和 manifest 到 `RuntimeState` 或独立 `SkillRegistry`。

### 阶段 2：Unified Gateway

- 实现 `invoke_data_gateway`。
- 接入现有 `WeReadClient::gateway_value_with_cache` 和 `ApiCache`，必要时把该方法调整为 crate 内部可见；不要在 AI Chat 模块复制请求和缓存代码。
- 按 weread skill 文档校准参数：
  - `search_books.scope` 使用整数枚举。
  - `/user/notebooks` 使用 `lastSort` 分页。
  - `/review/list/mine` 使用 `bookid`、`synckey`、`count`。
  - 时长全部按秒解释。
- 实现 `export_report_html` 真实落盘。

### 阶段 3：Agent runtime

- 移除硬编码多工具注册。
- 注册单个 `invoke_data_gateway`。
- 动态注入 skill prompt。
- 流式输出事件统一带 `jobId`。
- 后端维护 tool call history，前端不再拼接。

### 阶段 4：前端 Chat 体验

- 保留 `/chat` 路由。
- 保留当前 `ChatPage` 的基础页面骨架，但不要沿用前端拼 tool history、伪造 call id、可见调试日志和 `prompt()` / `alert()` 保存模板。
- 根据新事件协议渲染：
  - 输出流。
  - 当前正在调用的技能。
  - 敏感数据授权。
  - 报告保存结果。
- 去掉可见调试日志，开发态可保留隐藏日志。

### 阶段 5：验收与回归

- `npm run frontend:typecheck`
- `npm run frontend:build`
- `cd src-tauri && cargo check`
- `git diff --check`
- 至少手动验证：
  - 未配置 LLM 时进入 Chat 的提示。
  - 已配置 LLM 后普通问答。
  - 调用低敏技能获取阅读统计。
  - 请求划线原文时出现授权拦截。
  - 用户要求保存报告时真实生成 HTML 文件。
  - 用户要求推荐时只在 Chat 内返回建议，不新增基础页面入口。

## 验收标准

- AI Chat 不再依赖硬编码多工具 schema。
- Markdown Skill 包是 AI 可见能力、接口说明、字段解释和工作流的唯一文档入口。
- 可选 manifest 只服务 Rust 白名单、隐私等级和最小参数校验。
- Rust Gateway 是应用内服务调用的唯一执行入口。
- 所有工具调用有 `jobId` 和真实 `callId`。
- 推荐、相似书、公开书评为 AI-only 能力，不改变基础产品边界。
- 敏感数据读取必须经过授权，未授权时不读取、不编造。
- 报告保存工具真实落盘。
- weread API 参数和单位以 `~/.agents/skills/weread-skills/` 文档为准。

## 不做

- 不做外部任意目录 Skill 扫描。
- 不做用户安装第三方 Skill。
- 不做完整 MCP server。
- 不做书城推荐页面。
- 不做公共书评浏览页。
- 不让模型调用任意网关 API path。
- 不把 API Key 暴露给前端或模型上下文。
