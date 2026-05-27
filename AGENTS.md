# WeRead Skill Desktop - AGENTS.md

本文件是 AI 工程代理的项目入口协议，只定义工作方式、资料优先级和不可违反的边界。具体功能设计、UI 规范、API 字段与导出格式不在本文件重复描述，必须到对应资料中读取。

AI 必须同时参考：

1. `AGENTS.md`：工程约束、执行顺序、验收入口。
2. `docs/current-context.md`：当前阶段、边界、默认阅读入口。
3. `docs/requirements-pool.md`：活跃需求、优先级、状态、下一步建议。
4. `feature_list.json`：当前可执行功能队列、依赖、状态和验收证据索引。
5. `progress.md`：当前会话进展、最近验证结果、下一步动作。
6. `session-handoff.md`：跨会话交接、恢复入口和未完成事项。
7. `mvp-design-doc.md`：稳定产品范围、页面、命令、数据流、导出格式。
8. `ui-style-guide.md`：UI 与交互规范。
9. `design.md`：UI 审计结论、设计 tokens、组件规则、页面统一方案和后续改造执行蓝图。
10. `~/.agents/skills/weread-skills/`：微信读书 Skill 原始 API 文档。
11. `/Users/duoshilin/duosl/forks/html-anything`：智能体报告输出形态与风格拓展参考，尤其是 deck / 小红书 / 卡片 / 海报类 HTML skill。
12. 飞书多维表格「微信读书 SKill 桌面端需求收集表」：外部需求收集入口，按第 9 节流程读取和回写。

---

## 1. 项目目标

构建一个微信读书数据导出与管理桌面工具，而不是微信读书客户端。

核心目标：

- 用户可以配置 API Key。
- 用户可以查看书架。
- 用户可以查看单本书的划线与个人想法/点评。
- 用户可以导出 Markdown（包含用于资料库索引的 Frontmatter）。
- 用户可以查看基础阅读统计。

技术方向：

- Tauri 2 + Rust 后端。
- React + TypeScript + Vite + Tailwind CSS 前端。
- UI 遵循 `ui-style-guide.md`。

---

## 2. 资料优先级

当资料之间冲突时，按以下顺序判断：

1. `~/.agents/skills/weread-skills/*.md`：API 参数、字段含义、分页、单位、统计口径的最终依据。
2. `mvp-design-doc.md`：产品范围、页面结构、命令清单、导出格式的最终依据。
3. `ui-style-guide.md`：UI 与交互的最终依据。
4. `design.md`：UI 实施与收敛方案的执行依据。
5. `/Users/duoshilin/duosl/forks/html-anything`：智能体报告输出形态、版式池、交互和截图友好结构的参考依据；只用于抽象设计原则和产物约束，不覆盖本项目隐私、数据口径、UI 气质和版权边界。
6. `AGENTS.md`：工程行为与协作规则。

如果本文件与以上专门文档出现实现细节冲突，优先遵循专门文档。

`html-anything` 中的模板包含第三方来源和各自 LICENSE。后续拓展 PPT、小红书、海报、卡片、数据报告等风格时，可以参考其 `next/src/lib/templates/skills/*/SKILL.md` 的版式池、比例、交互和输出结构，但不要直接整段复制第三方模板文本或视觉资产；如实质复用某个模板或来源作品，必须保留原始署名和许可证要求。

---

## 3. 工作原则

必须遵循：

- 先读文档，再写代码。
- 先建立清晰架构，再实现具体功能。
- 每个功能只实现 MVP 明确需要的范围。
- 前端、数据获取、导出、系统能力保持职责分离。
- API 行为必须以 `~/.agents/skills/weread-skills/` 为准，不凭字段名猜测。
- UI 相关决策必须以 `ui-style-guide.md` 为准。
- 产品面向普通用户，所有功能、设置、状态、错误和权限说明都必须用用户能理解的语言表达；不要把工程字段、内部模块名、协议名或实现细节直接暴露给用户。

工程原则：

