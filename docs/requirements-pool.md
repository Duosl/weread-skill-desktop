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

建议下一个启动：`REQ-014 智能体模板原文权限策略优化`。

原因：智能体报告已进入可用性打磨阶段，原文划线 / 想法属于高敏数据，但部分模板不应因为未授权原文就完全阻断生成；先收敛权限策略能减少用户理解成本，也能避免模板继续扩展时把隐私、数据质量和降级体验混在一个布尔字段里。

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
| REQ-007.1 | P1 | Doing | Report / UI | 阅读报告模板体验与产物质量打磨 |
| REQ-008 | P2 | Done | Export | Obsidian Base 导出增强 |
| REQ-009 | P2 | Todo | Export | 导出为 PDF 文档 |
| REQ-010 | P2 | Doing | Integration | 腾讯 ima 联动 |
| REQ-011 | P1 | Done | Notes / Export | 合并为笔记工作台 |
| REQ-012 | P2 | Done | Report / Agent | 智能体报告自定义提示词与模板形态 |
| REQ-013 | P0 | Done | UI / Design System | 全应用 UI 风格统一与设计系统收敛 |
| REQ-014 | P1 | Todo | Report / Privacy | 智能体模板原文权限策略优化 |

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
  - 浏览器预览先生成 App 私有目录下的临时 HTML，再用系统默认浏览器打开；当前阅读报告页暂不展示 `.html` 导出入口。
  - 当前 Markdown 导出保持默认能力，不被 HTML 报告影响。
