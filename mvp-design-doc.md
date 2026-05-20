# WeRead Skill Desktop - MVP 技术设计文档

> **产品定位：** 微信读书数据导出与管理工具（非完整客户端）
>
> **技术栈：** Tauri 2 + React 19 + TypeScript + Vite 5 + Tailwind CSS 4

---

## 一、MVP 功能范围

### 核心用户流程

```
用户打开应用 → 输入 API Key → 查看书架 → 选择书籍 → 查看笔记/划线 → 导出为 Markdown
                                                                    ↓
                                                              查看阅读统计
```

### 功能清单

| 优先级 | 功能模块 | 具体功能 | 对应 API |
|--------|----------|----------|----------|
| P0 | 设置管理 | API Key 输入/保存/脱敏显示 | - |
| P0 | 书架概览 | 书架列表、已读/在读状态、最近阅读时间 | `shelf_sync` |
| P0 | 笔记中心 | 划线列表、点评卡片、章节导航 | `bookmark_list`, `my_reviews` |
| P0 | 导出功能 | 单本/批量导出 Markdown | - |
| P0 | 阅读统计 | 时长、天数、偏好分类图表 | `reading_stats` |
| P0.5 | 笔记本概览 | 所有笔记本列表、笔记计数、只导出有笔记的书 | `notebooks` |
| P1 | 搜索功能 | 书架/笔记本本地搜索；可选书城搜索 | 本地过滤；`search` |

> 注意：`/shelf/sync` 不提供精确阅读进度。MVP 只能稳定展示 `finishReading`、最近阅读时间等字段。若要展示 0-100% 阅读进度，需要额外引入 `/book/getprogress`，不属于 P0。

### 不包含的功能（留给微信读书 App）

- ❌ 书籍详情页（封面/简介/目录）
- ❌ 在线阅读体验
- ❌ 推荐发现
- ❌ 公共书评浏览
- ❌ 相似书籍推荐
- ❌ 精确阅读进度批量查询（除非后续显式引入 `/book/getprogress`）

---

## 二、精简后的项目结构

```
weread-export-tool/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/                              # 前端 (React)
│   ├── main.tsx
│   ├── App.tsx                       # 路由 + 布局
│   ├── index.css                     # Tailwind
│   │
│   ├── types/
│   │   └── index.ts                  # 共享类型定义
│   │
│   ├── hooks/
│   │   ├── useSettings.ts            # API Key 管理
│   │   ├── useBookshelf.ts           # 书架数据
│   │   ├── useNotes.ts              # 笔记/划线查询
│   │   ├── useExport.ts             # 导出逻辑
│   │   └── useReadingStats.ts        # 统计数据
│   │
│   ├── pages/
│   │   ├── DashboardPage.tsx         # 主面板（书架+统计概览）
│   │   ├── NotesPage.tsx             # 笔记详情（按书籍）
│   │   ├── ExportPage.tsx            # 导出中心
│   │   └── SettingsPage.tsx          # 设置页
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # 侧边导航
│   │   │   └── PageShell.tsx         # 页面容器
│   │   │
│   │   ├── bookshelf/
│   │   │   ├── BookList.tsx          # 书籍列表
│   │   │   ├── BookItem.tsx          # 书籍条目（状态/最近阅读）
│   │   │   └── BookFilter.tsx        # 筛选器（全部/已读完/在读）
│   │   │
│   │   ├── notes/
│   │   │   ├── BookmarkList.tsx      # 划线列表
│   │   │   ├── ReviewCard.tsx        # 点评卡片
│   │   │   ├── NoteContent.tsx       # 笔记内容渲染
│   │   │   └── ChapterGroup.tsx      # 按章分组
│   │   │
│   │   ├── export/
│   │   │   ├── ExportOptions.tsx     # 导出选项（格式/范围）
│   │   │   └── ExportPreview.tsx     # 导出预览
│   │   │
│   │   ├── stats/
│   │   │   ├── StatsOverview.tsx     # 统计概览卡片
│   │   │   ├── ReadingChart.tsx      # 阅读时长图表
│   │   │   └── CategoryPie.tsx       # 分类偏好饼图
│   │   │
│   │   └── common/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBanner.tsx
│   │       ├── EmptyState.tsx
│   │       └── Badge.tsx
│   │
│   └── lib/
│       ├── preview/
│       │   └── exportPreview.ts      # 前端导出预览（不负责最终文件写入）
│       └── utils.ts                  # 工具函数
│
├── src-tauri/                        # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs                    # Tauri 构建器
│       ├── api.rs                    # API 客户端
│       ├── commands.rs               # Tauri 命令
│       ├── config.rs                 # 配置管理
│       ├── export.rs                 # 导出逻辑（文件写入）
│       ├── state.rs                  # 应用状态
│       └── types.rs                  # 数据结构
│
└── landing/                          # 网页落地页（可选）
    ├── index.html
    ├── style.css
    └── app.js
```

