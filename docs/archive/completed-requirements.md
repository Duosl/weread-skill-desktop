# 已完成需求归档

本归档只用于追溯历史决策和完成记录。开始新任务时默认不读本文件；优先读 `docs/current-context.md` 和 `docs/requirements-pool.md`。

---

## 完成需求索引

| ID | 模块 | 完成摘要 | 主要入口 | 验证 |
|----|------|----------|----------|------|
| REQ-001 | Notes / Export | 前端想法分页加载，Notes 页和导出页预览循环读取所有个人想法。 | `src/lib/reviews.ts`、`src/hooks/useNotes.ts`、`src/pages/ExportPage.tsx` | `frontend:typecheck`、`frontend:build`、`cargo check` |
| REQ-002 | API / QA | 真实 API 数据校准，覆盖书架、笔记本分页、划线、想法、阅读统计、阅读进度。 | `src-tauri/src/api.rs`、相关类型和展示层 | `frontend:typecheck`、`frontend:build`、`cargo check` |
| REQ-003 | Docs | 清理 `mvp-design-doc.md` 中 JSON 导出和旧阶段计划遗留。 | `mvp-design-doc.md` | 文档检查 |
| REQ-004 | Export | 导出边界用例补齐：安全文件名、重名防覆盖、空内容、未匹配章节、取消 / 成功 / 失败反馈。 | `src-tauri/src/export.rs`、`src/lib/preview/exportPreview.ts`、`src/pages/ExportPage.tsx` | `frontend:typecheck`、`frontend:build`、`cargo check` |
| REQ-005 | UI | 窗口尺寸、长文本、空态 / 错误态 / 成功态走查。 | `src/index.css`、`src/pages/ExportPage.tsx`、`src/pages/NotesPage.tsx` | `frontend:typecheck`、`frontend:build`、`cargo check`、Chrome 截图抽查 |
| REQ-006 | Search | 书架 / 笔记本 / 导出范围本地搜索增强。 | `src/pages/NotesPage.tsx`、`src/pages/ExportPage.tsx` | `frontend:typecheck`、`frontend:build`、`cargo check` |
| REQ-008 | Export | Obsidian Base 所需 Frontmatter 当前已由 Markdown 导出支持。 | Markdown 导出与预览 | `frontend:typecheck`、`frontend:build`、`cargo check` |
| REQ-010 | Integration | 腾讯 ima Markdown 同步闭环完成，支持凭证、知识库选择、同步到 ima、同名笔记复用。 | `src/pages/ConnectorsPage.tsx`、`src-tauri/src/ima.rs`、`src-tauri/src/commands.rs` | 既有构建验收 |
| REQ-011 | Notes / Export | 合并为笔记工作台，侧边栏只保留笔记入口，浏览 / 导出用 Tab 分离。 | `src/pages/NotesWorkbenchPage.tsx`、`src/pages/NotesPage.tsx`、`src/pages/ExportPage.tsx`、`src/App.tsx` | `frontend:typecheck`、`frontend:build`、`cargo check`、`git diff --check` |
| REQ-012 | Report / Agent | 智能体报告支持自定义要求和输出形态：默认报告、PPT 风格、小红书图文风格。 | `src/pages/ReportPage.tsx`、`src/hooks/useAdvancedReport.ts`、`src-tauri/src/advanced_report.rs` | `frontend:typecheck`、`frontend:build`、`cargo check` |
| REQ-013 | UI / Design System | 全应用 UI 风格统一，新增设计执行文档和基础组件，收敛页面 shell、标题区、Tabs、按钮、弹窗。 | `design.md`、`src/components/layout/PageShell.tsx`、`src/components/ui/SegmentedControl.tsx`、`src/components/ui/IconButton.tsx`、`src/index.css` | `frontend:typecheck`、`frontend:build`、`cargo check`、`git diff --check` |

---

## 阅读报告与智能体报告阶段性完成记录

原 `REQ-007` / `REQ-007.1` 已完成可用闭环，但仍保留为真实数据回归观察项。后续问题在 `docs/requirements-pool.md` 的 `REQ-007R` 下记录或拆新需求。

已完成的稳定能力：