- 当前进展：
  - 已新增独立 `阅读报告` 页面和侧边栏入口。
  - 已定义 `ReadingReportData`，并用 `reading_stats`、`notebooks`、代表性 `bookmark_list` / `my_reviews` 抽样构建报告数据。
  - 已实现 3 个基础报告预览模版：阅读分析报告、读书旅程、年度阅读报告。
  - 已加入规则化结论、分类偏好、读书路径、Top 书籍和笔记行为统计；基础模板不再展示原划线 / 个人想法。
  - 已扩展源数据覆盖：笔记最多的前 10 本书抽样、最多 24 条代表性摘录，新增完成率、日均阅读、笔记/书密度、分类占比、时间线峰值/趋势、长读排行、划线排行、想法排行、进度排行和数据覆盖摘要。
  - 模版模块已按数据存在与否条件渲染，月度等数据较少场景不会展示空模块。
  - 已实现 `.html` 文件导出、App 私有目录预览文件和系统默认浏览器打开能力；当前还未实现更完整的 AI 叙事报告。
  - 已将阅读报告页重构为模板目录：基础模板卡片点击后进入接近全屏的报告工作台，集中展示预览、数据范围和浏览器打开入口。
  - 已在 `mvp-design-doc.md` 增补智能体报告完整方案：模板包、提示词模板、输入输出目录、job 目录和 CLI 调用边界。
  - 已在 `AGENTS.md` 记录当前开发偏好：普通 Markdown 导出页保持现有工作台结构；阅读报告页使用模板目录和全屏报告工作台；智能体模板不伪造能力。
  - 已升级 `/Users/duoshilin/duosl/sidework/agent-cli-bridge`：支持 `model` 透传、`Argv` / `ArgvMessage` prompt 传递、`Start.prompt_bytes`、`Raw`、`Canceled` 和取消句柄。
  - 已在 WeRead 后端接入可取消本地 agent job：`RuntimeState` 按 `job_id` 注册取消句柄，新增 `cancel_local_agent(job_id)`；前端 `useAgentBridge` 暴露 `cancelAgent(jobId)`。
  - 已新增智能体报告工作区骨架：`src-tauri/src/advanced_report.rs`、`list_advanced_report_templates`、`create_advanced_report_job`、`src/hooks/useAdvancedReport.ts`。
  - 阅读报告页的智能体模板已从占位变为真实模板清单，可确认隐私授权并准备 `reports/jobs/<job-id>/` 工作区，写入 `input/`、`data/`、`output/` 和 `job.json`。
  - 智能体模板已打通可用闭环：自动选择可用本地 Agent、调用生成、取消任务、读取 `output/report.html`、浏览器打开。
  - 已优化智能体模板输入协议：`input/brief.md` 作为唯一任务入口，其他 JSON 作为机器索引备份；prompt 强制报告主语使用“你”，并要求报告底部包含开源项目来源和 GitHub 仓库地址。
  - 已新增智能体报告输出质量提醒：内容过短、未使用“你”、残留“这个用户/该用户”、缺少开源项目 GitHub 地址时在预览区提示。
  - 已将智能体模板交互从“工作流配置”改为“报告任务中心”：普通用户只需选择模板并开始生成；任务在后台运行，支持离开页面后继续、回来查看进行中任务、同时多个任务、取消、打开完成报告。
  - 已进一步简化智能体模板页：移除底部任务列表，模板卡片直接显示生成中、已完成、失败/取消状态和对应操作；同一模板同一时间只允许一个活跃任务。
  - 已在智能体模板卡片增加“历史”入口：按模板查看生成记录，支持查看、浏览器打开和删除单个 job；后端从运行态任务和本地 job 目录合并历史记录。
  - 已新增智能体报告任务状态持久化：写入 `task.json`，应用重启后未生成 `output/report.html` 的运行中任务会显示为已中断 / 未完成，不再误显示为生成中。
  - 已移除智能体报告分享版：当前版本不要求生成 `share.html`，前端也不展示分享按钮。
  - 已将本地 Agent 选择收敛到单个智能体模板的生成配置中：应用会检测可用 CLI，用户可以在模板工作台内选择本次使用的 Agent；模型仍使用用户 CLI 默认配置。
  - 已将智能体模板生成设置从报告列表页移入模板工作台页面；列表页只保留模板选择和状态，工作台内集中展示模板说明、生成设置、当前结果和历史记录，避免复杂生成流程挤在弹窗里。
  - 已将数据范围从阅读报告模板目录页移入单个模板配置：目录页只负责选择基础 / 智能体模板；基础模板在预览工作台内选择范围，智能体模板在生成配置内选择范围并写入 `generation-settings.json`。
  - 已将阅读报告模板目录改为「基础模板 / 智能体模板」双 Tab，并把 Tab 放在原区块标题位置，避免两类模板混在同一滚动页面，便于后续分别管理。
  - 阅读报告页默认选中「基础模板」Tab，智能体模板保留为手动切换入口。
  - 已将智能体报告生成日志改为完整追加展示，不再只保留最后 500 条；点击「开始生成 / 再次生成」后会在模板工作台内展示当前任务状态和生成过程。
  - 已将生成过程从终端日志改为模型输出流：连续思考和正文输出会合并展示，保留流式片段中的空格，过滤 model/session/cwd/usage 等调试信息，并使用浅色消息块替代黑色日志框。
  - 已为智能体报告生成过程新增简洁 / 详细显示模式：默认简洁模式只显示任务状态和最新一行内容，详细模式保留完整模型输出流样式。
  - 已优化从智能体模板状态卡进入的焦点：只有外层模板卡仍显示进行中、已完成、失败等状态时，进入工作台才优先展示最近一次任务；普通模板入口仍优先展示生成配置和页面级「开始生成」按钮。
  - 已收敛上次生成任务区：隐藏重复的顶部生成按钮，把「再次生成」作为删除任务后的 outline 操作，并压缩状态卡与生成过程结构，减少边框套边框。
  - 已将当前生成中的任务从历史记录列表中过滤，并把生成过程日志放入生成中的状态卡内部，不再作为同级独立卡片展示。
  - 已收敛历史记录列表的边框层级，并在上次任务与历史任务中展示报告风格、数据范围、本地 Agent 和模型配置；未显式记录模型时展示“CLI 默认配置”。
  - 已把智能体模板历史记录标题提升为更清晰的子标题，并移除自定义提示词输入框下方的提示文案、字数计数和固定最大字数限制；配置区输入框默认两行且不可拖拽，可通过展开图标打开大尺寸编辑弹窗。
  - 已将 `agent-cli-bridge` vendoring 到仓库内 `vendor/agent-cli-bridge`，`src-tauri` 改用仓库内 path 依赖，避免干净 checkout 或 CI 构建依赖作者本机相邻目录。
  - 已在用户授权“使用个人划线和想法”后实际预取原始笔记内容：按有划线 / 想法的笔记本逐本写入 `data/notes.raw.json`，包含章节、划线和分页拉取后的个人想法 / 点评，供智能体报告在本地工作区内读取。
  - 已在智能体模板清单中新增偏传播的模板：年度阅读关键词、年度 Top 书单、阅读偏好雷达、精神书架；仍输出 `output/report.html`，不新增分享网页或在线托管。
  - 已先移除基础模板和智能体模板工作台中的 HTML 导出入口，当前只保留浏览器打开；后端复制导出能力暂时保留，便于后续需要时恢复。
  - 已修正智能体报告关键数字口径：job 数据目录新增 `data/profile.summary.json` 作为权威指标摘要，明确书架总数、读过、读完、阅读时长、阅读天数和笔记数；任务书要求模型优先使用该摘要，避免把“有笔记书籍数”误写成书架总数。摘要和 `reading-stats.*.json` 中的阅读时长只提供转换后的中文真实值，例如 `xx小时xx分钟`、`xx小时` 或 `xx分钟`，不在模型数据目录暴露秒数 / 小数小时，禁止模型写成 `a.b 小时`。
  - 已修正智能体报告历史周期笔记口径：`last_month` / `last_year` 这类有结束边界的报告不再用笔记本概览的最近笔记时间排除整本书；先保留候选笔记本，再按具体划线 / 想法创建时间过滤，避免一本书今年新增笔记后漏掉去年笔记。历史周期的 `profile.summary.json` 也优先使用周期内笔记汇总，避免把全量笔记数写成去年 / 上月口径。