---

## 三、Rust 后端设计（精简版）

### 3.1 需要对接的 API（从 16 个精简到 MVP 必需集合）

```rust
// api.rs - 仅保留 MVP 必需的接口

pub struct WeReadClient {
    client: reqwest::Client,
    api_key: String,
}

impl WeReadClient {
    // === 核心网关调用 ===
    async fn gateway_call<T: DeserializeOwned>(&self, api_name: &str, params: Value) -> Result<T, String>

    // === P0: 必需接口 ===

    /// 书架同步 - 获取书架条目
    pub async fn shelf_sync(&self) -> Result<ShelfSyncResult, String>

    /// 单本书的划线列表
    pub async fn bookmark_list(&self, book_id: &str) -> Result<BookmarkListResult, String>

    /// 单本书的我的点评
    pub async fn my_reviews(&self, book_id: &str, synckey: i64, count: i32) -> Result<ReviewListResult, String>

    /// 阅读统计
    pub async fn reading_stats(&self, mode: &str, base_time: i64) -> Result<ReadingStatsResult, String>

    /// 书籍基本信息（用于导出时显示书名/作者）
    pub async fn book_info(&self, book_id: &str) -> Result<BookInfo, String>

    // === P0.5: 建议实现 ===

    /// 笔记本列表（所有书的笔记概览）
    pub async fn notebooks(&self, count: i32, last_sort: i64) -> Result<NotebooksResult, String>

    // === P1: 可选接口 ===

    /// 书城搜索（不是本地笔记搜索）
    pub async fn search(&self, keyword: &str, scope: i32, max_idx: i32, count: i32) -> Result<SearchResult, String>

    // === P1/P2: 后续添加 ===
    // pub async fn best_bookmarks(...)
    // pub async fn underlines(...)
    // pub async fn get_progress(...)
}
```

API 规则以 `~/.agents/skills/weread-skills/` 为准。本设计文档只定义 MVP 使用哪些能力，不复制字段表。

### 3.2 Tauri 命令清单（MVP）

| 分类 | 命令名 | 说明 |
|------|--------|------|
| **配置** | `get_settings` | 获取设置（脱敏 API Key） |
| | `save_api_key` | 保存 API Key |
| | `clear_api_key` | 清除 API Key |
| **书架** | `sync_shelf` | 同步书架 |
| **笔记** | `get_notebooks` | 获取笔记本列表 |
| | `get_bookmarks` | 获取单本书划线 |
| | `get_my_reviews` | 获取单本书点评 |
| **搜索** | `search_books` | 搜索书籍 |
| **书籍** | `get_book_info` | 获取书籍基本信息 |
| **统计** | `get_reading_stats` | 获取阅读统计 |
| **导出** | `export_to_markdown` | 导出为 Markdown 文件 |
| | `select_export_dir` | 选择导出目录 |
| | `open_export_folder` | 打开导出目录 |
| **系统** | `open_in_weread` | 深度链接跳转 |

### 3.3 导出模块 (`export.rs`)

```rust
// export.rs - 文件导出逻辑

use std::path::PathBuf;
use tauri::AppHandle;

/// 导出选项
pub struct ExportOptions {
    pub book_ids: Vec<String>,       // 要导出的书籍 ID 列表（空=全部）
    pub output_dir: PathBuf,         // 输出目录
    pub include_bookmarks: bool,     // 包含划线
    pub include_reviews: bool,       // 包含点评
    pub group_by_chapter: bool,      // 按章节分组
}

/// 执行导出，返回生成的文件路径
pub async fn export_notes(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    options: ExportOptions,
) -> Result<Vec<PathBuf>, String> {
    // 1. 根据 book_ids 获取所有笔记数据
    // 2. 格式化为目标格式
    // 3. 写入文件系统
    // 4. 返回文件路径列表（前端可打开文件夹）
}

/// 打开输出目录
pub fn open_output_dir(path: PathBuf) -> Result<(), String>
```