- KISS：优先选择简单直接的实现。
- YAGNI：不为未来功能预留复杂结构。
- DRY：重复逻辑要抽象。
- SOLID：模块职责清晰，避免页面组件承担过多业务逻辑。

禁止：

- 不要扩展成完整微信读书客户端。
- 不要做在线阅读体验。
- 不要做推荐发现、相似书籍、公共书评浏览等非 MVP 功能。
- 不要交付伪功能。
- 不要为了假设中的历史包袱或未来扩展牺牲清晰架构。
- 不要主动提交 git。

---

## 4. 开始任务前

### Startup Workflow

开始任何实现前，必须完成：

1. 阅读 `docs/current-context.md`，确认当前阶段边界。
2. 阅读 `docs/requirements-pool.md`，确认当前需求状态、优先级和完成后应更新的位置。
3. 阅读 `feature_list.json`，确认同一时间只推进一个功能；如果用户没有指定任务，选择依赖已满足、优先级最高的 `not-started` 功能。
4. 阅读 `progress.md`；如果存在未完成工作，再阅读 `session-handoff.md`，按交接记录恢复，不要重新猜测上下文。
5. 如果任务涉及产品范围、页面结构、命令清单、数据流或导出格式，阅读 `mvp-design-doc.md`。
6. 如果任务涉及 UI、页面、组件、视觉、交互或布局，阅读 `ui-style-guide.md` 和 `design.md`，并按其中的 tokens、组件规则、页面统一方案和验收清单执行。
7. 如果任务涉及微信读书 API，阅读 `~/.agents/skills/weread-skills/` 中对应能力文档。
8. 如果任务涉及智能体报告输出形态、PPT 风格、小红书图文、海报、卡片、数据报告或新风格拓展，阅读 `/Users/duoshilin/duosl/forks/html-anything/next/src/lib/templates/skills/` 中对应 skill，提炼成符合本项目 Quiet Reading Ledger 的约束。
9. 只有在需要追溯已完成需求、历史决策或旧验收时，才读取 `docs/archive/completed-requirements.md`；不要把归档作为默认上下文。
10. 明确当前改动的边界：前端 UI、前端数据层、Rust API、导出、配置、系统命令中的哪一类。

One feature at a time：开始实现前，必须把选定功能在 `feature_list.json` 中标为 `in-progress`，同一时间只允许一个功能处于 `in-progress`。必须在 `progress.md` 写明当前目标、改动范围和预期验收入口。用户只是询问、规划或审阅时，不强制切换功能状态。

Stay in scope：实现期间只处理当前功能的必要文件、必要状态和必要文档；发现相邻优化时，先记录到 `docs/requirements-pool.md` 或 `feature_list.json`，不要顺手扩张当前交付范围。

不要把其他文档中的内容复制进本文件；需要细节时直接引用并遵循对应文档。

---

## 5. API 使用规则

本文件不维护 API 字段表。所有 API 参数、分页方式、字段单位和统计口径以 `~/.agents/skills/weread-skills/` 为准。

最低要求：

- 每个 API 实现前必须阅读对应 skill 文档。
- 网关请求必须遵守 skill 文档中的统一调用规范。
- 业务参数必须按 skill 文档要求传递。
- 时间、时长、计数口径不得凭直觉解释。
- 出现 `upgrade_info` 时必须中断当前 API 操作并向前端返回明确错误。

常用文档映射：

- 书架：`shelf.md`
- 笔记、划线、个人想法、笔记本：`notes.md`
- 阅读统计：`readdata.md`
- 搜索：`search.md`
- 书籍信息：`book.md`
- 总调用规范与深度链接：`SKILL.md`

---

## 6. UI 规则

本文件不维护 UI 细节。所有视觉、布局、组件、状态和交互要求都以 `ui-style-guide.md` 为准，具体执行、审计结论、tokens、组件规则和改造顺序以 `design.md` 为准。

如果实现中需要 UI 判断，先查 `ui-style-guide.md` 和 `design.md`，不要在本文件补充新的 UI 规范。