- 技术边界：
  - 先定义统一 `ReadingReportData`，模版读取报告模型，不直接读取微信读书原始 API 回包。
  - 基础数据来自 `reading_stats`、`notebooks`、`bookmark_list`、`my_reviews`、`book_info`、`book_progress`。
  - 导出预览和最终 HTML 文件应使用同一套报告数据模型。
  - 智能体模版后续通过 `GeneratedInsight[]` 扩展，不让 HTML 模版直接调用模型。
  - 智能体模板目录约定为 `reports/templates/<template-id>/`，任务目录约定为 `reports/jobs/<job-id>/`，应用通过模板清单和 job 状态查看输入输出，不让前端直接操作任意路径。
  - 当前内置模板字段包括 `id`、`name`、`description`、`category`、`styleSummary`、`defaultOutputShape`、`outputShapes`、`requiresRawNotesConsent`、`defaultCapabilities`、`optionalCapabilities`；输出形态全局支持默认报告、PPT 风格和小红书图文风格。
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

### REQ-007.1 阅读报告模板体验与产物质量打磨

- 优先级：P1
- 状态：Doing
- 模块：`ReportPage`、智能体模板、报告 HTML 产物
- 来源：用户对话，2026-05-22。
- 背景：阅读报告模板已经打通生成闭环，但当前 `ReportPage` 同时承担模板目录、配置、任务状态、历史记录、日志流、基础模板预览和删除确认，后续继续堆功能会让体验和代码都变重。下一步应把报告模板从“能生成”打磨到“愿意反复使用”。
- 任务拆分：
  - 结构拆分：抽出 `TemplateCard`、`GenerationSettings`、`TaskStateCard`、`ModelOutput`、`ConfirmDialog` 等组件，降低 `ReportPage` 复杂度。
  - 模板目录升级：模板卡片明确展示适用场景、默认输出形态、数据权限、最近生成状态和下一步操作。
  - 工作台收敛：智能体模板工作台聚焦生成配置、当前结果、生成过程和历史记录，减少重复状态和散落按钮。
  - Prompt 与产物标准：为每个智能体模板补强目标、章节、证据引用、禁忌输出和不同输出形态的版式标准。
