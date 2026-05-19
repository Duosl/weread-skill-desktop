# WeRead Desktop 微信读书桌面客户端 - 实施计划

## 背景

基于 weread skill 的底层 API 能力，开发一个独立的 Tauri 桌面客户端，实现搜索书籍、管理书架、查看笔记划线、阅读统计、书评浏览、推荐发现等全部功能。

**技术栈：** Tauri 2 + React 19 + TypeScript + Vite 5 + Tailwind CSS 4

**API 架构：** 所有 16 个接口通过统一网关 `POST https://i.weread.qq.com/api/agent/gateway` 调用，使用 `api_name` 路由，`Authorization: Bearer $WEREAD_API_KEY` 鉴权。

---

## 一、项目结构

```
weread-desktop/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/                              # 前端
│   ├── main.tsx                      # React 入口
│   ├── App.tsx                       # 根组件（路由 + 布局）
│   ├── index.css                     # Tailwind 指令
│   ├── types/
│   │   ├── index.ts                  # 共享 TypeScript 类型
│   │   └── api.ts                    # API 请求/响应类型
│   ├── hooks/
│   │   ├── useBookshelf.ts           # 书架同步
│   │   ├── useSearch.ts             # 搜索（防抖 + 分页）
│   │   ├── useBookDetail.ts          # 书籍详情聚合
│   │   ├── useNotes.ts              # 笔记/划线
│   │   ├── useReadingStats.ts        # 阅读统计
│   │   ├── useDiscovery.ts           # 推荐发现
│   │   ├── useSettings.ts            # API Key 管理
│   │   └── useDebounce.ts           # 通用防抖
│   ├── pages/
│   │   ├── BookshelfPage.tsx         # 书架页
│   │   ├── SearchPage.tsx            # 搜索页
│   │   ├── BookDetailPage.tsx        # 书籍详情页
│   │   ├── NotesPage.tsx             # 笔记页
│   │   ├── StatsPage.tsx             # 阅读统计页
│   │   ├── DiscoveryPage.tsx         # 发现推荐页
│   │   └── SettingsPage.tsx          # 设置页
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # 侧边导航栏
│   │   │   ├── Toolbar.tsx           # 顶部工具栏
│   │   │   └── PageShell.tsx         # 页面容器
│   │   ├── book/
│   │   │   ├── BookCard.tsx          # 书籍卡片
│   │   │   ├── BookGrid.tsx          # 书籍网格
│   │   │   ├── BookCover.tsx         # 封面组件
│   │   │   └── RatingBadge.tsx       # 评分标签
│   │   ├── search/
│   │   │   ├── SearchBar.tsx         # 搜索栏（含 scope 选择）
│   │   │   └── SearchResultItem.tsx  # 搜索结果项
│   │   ├── notes/
│   │   │   ├── BookmarkList.tsx      # 划线列表
│   │   │   ├── ReviewCard.tsx        # 点评卡片
│   │   │   └── ChapterNav.tsx        # 章节导航
│   │   ├── stats/
│   │   │   ├── ReadingChart.tsx      # 阅读时长图表
│   │   │   ├── StatCard.tsx          # 统计指标卡片
│   │   │   └── PeriodSelector.tsx    # 周期选择器
│   │   └── common/
│   │       ├── LoadingSpinner.tsx    # 加载动画
│   │       ├── ErrorBanner.tsx       # 错误提示
│   │       ├── EmptyState.tsx        # 空状态
│   │       └── Pagination.tsx        # 分页
│   └── lib/
│       └── utils.ts                  # 工具函数
├── src-tauri/                        # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs                   # 二进制入口
│       ├── lib.rs                    # Tauri 构建器 + 命令注册
│       ├── api.rs                    # 网关 API 客户端
│       ├── commands.rs               # 所有 Tauri 命令
│       ├── config.rs                 # 配置文件读写
│       ├── state.rs                  # 应用状态
│       └── types.rs                  # Rust 数据结构
```

---

## 二、Rust 后端设计

### 2.1 API 客户端 (`api.rs`)

核心设计：所有接口通过统一网关，`WeReadClient` 封装 typed 方法。

- **网关地址：** `https://i.weread.qq.com/api/agent/gateway`
- **请求格式：** POST JSON，`api_name` + `skill_version` + 业务参数平铺在同一层
- **鉴权：** `Authorization: Bearer {api_key}`
- **错误处理：** 401/403 → "API Key 鉴权失败"，其他非 200 → 中文错误信息

