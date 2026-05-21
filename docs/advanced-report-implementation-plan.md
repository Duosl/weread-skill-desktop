# 智能体报告实现方案

本文记录 `REQ-007 HTML 阅读报告生成器` 下一阶段的具体落地方案。目标是让智能体报告成为“本地 Agent 自主探索微信读书数据并生成千人千面 HTML 报告”的能力，而不是固定模板填充数据。

---

## 1. 产品目标

智能体报告与基础报告分层：

- 基础报告：应用内确定性模板渲染，快速、稳定、可预测。
- 智能体报告：本地 Agent 生成完整 HTML，模型决定报告结构、叙事、视觉和取数策略。

智能体报告的模板只提供风格与任务约束，不固定 UI 结构，也不固定要展示的数据模块。

必须保留的边界：

- 普通 Markdown 导出页保持现有工作台，不改成模板目录。
- 阅读报告页展示基础模板和智能体模板。
- 智能体模板点击后进入接近全屏的报告工作台。
- 应用负责数据、缓存、隐私确认、任务状态、文件落地和系统打开。
- Agent 负责数据探索、分析、报告结构和 HTML/CSS 生成。

---

## 2. 当前已完成基础

已接入本地 `agent-cli-bridge`：

- `src-tauri/Cargo.toml`
  - `agent-cli-bridge = { path = "../../agent-cli-bridge" }`
- `src-tauri/src/agent_bridge.rs`
  - `detect_local_agents`
  - `invoke_local_agent`
  - `cancel_local_agent`
  - 按 `job_id` 在 `RuntimeState` 注册取消句柄
  - 通过 Tauri 事件 `agent-invoke-event` 转发 agent 输出
- `src/hooks/useAgentBridge.ts`
  - 前端检测本地 agent
  - 前端调用本地 agent
  - 前端取消指定 `jobId` 的 agent 调用
  - 前端监听 agent 流式事件
- `src-tauri/src/advanced_report.rs`
  - `list_advanced_report_templates`
  - `create_advanced_report_job`
  - `read_advanced_report_output`
  - `export_advanced_report_output`
  - 创建 `reports/jobs/<job-id>/` 工作区
  - 写入 `input/brief.md` 作为 Agent 唯一任务入口
  - 写入 `input/template.json`、`style.md`、`prompt.md`、`user-policy.json`、`capabilities.json`、`cache-index.json` 作为机器索引和策略备份
  - 写入 `input/agent-prompt.md`，只负责指向 `input/brief.md`
  - 预取默认数据到 `data/`
- `src/hooks/useAdvancedReport.ts`
  - 前端读取智能体模板清单
  - 前端创建智能体报告 job 工作区
  - 前端读取 `output/report.html`
  - 前端导出智能体报告 HTML
- `RuntimeState`
  - 维护后台智能体报告任务列表
  - 支持多个任务同时运行
  - 页面关闭或切换后任务继续运行

当前 `agent-cli-bridge` 的真实能力：

- 检测本地安装的 agent CLI。
- 启动 agent 子进程。
- 通过 stdin/argv/argv-message 传入 prompt。
- `model` 会透传到 CLI 参数。
- `Argv` / `ArgvMessage` 协议会把 prompt 拼到位置参数或 `--message <prompt>`。
- 支持取消句柄，取消时 kill 子进程并输出 `Canceled`。
- 解析 stdout JSON，输出 `Start` / `Delta` / `Html` / `Meta` / `Stderr` / `Raw` / `Canceled` / `Done` / `Error`。

参考 `/Users/duoshilin/duosl/forks/html-anything` 后确认：`html-anything` 也是同一类通信模型，不是运行中双向 RPC。它的链路是 Next.js server route spawn 本地 agent，stdout JSON-line 转为 SSE 推给前端。可借鉴的是工程细节，而不是双向 tool-call：