- 当前进展：
  - 已新增 `src/components/report/TemplateCard.tsx`、`GenerationSettings.tsx`、`TaskStateCard.tsx`、`ModelOutput.tsx`、`ConfirmDialog.tsx`。
  - 模板目录卡片已展示模板场景、默认输出形态、数据权限和最近生成状态。
  - 智能体模板工作台已把生成配置、任务状态、模型输出和删除确认拆到独立组件。
  - 已将智能体模板历史记录改为点击整行展开：展开后只显示详细生成过程，并自动定位到最后一条内容；通过模板卡片状态进入时，上方仍展示最后一次任务状态和日志，历史记录本身不自动展开。
  - 已新增智能体模板默认数据范围：年度模板默认 `去年`，长期画像 / 结构 / 精神书架类模板默认 `全部`；用户仍可在模板内改为 `上个月 / 本月 / 去年 / 今年 / 全部`，选择按模板记忆。
  - 智能体任务书已增加报告质量标准：主要结论必须可追溯到阅读统计、分类占比、书目、笔记数量、划线或想法；避免空泛建议。
  - 7 个内置智能体模板已补充版式建议、必须包含内容、证据要求和禁忌输出。
  - 已重构基础报告的浏览器打开版 HTML：阅读分析报告、读书旅程、年度阅读报告现在分别使用数据档案、时间线旅程和年度数字墙结构，不再共用同一份 HTML body。
  - 已新增智能体报告质量提醒：检查证据链偏弱、小红书图文缺少卡片化结构、PPT 风格缺少演示页式结构等问题。
  - 已移除基础模板中的原文摘录区块，改为“笔记信号”统计；浏览器打开版也不再输出原划线和个人想法。
  - 已优化三个基础模板的纵向版式：应用内预览和浏览器打开版均减少左右分栏，分类、结论、排行、笔记信号等内容改为纵向块流，避免数据量不均时一侧空白。
  - 已修正读书旅程和年度阅读报告的封面信息布局、重复轨迹展示、年度笔记信号样式，以及应用内预览底部应用名和数据来源缺失问题。
  - 已将基础模板时间范围统一为上月 / 本月 / 去年 / 今年 / 全部，并按时间范围复用报告数据缓存；不同基础模板保留各自选择，默认均为全部。
  - 已接入概览页全局刷新信号：概览刷新成功后会清空基础报告时间范围缓存；如果用户正在报告页，会按当前范围自动重新整理报告数据。
  - 已移除阅读报告页顶部和基础模板预览弹窗内的手动刷新按钮，刷新入口统一收敛到概览页。
  - 已修正基础报告历史周期口径：上月 / 去年 / 本月 / 今年报告会按具体划线和个人想法创建时间重建有记录书籍、笔记数量、排行和代表性摘录；“全部”仍使用完整笔记本概览。历史周期不再出现阅读时长按周期、笔记和书籍排行却混入全量记录的情况。
  - 已统一基础报告和智能体报告的开源署名：报告底部展示“基于开源项目生成”和 `https://github.com/Duosl/weread-skill-desktop`，让分享出去的读者能知道报告来源；基础报告不再重复展示软件名。
  - 已补强 PPT 风格产物标准：参考 `/Users/duoshilin/duosl/forks/html-anything` 的 deck skill 思路，要求先选择明确方向并使用有限版式池；演示页必须使用固定 16:9 舞台并按视口缩放，主内容不能依赖页面滚动；舞台 CSS 必须使用浏览器兼容的 `calc()` 写法，不能写 `calc((100vh-96px)*16/9)` 这类会被 DevTools 丢弃的表达式；幻灯片必须有完整状态机，非当前页默认 `opacity: 0`、`visibility: hidden`、`pointer-events: none` 并设置低层级，切页时先清理所有 slide 状态再只激活当前页，避免上一页 / 下一页内容残留叠层；PPT 仍允许入场 / 离场动画，但离场页只能短暂处于 `is-exiting` 状态，不能接收点击、不能盖住当前页，并必须在动画结束或兜底定时器后回到隐藏态；必须支持按钮点击、方向键、Home / End、鼠标滚轮 / 触控板滑动翻页，并对滚轮连续事件做节流，避免一次滑动连续翻多页；滚轮向下 / 触控板向下滑动进入下一页，向上滑动回到上一页；键盘翻页方向必须和页面切换动画一致，横向动效用左右键、纵向动效用上下键，页面提示必须和实际绑定一致；底部固定 / 粘性控制条必须为幻灯片内容预留安全区，避免正文或证据块被上一页 / 下一页导航遮挡；生成后质量提醒会识别只有键盘切换、缺少滚轮 / 触控板翻页、滚轮方向反直觉、缺少非当前页隐藏态、缺少全量清理 slide 状态、缺少明确版式池、非法 `calc()` 舞台尺寸、缺少固定比例舞台、缺少底部避让、快捷键提示和实际绑定不一致、主要内容依赖滚动阅读等问题。
  - 已补强小红书图文风格产物标准：参考 `html-anything` 的 `card-xiaohongshu` / `deck-xhs-*` 思路，要求输出多卡片图文画廊，优先 3:4 截图卡、封面卡、页码、总结 / 来源卡和 2 到 4 列桌面网格；生成后质量提醒会识别缺少多列画廊、缺少 3:4 截图卡、缺少封面或页码等问题。
  - 已补强智能体报告 HTML 安全边界：生成报告必须是自包含单文件，不引用 `file://`、不暴露用户本地绝对路径，不通过 iframe/object/embed/fetch/XHR/window.open/location 读取或跳转本地文件；质量提醒会识别这类会触发浏览器 `file:` 安全限制的产物。
  - 已改进智能体报告质量闭环：首次生成后如果自动校验发现质量提醒，不再直接结束任务，而是写入 `input/quality-fix.md` 并自动调用同一个本地 Agent 修正一次；二次修正后仍有提醒才以完成态保留质量提示，避免无限重试。
  - 已将智能体报告的可用性判定改为 HTML 优先：只要 `output/report.html` 已生成，`report.meta.json` 解析失败或本地 Agent 最后返回异常状态都会降级为“有警告”，任务仍可在历史记录和上次生成中打开报告；旧的失败快照在重新读取任务列表时也会归一为可打开的警告状态。
  - 已在智能体报告任务上下文中写入当前电脑日期、时间和时区，并明确要求本地 Agent 按本机时间理解“今天 / 本月 / 上个月 / 今年 / 去年”等相对时间，避免模型按知识截止时间或默认时区误判历史周期。
  - 本轮验证：`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check`、`git diff --check` 通过。
