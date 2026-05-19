# WeRead Skill Desktop - MVP 技术设计文档

> **产品定位：** 微信读书数据导出与管理工具（非完整客户端）
>
> **技术栈：** Tauri 2 + React 19 + TypeScript + Vite 5 + Tailwind CSS 4

---

## 一、MVP 功能范围

### 核心用户流程

```
用户打开应用 → 输入 API Key → 查看书架 → 选择书籍 → 查看笔记/划线 → 导出为 Markdown/JSON
                                                                    ↓
                                                              查看阅读统计
```

### 功能清单

| 优先级 | 功能模块 | 具体功能 | 对应 API |
|--------|----------|----------|----------|
| P0 | 设置管理 | API Key 输入/保存/脱敏显示 | - |
| P0 | 书架概览 | 书架列表、已读/在读状态、最近阅读时间 | `shelf_sync` |
| P0 | 笔记中心 | 划线列表、点评卡片、章节导航 | `bookmark_list`, `my_reviews` |
| P0 | 导出功能 | 单本/批量导出 Markdown、JSON | - |
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

API 规则以 `/tmp/weread-skills/weread-skills/` 为准。本设计文档只定义 MVP 使用哪些能力，不复制字段表。

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
| | `export_to_json` | 导出为 JSON 文件 |
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
    pub format: ExportFormat,         // Markdown 或 JSON
    pub output_dir: PathBuf,         // 输出目录
    pub include_bookmarks: bool,     // 包含划线
    pub include_reviews: bool,       // 包含点评
    pub group_by_chapter: bool,      // 按章节分组（仅 Markdown）
}