- 新增独立 `阅读报告` 页面和侧边栏入口。
- 基础报告使用确定性数据模型，不直接展示原划线和个人想法。
- 基础模板包括阅读分析报告、读书旅程、年度阅读报告。
- 报告预览和浏览器打开走 App 私有目录临时 HTML。
- 阅读报告页采用模板目录和单模板工作台，不把所有模板操作铺在列表页。
- 智能体模板已打通任务闭环：模板清单、生成设置、本地 Agent 调用、取消任务、读取 `output/report.html`、浏览器打开、历史记录、任务状态持久化。
- 智能体任务工作区约定为 `reports/jobs/<job-id>/`，包含 `input/`、`data/`、`output/`、`job.json`、`task.json`。
- `input/brief.md` 是唯一任务入口；其他 JSON 作为机器索引备份。
- 生成报告必须输出 `output/report.html` 和 `output/report.meta.json`。
- 模型输出流支持简洁 / 详细显示模式。
- 已加入质量提醒：内容过短、未使用“你”、证据链偏弱、PPT / 小红书结构不合格、HTML 安全边界问题等。
- 首次生成有质量提醒时会自动追加 `input/quality-fix.md` 并调用同一个本地 Agent 修正一次。
- 只要 `output/report.html` 已生成，即使 meta 解析失败或 Agent 最后返回异常，也降级为“有警告”而不是不可打开失败。
- 当前版本不支持分享版 HTML，不生成 `share.html`。
- 基础模板和智能体模板工作台当前只保留浏览器打开，HTML 导出入口暂不展示。
- 智能体报告支持输出形态：默认报告、PPT 风格 HTML、小红书图文 HTML。
- PPT 风格要求固定 16:9 舞台、完整切页状态机、按钮 / 键盘 / 滚轮 / 触控板翻页和底部安全区。
- 小红书图文风格要求多卡片画廊、3:4 截图卡、封面、页码和来源卡。
- 智能体报告数据目录新增 `profile.summary.json`，作为关键数字权威摘要，避免模型误写书架数、阅读时长或笔记数。
- 历史周期报告已按具体划线 / 想法创建时间过滤笔记，不再用整本书最近笔记时间误判周期。
- 生成任务上下文写入当前电脑日期、时间和时区，避免相对日期误判。

仍需观察：

- 真实数据下基础报告长书名、排行密度、小窗口布局。
- 智能体报告不同输出形态的稳定性。
- 原文授权文案和未授权时的 Agent 输入约束。

---

## 2026-05-25 收尾归档

- MVP 主线冻结：Markdown 导出、笔记浏览、书架管理、阅读统计和基础报告已作为主线能力保留。
- PDF 导出暂不排期，不再作为本地活跃需求推进。
- 腾讯 ima 联动已完成当前 Markdown 同步闭环；后续只根据用户反馈优化重导出逻辑、同步结果解释和导出内容文案。
- 新增下一阶段活跃需求：`REQ-014`、`REQ-015`、`REQ-016`。

---

## 2026-05-23

- 自动更新国内源：Tauri updater 新增 Gitee 固定清单 endpoint 作为首选源，Release workflow 增加 `release2gitee` 同步 GitHub Release 到 Gitee Release，并将改写为 Gitee 下载地址的 `latest.json` 推送到 GitHub / Gitee `updater` 分支；GitHub latest endpoint 保留为 fallback。

## 2026-05-22

- 设置页 Token 获取引导：已将 README 中的微信读书 API Token 获取步骤加入应用内设置页，支持一键打开微信读书 Skill 配置页；获取说明支持展开 / 收起，未配置时默认展开，保存后自动收起，并补充 Token 只保存在本机的说明；`frontend:typecheck`、`frontend:build` 通过。
- 智能体报告原文授权提示：必需读取划线原文和个人想法的模板改用更明确的授权文案；未授权时生成配置摘要显示警告色，授权 checkbox 显示红色必填缺失态，非必需模板保持普通可选展示；`frontend:typecheck`、`frontend:build` 通过。

## 2026-05-21

- REQ-013 全应用 UI 风格统一与设计系统收敛：新增 `design.md`，扩展 `PageShell`，新增 `SegmentedControl` / `IconButton`，统一书架、笔记工作台、笔记筛选、设置页按钮和支持弹窗的基础交互组件；全局 CSS 增加 token、焦点态、减弱动效和 z-index 层级。
- 书架类别筛选：书籍卡片显示完整 `category`，空类别显示「未分类」；书架工具栏新增本地一级类别筛选行。
- 书架页面简化：书架筛选只保留「全部」和「已读完」；只有 `finishReading=1` 时显示「读完」标签。

## 2026-05-20

- REQ-001 到 REQ-006 完成 MVP 主链路的数据、导出、UI 和搜索收敛。
- REQ-008 Obsidian Base 导出增强：用户确认现有 Frontmatter 能力已支持。
- 飞书需求表同步：合并 `rec27qYCk2C7z5` 到 `REQ-007`，新增 `REQ-008`、`REQ-010` 作为 P2 外部候选；PDF 导出候选已在 2026-05-25 从当前排期移除。
- Markdown-only 导出边界：已移除 JSON 导出命令和前端格式切换，导出入口固定为 `export_to_markdown`。
- Markdown Frontmatter：导出文件头部包含 `bookId`、`isbn`、`title`、`author`、`cover`、`lastReadDate`、`finishedDate`、`reading-time`、`progress`。
- 笔记页视图：支持笔记本列表、关键词搜索、划线与想法筛选，以及「按章节 / 按时间」两种视图。
- 导出页真实预览：选择单本书时读取真实划线、想法、书籍信息和阅读进度生成 Markdown 预览；多本选择时只展示提示。
- API 本地缓存：API 响应写入本地缓存，设置页可调整自动刷新间隔。
- 自动更新发布修正：Windows updater 元数据改为使用 Tauri v2 `createUpdaterArtifacts: true` 对应的 `-setup.exe` / `-setup.exe.sig`。

---

最后更新：2026-05-25