- 下一步：
  - 用真实数据打开三套基础报告做视觉回归，重点检查长书名、排行密度和小窗口下的排版。
  - 继续打磨智能体输出形态，给 `report`、`slides`、`xiaohongshu` 增加更明确的 HTML 结构示例；其中 `slides` 需要重点检查翻页按钮点击、页码更新、禁用态、全屏退出后布局和底部控制条遮挡。
- 验收：
  - 报告页核心 UI 结构有可复用组件，不再全部堆在 `ReportPage.tsx` 中。
  - 模板目录中用户无需打开详情也能判断模板适合什么、是否会读取划线和想法、默认输出形态是什么。
  - 智能体模板工作台中主操作唯一且清晰；生成配置、当前结果、生成过程和历史记录层级明确。
  - 智能体模板 prompt 明确要求证据链、报告主语、输出边界和形态差异，减少泛泛而谈。
  - `npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。

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
- 状态：Doing
- 模块：Integration
- 来源：飞书记录 `rec27qYOrn5Fmy`，提出人 `曲小明`，创建时间 `2026-05-20 11:55:43`。
- 背景：飞书收集项希望笔记自动导出到腾讯 ima 笔记和知识库，格式包含 Markdown 和 PDF。该能力涉及外部服务集成，不进入当前 MVP 主线，需先确认 ima 的导入 API、认证方式和用户授权流程。
- 详细实现方案：`docs/ima-connector-implementation-plan.md`。
- 当前范围：左侧菜单新增 `连接器` 页面，ima 配置以弹窗形式展开；支持保存凭证、测试连接、连接成功后列出用户自己创建的 ima 个人知识库并保存默认目标。知识库列表打开弹窗时优先使用 24 小时内缓存，点击「刷新知识库」时强制请求并更新缓存；缓存状态不在 UI 中展示。ima skill 暂不支持新建知识库，应用只提示用户先在 ima 中手动创建。连接器卡片提供「去同步」快捷入口，跳转到笔记工作台导出区；导出区新增「同步到 ima」按钮，复用已有选书、包含划线、包含想法和章节分组逻辑。同步时复用现有 Markdown 构建逻辑；同名 ima 笔记会重新加入所选知识库，没有同名笔记时创建新笔记再加入知识库，不追加、不覆盖已有笔记内容。
- 当前进展：
  - 已检查并修正知识库列表缓存逻辑：后端改为按 Client ID 指纹缓存全量个人知识库列表，再按请求分页切片；刷新时跳过缓存并重写缓存。
  - 已新增 `sync_books_to_ima` 命令，批量读取有划线或想法的微信读书笔记并同步到默认 ima 知识库。
  - 已接入 ima Notes `import_doc` 和 Knowledge Base `add_knowledge(media_type=11)`，暂不走 COS 文件上传。
  - 连接器配置弹窗保持凭证和知识库选择职责；同步入口改为连接器卡片「去同步」快捷跳转。
  - 导出区新增「同步到 ima」操作，展示完成、跳过和失败结果；不展示缓存命中状态。
  - 「同步到 ima」按钮同步中展示已处理书籍数 / 总书籍数；同步到 ima 的笔记标题使用书名，不使用书籍编号。
  - 同名 ima 笔记已存在时会复用并重新加入知识库，支持用户从知识库删除条目后再次同步恢复。
  - 当前未实现 PDF 同步、后台自动同步和覆盖已有 ima 笔记内容。
- 验收：
  - 明确 ima 可用导入能力和认证边界。
  - 导出失败不能影响本地 Markdown/PDF 文件生成。
  - 用户可选择是否启用该联动。
  - 同步过程不覆盖或追加到已有 ima 笔记。
  - UI 不暴露缓存命中状态等内部实现细节。

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

### REQ-012 智能体报告自定义提示词与模板形态

- 优先级：P2
- 状态：Done
- 模块：Report / Agent
- 来源：用户对话，2026-05-21。
- 背景：当前智能体报告只支持内置模板和固定提示词，用户希望能在生成前补充自己的具体要求，让报告更贴合当次诉求；同时希望模板支持不同输出形态，例如 PPT 风格、小红书图文风格，以及当前默认完整报告风格，并能后续继续扩展。
- 完成说明：智能体模板生成设置已新增“输出形态”和“自定义要求”。内置模板返回 `defaultOutputShape` / `outputShapes`，当前支持 `默认报告`、`PPT 风格`、`小红书图文风格`；开始生成时前端提交结构化 `outputShape` / `userPrompt`，后端写入 `input/generation-settings.json` 和可选 `input/user-prompt.md`，并合成到 `input/brief.md`。
- 改动入口：`src/pages/ReportPage.tsx`、`src/hooks/useAdvancedReport.ts`、`src-tauri/src/advanced_report.rs`、`src/index.css`、`mvp-design-doc.md`。
- 验证结果：`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。
- 剩余风险：第二阶段“用户自定义模板增删改”尚未实现；PPT 风格和小红书图文风格当前是 HTML 输出形态约束，不生成 `.pptx` 或图片文件。
- 第一阶段建议范围：
  - 在智能体模板生成设置中增加“自定义要求”输入框，作为本次 job 的补充提示词写入 `input/user-prompt.md` 或合并进 `input/brief.md`。
  - 自定义要求必须作为用户偏好处理，不能覆盖隐私、安全、只读本地工作区、必须输出 `output/report.html` 等系统约束。
  - 内置模板增加 `outputShape` / `styleVariant` 配置，至少支持 `默认报告`、`PPT 风格`、`小红书图文风格` 三类形态。
  - 生成 brief 时把形态要求明确传给 Agent，例如页面比例、版式密度、章节结构、适合截图或演示的视觉约束。