pub enum ExportFormat {
    Markdown,
    Json,
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
    pub default_format: Option<String>,   // 默认导出格式
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
| `/notes/:bookId?` | NotesPage | 笔记详情：查看/筛选/预览笔记 |
| `/export` | ExportPage | 导出中心：选择范围+格式+执行导出 |
| `/settings` | SettingsPage | 设置：API Key + 导出偏好 |

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

#### NotesPage（笔记详情）

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

#### ExportPage（导出中心）

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
│  │ 格式:  ● Markdown  ○ JSON                   │    │
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
│  │ 默认格式:  [Markdown ▼]                      │    │
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

### 5.2 JSON 导出格式示例

```json
{
  "version": "1.0",
  "exportTime": "2026-05-19T10:30:00Z",
  "source": "weread",
  "book": {
    "id": "123456",
    "title": "原则",
    "author": "瑞·达利欧",
    "cover": "https://..."
  },
  "stats": {
    "totalBookmarks": 156,
    "totalReviews": 23,
    "chaptersCount": 12
  },
  "chapters": [
    {
      "chapterUid": 123,
      "title": "第一章 生活原则",
      "bookmarks": [
        {
          "id": "bm001",
          "content": "拥抱现实并妥善处理现实",
          "rangeStart": 0,
          "rangeEnd": 100,
          "range": "0-100",
          "createdAt": "2026-01-15T08:30:00Z",
          "reviews": []
        }
      ],
      "reviews": [
        {
          "id": "rv001",
          "content": "这句话是全书的核心...",
          "createdAt": "2026-01-15T09:00:00Z",
          "chapterName": "第一章 生活原则"
        }
      ]
    }
  ]
}
```

说明：

- `/book/bookmarklist` 不提供稳定页码，导出不应承诺 page 字段。
- 划线位置使用 `range`，可拆为 `rangeStart` / `rangeEnd`。
- 点评/想法不总能可靠关联到某条划线。能关联时可放入对应 bookmark 的 `reviews`；不能关联时放入章节级 `reviews`。
- 书签内容当前不可导出，只能在统计中体现数量。

### 5.3 导出流程

```
前端选择选项 → invoke("export_to_markdown", options)
    → Rust export.rs 接收参数
    → 循环 book_ids:
        → 调用 bookmark_list + my_reviews
        → 组装数据结构
        → 格式化 Markdown/JSON
        → 写入文件系统（每本书一个文件）
    → 返回成功 + 文件路径列表
    → 前端提示成功 + 提供"打开文件夹"按钮
```

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

### 7.1 文件保存对话框（Tauri）

```rust
// 使用 tauri-plugin-dialog 让用户选择保存位置
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn save_file_dialog(
    app: AppHandle,
    state: State<'_, RuntimeState>,
) -> Result<PathBuf, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md"])
        .add_filter("JSON", &["json"])
        .blocking_save_file();
    
    Ok(file_path.ok_or("用户取消")?.path())
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

## 十、MVP 分阶段实施计划

### 第一阶段：基础骨架（Day 1-2）

- [ ] 初始化 Tauri 项目（`npm create tauri-app`）
- [ ] 配置 Tailwind CSS v4 + Vite
- [ ] 实现 Rust 后端骨架：
  - [ ] `config.rs` - 配置读写
  - [ ] `state.rs` - 应用状态
  - [ ] `api.rs` - `WeReadClient` + `gateway_call()`
  - [ ] `types.rs` - 核心数据结构
  - [ ] `commands.rs` - 配置相关命令（3个）
- [ ] 前端基础布局：
  - [ ] `App.tsx` + HashRouter
  - [ ] `Sidebar.tsx` + `PageShell.tsx`
  - [ ] `SettingsPage` + `useSettings` Hook

**验证点：** 应用启动 → 设置页输入 API Key → 保存成功 → 脱敏显示正确

---

### 第二阶段：书架 + 统计（Day 3-4）

- [ ] Rust 后端：
  - [ ] 实现 `shelf_sync` 和 `reading_stats` API 调用
  - [ ] 实现对应 Tauri 命令
- [ ] 前端页面：
  - [ ] `DashboardPage` - 书架列表 + 统计卡片
  - [ ] `useBookshelf` Hook
  - [ ] `useReadingStats` Hook
  - [ ] `BookList` / `BookItem` / `BookFilter` 组件
  - [ ] `StatsOverview` / `ReadingChart` / `CategoryPie` 组件
  - [ ] 通用组件：LoadingSpinner / ErrorBanner / EmptyState

**验证点：** 同步书架成功 → 显示书籍列表、已读/在读状态、最近阅读时间 → 统计卡片数据正确

---

### 第三阶段：笔记功能（Day 5-6）

- [ ] Rust 后端：
  - [ ] 实现 `bookmark_list`、`my_reviews` API
  - [ ] 实现 `notebooks` API（P0.5，建议用于只导出有笔记的书）
  - [ ] 实现搜索命令 `search_books`（P1，可延后）
- [ ] 前端页面：
  - [ ] `NotesPage` - 笔记详情页
  - [ ] `useNotes` Hook
  - [ ] `BookmarkList` / `ReviewCard` / `ChapterGroup` / `NoteContent` 组件
  - [ ] 章节筛选和本地搜索

**验证点：** 点击书籍进入笔记页 → 显示划线和点评 → 按章节分组 → 筛选正常

---

### 第四阶段：导出功能（Day 7）

- [ ] Rust 后端：
  - [ ] 实现 `export.rs` - 导出逻辑
  - [ ] 实现 `export_to_markdown` / `export_to_json` 命令
  - [ ] 文件对话框集成：`select_export_dir` / `open_export_folder`
- [ ] 前端页面：
  - [ ] `ExportPage` - 导出中心
  - [ ] `useExport` Hook
  - [ ] `ExportOptions` / `ExportPreview` 组件
  - [ ] 前端只负责预览和参数组织；最终文件内容由 Rust 导出模块生成

**验证点：** 选择书籍 → 选择格式 → 导出成功 → 文件内容正确 → 可打开文件夹

---

### 第五阶段：打磨 + 落地页（Day 8）

- [ ] UI 打磨：
  - [ ] 暗色模式支持（可选）
  - [ ] 骨架屏加载态
  - [ ] 错误边界优化
- [ ] 网页落地页：
  - [ ] 产品介绍
  - [ ] 功能截图/GIF
  - [ ] 下载按钮
- [ ] 构建测试：
  - [ ] macOS 开发模式运行
  - [ ] 生产构建测试

**验证点：** 应用流畅无报错 → 落地页可访问 → 下载链接可用

---

### 第六阶段：细节调整与真实数据校准（MVP 可用后）

当基础功能已经可用后，下一步不要急于扩展 P1/P2 功能，先完成以下质量收敛：

- [ ] 真实 API 数据校准：
  - [ ] 用真实账号逐页验证 `shelf_sync`、`notebooks`、`bookmark_list`、`my_reviews`、`reading_stats` 的字段映射
  - [ ] 对照 `/tmp/weread-skills/weread-skills/` 修正字段单位、缺省值、分页游标、统计口径
  - [ ] 记录无法稳定获得的字段，不用前端假数据补齐
- [ ] 导出边界用例：
  - [ ] 空笔记本、只有划线、只有想法、无章节名、无作者名
  - [ ] 超长书名、非法文件名字符、重名文件
  - [ ] 导出目录不存在、目录无权限、用户取消目录选择
  - [ ] Markdown 与 JSON 内容和 UI 预览口径一致
- [ ] UI 细节走查：
  - [ ] macOS 默认窗口、最小窗口、宽屏窗口下无错位
  - [ ] 长书名、长作者名、长划线、长点评不撑破布局
  - [ ] 加载态、空态、错误态、成功态都有明确反馈
  - [ ] 视觉细节继续以 `ui-style-guide.md` 和 `$frontend-design` 为准
- [ ] 稳定性与体验：
  - [ ] API Key 无效、网络失败、接口升级提示的错误文案可理解
  - [ ] 批量导出需要进度反馈，避免用户误以为卡死
  - [ ] 再评估是否需要缓存、搜索增强和批量导出进度条

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
   - 解决方案：实现任何接口前必须阅读 `/tmp/weread-skills/weread-skills/` 中对应文档，不在本文件复制字段表

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
