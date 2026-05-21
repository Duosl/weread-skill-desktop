# WeRead Skill Desktop - 需求池

本文件承接项目需求状态、优先级、完成记录和下一步建议。`AGENTS.md` 只负责规定代理工作方式，不记录会频繁变化的需求细节。

---

## 使用规则

### 飞书需求收集表同步

外部收集入口：`https://my.feishu.cn/wiki/SuvEweIueio4HckdjYocYJsgnod?table=tblDgYWsdzy9hYkp&view=vewdxXFqVN`

默认用 `lark-cli` 的 user 身份读取和回写：

```bash
lark-cli base +record-list \
  --base-token RrRSbRyU9asqCSsPRcacGt93nPw \
  --table-id tblDgYWsdzy9hYkp \
  --view-id vewdxXFqVN \
  --offset 0 \
  --limit 200 \
  --as user
```

权限状态：

- user 身份已验证可以解析 Wiki、创建记录和更新记录。
- bot 身份已验证可以读取该表，但创建记录返回 `HTTP 403: you don't have permission`，不能直接回写状态或新增记录。
- 如果 user 身份出现 `need_user_authorization`，执行 `lark-cli auth login --domain wiki,base` 后重试；只读场景可临时使用 `--as bot`。

字段映射：

| 飞书字段 | 本地需求池字段 |
|----------|----------------|
| `需求概述` | 需求标题 |
| `预期实现效果` | 背景 / 验收 |
| `其他补充信息` | 补充说明 / 剩余风险 |
| `优先级` | 优先级 |
| `状态` | 状态 |
| `提出人` | 来源 |
| `创建时间` | 来源时间 |
| `上线版本` | 完成记录 |

状态映射：

| 飞书状态 | 本地状态 | 处理规则 |
|----------|----------|----------|
| `收集箱` | `Todo` 或待澄清 | 信息足够且符合 MVP/近期范围时加入需求列表；否则只作为候选，不抢占当前推荐 |
| `规划中` | `Todo` | 可排期，按优先级与 MVP 边界排序 |
| `开发中` | `Doing` | 同一时间尽量只保留一个 Doing；若冲突，优先以当前对话正在实现的需求为准 |
| `已上线` | `Done` | 补完成说明、验证结果和上线版本 |

去重规则：

1. 先按飞书 `record_id` 查找本地条目是否已记录来源。
2. 没有来源记录时，再按需求标题和模块判断是否与现有 REQ 重复。
3. 已有本地 REQ 的需求，只补来源、背景或验收，不重复新增 ID。
4. 飞书条目缺少优先级时，先按 `P2` 候选处理；缺少验收或范围不清时，标记待澄清。

### 状态

- `Todo`：尚未开始，可以排期。
- `Doing`：正在实现。同一时间尽量只保留一个 Doing。
- `Blocked`：已明确阻塞，需要先补信息、权限、设计或 API 校准。
- `Done`：已完成并通过必要验收。

### 优先级

- `P0`：会导致核心流程数据缺失、导出错误或无法完成 MVP。
- `P1`：明显提升稳定性、效率或可用性，但不阻断核心流程。
- `P2`：增强能力或可选体验，必须在 P0/P1 收敛后再做。
- `P3`：想法收集或长期候选，不进入当前推荐，除非用户明确指定。

### 完成一个需求后

1. 将对应条目状态改为 `Done`。
2. 在条目中补充完成说明、改动入口和验证结果。
3. 如果该需求来自飞书表，回写飞书状态为 `已上线`，并补充 `上线版本` 或 `其他补充信息`。
4. 如果产生新问题，把它作为新条目加入本需求池，必要时同步到飞书表。
5. 在对话最终回复中提示“建议下一个启动”的最高优先级 `Todo` 条目。

---

## 当前推荐

建议下一个启动：`REQ-007 HTML 阅读报告生成器` 的智能体报告 CLI 接入。

原因：基础 HTML 报告和导出模板入口已经有进展；下一步应接入本地 CLI 封装库，把智能体模板从规划中变成可执行能力。

---

## 需求列表