- 第二阶段候选：
  - 支持用户创建自定义智能体模板：填写模板名称、描述、提示词、默认形态、是否需要原始笔记授权。
  - 自定义模板保存到应用私有目录，不和内置模板混写；模板列表合并展示，并标记来源为“自定义”。
  - 支持编辑、复制、删除自定义模板；内置模板只允许复制，不允许直接修改。
- 技术边界：
  - 前端只提交结构化配置，不直接拼接完整系统 prompt。
  - 后端负责把用户要求、模板提示词、形态配置和隐私策略合成为 job 工作区输入。
  - 自定义提示词不得允许 Agent 读取工作区外文件、访问网络、自动打开浏览器或绕过隐私授权。
  - 形态配置先服务 HTML 输出；PPT 风格是 HTML 演示页形态，不等同于导出 `.pptx` 文件。
- 验收：
  - 生成智能体报告时可以填写本次自定义要求，并能在 job 输入文件中追溯。
  - 选择不同形态后，Agent brief 中有明确差异化输出要求。
  - 不填写自定义要求时，现有内置模板生成流程不受影响。
  - 自定义要求不能绕过原始笔记授权开关。
  - `npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。

### REQ-014 智能体模板原文权限策略优化

- 优先级：P1
- 状态：Todo
- 模块：Report / Privacy / Agent
- 来源：用户对话，2026-05-22。
- 背景：当前智能体模板使用 `requiresRawNotesConsent` 表达是否必须授权读取划线原文和个人想法。这个布尔字段能保护高敏数据，但也把“必须原文才能生成”和“原文只会提升质量”混在一起，导致部分模板在未授权时只能阻断，而不能以统计、书架和笔记数量做降级报告。
- 产品结论：
  - 隐私确认必须继续严格：只要读取划线原文、书摘原文或个人想法，就必须由用户显式确认。
  - 模板门槛应拆为三档：`required`、`optional`、`none`。
  - `required`：没有原文授权不能生成，适用于精神书架、深度摘录分析等以原文为核心证据的模板。
  - `optional`：没有原文授权也能生成，但只使用统计、书架、笔记数量和分类等低敏数据，并在报告中明确“未使用划线原文和个人想法”。
  - `none`：模板不需要原文，生成流程不展示原文授权为必需项。
- 技术边界：
  - 后端模板字段从单一 `requiresRawNotesConsent` 逐步收敛为 `rawNotesPolicy`，旧字段可在过渡期兼容输出。
  - `rawNotesPolicy=required` 且未授权时继续后端硬校验。
  - `rawNotesPolicy=optional` 且未授权时不写入 `data/notes.raw.json`，并在 `input/user-policy.json`、`input/brief.md` 或等价输入中标记未使用原文。
  - 用户自定义要求不能覆盖原文授权策略，不能通过 prompt 要求读取未授权数据。
- UI / 文案要求：
  - 不向用户展示 `requiresRawNotesConsent`、`rawNotesPolicy` 等工程字段。
  - `required` 使用“需要允许读取划线原文和个人想法后才能生成”。
  - `optional` 使用“可不授权生成；允许后报告会更具体”。
  - `none` 使用“不读取划线原文和个人想法”。
- 验收：
  - 智能体模板清单能区分 required / optional / none 三种原文权限策略。
  - required 模板未授权时无法开始生成，并给出用户可理解的原因。
  - optional 模板未授权时可以生成，且 job 数据目录不包含 `notes.raw.json`。
  - optional 模板授权后才预取原文划线和个人想法。
  - 生成 brief 明确告知 Agent 当前是否可用原文，并要求数据不足时不要编造。
  - 前端模板卡片和工作台用用户语言解释数据读取范围。
  - `npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。