- `AbortController` / request abort 触发子进程取消。
- `promptBytes`、`bin`、`argv` 等启动信息进入流式日志。
- `model` 会被传入 argv 构造。
- `argv` / `argv-message` 协议会把 prompt 拼到位置参数或 `--message`。
- 从 Claude / Cursor / Gemini / Qoder 的 file-write tool_use 中 rescue HTML。
- 前端按事件流更新日志、统计和预览。

当前限制：

- 它不是运行中双向 RPC bridge。
- Agent 运行中不能直接回调 Tauri 命令。
- 第一版仍采用文件工作区协议；如果 Agent 需要更多数据，可写 `output/data-requests.json`，由应用二次补数据后重新调用。
- 真实 CLI 运行已接入“调用本地 Agent”按钮；当前按单次任务结束后读取 output，后续可扩展为轮询或二次补数据。
- 输出读取会做基础质量校验：分析版是否过短、是否使用“你”作为主语、是否残留“这个用户/该用户”、是否包含 `WeRead Skill Desktop` 标识。
- 前端交互已收敛为“报告任务中心”：不暴露 Agent、模型、路径等复杂概念；用户从智能体模板直接开始生成，应用自动选择可用本地 CLI，并使用用户 CLI 的默认模型配置。
- 智能体模板状态直接显示在模板卡片上，不再在页面底部维护单独的“正在生成 / 最近完成”列表。
- 智能体模板卡片提供“历史”入口，可查看该模板的生成记录；记录合并运行中内存任务和本地 `reports/jobs/*/job.json` / `task.json`，支持应用重启后恢复历史。
- 第一版不做 detached 后台进程。应用退出会中断运行中的 Agent；重启后如果 job 没有 `output/report.html`，历史中明确显示为已中断 / 未完成，而不是继续显示生成中。
- 历史记录支持删除单个 job；运行中的 job 必须先取消，避免删除 Agent 正在使用的工作目录。
- 同一个智能体模板同一时间只允许一个活跃任务；不同模板仍可同时生成。
- 当前版本不支持分享版，应用只要求输出完整报告 HTML。

因此第一版智能体报告应采用“准备 job 工作区 -> 启动 agent -> agent 读写工作区文件 -> 应用监听结果”的文件协议，而不是运行中 tool-call RPC。

---

## 3. 总体架构

```text
ReportPage
  -> advanced_report Tauri commands
    -> reports/jobs/<job-id>/ 工作区
      -> agent-cli-bridge
        -> local agent CLI
          -> 读取 input/
          -> 按需读取 data/
          -> 写入 output/report.html
```

核心模块：

| 模块 | 位置 | 职责 |
|------|------|------|
| Agent Bridge | `src-tauri/src/agent_bridge.rs` | 检测和调用本地 agent CLI |
| Advanced Report | `src-tauri/src/advanced_report.rs` | 模板扫描、job 创建、数据准备、agent 调用、产物读取 |
| WeRead Data Broker | `src-tauri/src/report_data_broker.rs` | 按能力读取微信读书数据，优先缓存 |
| Report Page | `src/pages/ReportPage.tsx` | 展示基础/智能体模板、job 状态、预览和导出 |
| Agent Hook | `src/hooks/useAgentBridge.ts` | 监听 agent 输出流 |
| Advanced Report Hook | `src/hooks/useAdvancedReport.ts` | 封装智能体报告 job 生命周期 |

---

## 4. 目录结构

使用应用私有目录承载模板、job、缓存和预览。