| ID | 优先级 | 状态 | 模块 | 需求 |
|----|--------|------|------|------|
| REQ-001 | P0 | Done | Notes / Export | 前端想法分页加载 |
| REQ-002 | P0 | Done | API / QA | 真实 API 数据校准 |
| REQ-003 | P1 | Done | Docs | 同步清理 `mvp-design-doc.md` 中过期阶段和 JSON 遗留描述 |
| REQ-004 | P1 | Done | Export | 导出边界用例补齐 |
| REQ-005 | P1 | Done | UI | 窗口尺寸、长文本、空态/错误态走查 |
| REQ-006 | P1 | Done | Search | 书架/笔记本本地搜索增强 |
| REQ-007 | P2 | Doing | Export | HTML 阅读报告生成器 |
| REQ-008 | P2 | Done | Export | Obsidian Base 导出增强 |
| REQ-009 | P2 | Todo | Export | 导出为 PDF 文档 |
| REQ-010 | P2 | Todo | Integration | 腾讯 ima 联动 |
| REQ-011 | P1 | Done | Notes / Export | 合并为笔记工作台 |

---

## 需求详情

### REQ-001 前端想法分页加载

- 优先级：P0
- 状态：Done
- 模块：`src/hooks/useNotes.ts`、`src/pages/ExportPage.tsx`
- 背景：`get_my_reviews` 支持 `synckey` / `hasMore` 分页，Rust 导出路径 `load_all_reviews` 已循环加载，但前端页面和导出预览仍只请求 `count: 100`。
- 完成说明：新增前端分页 helper `src/lib/reviews.ts`，`useNotes` 和导出页单本预览均循环加载 `get_my_reviews`，直到 `hasMore !== 1` 或返回空页。
- 改动入口：`src/lib/reviews.ts`、`src/hooks/useNotes.ts`、`src/pages/ExportPage.tsx`。
- 验证结果：`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。
- 验收：
  - `useNotes` 循环调用 `get_my_reviews`，直到 `hasMore !== 1` 或返回空页。
  - 导出页单本预览使用相同分页逻辑。
  - API 错误能正常进入现有错误展示路径。
  - `npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。
- 完成后建议：继续 `REQ-002`。

### REQ-002 真实 API 数据校准

- 优先级：P0
- 状态：Done
- 模块：API 解析、统计展示、导出字段
- 背景：MVP 已能串起核心流程，但字段单位、缺省值、分页游标和统计口径必须以 `~/.agents/skills/weread-skills/` 和真实账号响应校准。
- 完成说明：已用真实 API 校准 `shelf_sync`、`notebooks`、`bookmark_list`、`my_reviews`、`reading_stats`、`book_progress`。修正 `reading_stats` 中 `dayAverageReadTime` 不再用 `totalReadTime / readDays` 伪造；兼容点评 `chapterTitle`；兼容阅读统计 `readLongest` 中有声书 `albumInfo`。
- 验证结果：真实 API 抽样覆盖书架、笔记本分页、大量划线书、只有想法/点评书、阅读统计和阅读进度；`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。
- 剩余风险：真实内容样本只做字段和聚合级验证，未在文档中记录私有书名或笔记内容；`dayAverageReadTime` 在真实回包中可能缺省，前端必须按缺省值处理。
- 验收：
  - 覆盖 `shelf_sync`、`notebooks`、`bookmark_list`、`my_reviews`、`reading_stats`、`book_progress`。
  - 记录无法稳定获得的字段，不用前端假数据补齐。
  - 至少覆盖 3 本不同类型书：无笔记书、有大量划线书、只有想法/点评书。
  - 更新相关设计文档或 README 中受影响的说明。
- 完成后建议：继续 `REQ-004` 或 `REQ-005`。

### REQ-003 同步清理设计文档遗留描述

- 优先级：P1
- 状态：Done
- 模块：`mvp-design-doc.md`
- 背景：当前实现已收敛为 Markdown-only 导出，但设计文档的后段阶段计划仍残留 `export_to_json`、选择格式、旧组件拆分和部分未勾选阶段内容。
- 完成说明：已清理 `mvp-design-doc.md` 中 JSON 导出、保存文件对话框和旧阶段待办描述；第十节改为当前实现与剩余质量收敛，不再充当需求池。
- 验证结果：`mvp-design-doc.md` 中不再出现 `export_to_json`、`JSON`、`选择格式`、`Markdown 与 JSON` 或旧 `[ ]` 阶段计划残留。
- 验收：
  - 清理 JSON 导出遗留描述。
  - 将已实现能力与待办能力拆清楚。
  - 保持 `mvp-design-doc.md` 作为产品范围和技术边界文档，而不是需求池。
- 完成后建议：回到最高优先级未完成需求。

### REQ-004 导出边界用例补齐

- 优先级：P1
- 状态：Done
- 模块：`src-tauri/src/export.rs`、导出页
- 背景：导出是核心价值，需要覆盖空笔记本、只有划线、只有想法、无章节名、无作者名、超长书名、非法文件名、重名文件、目录无权限、用户取消目录选择等情况。
- 完成说明：导出目录为空直接报错；文件名做非法字符清理、空标题 fallback、长度截断和重名防覆盖；按章节导出时未匹配到章节的划线/想法统一输出到「其他笔记」；空内容输出明确提示；前端展示取消目录、成功消息、失败错误、进度和已生成文件列表。
- 改动入口：`src-tauri/src/export.rs`、`src/lib/preview/exportPreview.ts`、`src/pages/ExportPage.tsx`。
- 验证结果：`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。
- 验收：
  - Rust 导出不把系统错误伪装成成功。
  - 文件名处理可靠，必要时避免重名覆盖。
  - UI 对取消、失败、成功都有明确反馈。
  - Markdown 内容与预览口径一致。