### REQ-013 全应用 UI 风格统一与设计系统收敛

- 优先级：P0
- 状态：Done
- 模块：UI / Design System
- 来源：用户对话，2026-05-21。
- 背景：随着书架、笔记工作台、导出、阅读报告、智能体模板等页面持续开发，当前页面风格开始变乱，存在视觉层级、组件形态、页面密度、弹窗结构、按钮层级和报告相关界面风格不够统一的问题。这里的 UI 范围包括但不限于整体风格，也包括字体大小、字重、行高、间距、颜色、圆角、阴影、边框、图标、状态反馈、滚动区域、响应式和可访问性等细节。下一步开发前必须先做一次全应用 UI 风格审计和统一。
- 资料与 Skill 要求：
  - 必须使用 UI 相关 Skill：`frontend-design` 和 `ui-ux-pro-max`。
  - 必须先读取 `ui-style-guide.md`，确认 Quiet Reading Ledger 的设计方向。
  - 已新增 `design.md`，后续 UI 开发必须同时参考其中的审计结论、设计 tokens、组件规则、页面统一方案和验收清单。
  - 统一后的稳定规则应回写 `ui-style-guide.md`；`AGENTS.md` 只记录执行约束和资料入口。
- 第一阶段范围：
  - 审计全应用页面：概览 / 书架、笔记工作台、导出、阅读报告、设置、支持弹窗、智能体报告弹窗和任务详情。
  - 梳理当前不一致点：标题区、页面容器、列表、卡片、表单、按钮、Tabs、弹窗、空态、错误态、加载态、成功态、日志 / 输出流展示。
  - 提出统一方案：组件层级、间距系统、按钮等级、卡片边界、弹窗宽度、侧栏与页面标题关系、报告页面与普通工作台的差异边界。
  - 对照 Quiet Reading Ledger 修正过度装饰、过度卡片化、密度失控或普通 SaaS 化的问题。
- 第二阶段范围：
  - 已收敛 `src/index.css` 中第一批重复或漂移的样式规则，建立 token aliases、页面 shell、toolbar、card、modal、tab、button、state 基础样式。
  - 已统一页面头部和工作台布局，不让书架、笔记工作台、笔记筛选等页面继续自行发明标题、操作区和筛选区。
  - 对所有核心页面做窗口尺寸、长文本和滚动区域回归。
- 完成说明：
  - 新增 `design.md` 作为后续 UI 开发的执行型设计说明，并在 `AGENTS.md` 中加入入口要求。
  - 扩展 `PageShell`，支持 `subtitle`、`meta`、`tabs`、`actions`、`toolbar`，保留旧 `action` 兼容。
  - 新增 `SegmentedControl` 和 `IconButton`，并把笔记工作台、笔记筛选、书架筛选、书籍详情关闭、支持弹窗关闭接入统一组件。
  - 在全局 CSS 增加字体、间距、圆角、语义色、surface、shadow、z-index token，补充 `:focus-visible` 和 `prefers-reduced-motion`。
  - 书架工具区上移到 `PageShell toolbar`，笔记工作台 Tab 移出 H1，设置页关于区按钮改用统一 `Button`。
  - 统一弹窗和抽屉层级：书籍详情面板、支持弹窗、报告弹窗使用明确 z-index token，避免后续互相覆盖。
