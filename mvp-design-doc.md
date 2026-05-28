# 书迹产品设计文档

最后更新：2026-05-28

## 产品定位

书迹是一款微信读书数据导出与管理桌面工具。它帮助用户把微信读书里的书架、划线、个人想法、阅读统计和报告整理成可归档、可复盘、可分享的个人阅读资产。

书迹不是微信读书客户端，不提供在线阅读、书城推荐、相似书推荐、公共书评浏览或社交社区功能。

## 当前产品范围

### 主流程

```text
配置 API Key
  -> 刷新概览与书架
  -> 浏览书籍、划线和想法
  -> 导出 Markdown 或同步到 ima
  -> 生成基础/高级阅读报告
```

### 页面与入口

| 页面 | 当前能力 |
| --- | --- |
| 概览 | 阅读总时长、读过/读完、笔记数量、阅读天数、分类偏好、阅读趋势、最长阅读书籍。 |
| 我的书架 | 书架同步、本地搜索、类别筛选、已读完筛选、最近阅读/最多笔记排序、列表/封面墙视图、书籍侧栏详情。 |
| 划线与想法 | 单本书笔记工作台，支持搜索、类型筛选、颜色筛选、章节/时间浏览、跳转微信读书、分享卡片。 |
| 导出 | 作为「划线与想法」的工作台标签存在，支持单本/批量 Markdown 导出、真实预览、输出目录选择、ima 同步入口。 |
| 阅读报告 | 基础 HTML 报告、报告导出/浏览器预览、高级 Agent 模板、任务历史、日志查看、取消/删除任务。 |
| 连接器 | 配置 ima Client ID / API Key，选择知识库，并从导出工作台发起同步。 |
| 设置 | 微信读书 API Key、缓存刷新、匿名统计、版本更新、交流群、支持入口。 |

### 不进入当前范围

- PDF 导出。
- 在线阅读体验。
- 书城推荐、相似推荐、公共书评浏览。
- 在线分享平台。
- 完整 HTML 编辑器。
- 让应用替代微信读书 App 的功能集合。

## 数据与系统能力

### 微信读书 API

API 参数、字段含义、分页、单位和错误处理以 `~/.agents/skills/weread-skills/` 为准。仓库文档不复制字段表。

当前代码使用的能力包括：

- 书架同步：`sync_shelf`
- 书籍信息与进度：`get_book_info`、`get_book_progress`
- 划线与想法：`get_bookmarks`、`get_my_reviews`、`get_notebooks`
- 阅读统计：`get_reading_stats`

出现 `upgrade_info` 或 API 需要用户重新授权时，后端必须返回可展示的错误，不把失败伪装成空数据。

### 本地配置与缓存

- API Key、ima 凭证、导出目录、缓存刷新间隔和匿名统计开关由 Rust 配置模块保存。
- 前端只展示脱敏凭证。
- 微信读书 API 响应写入本地缓存；设置页可查看缓存信息、调整刷新间隔或清空缓存。

### 导出

Markdown 是当前唯一正式笔记导出格式。

导出要求：

- 单本或批量导出。
- 每本书一个 Markdown 文件。
- 输出到用户选择目录下的 `markdown/` 子目录。
- 支持包含/排除划线、个人想法。
- 支持按章节分组。
- Frontmatter 保留资料库索引字段：书籍 ID、ISBN、标题、作者、封面、最近阅读时间、读完时间、阅读时长、进度等。

### 分享卡片

划线和想法可以生成 PNG 分享卡片。分享版必须与正式 Markdown 导出分开：分享图可以带「书迹」桌面端署名，但不能改变用户本地私有导出内容。

### 阅读报告

基础报告由确定性数据模型渲染，不调用 Agent。

高级报告通过本机 Agent CLI 执行，前端只负责模板选择、隐私确认、任务状态和结果查看。模板分为：

- 深度分析：阅读人格、知识结构盲区、下一阶段阅读建议。
- 分享型：年度关键词、年度 Top 书单、阅读偏好雷达、精神书架。

高级报告输出仍是本地 HTML 文件，可导出为：

- 通用网页。
- PPT 风格网页。
- 小红书图文风格网页。

涉及划线原文、书摘或个人想法时，必须由用户显式确认。未授权时，Agent 输入必须明确告知不可使用或编造原文证据。

### ima 连接器

ima 是外部知识库同步能力，不是主线导出格式的替代品。

当前行为：

- 用户配置 ima Client ID / API Key。
- 应用读取可添加的知识库列表。
- 用户选择目标知识库。
- 导出工作台把选定书籍的 Markdown 内容同步到知识库。
- 发现同名 ima 笔记时复用已有笔记并重新加入知识库。

不支持在书迹内新建 ima 知识库，不支持 PDF 同步，不做后台自动同步。

## 主要 Tauri 命令

| 分类 | 命令 |
| --- | --- |
| 设置 | `get_settings`、`save_api_key`、`clear_api_key`、`save_cache_settings`、`save_export_settings` |
| 缓存与统计 | `get_api_cache_info`、`clear_api_cache`、`save_telemetry_enabled`、`reset_telemetry_installation_id`、`send_telemetry_ping` |
| 微信读书 | `sync_shelf`、`get_book_info`、`get_book_progress`、`get_bookmarks`、`get_my_reviews`、`get_notebooks`、`get_reading_stats` |
| 导出与系统 | `export_to_markdown`、`open_export_folder`、`open_in_weread`、`save_image_file` |
| 报告 | `export_report_html`、`preview_report_html`、`open_report_file` |
| Agent | `detect_local_agents`、`invoke_local_agent`、`cancel_local_agent` |
| 高级报告 | `list_advanced_report_templates`、`create_advanced_report_job`、`start_advanced_report_task`、`list_advanced_report_tasks`、`read_advanced_report_output`、`read_advanced_report_logs`、`export_advanced_report_output`、`cancel_advanced_report_task`、`delete_advanced_report_job` |
| ima | `save_ima_credentials`、`clear_ima_credentials`、`test_ima_connection`、`list_addable_ima_knowledge_bases`、`save_ima_target`、`sync_books_to_ima` |

## 验收口径

功能完成必须满足：

- 用户可见文案不暴露工程字段或内部模块名。
- 数据口径以微信读书 skill 文档和当前代码为准。
- UI 遵循 `ui-style-guide.md` 与 `design.md`。
- `./init.sh` 通过；失败时必须记录原因和剩余风险。
- `feature_list.json`、`progress.md`、`session-handoff.md` 与需求池同步。