### REQ-005 UI 走查

- 优先级：P1
- 状态：Done
- 模块：全局 UI
- 背景：应用要符合 `ui-style-guide.md` 的 Quiet Reading Ledger，不应出现错位、拥挤、长文本撑破或通用 SaaS 化。
- 完成说明：补充导出目录行换行、列表搜索框尺寸、书架底部文本截断、章节/笔记/预览/进度长文本换行或截断规则；Notes 与 Export 保持内容优先布局。
- 改动入口：`src/index.css`、`src/pages/ExportPage.tsx`、`src/pages/NotesPage.tsx`。
- 验证结果：`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过；临时移除代理后已用本机 Chrome 截图检查 `/#/notes` 和 `/#/export`，布局无明显错位。浏览器预览环境缺少 Tauri runtime，会显示 `invoke` 不存在的错误横幅，桌面运行时不受此限制。
- 验收：
  - macOS 默认窗口、最小窗口、宽屏窗口无明显错位。
  - 长书名、长作者名、长划线、长想法不撑破布局。
  - 加载态、空态、错误态、成功态完整。
  - Notes 与 Export 的核心视觉优先级高于统计卡片和辅助区域。

### REQ-006 书架/笔记本本地搜索增强

- 优先级：P1
- 状态：Done
- 模块：Dashboard / Notes / Export
- 背景：MVP 允许本地搜索，当前笔记内容已有搜索，书架和导出范围选择仍可继续增强筛选效率。
- 完成说明：书架已有标题/作者本地搜索；新增 Notes 左侧笔记本标题/作者搜索；新增 Export 选择书籍标题/作者搜索，支持全选筛选结果。
- 改动入口：`src/pages/NotesPage.tsx`、`src/pages/ExportPage.tsx`。
- 验证结果：`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。
- 验收：
  - 书架或笔记本列表支持标题/作者本地搜索。
  - 导出页大量书籍下可快速定位目标。
  - 不引入书城搜索或推荐发现，除非用户明确要求。

### REQ-007 HTML 阅读报告生成器

- 优先级：P2
- 状态：Doing
- 模块：Export
- 来源：飞书记录 `rec27qYCk2C7z5`，提出人 `Duosl`，创建时间 `2026-05-20 11:44:15`。
- 背景：报告能力升级为 HTML 阅读报告生成器：先把阅读统计、书籍、分类、划线、想法等数据整理为统一报告数据模型，再用不同 HTML 风格模版导出静态网页。飞书收集项补充希望支持内置报告模版、分享，以及区分调用已安装 CLI 版本 / API Key 版本。详见 `mvp-design-doc.md` 5.4 节。
- 详细实现方案：`docs/advanced-report-implementation-plan.md`。
- 产品分层：
  - 基础模版：不依赖大模型，基于确定数据生成年度 / 月度阅读报告、读书旅程、阅读分析报告、成长路径报告、个人阅读账本。
  - 智能体模版：需要解释和归纳，后续可支持阅读人格分析、阅读画像、阅读局限诊断、MBTI 风格阅读测试、知识结构盲区和下一阶段阅读建议。
- 第一版范围：
  - 新增独立 `阅读报告` 页面；报告不是 Markdown 导出的附属选项，而是可浏览、可切换、可预览的内容页。
  - HTML 阅读报告支持 3 个内置模版：`阅读分析报告`、`读书旅程`、`年度阅读报告`。
  - 浏览器预览先生成 App 私有目录下的临时 HTML，再用系统默认浏览器打开；正式导出时再让用户选择目录并写入 `.html` 文件。
  - 当前 Markdown 导出保持默认能力，不被 HTML 报告影响。
- 当前进展：
  - 已新增独立 `阅读报告` 页面和侧边栏入口。
  - 已定义 `ReadingReportData`，并用 `reading_stats`、`notebooks`、代表性 `bookmark_list` / `my_reviews` 抽样构建报告数据。
  - 已实现 3 个基础报告预览模版：阅读分析报告、读书旅程、年度阅读报告。
  - 已加入规则化结论、分类偏好、读书路径、Top 书籍、代表性划线 / 想法摘录。
  - 已扩展源数据覆盖：笔记最多的前 10 本书抽样、最多 24 条代表性摘录，新增完成率、日均阅读、笔记/书密度、分类占比、时间线峰值/趋势、长读排行、划线排行、想法排行、进度排行和数据覆盖摘要。
  - 模版模块已按数据存在与否条件渲染，月度等数据较少场景不会展示空模块。
  - 已实现 `.html` 文件导出、App 私有目录预览文件和系统默认浏览器打开能力；当前还未实现更完整的 AI 叙事报告。
  - 已将阅读报告页重构为模板目录：基础模板卡片点击后进入接近全屏的报告工作台，集中展示预览、浏览器打开和导出入口。
  - 已在 `mvp-design-doc.md` 增补智能体报告完整方案：模板包、提示词模板、输入输出目录、job 目录和 CLI 调用边界。
  - 已在 `AGENTS.md` 记录当前开发偏好：普通 Markdown 导出页保持现有工作台结构；阅读报告页使用模板目录和全屏报告工作台；智能体模板不伪造能力。
  - 已升级 `/Users/duoshilin/duosl/sidework/agent-cli-bridge`：支持 `model` 透传、`Argv` / `ArgvMessage` prompt 传递、`Start.prompt_bytes`、`Raw`、`Canceled` 和取消句柄。
  - 已在 WeRead 后端接入可取消本地 agent job：`RuntimeState` 按 `job_id` 注册取消句柄，新增 `cancel_local_agent(job_id)`；前端 `useAgentBridge` 暴露 `cancelAgent(jobId)`。
  - 已新增智能体报告工作区骨架：`src-tauri/src/advanced_report.rs`、`list_advanced_report_templates`、`create_advanced_report_job`、`src/hooks/useAdvancedReport.ts`。
  - 阅读报告页的智能体模板已从占位变为真实模板清单，可确认隐私授权并准备 `reports/jobs/<job-id>/` 工作区，写入 `input/`、`data/`、`output/` 和 `job.json`。
  - 智能体模板已打通可用闭环：自动选择可用本地 Agent、调用生成、取消任务、读取 `output/report.html`、浏览器打开、导出 HTML。
  - 已优化智能体模板输入协议：`input/brief.md` 作为唯一任务入口，其他 JSON 作为机器索引备份；prompt 强制报告主语使用“你”，并要求报告包含 `WeRead Skill Desktop` 软件标识。
  - 已新增智能体报告输出质量提醒：内容过短、未使用“你”、残留“这个用户/该用户”、缺少软件标识时在预览区提示。
  - 已将智能体模板交互从“工作流配置”改为“报告任务中心”：普通用户只需选择模板并开始生成；任务在后台运行，支持离开页面后继续、回来查看进行中任务、同时多个任务、取消、打开完成报告。
  - 已进一步简化智能体模板页：移除底部任务列表，模板卡片直接显示生成中、已完成、失败/取消状态和对应操作；同一模板同一时间只允许一个活跃任务。
  - 已在智能体模板卡片增加“历史”入口：按模板查看生成记录，支持查看、浏览器打开和删除单个 job；后端从运行态任务和本地 job 目录合并历史记录。
  - 已新增智能体报告任务状态持久化：写入 `task.json`，应用重启后未生成 `output/report.html` 的运行中任务会显示为已中断 / 未完成，不再误显示为生成中。
  - 已移除智能体报告分享版：当前版本不要求生成 `share.html`，前端也不展示分享按钮。
  - 已移除前端本地 Agent 和模型选择表单：应用自动选择可用 CLI，模型使用用户 CLI 默认配置。
  - 已将智能体模板生成设置从报告列表页移入模板详情弹窗；列表页只保留模板选择和状态，模板详情内集中展示模板说明、生成设置和历史记录。
  - 已将阅读报告模板目录改为「基础模板 / 智能体模板」双 Tab，并把 Tab 放在原区块标题位置，避免两类模板混在同一滚动页面，便于后续分别管理。
  - 阅读报告页默认选中「智能体模板」Tab，基础模板保留为手动切换入口。
  - 已将智能体报告生成日志改为完整追加展示，不再只保留最后 500 条；点击「开始生成 / 再次生成」后会直接打开新任务详情并展开生成过程，原模板详情保持打开。
  - 已将生成过程从终端日志改为模型输出流：连续思考和正文输出会合并展示，保留流式片段中的空格，过滤 model/session/cwd/usage 等调试信息，并使用浅色消息块替代黑色日志框。
  - 已为智能体报告生成过程新增简洁 / 详细显示模式：默认简洁模式只显示任务状态和最新一行内容，详细模式保留完整模型输出流样式。
  - 已将 `agent-cli-bridge` vendoring 到仓库内 `vendor/agent-cli-bridge`，`src-tauri` 改用仓库内 path 依赖，避免干净 checkout 或 CI 构建依赖作者本机相邻目录。
  - 已在用户授权“使用个人划线和想法”后实际预取原始笔记内容：按有划线 / 想法的笔记本逐本写入 `data/notes.raw.json`，包含章节、划线和分页拉取后的个人想法 / 点评，供智能体报告在本地工作区内读取。
- 技术边界：
  - 先定义统一 `ReadingReportData`，模版读取报告模型，不直接读取微信读书原始 API 回包。
  - 基础数据来自 `reading_stats`、`notebooks`、`bookmark_list`、`my_reviews`、`book_info`、`book_progress`。
  - 导出预览和最终 HTML 文件应使用同一套报告数据模型。
  - 智能体模版后续通过 `GeneratedInsight[]` 扩展，不让 HTML 模版直接调用模型。
  - 智能体模板目录约定为 `reports/templates/<template-id>/`，任务目录约定为 `reports/jobs/<job-id>/`，应用通过模板清单和 job 状态查看输入输出，不让前端直接操作任意路径。
  - 当前版本不支持分享版 HTML；分享能力后续单独设计，不进入本版输出契约。
  - 第一版智能体报告采用文件工作区协议，不做运行中双向 RPC；如需更多数据，由 Agent 写 `output/data-requests.json`，应用后续补数据再二次调用。
- 暂不做：
  - 第一版不做完整 HTML 编辑器。
  - 第一版不做在线分享平台。
  - 第一版不做 PDF 渲染，PDF 由 `REQ-009` 单独设计。
  - 第一版不做 AI 分析；只为后续 `insights` 预留模型字段。
- 验收：
  - `mvp-design-doc.md` 中明确 HTML 阅读报告的数据模型、基础模版、智能体模版和第一版边界。
  - 实现前先确认 `ReadingReportData` 字段和数据来源。
  - 第一版至少能导出一个可本地打开的 HTML 报告。
  - Markdown 导出仍为默认路径，且不被报告功能破坏。
  - 报告导出失败不影响普通 Markdown 导出。
  - 高级 AI 分析必须有隐私确认和数据裁剪方案后再进入实现。

### REQ-008 Obsidian Base 导出增强

- 优先级：P2
- 状态：Done
- 模块：Export
- 来源：飞书记录 `rec27qYACS18S2`，提出人 `Duosl`，创建时间 `2026-05-20 11:42:39`。
- 背景：飞书收集项希望 Markdown 支持更适合 Obsidian Base 的 Frontmatter，方便用户在 Obsidian 中创建 Base 并可视化。当前 Markdown Frontmatter 已有基础字段，仍需澄清 Obsidian Base 需要的字段命名、类型和示例视图。
- 完成说明：现有 Markdown Frontmatter 已包含 `bookId`、`isbn`、`title`、`author`、`cover`、`lastReadDate`、`finishedDate`、`reading-time`、`progress` 等资料库索引字段，可直接支撑 Obsidian Base 建表与视图配置；本轮按用户确认标记为已支持。
- 验证结果：导出预览和 Rust 实际导出口径已对齐；`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。
- 验收：
  - 明确 Obsidian Base 所需 Frontmatter 字段清单和字段类型。
  - 不破坏现有 Markdown 导出和资料库索引字段。
  - 补充一份 Obsidian Base 使用示例或 README 说明。