```text
AppData/
└── reports/
    ├── templates/
    │   ├── personality/
    │   │   ├── template.json
    │   │   ├── style.md
    │   │   └── prompt.md
    │   ├── knowledge-map/
    │   │   ├── template.json
    │   │   ├── style.md
    │   │   └── prompt.md
    │   └── growth-path/
    │       ├── template.json
    │       ├── style.md
    │       └── prompt.md
    ├── jobs/
    │   └── <job-id>/
    │       ├── input/
    │       │   ├── template.json
    │       │   ├── style.md
    │       │   ├── prompt.md
    │       │   ├── user-policy.json
    │       │   ├── capabilities.json
    │       │   └── cache-index.json
    │       ├── data/
    │       │   ├── shelf.sync.json
    │       │   ├── notebooks.all.json
    │       │   ├── reading-stats.year.json
    │       │   └── books/
    │       │       └── <book-id>/
    │       │           ├── info.json
    │       │           ├── progress.json
    │       │           ├── bookmarks.json
    │       │           └── reviews.json
    │       ├── output/
    │       │   ├── report.html
    │       │   ├── report.meta.json
    │       │   └── debug.md
    │       ├── agent-output.ndjson
    │       └── job.json
    └── preview/
```

---

## 5. 智能体模板包

智能体模板不是固定 UI 模板，而是报告风格和任务意图。

`template.json`：

```json
{
  "id": "knowledge-map",
  "name": "知识地图",
  "kind": "advanced",
  "version": "0.1.0",
  "description": "识别阅读主题、主题关系、知识盲区和下一阶段建议。",
  "style": "style.md",
  "prompt": "prompt.md",
  "dataPolicy": {
    "defaultCapabilities": [
      "profile.summary",
      "shelf.sync",
      "notes.notebooks",
      "reading.stats"
    ],
    "optionalCapabilities": [
      "book.info",
      "book.progress",
      "notes.bookmarks",
      "notes.reviews",
      "review.public",
      "discover.recommendations"
    ],
    "requiresRawNotesConsent": true
  },
  "outputs": ["report.html", "report.meta.json"]
}
```

`style.md` 只写视觉气质和禁忌，不写固定布局：

```md
# 知识地图风格

整体气质：安静、结构化、像私人知识档案。

允许：
- 根据用户数据决定章节结构。
- 使用信息图、地图、时间线、书目索引、摘录墙等任意布局。
- 自行决定哪些数据值得呈现。

避免：
- 大面积紫蓝渐变。
- 泛 SaaS 卡片堆叠。
- 没有证据的夸张判断。
- 远程脚本、远程字体、远程图片。
```

`prompt.md` 写任务，不限制具体 UI：

```md
你是阅读分析师和 HTML 报告设计师。

请基于 input/ 中的能力目录、缓存索引和用户策略，自主决定需要读取 data/ 中哪些文件。
如果数据不足，可以先基于已有 data/ 生成报告；不要伪造不存在的数据。

目标：
- 生成一份只属于这个用户的 HTML 阅读报告。
- 不要套固定模板。
- 根据数据特征决定报告结构、叙事和视觉。
- 输出完整单文件 HTML 到 output/report.html。
- 输出报告使用了哪些数据到 output/report.meta.json。
```

---

## 6. 数据渐进披露

智能体报告不再固定为 `ReadingReportData`。应用给 Agent 一个能力目录和缓存索引，Agent 自己决定读哪些数据。

第一版因为 `agent-cli-bridge` 不是双向 RPC，渐进披露采用“文件式渐进披露”：

1. 应用先写入轻量文件：
   - `input/capabilities.json`
   - `input/cache-index.json`
   - `input/user-policy.json`
2. 应用根据模板 `defaultCapabilities` 预取最小数据到 `data/`。
3. Agent 读取这些文件后决定报告方向。
4. 如果 Agent 需要更多数据，第一版不能运行中回调应用；因此采用两种策略：
   - 策略 A：应用预取“全量常用数据”，Agent 自由读取。
   - 策略 B：Agent 输出 `output/data-requests.json`，应用检测后补数据，再二次调用 Agent。

推荐第一版使用策略 A，先保证链路可用；第二版再做策略 B。

### 6.1 能力目录

`capabilities.json`：