### 3.4 配置管理 (`config.rs`)

```rust
// config.rs - 配置持久化

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub api_key: Option<String>,
    pub last_export_dir: Option<String>,  // 记住上次导出目录
    pub default_format: Option<String>,   // 兼容旧配置；当前导出固定为 Markdown
    #[serde(skip)]
    config_path: PathBuf,
}

impl AppConfig {
    pub fn load() -> Self { ... }
    pub fn save(&self) -> Result<(), String> { ... }
    pub fn get_masked_key(&self) -> Option<String> { ... }  // 脱敏：***xxxx
}
```

---

## 四、前端页面设计

### 4.1 路由设计（精简到 4 个主页面）

| 路由 | 页面 | 功能说明 |
|------|------|----------|
| `/` | DashboardPage | **主页**：书架列表 + 统计概览卡片 |
| `/notes/:bookId?` | NotesWorkbenchPage | 笔记工作台：浏览笔记、查看单本书划线/想法、进入导出 |
| `/notes?tab=export` | NotesWorkbenchPage | 笔记工作台导出 Tab：选择范围、预览并导出 Markdown |
| `/settings` | SettingsPage | 设置：API Key + 导出偏好 |

> `/export` 作为旧入口保留重定向到 `/notes?tab=export`，侧边栏只保留「笔记」入口。

### 4.2 页面原型描述

#### DashboardPage（仪表盘）

```
┌─────────────────────────────────────────────────────┐
│  Sidebar │  统计概览（横向 4 个卡片）                   │
│          │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  书架    │  │127天 │ │42本  │ │156h │ │科技类│     │
│  笔记    │  │阅读天│ │读完数│ │总时长│ │偏好  │     │
│  导出    │  └──────┘ └──────┘ └──────┘ └──────┘     │
│  设置    │                                         │
│          │  书架列表                                  │
│          │  ┌─────────────────────────────────────┐  │
│          │  [搜索书籍...]  [全部 ▼] [已读完 ▼]     │  │
│          │  ├─────────────────────────────────────┤  │
│          │  原则        瑞·达利欧    已读完    2026-05-12│
│          │  三体        刘慈欣      阅读中    2026-05-10│
│          │  深度工作    卡尔·纽波特  阅读中    2026-05-08│
│          │  ...                                    │
│          │  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

#### NotesWorkbenchPage（笔记工作台）

笔记工作台内部使用 `浏览 / 导出` 两个 Tab。浏览区保留单本笔记查看体验，导出区保留批量选择、预览和生成文件能力。

```
┌─────────────────────────────────────────────────────┐
│  笔记                                      [浏览][导出] │
│                                                     │
│  浏览 Tab                                           │
│  ┌──────────────┐ ┌─────────────────────────────┐   │
│  │ 笔记本列表     │ │ 搜索划线或想法                │   │
│  │ 搜索书名/作者  │ │ [全部][划线][想法]            │   │
│  │ 原则  12      │ │ [按章节][按时间]              │   │
│  └──────────────┘ │ 第一章                         │   │
│                  │ > 划线内容                     │   │
│                  │ 我的想法...                     │   │
│                  └─────────────────────────────┘   │
│                                                     │
│  导出 Tab                                           │
│  ┌──────────────┐ ┌─────────────────────────────┐   │
│  │ 选择导出范围   │ │ 导出选项 / 预览 / 生成文件       │   │
│  └──────────────┘ └─────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### Notes Browse（浏览）

```
┌─────────────────────────────────────────────────────┐
│  ← 返回书架  |  《原则》- 瑞·达利欧                   │
│                                                     │
│  Tab: [全部笔记] [划线] [点评]                       │
│  筛选: [全部章节 ▼] [最近7天 ▼]                      │
│                                                     │
│  第一章 生活原则                                    │
│  ├─ "拥抱现实并妥善处理现实" · 2026-01-15 · 900-2004 │
│  │   我的思考：这句话是全书的核心...                   │
│  ├─ "痛苦+反思=进步" · 2026-01-16 · 2100-2300        │
│  │                                                   │
│  第二章 工作原则                                    │
│  ├─ "建立系统化的决策流程" · 2026-01-20 · 500-760    │
│  │                                                   │
│  [加载更多...]                                       │
│                                                     │
│  [导出] [复制全部] [在微信读书中打开]                 │
└─────────────────────────────────────────────────────┘
```