```rust
pub struct WeReadClient {
    client: reqwest::Client,
    api_key: String,
}

// 核心方法：合并 api_name/skill_version 和业务参数到同一层 JSON
async fn gateway_call<T: DeserializeOwned>(&self, api_name: &str, params: Value) -> Result<T, String>

// 16 个 typed 方法
pub async fn search(&self, keyword: &str, scope: i32, max_idx: i32, count: i32) -> Result<SearchResult, String>
pub async fn book_info(&self, book_id: &str) -> Result<BookInfo, String>
pub async fn chapter_info(&self, book_id: &str) -> Result<ChapterInfo, String>
pub async fn get_progress(&self, book_id: &str) -> Result<ReadingProgress, String>
pub async fn shelf_sync(&self) -> Result<ShelfSyncResult, String>
pub async fn notebooks(&self, count: i32, last_sort: i64) -> Result<NotebooksResult, String>
pub async fn bookmark_list(&self, book_id: &str) -> Result<BookmarkListResult, String>
pub async fn my_reviews(&self, book_id: &str, synckey: i64, count: i32) -> Result<ReviewListResult, String>
pub async fn public_reviews(&self, book_id: &str, review_type: i32, count: i32, max_idx: i32) -> Result<PublicReviewResult, String>
pub async fn reading_stats(&self, mode: &str, base_time: i64) -> Result<ReadingStatsResult, String>
pub async fn best_bookmarks(&self, book_id: &str, chapter_uid: i64) -> Result<BestBookmarksResult, String>
pub async fn underlines(&self, book_id: &str, chapter_uid: i64) -> Result<UnderlinesResult, String>
pub async fn read_reviews(&self, book_id: &str, chapter_uid: i64, reviews: Vec<ReviewRange>) -> Result<ReadReviewsResult, String>
pub async fn single_review(&self, review_id: &str) -> Result<SingleReviewResult, String>
pub async fn recommend(&self, count: i32, max_idx: i32) -> Result<RecommendResult, String>
pub async fn similar_books(&self, book_id: &str, count: i32, max_idx: i32) -> Result<SimilarBooksResult, String>
```

### 2.2 数据结构 (`types.rs`)

使用 `#[serde(rename_all = "camelCase")]` 对齐 JSON 字段名。分组：

- **配置类型：** `AppConfig`（持久化）、`AppSettings`（暴露给前端）
- **书籍类型：** `BookInfo`、`BookBrief`、`Chapter`、`ChapterInfo`、`ReadingProgress`
- **书架类型：** `ShelfSyncResult`（含 `books[]`、`albums[]`、`mp`）
- **笔记类型：** `NotebooksResult`、`BookmarkListResult`、`Bookmark`、`Review`
- **统计类型：** `ReadingStatsResult`（含 `readTimes`、`readDays`、`totalReadTime`、`preferCategory` 等）
- **搜索/发现：** `SearchResult`、`RecommendResult`、`SimilarBooksResult`

### 2.3 配置管理 (`config.rs`)

- 配置文件路径：`~/.weread-desktop/config.json`
- API Key 存储在配置文件中，前端只接收脱敏后的 `api_key_masked`
- 参考 biji2md 的 `config.rs` 模式

### 2.4 应用状态 (`state.rs`)

```rust
pub struct RuntimeState {
    pub client: Option<WeReadClient>,   // API Key 设置后初始化
    pub cache: HashMap<String, CachedResponse>,  // 内存 TTL 缓存（5 分钟）
}
```

### 2.5 Tauri 命令 (`commands.rs`)

共 21 个命令：

| 分类 | 命令 |
|------|------|
| 配置 | `get_settings`、`save_api_key`、`clear_api_key`、`get_platform_info` |
| 书架 | `sync_shelf` |
| 搜索 | `search_books` |
| 书籍详情 | `get_book_info`、`get_chapter_info`、`get_reading_progress` |
| 笔记 | `get_notebooks`、`get_bookmarks`、`get_my_reviews`、`get_public_reviews`、`get_best_bookmarks`、`get_underlines`、`get_read_reviews`、`get_single_review` |
| 统计 | `get_reading_stats` |
| 发现 | `get_recommendations`、`get_similar_books` |
| 深度链接 | `open_in_weread` |

---

## 三、前端设计

### 3.1 路由方案

使用 `react-router-dom` 的 `HashRouter`（兼容 Tauri 的 file:// 协议）：