```json
{
  "version": "1.0",
  "capabilities": [
    {
      "id": "shelf.sync",
      "title": "书架",
      "description": "读取完整书架，包含书籍、有声书和公众号条目。",
      "sensitivity": "medium",
      "cache": "prefer"
    },
    {
      "id": "notes.notebooks",
      "title": "笔记本列表",
      "description": "读取所有有笔记的书及划线和想法数量。",
      "sensitivity": "medium",
      "cache": "prefer"
    },
    {
      "id": "notes.bookmarks",
      "title": "单本书划线",
      "description": "读取指定书籍的个人划线文本、章节、range。",
      "sensitivity": "high",
      "cache": "prefer"
    },
    {
      "id": "notes.reviews",
      "title": "单本书个人想法",
      "description": "读取指定书籍的个人想法/点评。",
      "sensitivity": "high",
      "cache": "prefer"
    },
    {
      "id": "reading.stats",
      "title": "阅读统计",
      "description": "读取月度、年度或全部阅读统计。",
      "sensitivity": "low",
      "cache": "prefer"
    }
  ]
}
```

能力映射必须以 `~/.agents/skills/weread-skills/` 为准：

| 能力 | Skill 文档 | 数据来源 |
|------|------------|----------|
| `shelf.sync` | `shelf.md` | `shelf_sync` |
| `notes.notebooks` | `notes.md` | `notebooks` |
| `notes.bookmarks` | `notes.md` | `bookmark_list` |
| `notes.reviews` | `notes.md` | `my_reviews` |
| `reading.stats` | `readdata.md` | `reading_stats` |
| `book.info` | `book.md` | `book_info` |
| `book.progress` | `book.md` | `book_progress` |
| `search.books` | `search.md` | `search` |
| `review.public` | `review.md` | 公开点评 |
| `discover.recommendations` | `discover.md` | 推荐 |

---

## 7. 无限数据策略

产品上允许 Agent 拉取任意 WeRead Skill 能力提供的数据，不设置业务上限。

但仍必须保留工程边界：

- 用户可以取消任务。
- 所有请求优先缓存。
- 重复请求直接复用缓存。
- 分页接口必须按 API 文档拉完，不猜字段。
- 原文划线和想法属于高敏数据，必须有用户确认。
- job 必须持续写入进度，防止用户误以为卡死。
- 任务失败时保留已拉取数据和 agent 输出，支持重试。

“无限”在实现上表示：

- 不限制书籍数量。
- 不限制按书拉取 bookmarks/reviews 的数量。
- 不限制分页页数，只要 API 仍返回 `hasMore`。
- 不限制 Agent 多轮生成，但每一轮必须可取消、可恢复。

第一版建议预取策略：

1. 读取 `reading.stats`：month / year / all。
2. 读取完整 `notes.notebooks`。
3. 读取完整 `shelf.sync`。
4. 若用户允许原文：遍历所有 notebooks 中有笔记的书，读取完整 bookmarks 和 reviews。
5. 按需读取 `book.info` / `book.progress`。

这会比较慢，但符合“不限制数据”的目标。

---

## 8. 缓存策略

所有 WeRead API 读取都必须优先走现有缓存层。

缓存策略：

| 策略 | 行为 |
|------|------|
| `only` | 只用缓存，缺失则跳过 |
| `prefer` | 优先缓存，缺失再请求 API |
| `refresh` | 强制刷新 |

智能体报告默认使用 `prefer`。

job 内 `data/` 是本次报告快照，不能直接等同全局 API cache。生成开始后，即使全局缓存刷新，当前 job 也应继续使用 job 内快照，保证报告可复现。

`cache-index.json` 示例：

```json
{
  "generatedAt": "2026-05-21T08:00:00+08:00",
  "policy": "prefer",
  "entries": [
    {
      "capability": "notes.notebooks",
      "path": "data/notebooks.all.json",
      "source": "cache",
      "fetchedAt": 1760000000
    }
  ]
}
```

---

## 9. Agent 输入输出协议

### 9.1 Agent 输入

Agent 的 prompt 不直接塞超大 JSON。Prompt 只告诉 Agent 去读工作区文件：

