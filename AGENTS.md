# WeRead Skill Desktop - AGENTS.md

本文件是 AI 工程代理的项目入口协议，只定义工作方式、资料优先级和不可违反的边界。具体功能设计、UI 规范、API 字段与导出格式不在本文件重复描述，必须到对应资料中读取。

AI 必须同时参考：

1. `AGENTS.md`：工程约束、执行顺序、验收入口。
2. `mvp-design-doc.md`：MVP 范围、页面、命令、数据流、导出格式。
3. `ui-style-guide.md`：UI 与交互规范。
4. `/tmp/weread-skills/weread-skills/`：微信读书 Skill 原始 API 文档。
5. `docs/requirements-pool.md`：需求池、优先级、状态、下一步建议。
6. 飞书多维表格「微信读书 SKill 桌面端需求收集表」：外部需求收集入口，按第 9 节流程读取和回写。

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

1. `/tmp/weread-skills/weread-skills/*.md`：API 参数、字段含义、分页、单位、统计口径的最终依据。
2. `mvp-design-doc.md`：产品范围、页面结构、命令清单、导出格式的最终依据。
3. `ui-style-guide.md`：UI 与交互的最终依据。
4. `AGENTS.md`：工程行为与协作规则。

如果本文件与以上专门文档出现实现细节冲突，优先遵循专门文档。

---

## 3. 工作原则

必须遵循：

- 先读文档，再写代码。
- 先建立清晰架构，再实现具体功能。
- 每个功能只实现 MVP 明确需要的范围。
- 前端、数据获取、导出、系统能力保持职责分离。
- API 行为必须以 `/tmp/weread-skills/weread-skills/` 为准，不凭字段名猜测。
- UI 相关决策必须以 `ui-style-guide.md` 为准。

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

开始任何实现前，必须完成：

1. 阅读 `mvp-design-doc.md`，确认当前任务属于 MVP 的哪个模块。
2. 阅读 `ui-style-guide.md`，确认相关 UI 规则。
3. 阅读 `docs/requirements-pool.md`，确认当前需求状态、优先级和完成后应更新的位置。
4. 如果任务涉及微信读书 API，阅读 `/tmp/weread-skills/weread-skills/` 中对应能力文档。
5. 明确当前改动的边界：前端 UI、前端数据层、Rust API、导出、配置、系统命令中的哪一类。

不要把其他文档中的内容复制进本文件；需要细节时直接引用并遵循对应文档。

---

## 5. API 使用规则

本文件不维护 API 字段表。所有 API 参数、分页方式、字段单位和统计口径以 `/tmp/weread-skills/weread-skills/` 为准。

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

本文件不维护 UI 细节。所有视觉、布局、组件、状态和交互要求都以 `ui-style-guide.md` 为准。

如果实现中需要 UI 判断，先查 `ui-style-guide.md`，不要在本文件补充新的 UI 规范。

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

每个阶段完成后至少执行：

- `npm run frontend:typecheck`
- `npm run frontend:build`
- `cargo check`

如果某条命令无法执行，必须说明原因和剩余风险。

功能验收以 `mvp-design-doc.md` 为准。

UI 验收以 `ui-style-guide.md` 为准。

API 验收以 `/tmp/weread-skills/weread-skills/` 为准。

---

## 9. 需求池与下一步

需求状态、优先级、已完成功能记录、下一步建议都不写在本文件，统一维护在 `docs/requirements-pool.md`；飞书多维表格只作为外部需求收集和状态回写入口。

外部需求收集表：

- 链接：`https://my.feishu.cn/wiki/SuvEweIueio4HckdjYocYJsgnod?table=tblDgYWsdzy9hYkp&view=vewdxXFqVN`
- Wiki token：`SuvEweIueio4HckdjYocYJsgnod`
- Table ID：`tblDgYWsdzy9hYkp`
- 默认视图：`vewdxXFqVN`
- 已解析 Base token：`RrRSbRyU9asqCSsPRcacGt93nPw`

读取或回写飞书表时必须使用 `lark-base` skill，并先遵循其 reference 要求。默认使用 `--as user`；如果用户身份出现 `need_user_authorization`，不要把它当作失败结论，应提示用户执行 `lark-cli auth login --domain wiki,base` 后重试。只读场景可临时使用 `--as bot` 作为备用。

当前已验证：user 身份可以解析 Wiki、创建记录和更新记录；bot 身份可以读取该表，但创建记录返回 `HTTP 403: you don't have permission`，因此 bot 只作为读取备用，不用于回写。

开始任何需求前：

1. 先读 `docs/requirements-pool.md`，确认最高优先级且未阻塞的需求。
2. 读取飞书需求收集表当前视图，检查是否有新的 `收集箱` / `规划中` / `开发中` 条目需要同步到本地需求池。
3. 按 `docs/requirements-pool.md` 中的飞书同步规则去重、映射优先级与状态；没有足够信息的条目标记为待澄清，不要直接进入开发。
4. 再按本文件第 4 节读取对应设计、UI 或 API 资料。
5. 如果用户指定了需求，以用户指定为准；如果用户只说“继续”或“下一个”，默认选择本地需求池中最高优先级且未阻塞的 `Todo` 需求。

完成任何需求后：

1. 更新 `docs/requirements-pool.md` 中对应条目的状态、完成说明和剩余风险。
2. 如果该需求来自飞书表，且当前身份具备写权限，回写飞书记录的状态、上线版本或补充信息；没有回写权限时在最终回复中说明。
3. 如果实现改变了产品范围、导出格式、命令清单或 UI 规则，同步更新 `mvp-design-doc.md`、`ui-style-guide.md` 或 `README.md`。
4. 在最终回复中提示下一个建议启动的高优先级需求。

---

## 10. 资料落位规则

为避免 `AGENTS.md` 膨胀，以下内容必须写到对应资料中：

- 产品范围、页面结构、数据流、命令清单、导出格式：写入 `mvp-design-doc.md`。
- 视觉风格、组件状态、布局规则、交互细节：写入 `ui-style-guide.md`。
- 需求池、优先级、完成记录、下一步开发建议：写入 `docs/requirements-pool.md`。
- 面向用户的安装、使用、功能说明：写入 `README.md`。
- 微信读书 API 字段、参数、分页、统计口径：只引用 `/tmp/weread-skills/weread-skills/`，不要复制到仓库文档。
- 具体实现细节：以代码为准；文档只记录稳定边界和必要决策。

---

最后更新：2026-05-20