#### Notes Export（导出）

```
┌─────────────────────────────────────────────────────┐
│  导出笔记                                           │
│                                                     │
│  1. 选择范围                                        │
│  ┌─────────────────────────────────────────────┐    │
│  │ ☑ 全部有笔记的书（42 本）                      │    │
│  │   或选择特定书籍:                             │    │
│  │   ☑ 原则  ☑ 三体  ☐ 深度工作  ☐ ...          │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  2. 导出选项                                        │
│  ┌─────────────────────────────────────────────┐    │
│  │ 格式:  Markdown                              │    │
│  │ 内容:  ☑ 划线  ☑ 点评                       │    │
│  │ 组织:  ☑ 按章节分组                          │    │
│  │ 输出到: ~/Documents/WereadNotes/  [更改...]  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  3. 预览（可选）                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │ # 原则 - 瑞·达利欧                            │    │
│  │ ## 第一章 生活原则                            │    │
│  │ 创建时间：2026-01-15 · range: 900-2004        │    │
│  │ > 拥抱现实并妥善处理现实                       │    │
│  │                                             │    │
│  │ **我的思考：** 这句话是全书的核心...           │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [开始导出]                                         │
│                                                     │
│  导出完成！已生成 42 个文件                         │
│  [打开文件夹] [再次导出]                             │
└─────────────────────────────────────────────────────┘
```

#### SettingsPage（设置）

```
┌─────────────────────────────────────────────────────┐
│  设置                                               │
│                                                     │
│  API Key 配置                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ 当前状态: ✓ 已配置                           │    │
│  │ Key: sk-****abcd1234  [修改] [清除]          │    │
│  │                                             │    │
│  │ 输入新 Key:                                  │    │
│  │ [________________________________] [保存]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  默认导出设置                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ 默认格式:  Markdown（当前唯一导出格式）          │    │
│  │ 输出目录:  [~/Documents/WereadNotes/] [浏览] │    │
│  │ 默认内容:  ☑ 划线  ☑ 点评  ☑ 按章分组       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  关于                                               │
│  版本: 0.1.0 (MVP)                                  │
│  基于 weread skill 构建                              │
└─────────────────────────────────────────────────────┘
```

---

## 五、导出功能详细设计

### 5.1 Markdown 导出格式示例

```markdown
# {书名} - {作者}

> 导出时间：2026-05-19
> 数据来源：微信读书

---

## {章节标题}

> {划线内容}

创建时间：{YYYY-MM-DD}  
位置：`{range}`

{如有点评}**我的思考：** {点评内容}

---

## {下一章节}

...

---
*由 WeRead Skill Desktop 导出*
```

### 5.2 导出流程

```
前端选择选项 → invoke("export_to_markdown", options)
    → Rust export.rs 接收参数
    → 循环 book_ids:
        → 调用 bookmark_list + my_reviews
        → 组装数据结构
        → 格式化 Markdown
        → 写入文件系统（每本书一个文件）
    → 返回成功 + 文件路径列表
    → 前端提示成功 + 提供"打开文件夹"按钮
```

### 5.3 Frontmatter 增强（已实现）

导出的 Markdown 文件头部增加 YAML Frontmatter，便于 Obsidian 等工具索引：

```yaml
---
title: 原则
author: 瑞·达利欧
cover: https://weread-oss.xxx/cover.jpg
start-date: 2026-01-10
reading-time: 18640
progress: 100
---
```

字段说明：

| 字段 | 来源 | 说明 |
|------|------|------|
| `title` | `book_info.title` | 书名 |
| `author` | `book_info.author` | 作者名 |
| `cover` | `book_info.cover` | 封面图 URL |
| `start-date` | `book_progress.updateTime`（首次） | 开始阅读时间 |
| `reading-time` | `book_progress.recordReadingTime` | 阅读时长（秒） |
| `progress` | `book_progress.progress` | 阅读进度百分比 |

> 注意：`start-date` 当前 API 不直接提供"开始阅读时间"，需从 `book_progress` 的最早记录推算，或暂用 `updateTime` 代替。实现时需确认数据可用性。