```md
你正在为微信读书用户生成高级阅读报告。

工作目录结构：
- input/template.json：报告任务定义
- input/style.md：视觉风格约束
- input/user-policy.json：用户隐私与数据策略
- input/capabilities.json：可用数据能力说明
- input/cache-index.json：已准备的数据快照索引
- data/：本次报告可读取的数据
- output/：你必须写入最终产物

要求：
1. 先阅读 input/ 下所有文件。
2. 根据 data/ 的真实内容决定报告结构。
3. 不要套固定模板。
4. 生成 output/report.html。
5. 生成 output/report.meta.json。
```

### 9.2 Agent 输出

`output/report.meta.json`：

```json
{
  "title": "你的阅读知识地图",
  "templateId": "knowledge-map",
  "privacyLevel": "with_raw_notes",
  "usedCapabilities": [
    "notes.notebooks",
    "reading.stats",
    "notes.bookmarks",
    "notes.reviews"
  ],
  "usedFiles": [
    "data/notebooks.all.json",
    "data/books/123/bookmarks.json"
  ],
  "summary": "本报告识别出三个长期阅读主题和两个知识盲区。",
  "warnings": []
}
```

`output/report.html` 规则：

- 单文件 HTML。
- CSS 内联。
- 不依赖外部网络资源。
- 不包含远程 JS。
- 不暴露 API Key、缓存路径、用户本地绝对路径。
- 可以嵌入本地生成的 data URL 图片，但第一版不要求。

---

## 10. Tauri 命令设计

新增模块：`src-tauri/src/advanced_report.rs`

命令：

| 命令 | 说明 |
|------|------|
| `list_advanced_report_templates` | 扫描内置和用户模板目录 |
| `prepare_advanced_report_job` | 创建 job，写入 input，按策略预取 data |
| `run_advanced_report_job` | 通过 `agent-cli-bridge` 调用本地 agent |
| `get_advanced_report_job` | 读取 `job.json` 和输出状态 |
| `open_advanced_report_file` | 打开 `report.html` |
| `export_advanced_report_file` | 复制报告到用户选择目录 |
| `cancel_advanced_report_job` | 取消正在运行的任务，第二版实现 |

第一版可以先不做真正 cancel，但 UI 和 job 状态要预留。