- 改动入口：`design.md`、`AGENTS.md`、`src/components/layout/PageShell.tsx`、`src/components/ui/SegmentedControl.tsx`、`src/components/ui/IconButton.tsx`、`src/index.css`、`src/pages/DashboardPage.tsx`、`src/pages/NotesWorkbenchPage.tsx`、`src/pages/NotesPage.tsx`、`src/pages/SettingsPage.tsx`、`src/components/RewardDialog.tsx`。
- 验证结果：`npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check`、`git diff --check` 通过。
- 剩余风险：`ReportPage` 仍是最大样式密度区域，本轮只统一了 modal 层级和基础 token，后续新增报告模板形态时应继续按 `design.md` 抽离报告页内部按钮、历史记录、任务详情和输出流样式。
- 技术边界：
  - 本需求优先做“统一和收敛”，不是重新设计整套品牌。
  - 不改变核心数据流、Tauri 命令或导出格式。
  - 不引入大面积渐变、玻璃拟态、紫蓝渐变、漂浮光球等与现有设计方向冲突的风格。
  - 桌面应用优先，移动端只做不破坏的响应式保护。
- 验收：
  - 形成一份明确的 UI 审计结论，列出需要统一的页面和组件问题。已完成：`design.md`。
  - 完成主要页面的视觉统一，页面标题、操作区、筛选区、卡片、弹窗和状态反馈风格一致。
  - 更新 `ui-style-guide.md` 中稳定的新增规则；必要时补充 `design.md` 或引用其实现方向。
  - 使用 `frontend-design` / `ui-ux-pro-max` 的规则检查可访问性、触控尺寸、布局响应、字号层级、颜色对比和动效克制。
  - `npm run frontend:typecheck`、`npm run frontend:build`、`cd src-tauri && cargo check` 通过。

---

## 已完成记录

### 2026-05-23

- 自动更新国内源：Tauri updater 新增 Gitee 固定清单 endpoint 作为首选源，Release workflow 增加 `release2gitee` 同步 GitHub Release 到 Gitee Release，并将改写为 Gitee 下载地址的 `latest.json` 推送到 GitHub / Gitee `updater` 分支；GitHub latest endpoint 保留为 fallback。

### 2026-05-22

- 设置页 Token 获取引导：已将 README 中的微信读书 API Token 获取步骤加入应用内设置页，支持一键打开微信读书 Skill 配置页；获取说明支持展开 / 收起，未配置时默认展开，保存后自动收起，并补充 Token 只保存在本机的说明；`frontend:typecheck`、`frontend:build` 通过。
- 智能体报告原文授权提示：必需读取划线原文和个人想法的模板改用更明确的授权文案；未授权时生成配置摘要显示警告色，授权 checkbox 显示红色必填缺失态，非必需模板保持普通可选展示；`frontend:typecheck`、`frontend:build` 通过。

### 2026-05-21

- REQ-013 全应用 UI 风格统一与设计系统收敛：新增 `design.md`，扩展 `PageShell`，新增 `SegmentedControl` / `IconButton`，统一书架、笔记工作台、笔记筛选、设置页按钮和支持弹窗的基础交互组件；全局 CSS 增加 token、焦点态、减弱动效和 z-index 层级；`frontend:typecheck`、`frontend:build`、`cargo check`、`git diff --check` 通过。
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
- 笔记页视图：支持笔记本列表、关键词搜索、划线与想法筛选，以及「按章节 / 按时间」两种视图。
- 导出页真实预览：选择单本书时读取真实划线、想法、书籍信息和阅读进度生成 Markdown 预览；多本选择时只展示提示。
- API 本地缓存：API 响应写入本地缓存，设置页可调整自动刷新间隔。
- 交流与支持入口：README 中「开发贡献」已移动到交流群和打赏之后；软件内已拆分为「交流群」和「打赏支持」两个入口、两个弹窗。
- 弹窗视觉增强：交流群弹窗放大二维码并使用蓝色主题；打赏支持弹窗使用红心色主题。
- 二维码展示归一：四张二维码图在弹窗中使用统一方形裁切展示，个人微信高图通过展示层裁切放大，不改动源图。
- 自动更新错误展示：签名 key 不匹配会明确显示为「签名密钥不匹配」，并提示用户前往 GitHub 手动下载最新版。
- 自动更新发布修正：Windows updater 元数据改为使用 Tauri v2 `createUpdaterArtifacts: true` 对应的 `-setup.exe` / `-setup.exe.sig`，缺少任一平台 updater 签名时 release workflow 直接失败，不再生成空签名 `latest.json`。