### 5.4 HTML 阅读报告生成器（P2，规划中）

笔记报告能力不再按“Markdown 字符串模版”理解，而是作为独立的 HTML 阅读报告生成器推进：先把微信读书数据整理成稳定的报告数据模型，再用不同 HTML 模版渲染成可预览、可导出的静态网页。

#### 产品分层

第一层是基础报告模版，不依赖大模型，只基于确定数据生成：

- 年度 / 月度阅读报告：阅读时长、阅读天数、读完书籍、分类偏好、最长阅读书籍、摘录摘要。
- 阅读旅程：按时间线呈现近期读过的书、阅读阶段、代表性划线和想法。
- 阅读分析报告：偏数据仪表盘，展示分类分布、阅读曲线、笔记数量、读完率和重点书籍。
- 成长路径报告：围绕书籍分类和阶段性主题呈现个人阅读方向变化。
- 个人阅读账本：延续 Quiet Reading Ledger 气质，偏档案、索引和本地知识库归档。

第二层是高级报告模版，需要解释、归纳和建议能力，应接入大模型或规则引擎：

- 阅读人格分析报告。
- 阅读画像 / 你是哪种阅读者。
- 阅读局限诊断。
- 基于阅读记录的 MBTI 风格阅读测试。
- 知识结构盲区与下一阶段阅读建议。
- 基于年度阅读记录的成长主题识别。

高级模版不得直接把全量笔记无节制发送给模型。必须先做数据裁剪和用户确认：只发送统计摘要、代表性书籍、代表性划线 / 想法，并明确是否包含个人笔记内容。

#### 报告数据模型

所有 HTML 报告模版都应读取统一的 `ReadingReportData`，不要直接依赖微信读书原始 API 回包：

```typescript
type ReadingReportData = {
  profile: {
    period: string;
    totalReadTime: number;
    readDays: number;
    finishedBooks: number;
    noteCount: number;
    bookmarkCount: number;
    reviewCount: number;
  };
  books: ReportBook[];
  categories: CategoryStat[];
  timeline: DailyReadingStat[];
  highlights: Highlight[];
  insights?: GeneratedInsight[];
};
```

基础数据来源：

- `reading_stats`：阅读时长、阅读天数、阅读曲线、分类偏好、最长阅读书籍。
- `notebooks`：有笔记书籍、划线数、想法数、笔记总量。
- `bookmark_list` / `my_reviews`：代表性划线、个人想法、章节信息。
- `book_info` / `book_progress`：书籍元数据、阅读进度、阅读时长。

#### 第一版边界

第一版只做基础 HTML 报告，不做用户自定义 HTML 编辑器，不做大模型分析：

- 新增独立 `阅读报告` 页面；报告不是 Markdown 导出的附属选项，而是可浏览、可切换、可预览的内容页。
- HTML 阅读报告支持 3 个内置模版：
  - `阅读分析报告`：数据分析型，偏统计和结构化视图。
  - `读书旅程`：时间线型，偏阅读路径和代表性摘录。
  - `年度阅读报告`：总结型，偏视觉化年度 / 月度汇总。
- 浏览器预览会先把当前报告 HTML 写入 App 私有目录，再用系统默认浏览器打开；预览文件不进入用户导出目录。
- 正式导出时必须让用户选择目标目录，再在该目录下生成 `.html` 文件。
- HTML 使用内联 CSS，尽量不依赖外部网络资源，保证本地可打开。
- 导出预览和最终文件使用同一套报告数据模型。
- 当前 Markdown 导出保持默认且不被破坏。

#### 后续高级模版边界

高级模版在基础报告稳定后再进入：

- 新增 `Insight Engine`，负责把结构化阅读数据转成洞察、证据和建议。
- 新增 AI 使用设置：使用本地已安装 CLI、API Key 或外部模型服务。
- 新增隐私确认：只发送统计数据，或允许包含代表性划线 / 想法。
- 输出 `GeneratedInsight[]`，再由 HTML 模版渲染，不让模版直接调用模型。

```typescript
type GeneratedInsight = {
  title: string;
  summary: string;
  evidence: string[];
  suggestions: string[];
};
```

#### 高级报告完整实现方案