### 10.1 类型草案

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub style_path: String,
    pub prompt_path: String,
    pub requires_raw_notes_consent: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportJob {
    pub id: String,
    pub template_id: String,
    pub status: AdvancedReportJobStatus,
    pub job_dir: String,
    pub report_html_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareAdvancedReportJobRequest {
    pub template_id: String,
    pub period: String,
    pub cache_policy: String,
    pub allow_raw_notes: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAdvancedReportJobRequest {
    pub job_id: String,
    pub agent: String,
    pub bin_override: Option<String>,
}
```

---

## 11. 前端落点

### 11.1 ReportPage

报告页保留两组：

- 基础模板：当前已实现的 `reportTemplates`。
- 智能体模板：从 `list_advanced_report_templates` 返回。

智能体模板卡片承担任务入口和状态展示：

```text
未开始：模板名称、说明、开始生成
生成中：生成状态、查看、取消
已完成：打开报告、重新生成
失败/取消：失败状态、重新生成
任意状态：历史
```

点击“查看 / 打开报告”后进入接近全屏的报告工作台，集中展示浏览器打开和导出。点击“历史”只展示当前模板的生成记录，每条记录可查看、浏览器打开和删除；运行中记录不可直接删除。生成设置只保留隐私授权，Agent 自动选择，模型使用用户 CLI 默认配置，避免普通用户先理解工作流。

### 11.2 新 Hook

新增 `src/hooks/useAdvancedReport.ts`：

```ts
function useAdvancedReport() {
  return {
    templates,
    agents,
    currentJob,
    events,
    loading,
    error,
    loadTemplates,
    detectAgents,
    prepareJob,
    runJob,
    openReport,
    exportReport,
  };
}
```

`useAgentBridge` 保留为底层 hook，不直接暴露给页面复杂业务。

---

## 12. 分阶段实施

### Phase 1：文件协议跑通

目标：用本地 agent 生成一份智能体报告 HTML。

任务：

1. 新增 `advanced_report.rs`。
2. 新增内置智能体模板目录。
3. 实现 `list_advanced_report_templates`。
4. 实现 `prepare_advanced_report_job`。
5. 实现最小数据预取：stats + notebooks + shelf。
6. 实现 `run_advanced_report_job`。
7. 让 Agent 读取 input/data 并写 output/report.html。
8. 前端智能体模板卡片可开始生成、展示状态、查看任务、取消任务、打开报告和查看当前模板历史。

验收：

- 可检测本地 agent。
- 可创建 job 目录。
- 可运行 agent。
- 可生成 `output/report.html`。
- 同一个模板同时启动第二个活跃任务时后端返回明确错误。
- 同一模板历史记录能按模板过滤，支持查看和浏览器打开。
- 应用重启后，未生成 `output/report.html` 的运行中 job 不再显示为生成中，而是明确显示为已中断或未完成。
- 单个历史 job 可删除；运行中的 job 删除时返回明确错误。
- `npm run frontend:typecheck`、`npm run frontend:build`、`cargo check` 通过。

### Phase 2：无限数据预取

目标：允许 Agent 使用完整微信读书数据。

任务：

1. 实现 `WeReadDataBroker`。
2. 按 skill 文档实现能力映射。
3. 全量分页读取 notebooks。
4. 遍历有笔记书籍读取 bookmarks/reviews。
5. 写入 job `data/books/<book-id>/`。
6. 写入 `cache-index.json`。
7. UI 增加“允许使用原文划线/想法”确认。

验收：

- 可生成包含完整笔记语料的智能体报告。
- 缓存命中时不会重复请求 API。
- 任务状态能显示当前读取进度。

### Phase 3：多轮文件式数据请求

目标：在没有双向 RPC 的前提下，用文件协议模拟真正的渐进披露。

任务：

1. Agent 可输出 `output/data-requests.json`。
2. 应用读取请求并补充 `data/`。
3. 应用把补充结果写入 `input/data-response-<round>.json`。
4. 应用二次调用 agent，让其继续生成报告。
5. 每一轮都追加写入 `agent-output.ndjson` 和 `job.json` 状态。

验收：

- Agent 能先看摘要，再请求更细数据。
- 应用可以多轮补充数据。
- 每轮都是独立 agent invocation，不依赖运行中 RPC。

### Phase 4：分享版（后续）

目标：生成适合传播的 `share.html`。

当前版本不实现本阶段，也不要求智能体生成 `share.html`。

任务：

1. 定义分享版包装规则。
2. 注入应用署名、项目链接、二维码占位。
3. 根据隐私策略裁剪原文摘录。
4. 支持导出分享版。

验收：

- 正式版和分享版分离。
- 分享版不泄露未授权原文。

---

## 13. 需要注意的问题

1. **不要把 API Key 写入 job 目录。**
2. **不要把用户本地绝对路径写进 HTML。**
3. **不要让 Agent 修改应用源码目录。** Agent 的 cwd 应该是 job 目录。
4. **不要依赖远程资源。** 生成 HTML 必须本地可打开。
5. **不要限制 UI 创作。** style 只约束气质、隐私和安全，不规定布局。
6. **不要让前端拼 agent 命令。** 前端只传 agent id、job id 和用户选项。
7. **不要绕过 WeRead skill 文档。** API 字段、分页、单位和口径仍以 `~/.agents/skills/weread-skills/` 为准。

---

## 14. 下一步建议

下一步直接实现 Phase 1：

1. 新增 `src-tauri/src/advanced_report.rs`。
2. 新增 `reports/templates/knowledge-map` 内置模板。
3. 新增 `list_advanced_report_templates` / `prepare_advanced_report_job` / `run_advanced_report_job`。
4. 在 `ReportPage` 智能体模板卡片上接入真实模板列表和 agent 选择。