| 路由 | 页面 | 说明 |
|------|------|------|
| `/bookshelf` | BookshelfPage | 书架（默认首页） |
| `/search` | SearchPage | 搜索 |
| `/book/:bookId` | BookDetailPage | 书籍详情 |
| `/notes` | NotesPage | 笔记概览 |
| `/notes/:bookId` | NotesPage | 指定书籍笔记 |
| `/stats` | StatsPage | 阅读统计 |
| `/discovery` | DiscoveryPage | 发现推荐 |
| `/settings` | SettingsPage | 设置 |

### 3.2 组件层级

```
App.tsx
├── Sidebar（侧边导航：书架/搜索/笔记/统计/发现/设置）
├── Toolbar（顶部栏：全局搜索、版本信息）
└── <Routes>
    ├── BookshelfPage → BookGrid → BookCard[]
    ├── SearchPage → SearchBar(scope选择) + SearchResultItem[]
    ├── BookDetailPage → BookInfo + ChapterNav + BookmarkList + ReviewCard + 深度链接按钮
    ├── NotesPage → NotebookCard[] / 指定书的 BookmarkList + ReviewCard
    ├── StatsPage → PeriodSelector + ReadingChart + StatCard[]
    ├── DiscoveryPage → 推荐书 Grid + 相似书推荐
    └── SettingsPage → API Key 输入 + 主题切换 + 关于
```

### 3.3 状态管理

每个页面使用独立的自定义 Hook 管理状态（与 biji2md 一致的模式）：

- 每个 Hook 封装：本地状态（data/loading/error）+ Tauri invoke 调用 + 派生状态
- 跨页面共享状态：仅 `AppSettings`（API Key 状态），在 App.tsx 加载后向下传递
- 不使用 Redux/Zustand 等全局状态库

### 3.4 UI 设计要点

- **主题色：** 微信读书品牌绿 `#1EB869`
- **暗色模式：** Tailwind `dark:` 修饰符 + class 切换
- **布局：** 左侧固定侧边栏 + 右侧内容区，桌面端宽度 1200x800
- **macOS 适配：** 隐藏标题栏 + Overlay 模式，侧边栏预留红绿灯空间

---

## 四、数据流示例

查看书籍详情的完整流程：

```
用户点击书籍卡片
  → React Router 导航到 /book/:bookId
  → BookDetailPage 挂载
  → useBookDetail(bookId) Hook 激活
  → Hook 调用 invoke("get_book_info", { bookId })
  → Rust commands.rs 获取 state lock
  → 调用 client.book_info(bookId)
  → WeReadClient::gateway_call("/book/info", { bookId })
  → HTTP POST 到网关（Bearer auth）
  → 响应 JSON 反序列化为 BookInfo 结构体
  → 返回前端 camelCase JSON
  → Hook 设置 React state
  → 页面渲染
```

---

## 五、深度链接支持

### 发出深度链接（在微信读书 App 中打开）

```
weread://reading?bId={bookId}                              # 打开书籍
weread://reading?bId={bookId}&chapterUid={chapterUid}      # 打开指定章节
weread://bestbookmark?bookId={bookId}&chapterUid={chapterUid}&rangeStart={start}&rangeEnd={end}  # 跳转到划线位置
```

通过 `tauri_plugin_shell` 的 `open()` 方法调用系统 URL handler。

---

## 六、依赖清单

### Cargo.toml

```toml
[dependencies]
dirs = "5"
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2" }
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
tokio = { version = "1", features = ["sync"] }
open = "5"
```

### package.json

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.3.5",
    "@tauri-apps/plugin-updater": "^2.7.1",
    "@tauri-apps/plugin-process": "^2.2.0",
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

## 七、分阶段实施

### 第一阶段：基础骨架（第 1-2 天）

1. 用 `npm create tauri-app` 初始化项目
2. 配置 Tailwind CSS v4 + Vite 插件
3. 实现 `config.rs` — 配置文件读写
4. 实现 `state.rs` — AppState + WeReadClient 持有
5. 实现 `api.rs` — `WeReadClient::new()` + `gateway_call()` 核心
6. 实现 `types.rs` — 所有数据结构（初期可用 `serde_json::Value` 过渡）
7. 实现设置相关命令：`get_settings`、`save_api_key`、`clear_api_key`
8. 前端：`App.tsx` + `HashRouter` + `Sidebar` + `Toolbar`
9. 前端：`SettingsPage` + `useSettings` Hook

**验证点：** 应用启动 → 输入 API Key → Key 持久化 → 脱敏显示正确