高级报告按“模板包 + 数据准备 + 本地 CLI 任务 + 输出登记 + 应用预览/分享”实现。CLI 的具体封装库和调用参数后续再接入；本阶段先固定应用侧目录、数据契约和模板发现方式。

目录约定：

```text
AppData/
└── reports/
    ├── templates/
    │   ├── personality/
    │   │   ├── template.json
    │   │   ├── prompt.md
    │   │   ├── renderer.html
    │   │   └── assets/
    │   └── knowledge-gap/
    │       ├── template.json
    │       ├── prompt.md
    │       ├── renderer.html
    │       └── assets/
    ├── jobs/
    │   └── <job-id>/
    │       ├── input/
    │       │   ├── report-data.json
    │       │   ├── prompt.md
    │       │   └── excerpts.json
    │       ├── output/
    │       │   ├── insights.json
    │       │   ├── report.html
    │       │   └── share.html
    │       └── job.json
    └── preview/
```

`template.json` 用于应用发现高级模板：

```json
{
  "id": "personality",
  "name": "阅读人格分析",
  "kind": "advanced",
  "version": "0.1.0",
  "description": "基于阅读统计、分类偏好和代表性摘录生成阅读者画像。",
  "prompt": "prompt.md",
  "renderer": "renderer.html",
  "requires": {
    "cli": true,
    "excerpts": "optional",
    "privacyConfirmation": true
  },
  "outputs": ["insights.json", "report.html", "share.html"]
}
```

输入数据分三层：

- `report-data.json`：统一 `ReadingReportData`，只包含统计、书籍、分类、排行、时间线和数据覆盖摘要。
- `excerpts.json`：代表性划线 / 想法，必须由用户确认是否纳入；默认只抽样，不传全量笔记。
- `prompt.md`：由模板包提供，应用在 job 目录中展开变量，例如报告周期、隐私级别、输出 schema 和模板目标。

CLI 调用边界：

- Rust 新增 `advanced_report` 模块，负责模板扫描、job 目录创建、输入写入、调用本地 CLI、读取输出和错误映射。
- 前端不拼命令、不读任意路径，只通过 Tauri 命令拿模板清单、创建任务、查看任务状态、打开输出文件。
- CLI 必须输出稳定 `insights.json`；HTML 渲染可以由 CLI 直接产出，也可以由应用用 `renderer.html` + `insights.json` 生成。
- CLI 失败时保留 `job.json`、输入文件和错误摘要，便于用户重试或排查。

建议 Tauri 命令：

| 命令 | 说明 |
|------|------|
| `list_report_templates` | 扫描内置与用户模板目录，返回基础/高级模板清单 |
| `prepare_report_job` | 创建 job，写入 `report-data.json`、`excerpts.json`、展开后的 `prompt.md` |
| `run_advanced_report` | 调用本地 CLI，生成 `insights.json`、`report.html` 和可选 `share.html` |
| `get_report_job` | 查询任务状态、输出路径和错误 |
| `open_report_file` | 用系统默认应用打开报告文件 |
| `export_report_artifact` | 将 job 输出复制到用户选择目录 |
| `create_report_share_file` | 生成带应用署名和传播入口的分享版 HTML |

前端工作流：

1. 阅读报告页展示基础报告模板和高级报告模板；普通 Markdown 导出页保持现有导出工作台，不纳入报告模板目录。
2. 点击高级模板后进入接近全屏的报告工作台。
3. 报告工作台展示数据范围、隐私确认、输出目录、预览区和任务状态。
4. 用户确认后创建 job 并调用本地 CLI。
5. 成功后应用读取 `report.html` 预览；用户可导出正式版或生成分享版。

分享能力：

- 分享版与正式导出版分离，文件名建议为 `<title>-share.html`。
- 分享版可以加入应用署名、项目名、下载/主页链接、二维码占位和“由微信读书 Skill 桌面端生成”的弱提示。
- 分享版默认不包含用户未确认的原文摘录；如果包含摘录，必须沿用高级模板的隐私确认。
- 第一阶段只生成本地分享 HTML，不建设在线托管平台；用户自行上传或发送文件。

#### 不做内容

- 第一版不做完整网页编辑器。
- 第一版不做在线分享平台。
- 第一版不做 PDF 渲染；PDF 由 `REQ-009` 单独设计。
- 第一版不要求 AI 分析，但数据模型要为后续 `insights` 预留扩展点。

