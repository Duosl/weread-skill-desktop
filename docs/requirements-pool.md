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

建议下一个启动：`REQ-002 真实 API 数据校准`。

原因：前端想法分页加载已完成，下一步需要用真实 API 响应校准字段单位、缺省值、分页游标和统计口径。

---

## 需求列表

| ID | 优先级 | 状态 | 模块 | 需求 |
|----|--------|------|------|------|
| REQ-001 | P0 | Done | Notes / Export | 前端想法分页加载 |
| REQ-002 | P0 | Todo | API / QA | 真实 API 数据校准 |
| REQ-003 | P1 | Todo | Docs | 同步清理 `mvp-design-doc.md` 中过期阶段和 JSON 遗留描述 |
| REQ-004 | P1 | Todo | Export | 导出边界用例补齐 |
| REQ-005 | P1 | Todo | UI | 窗口尺寸、长文本、空态/错误态走查 |
| REQ-006 | P1 | Todo | Search | 书架/笔记本本地搜索增强 |
| REQ-007 | P2 | Todo | Export | 笔记报告模版 |
| REQ-008 | P2 | Todo | Export | Obsidian Base 导出增强 |
| REQ-009 | P2 | Todo | Export | 导出为 PDF 文档 |
| REQ-010 | P2 | Todo | Integration | 腾讯 ima 联动 |

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
- 状态：Todo
- 模块：API 解析、统计展示、导出字段
- 背景：MVP 已能串起核心流程，但字段单位、缺省值、分页游标和统计口径必须以 `~/.agents/skills/weread-skills/` 和真实账号响应校准。
- 验收：
  - 覆盖 `shelf_sync`、`notebooks`、`bookmark_list`、`my_reviews`、`reading_stats`、`book_progress`。
  - 记录无法稳定获得的字段，不用前端假数据补齐。
  - 至少覆盖 3 本不同类型书：无笔记书、有大量划线书、只有想法/点评书。
  - 更新相关设计文档或 README 中受影响的说明。
- 完成后建议：继续 `REQ-004` 或 `REQ-005`。

### REQ-003 同步清理设计文档遗留描述

- 优先级：P1
- 状态：Todo
- 模块：`mvp-design-doc.md`
- 背景：当前实现已收敛为 Markdown-only 导出，但设计文档的后段阶段计划仍残留 `export_to_json`、选择格式、旧组件拆分和部分未勾选阶段内容。
- 验收：
  - 清理 JSON 导出遗留描述。
  - 将已实现能力与待办能力拆清楚。
  - 保持 `mvp-design-doc.md` 作为产品范围和技术边界文档，而不是需求池。
- 完成后建议：回到最高优先级未完成需求。

### REQ-004 导出边界用例补齐

- 优先级：P1
- 状态：Todo
- 模块：`src-tauri/src/export.rs`、导出页
- 背景：导出是核心价值，需要覆盖空笔记本、只有划线、只有想法、无章节名、无作者名、超长书名、非法文件名、重名文件、目录无权限、用户取消目录选择等情况。
- 验收：
  - Rust 导出不把系统错误伪装成成功。
  - 文件名处理可靠，必要时避免重名覆盖。
  - UI 对取消、失败、成功都有明确反馈。
  - Markdown 内容与预览口径一致。

### REQ-005 UI 走查

- 优先级：P1
- 状态：Todo
- 模块：全局 UI
- 背景：应用要符合 `ui-style-guide.md` 的 Quiet Reading Ledger，不应出现错位、拥挤、长文本撑破或通用 SaaS 化。
- 验收：
  - macOS 默认窗口、最小窗口、宽屏窗口无明显错位。
  - 长书名、长作者名、长划线、长想法不撑破布局。
  - 加载态、空态、错误态、成功态完整。
  - Notes 与 Export 的核心视觉优先级高于统计卡片和辅助区域。

### REQ-006 书架/笔记本本地搜索增强

- 优先级：P1
- 状态：Todo
- 模块：Dashboard / Notes / Export
- 背景：MVP 允许本地搜索，当前笔记内容已有搜索，书架和导出范围选择仍可继续增强筛选效率。
- 验收：
  - 书架或笔记本列表支持标题/作者本地搜索。
  - 导出页大量书籍下可快速定位目标。
  - 不引入书城搜索或推荐发现，除非用户明确要求。

### REQ-007 笔记报告模版

- 优先级：P2
- 状态：Todo
- 模块：Export
- 来源：飞书记录 `rec27qYCk2C7z5`，提出人 `Duosl`，创建时间 `2026-05-20 11:44:15`。
- 背景：支持用户自定义导出模版，将划线、想法、章节等数据按模版渲染输出。飞书收集项补充希望支持内置报告模版、分享，以及区分调用已安装 CLI 版本 / API Key 版本。详见 `mvp-design-doc.md` 5.4 节。
- 验收：
  - 先确定模版语法和最小变量集。
  - 默认模版保持现有 Markdown 输出。
  - 用户模版错误不影响默认导出能力。

### REQ-008 Obsidian Base 导出增强

- 优先级：P2
- 状态：Todo
- 模块：Export
- 来源：飞书记录 `rec27qYACS18S2`，提出人 `Duosl`，创建时间 `2026-05-20 11:42:39`。
- 背景：飞书收集项希望 Markdown 支持更适合 Obsidian Base 的 Frontmatter，方便用户在 Obsidian 中创建 Base 并可视化。当前 Markdown Frontmatter 已有基础字段，仍需澄清 Obsidian Base 需要的字段命名、类型和示例视图。
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

---

## 已完成记录

### 2026-05-20

- REQ-001 前端想法分页加载：Notes 页和导出页单本预览已通过 `src/lib/reviews.ts` 共享分页加载所有想法，不再只取前 100 条；`frontend:typecheck`、`frontend:build`、`cargo check` 通过。
- 飞书需求表同步：已用 user 身份读取外部收集表，合并 `rec27qYCk2C7z5` 到 `REQ-007`，新增 `REQ-008`、`REQ-009`、`REQ-010` 作为 P2 外部候选。
- Markdown-only 导出边界：已移除 JSON 导出命令和前端格式切换，导出入口固定为 `export_to_markdown`。
- Markdown Frontmatter：导出文件头部包含 `bookId`、`isbn`、`title`、`author`、`cover`、`lastReadDate`、`finishedDate`、`reading-time`、`progress`。
- 笔记页视图：支持笔记本列表、关键词搜索、划线/想法筛选，以及「按章节 / 按时间」两种视图。
- 导出页真实预览：选择单本书时读取真实划线、想法、书籍信息和阅读进度生成 Markdown 预览；多本选择时只展示提示。
- API 本地缓存：API 响应写入本地缓存，设置页可调整自动刷新间隔。
- 交流与支持入口：README 中「开发贡献」已移动到交流群和打赏之后；软件内已拆分为「交流群」和「打赏支持」两个入口、两个弹窗。
- 弹窗视觉增强：交流群弹窗放大二维码并使用蓝色主题；打赏支持弹窗使用红心色主题。
- 二维码展示归一：四张二维码图在弹窗中使用统一方形裁切展示，个人微信高图通过展示层裁切放大，不改动源图。