### REQ-009 导出为 PDF 文档

- 优先级：P2
- 状态：Todo
- 模块：Export
- 来源：飞书记录 `rec27qYMwke04e`，提出人 `曲小明`，创建时间 `2026-05-20 11:53:54`。
- 背景：飞书收集项希望读书笔记可以导出为 PDF 文档。该能力不属于当前 Markdown-only MVP，需先确定 PDF 渲染来源、样式和文件命名策略。
- 验收：
  - 明确 PDF 是否由 Markdown 渲染生成，以及是否复用当前导出预览样式。
  - 失败时不影响默认 Markdown 导出。
  - UI 中清楚区分 Markdown 与 PDF 导出入口。

### REQ-010 腾讯 ima 联动

- 优先级：P2
- 状态：Todo
- 模块：Integration
- 来源：飞书记录 `rec27qYOrn5Fmy`，提出人 `曲小明`，创建时间 `2026-05-20 11:55:43`。
- 背景：飞书收集项希望笔记自动导出到腾讯 ima 笔记和知识库，格式包含 Markdown 和 PDF。该能力涉及外部服务集成，不进入当前 MVP 主线，需先确认 ima 的导入 API、认证方式和用户授权流程。
- 验收：
  - 明确 ima 可用导入能力和认证边界。
  - 导出失败不能影响本地 Markdown/PDF 文件生成。
  - 用户可选择是否启用该联动。