---

## 六、状态管理设计（Hook 模式）

### 6.1 核心 Hooks

```typescript
// hooks/useSettings.ts
function useSettings() {
  const [apiKeySet, setApiKeySet] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string|null>(null);

  useEffect(() => { checkApiStatus(); }, []);
  
  return { apiKeySet, maskedKey, saveKey, clearKey };
}

// hooks/useBookshelf.ts
function useBookshelf() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all'|'finished'|'reading'>('all');

  const sync = () => invoke('sync_shelf').then(setBooks);
  
  const filteredBooks = useMemo(() => 
    books.filter(/* filter logic */), [books, filter]
  );

  return { books: filteredBooks, loading, filter, setFilter, sync };
}

// hooks/useNotes.ts
function useNotes(bookId: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => { loadNotes(bookId); }, [bookId]);
  
  return { bookmarks, reviews, groupedByChapter, refresh };
}

// hooks/useExport.ts
function useExport() {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult|null>(null);

  const doExport = async (options: ExportOptions) => {
    setExporting(true);
    const res = await invoke('export_to_markdown', { options });
    setResult(res);
  };

  return { exporting, result, doExport, openFolder };
}

// hooks/useReadingStats.ts
function useReadingStats() {
  const [stats, setStats] = useState<ReadingStats|null>(null);
  const [period, setPeriod] = useState<'week'|'month'|'year'|'all'>('month');

  useEffect(() => { loadStats(period); }, [period]);
  
  return { stats, period, setPeriod };
}
```

---

## 七、关键技术实现细节

### 7.1 导出目录选择（Tauri）

```rust
// 使用 tauri-plugin-dialog 让用户选择导出目录
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn select_export_dir(
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Result<PathBuf, String> {
    let dir = app
        .dialog()
        .file()
        .blocking_pick_folder();
    
    Ok(dir.ok_or("用户取消")?.path())
}
```

### 7.2 打开导出目录

```rust
#[tauri::command]
async fn open_export_folder(path: PathBuf) -> Result<(), String> {
    open::that(path).map_err(|e| format!("无法打开文件夹: {}", e))
}
```

### 7.3 内存缓存策略

```rust
// state.rs
use std::collections::HashMap;
use std::time::{Instant, Duration};

struct CachedResponse {
    data: serde_json::Value,
    cached_at: Instant,
}

pub struct RuntimeState {
    pub client: Option<WeReadClient>,
    cache: HashMap<String, CachedResponse>,
    cache_ttl: Duration,  // 默认 5 分钟
}

impl RuntimeState {
    pub fn get_cached(&self, key: &str) -> Option<&serde_json::Value> {
        self.cache.get(key).and_then(|entry| {
            if entry.cached_at.elapsed() < self.cache_ttl {
                Some(&entry.data)
            } else {
                None
            }
        })
    }

    pub fn set_cache(&mut self, key: String, data: serde_json::Value) {
        self.cache.insert(key, CachedResponse {
            data,
            cached_at: Instant::now(),
        });
    }
}
```

### 7.4 错误处理统一方案

```typescript
// components/common/ErrorBanner.tsx
interface ErrorBannerProps {
  error: string | null;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// 使用方式：
// <ErrorBanner error={error} action={{ label: '重试', onClick: retry }} />
```

```rust
// Rust 层错误处理
fn map_api_error(status: u16, body: &str) -> String {
    match status {
        401 | 403 => "API Key 无效或已过期，请检查设置".to_string(),
        429 => "请求过于频繁，请稍后再试".to_string(),
        _ => format!("请求失败 (HTTP {}): {}", status, extract_error_msg(body)),
    }
}
```

---

## 八、依赖清单（MVP 精简版）

### Cargo.toml

```toml
[dependencies]
dirs = "5"                              # 用户目录路径
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2" }
tauri-plugin-dialog = "2"                # 文件对话框
tauri-plugin-shell = "2"                 # 打开外部链接/文件夹
tauri-plugin-fs = "2"                    # 文件系统操作（可选）
tokio = { version = "1", features = ["sync"] }
open = "5"                               # 打开文件夹/URL
chrono = { version = "0.4", features = ["serde"] }  # 时间处理
```

### package.json

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.3.5",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^6.0.3",
    "vite": "^5.4.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