涉及全应用 UI 审计、页面风格统一、组件视觉重构或设计系统收敛时，必须额外使用 UI 相关 Skill（当前优先 `frontend-design` 与 `ui-ux-pro-max`）做分析和验收。必须参考 `design.md` 的视觉方向、tokens、组件规则和实现顺序；稳定规则仍回写 `ui-style-guide.md`，不要让 `AGENTS.md` 承载具体样式规范。

用户可见文案必须降低理解成本：

- 不要在界面中出现 `requiresRawNotesConsent`、`outputShape`、`jobId`、`templateId`、`CLI` 等工程字段或内部概念，除非目标用户确实需要并已有上下文。
- 涉及权限和隐私时，明确说明“会读取什么、为什么需要、是否默认开启、数据保存在哪里”，例如用“允许读取划线原文和个人想法”替代内部字段名。
- 设置项和操作按钮要表达用户目标，而不是实现机制；必要时用一句短说明补充影响和边界。
- 错误信息要告诉用户发生了什么、能否重试、下一步做什么，不要只展示底层异常或接口字段。

---

## 7. Rust 与导出规则

Rust 后端职责：

- 配置读写。
- API Key 管理。
- 微信读书 API 调用。
- 数据解析与错误映射。
- Markdown 导出。
- 打开文件夹和微信读书深度链接。

最低要求：

- 配置、API、导出、命令、状态管理分模块实现。
- 导出格式以 `mvp-design-doc.md` 为准。
- API 解析以 skill 文档字段为准。
- 错误返回要对前端可展示，且语义一致。
- 不要把系统错误伪装成成功结果。
- 文件写入、路径处理、目录创建必须可靠。

---

## 8. 验收入口

### Verification Commands

每个阶段完成后默认执行：

- `./init.sh`

`init.sh` 是当前仓库的统一验收入口，至少包含：

- `npm run frontend:typecheck`
- `npm run frontend:build`
- `cd src-tauri && cargo check`
- `git diff --check`

当前仓库尚未固定自动化单元测试入口；如果新增测试脚本，必须同步加入 `init.sh`。如果某个需求需要更强回归，可以临时运行对应的 test 命令，并把命令与结果写入 Evidence。

如果某条命令无法执行，必须说明原因和剩余风险。

完成后必须把验证命令、结果摘要和剩余风险写回 `progress.md`；如果功能完成，还要同步写入 `feature_list.json` 的 `evidence` 字段和 `session-handoff.md`。

### Definition of Done

需求 done only when：

- 当前功能代码、相关文档和状态文件已经同步。
- `./init.sh` 已通过，或失败/跳过原因和剩余风险已记录。
- `feature_list.json` 已写入最终 `status` 和 Evidence。
- `progress.md` 与 `session-handoff.md` 已更新到可 clean restart 的状态。
- 当前功能范围已经关闭，新增想法已进入需求池或功能队列，而不是混入本次完成口径。

功能验收以 `mvp-design-doc.md` 为准。

UI 验收以 `ui-style-guide.md` 为准。

API 验收以 `~/.agents/skills/weread-skills/` 为准。

---

## 8.1 当前开发偏好

以下偏好来自当前阶段已经收敛的实现方式，后续新增功能默认沿用：