### REQ-011 合并为笔记工作台

- 优先级：P1
- 状态：Done
- 模块：Notes / Export / Navigation
- 背景：笔记页和导出页都围绕微信读书笔记数据，但当前分成两个侧边栏入口。笔记页负责浏览、搜索、查看单本书划线和想法；导出页负责批量选择、配置导出、预览和生成文件。二者可以合并入口，但不应直接揉成一个长页面。
- 产品结论：新增 `NotesWorkbenchPage`，内部用 Tab 区分 `浏览` 和 `导出`。侧边栏只保留 `笔记` 入口，去掉单独 `导出` 入口；旧 `/export` 路由重定向到 `/notes?tab=export`，避免旧链接失效。
- 当前实现：
  - 新增 `src/pages/NotesWorkbenchPage.tsx`，作为笔记工作台容器。
  - `NotesPage` 增加 `embedded` 模式，并把当前选中书籍同步给工作台头部操作区。
  - `ExportPage` 增加 `embedded` 模式和 `initialSelectedBookId`，支持从浏览 Tab 带当前书进入导出。
  - 侧边栏移除独立 `导出` 项。
  - `mvp-design-doc.md` 路由设计已同步为工作台结构。
- 完成说明：已完成工作台容器、路由重定向、侧边栏入口收敛、浏览到导出当前书的跳转，以及导出范围计数文案优化；`浏览 / 导出` Tab 已移到「笔记」标题后方，`导出当前书 / 微信读书` 已上移到页面头部操作区。
- 验证结果：`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check`、`git diff --check` 通过；普通浏览器预览会被无 API Key 状态拦截到概览页，桌面运行时仍需在 Tauri 环境内做一次真实数据回归。
- 验收：
  - 侧边栏只保留一个 `笔记` 入口，导出入口可从笔记工作台内清晰进入。
  - `浏览` Tab 保留现有笔记浏览、搜索、筛选能力。
  - `导出` Tab 保留现有批量选择、导出选项、预览和结果反馈能力。
  - 从笔记浏览到导出当前书的路径清晰，不需要用户重新搜索该书。
  - 旧 `/export` 路由可重定向到 `/notes?tab=export`。
  - `npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。

---

## 已完成记录

### 2026-05-21

- 书架类别筛选：书籍卡片显示完整 `category`，空类别显示「未分类」；书架工具栏新增本地一级类别筛选行，支持与「全部 / 已读完」状态筛选和搜索组合使用；`frontend:typecheck`、`frontend:build`、`cargo check` 通过。
- 书架页面简化：书架筛选只保留「全部」和「已读完」；书籍卡片与详情面板只在 `finishReading=1` 时显示「读完」标签，未读完书籍不再显示在读/未读标签；`frontend:typecheck`、`frontend:build`、`cargo check` 通过。

### 2026-05-20

- REQ-001 前端想法分页加载：Notes 页和导出页单本预览已通过 `src/lib/reviews.ts` 共享分页加载所有想法，不再只取前 100 条；`frontend:typecheck`、`frontend:build`、`cargo check` 通过。
- REQ-002 真实 API 数据校准：已校准书架、笔记本分页、划线、想法、阅读统计和阅读进度字段；修正统计均值缺省、点评章节字段、有声书 `readLongest` 映射。
- REQ-003 设计文档清理：已移除 Markdown-only MVP 中的 JSON 导出遗留描述和过期阶段待办。
- REQ-004 导出边界用例：已补齐文件名安全处理、重名防覆盖、空内容提示、未匹配章节输出、取消/成功/失败反馈和生成文件列表。
- REQ-005 UI 走查：已补齐长文本、目录行、搜索框、预览和进度布局保护；已用本机 Chrome 截图检查 `/#/notes` 和 `/#/export`，浏览器预览仅受 Tauri runtime 缺失影响。
- REQ-006 本地搜索增强：Notes 笔记本列表和 Export 导出范围支持标题/作者搜索，导出页支持全选筛选结果。
- REQ-008 Obsidian Base 导出增强：用户确认现有 Frontmatter 能力已支持，状态更新为 Done。
- 飞书需求表同步：已用 user 身份读取外部收集表，合并 `rec27qYCk2C7z5` 到 `REQ-007`，新增 `REQ-008`、`REQ-009`、`REQ-010` 作为 P2 外部候选。
- Markdown-only 导出边界：已移除 JSON 导出命令和前端格式切换，导出入口固定为 `export_to_markdown`。
- Markdown Frontmatter：导出文件头部包含 `bookId`、`isbn`、`title`、`author`、`cover`、`lastReadDate`、`finishedDate`、`reading-time`、`progress`。
- 笔记页视图：支持笔记本列表、关键词搜索、划线/想法筛选，以及「按章节 / 按时间」两种视图。
- 导出页真实预览：选择单本书时读取真实划线、想法、书籍信息和阅读进度生成 Markdown 预览；多本选择时只展示提示。
- API 本地缓存：API 响应写入本地缓存，设置页可调整自动刷新间隔。
- 交流与支持入口：README 中「开发贡献」已移动到交流群和打赏之后；软件内已拆分为「交流群」和「打赏支持」两个入口、两个弹窗。
- 弹窗视觉增强：交流群弹窗放大二维码并使用蓝色主题；打赏支持弹窗使用红心色主题。
- 二维码展示归一：四张二维码图在弹窗中使用统一方形裁切展示，个人微信高图通过展示层裁切放大，不改动源图。
- 自动更新错误展示：签名 key 不匹配会明确显示为「签名密钥不匹配」，并提示用户前往 GitHub 手动下载最新版。
- 自动更新发布修正：Windows updater 元数据改为使用 Tauri v2 `createUpdaterArtifacts: true` 对应的 `-setup.exe` / `-setup.exe.sig`，缺少任一平台 updater 签名时 release workflow 直接失败，不再生成空签名 `latest.json`。