---

## 九、UI 设计规范

本文件只定义页面与功能范围。视觉系统、组件规范、布局尺寸、动效和检查清单统一以 `ui-style-guide.md` 为准，避免两份文档维护重复 token。

### macOS 适配

```json
// tauri.conf.json
{
  "app": {
    "macOSPrivateApi": true,
    "titleBarStyle": "overlay"
  },
  "window": {
    "width": 1280,
    "height": 800,
    "minWidth": 1024,
    "minHeight": 700
  }
}
```

---

## 十、当前实现与剩余收敛

### 10.1 已实现的 MVP 能力

- 基础骨架：Tauri 2、React、HashRouter、侧边栏、页面容器和设置页已接入。
- 配置能力：支持 API Key 保存、脱敏显示、清除，以及缓存刷新间隔设置。
- 书架与统计：支持 `shelf_sync`、`reading_stats`、书架本地筛选和统计概览。
- 笔记中心：支持笔记本列表、划线、我的想法/点评、按章节/按时间视图和本地搜索。
- 导出中心：支持单本/批量 Markdown 导出、目录选择、导出进度、真实 Markdown 预览和成功/失败反馈。
- 文件能力：支持打开导出目录和微信读书深度链接。

### 10.2 当前质量收敛方向

基础功能可用后，优先做质量收敛，不急于扩展非 MVP 功能：

- 真实 API 数据校准：用真实账号验证 `shelf_sync`、`notebooks`、`bookmark_list`、`my_reviews`、`reading_stats`、`book_progress` 的字段映射、单位、缺省值和分页游标。
- 导出边界用例：覆盖空笔记本、只有划线、只有想法、无章节名、无作者名、超长书名、非法文件名、重名文件、目录不可写、用户取消目录选择。
- UI 细节走查：检查 macOS 默认窗口、最小窗口、宽屏窗口下的错位、长文本撑破、加载态、空态、错误态、成功态。
- 稳定性体验：API Key 无效、网络失败、接口升级提示需要返回可理解错误；批量导出需要持续进度反馈。

**验证点：** 使用真实 API Key 完成一轮“设置 → 书架 → 笔记 → 导出 → 打开目录”流程；至少覆盖 3 本不同类型书籍，包括无笔记书、有大量划线书、只有想法/点评书。

---

## 十一、与原计划的差异对比

| 维度 | 原计划（完整客户端） | **MVP（导出工具）** |
|------|---------------------|---------------------|
| **API 数量** | 16 个 | **5 个 P0 + 1 个 P0.5 + 1 个 P1** |
| **Tauri 命令** | 21 个 | **核心命令 + 导出目录命令** |
| **页面数量** | 7 个 | **4 个** |
| **组件数量** | 25+ | **~18 个** |
| **预计工期** | 12 天+ | **7-8 天** |
| **核心价值** | 替代微信读书 | **数据导出 + 统计** |
| **复杂度** | 高（完整阅读流程） | **中（工具型应用）** |

---

## 十二、风险与注意事项

### 技术风险

1. **API 口径误读**
   - 微信读书字段命名不总是直觉含义，例如 `noteCount` 不是总笔记数，阅读时长字段单位是秒
   - 解决方案：实现任何接口前必须阅读 `~/.agents/skills/weread-skills/` 中对应文档，不在本文件复制字段表

2. **API 限制**
   - 微信读书 API 可能有频率限制
   - 解决方案：批量导出时加入延迟 + 进度提示

3. **数据量大的书籍**
   - 某些书可能有数百条划线
   - 解决方案：虚拟滚动 + 分页加载

4. **字符编码**
   - 导出中文内容需确保 UTF-8 编码
   - 解决方案：Rust 写入时显式指定编码

5. **不可得字段**
   - 当前划线接口不提供稳定页码，点评也不总能定位到具体划线
   - 解决方案：导出使用章节、时间、range；点评能关联则关联，不能关联则单独输出

### 产品风险

1. **用户已有替代方案**
   - 微信读书 Web 端本身有部分导出能力
   - 差异化：批量导出 + 格式丰富 + 统计分析

2. **API Key 安全性**
   - 用户担心 Key 泄露
   - 解决方案：本地存储 + 明确说明权限范围

---

*文档版本：v1.0 (MVP Design)*
*最后更新：2026-05-19*