- 普通 Markdown 导出页保持现有导出工作台结构，不改成模板目录，除非用户明确要求。
- 阅读报告页优先做“报告模板目录”，不要把所有模板的预览、导出和系统打开操作直接铺满页面。
- 具体报告模板应在接近全屏的工作台弹窗中完成预览、导出、浏览器打开和结果反馈。
- 基础模板可以直接读取确定性数据模型；高级模板必须先通过独立数据准备层和洞察生成层，不让 UI 模板直接调用模型或 CLI。
- 高级报告的本地 CLI 调用只作为后端/系统能力封装，前端只读取模板清单、任务状态、输入输出目录和生成结果。
- 分享能力必须与正式导出分开设计；分享版 HTML 可以加入应用署名、回链或安装入口，但不能影响用户本地私有导出。
- 对外分享场景（导出文件、报告、分享图片等）统一使用署名格式：`「书迹」桌面端`。使用直角引号「」强调品牌名，避免与普通词汇混淆。
- UI 保持 Quiet Reading Ledger：模板卡片用于选择，预览像真实文件或报告纸面，主操作保持清晰克制。
- 智能体报告的输出形态拓展默认参考 `/Users/duoshilin/duosl/forks/html-anything` 的 skill 模板体系：PPT 优先参考 deck 类的固定舞台、版式池和翻页交互；小红书优先参考 card / deck-xhs 类的 3:4 截图卡、封面卡、页码和多卡片画廊。但最终产物必须收敛到本项目的阅读档案气质，不照搬营销化文案或第三方模板资产。
- 当前阶段最高优先级以 `docs/requirements-pool.md` 为准；已完成内容进入 `docs/archive/completed-requirements.md`，不要让需求池重新膨胀。

## 8.2 Changelog 规则

生成或更新 `CHANGELOG.md` 时必须按用户功能角度书写，不写技术实现、内部字段、依赖、权限、缓存、命令或工程修复细节，除非这些内容直接对应用户可感知的能力变化。分类边界如下：

- `新增`：用户以前没有这个入口、视图、操作、筛选条件、输出形态或可完成的任务，现在可以做一件新事。只要用户能说“现在多了一个可以做 X 的功能”，就归入新增。例如封面墙视图、全部笔记、划线颜色筛选、分享卡片。
- `优化`：用户原来已经能完成同一件事，本次让它更顺、更清晰、更快、更稳定、更好理解或更好看，但没有增加新的用户目标。优化必须说清楚优化了哪个既有体验，不写泛泛的“细节打磨”。不要把新增功能拆成“新增 + 优化”重复描述。
- `修复`：修正用户已经可能遇到的错误、异常、误判、数据不完整、展示不正确、操作失败或与预期不一致的问题。只有用户可感知的问题才写入修复；内部重构、权限收敛、依赖调整、测试修正不算面向用户的修复，除非它直接解决了用户可见故障。
- 分类优先级：如果一项改动让用户获得新能力，即使同时改善了界面，也归入 `新增`；如果只是改善已有能力，归入 `优化`；如果是纠正错误行为，归入 `修复`。
- 不写“批量导出、笔记浏览和长内容显示做了细节打磨”这类没有明确用户功能指向的虚泛表述。
- 匿名统计、埋点、内部验收、代码结构调整默认不写入面向用户的 changelog；除非用户明确要求披露。
- 条目保持少而准，优先合并同类能力，避免面面俱到。

---

## 9. 需求池与下一步

当前阶段、活跃需求、优先级和下一步建议统一维护在 `docs/current-context.md` 与 `docs/requirements-pool.md`；已完成需求归档到 `docs/archive/completed-requirements.md`；飞书多维表格只作为外部需求收集和状态回写入口。

外部需求收集表：

- 链接：`https://my.feishu.cn/wiki/SuvEweIueio4HckdjYocYJsgnod?table=tblDgYWsdzy9hYkp&view=vewdxXFqVN`
- Wiki token：`SuvEweIueio4HckdjYocYJsgnod`
- Table ID：`tblDgYWsdzy9hYkp`
- 默认视图：`vewdxXFqVN`
- 已解析 Base token：`RrRSbRyU9asqCSsPRcacGt93nPw`

读取或回写飞书表时必须使用 `lark-base` skill，并先遵循其 reference 要求。默认使用 `--as user`；如果用户身份出现 `need_user_authorization`，不要把它当作失败结论，应提示用户执行 `lark-cli auth login --domain wiki,base` 后重试。只读场景可临时使用 `--as bot` 作为备用。

当前已验证：user 身份可以解析 Wiki、创建记录和更新记录；bot 身份可以读取该表，但创建记录返回 `HTTP 403: you don't have permission`，因此 bot 只作为读取备用，不用于回写。