### 第二阶段：书架 + 搜索（第 3-4 天）

1. 实现 `shelf_sync`、`search_books` 命令
2. 前端：`BookshelfPage` + `useBookshelf` Hook
3. 前端：`SearchPage` + `useSearch` Hook（防抖输入）
4. 前端：`BookCard`、`BookGrid`、`BookCover` 组件
5. 前端：`SearchBar`（scope 选择器）、`SearchResultItem`
6. 前端：通用组件 `LoadingSpinner`、`ErrorBanner`、`EmptyState`

**验证点：** 加载书架 → 搜索书籍（不同 scope）→ 点击跳转详情

### 第三阶段：书籍详情（第 5-6 天）

1. 实现 `get_book_info`、`get_chapter_info`、`get_reading_progress` 命令
2. 实现 `get_bookmarks`、`get_my_reviews`、`get_public_reviews` 命令
3. 前端：`BookDetailPage` + `useBookDetail` Hook（聚合多接口）
4. 前端：`ChapterNav`、`BookmarkList`、`ReviewCard`
5. 前端：深度链接"在微信读书中打开"按钮

**验证点：** 书籍信息 + 章节目录 + 阅读进度 + 划线 + 点评完整展示，深度链接可用

### 第四阶段：笔记管理（第 7 天）

1. 实现 `get_notebooks`、`get_best_bookmarks`、`get_underlines`、`get_read_reviews`、`get_single_review` 命令
2. 前端：`NotesPage` + `useNotes` Hook
3. 前端：笔记本卡片（每本书的笔记数量统计）
4. 前端：点击进入指定书籍的划线 + 点评详情

**验证点：** 浏览所有笔记本 → 钻入具体书籍的划线和点评

### 第五阶段：阅读统计（第 8 天）

1. 实现 `get_reading_stats` 命令
2. 前端：`StatsPage` + `useReadingStats` Hook
3. 前端：`PeriodSelector`（周/月/年/总计切换）
4. 前端：`StatCard`、`ReadingChart`（CSS 柱状图或轻量图表库）

**验证点：** 按不同周期查看阅读统计，时长转换正确（秒 → 小时分钟）

### 第六阶段：发现推荐（第 9 天）

1. 实现 `get_recommendations`、`get_similar_books` 命令
2. 前端：`DiscoveryPage` + `useDiscovery` Hook
3. 前端：复用 `BookGrid`/`BookCard` 展示推荐
4. 前端：书籍详情页中集成"相似推荐"区域

**验证点：** 浏览个性化推荐 → 从详情页查看相似书籍

### 第七阶段：打磨完善（第 10-11 天）

1. 笔记导出功能（Markdown/JSON 格式导出划线和点评）
2. 键盘快捷键
3. 全局错误处理优化
4. 骨架屏加载状态
5. 暗色模式
6. 自动更新集成（复用 biji2md 的 updater 模式）
7. macOS 红绿灯适配

### 第八阶段：测试发布（第 12 天+）

1. 跨平台测试（macOS/Windows/Linux）
2. 各平台构建脚本
3. README 文档
4. GitHub Actions CI/CD

---

## 八、关键技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 路由 | HashRouter | 兼容 Tauri file:// 协议，无需服务端 History API 支持 |
| 状态管理 | 自定义 Hook | 与 biji2md 一致，简单够用，避免 Redux/Zustand 复杂度 |
| API Key 存储 | 配置文件 | 桌面应用场景，比环境变量更用户友好，支持设置 UI |
| 缓存 | 内存 TTL（5分钟） | 避免页面切换时重复请求，不持久化 |
| UI 框架 | Tailwind CSS v4 | 原子化 CSS，开发效率高，暗色模式支持好 |

---

## 九、参考文件

实施时参考 biji2md 项目的以下文件：

- `src-tauri/src/api.rs` — API 客户端模式：reqwest + Bearer auth + serde_json::Value 中间层
- `src-tauri/src/commands.rs` — Tauri 命令模式：`#[tauri::command]` + `State<'_, AppState>` + async
- `src-tauri/src/config.rs` — 配置持久化：`dirs::home_dir()` + JSON 读写
- `src-tauri/src/lib.rs` — Tauri 构建器：插件注册 + 命令注册
- `src/hooks/useSync.ts` — 前端 Hook 模式：`invoke<T>()` + 状态管理
- `src/App.tsx` — 页面布局 + 侧边栏 + onboarding 模式