开始任何需求前：

1. 先读 `docs/current-context.md` 和 `docs/requirements-pool.md`，确认最高优先级且未阻塞的需求。
2. 读取 `feature_list.json`，确认依赖、状态和当前唯一可推进功能。
3. 读取飞书需求收集表当前视图，检查是否有新的 `收集箱` / `规划中` / `开发中` 条目需要同步到本地需求池。
4. 按 `docs/requirements-pool.md` 中的飞书同步规则去重、映射优先级与状态；没有足够信息的条目标记为待澄清，不要直接进入开发。
5. 再按本文件第 4 节读取对应设计、UI 或 API 资料。
6. 如果用户指定了需求，以用户指定为准；如果用户只说“继续”或“下一个”，默认选择 `feature_list.json` 中依赖已满足、优先级最高且未阻塞的 `not-started` 功能。

完成任何需求后：

1. 运行 `./init.sh`，并记录通过、失败或跳过原因。
2. 更新 `feature_list.json` 中对应功能的 `status` 和 `evidence`。
3. 更新 `progress.md` 的完成说明、验证结果、剩余风险和下一步。
4. 更新 `session-handoff.md`，确保下一位智能体可以在 5 分钟内恢复现场。
5. 更新 `docs/requirements-pool.md` 中对应条目的状态。
6. 将完成说明、改动入口、验证结果和剩余风险追加到 `docs/archive/completed-requirements.md`，并从活跃需求详情中移除已完成需求。
7. 如果该需求来自飞书表，且当前身份具备写权限，回写飞书记录的状态、上线版本或补充信息；没有回写权限时在最终回复中说明。
8. 如果实现改变了产品范围、导出格式、命令清单或 UI 规则，同步更新 `mvp-design-doc.md`、`ui-style-guide.md` 或 `README.md`。
9. 在最终回复中提示下一个建议启动的高优先级需求。

### End of Session

Before ending a development session：

- 确认 `feature_list.json` 中没有过期的 `in-progress` 状态；未完成则保留并写清 blocker，已完成则改为 `done`。
- 在 `progress.md` 写入最后验证结果、当前状态、下一步。
- 在 `session-handoff.md` 写入 changed files、blockers、recommended next step，保证下一次可以 restartable 且 clean 地恢复。
- 不主动提交 git；只报告改动和验证证据。

---

## 10. 资料落位规则

为避免 `AGENTS.md` 膨胀，以下内容必须写到对应资料中：

- 产品范围、页面结构、数据流、命令清单、导出格式：写入 `mvp-design-doc.md`。
- 视觉风格、组件状态、布局规则、交互细节：写入 `ui-style-guide.md`。
- UI 审计结论、设计 tokens、组件规则、页面统一方案、改造顺序和验收清单：写入 `design.md`。
- 当前阶段与默认阅读入口：写入 `docs/current-context.md`。
- 活跃需求、优先级、下一步开发建议：写入 `docs/requirements-pool.md`。
- 已完成需求、完成记录和历史决策：写入 `docs/archive/completed-requirements.md`。
- 可执行功能队列、依赖、状态、证据索引：写入 `feature_list.json`。
- 当前会话进展、验证结果、下一步动作：写入 `progress.md`。
- 跨会话恢复说明、未完成事项、最后有效上下文：写入 `session-handoff.md`。
- 验收命令编排：写入 `init.sh`。
- 面向用户的安装、使用、功能说明：写入 `README.md`。
- 微信读书 API 字段、参数、分页、统计口径：只引用 `~/.agents/skills/weread-skills/`，不要复制到仓库文档。
- 智能体报告输出形态、版式池、截图比例、交互结构等稳定规则：优先写入 `mvp-design-doc.md`、`ui-style-guide.md` 或 `docs/requirements-pool.md`；`html-anything` 只作为外部参考来源，不复制进仓库。
- 具体实现细节：以代码为准；文档只记录稳定边界和必要决策。

---

最后更新：2026-05-27
