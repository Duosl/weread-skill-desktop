# 书迹工程代理协议

最后更新：2026-05-28

本文件只定义工程代理的工作方式、资料优先级和不可违反的边界。产品范围、UI 规范、API 字段和导出格式不要写进本文件，按下方资料读取。

## 项目目标

书迹是一款微信读书数据导出与管理桌面工具，不是微信读书客户端。

当前核心能力：

- 配置微信读书 API Key。
- 查看概览、书架、划线、个人想法和阅读统计。
- 导出 Markdown。
- 生成基础/高级阅读报告。
- 生成划线/想法分享卡片。
- 同步 Markdown 到 ima 知识库。

技术栈：

- Tauri 2 + Rust
- React 19 + TypeScript + Vite
- Tailwind CSS 4

## 资料优先级

冲突时按此顺序判断：

1. `~/.agents/skills/weread-skills/`：微信读书 API 参数、字段、分页、单位和统计口径。
2. `mvp-design-doc.md`：产品范围、页面、命令、数据流和导出格式。
3. `ui-style-guide.md`：长期 UI 与交互规则。
4. `design.md`：当前 UI 执行说明、审计结论和页面改造顺序。
5. `docs/current-context.md`：当前阶段和默认入口。
6. `docs/requirements-pool.md`：活跃需求、优先级和飞书同步规则。
7. `feature_list.json`：可执行功能队列、状态和验收证据。
8. `progress.md`、`session-handoff.md`：当前会话进展与恢复入口。
9. `docs/archive/completed-requirements.md`：历史完成记录，只在追溯时读取。

## 开始任务前

实现类任务必须先做：

1. 读取 `docs/current-context.md`。
2. 读取 `docs/requirements-pool.md`。
3. 读取 `feature_list.json`，确认同一时间只有一个 `in-progress` 功能。
4. 读取 `progress.md` 和 `session-handoff.md`。
5. 如果用户未指定任务，选择依赖已满足、优先级最高的 `not-started` 功能。
6. 开始编码或写文档前，把选定功能标为 `in-progress`，并在 `progress.md` 写清目标、范围和验收入口。

按任务追加读取：

- 产品范围 / 数据流 / 命令 / 导出：`mvp-design-doc.md`
- UI / 页面 / 落地页 / 交互：`ui-style-guide.md`、`design.md`，并使用 UI 相关 skill
- 微信读书 API：`~/.agents/skills/weread-skills/` 中对应能力文档
- 飞书需求表：使用 `lark-base` skill，默认 `--as user`

## 工作原则

- 先读文档，再写代码。
- 一次只推进一个功能。
- 保持前端 UI、数据获取、导出、系统能力职责分离。
- API 行为以微信读书 skill 文档为准，不凭字段名猜测。
- UI 决策以 `ui-style-guide.md` 和 `design.md` 为准。
- 面向普通用户写文案，不暴露内部字段、命令名、协议名或实现细节。
- 不主动提交 git。

禁止：

- 不要扩展成完整微信读书客户端。
- 不要做在线阅读、推荐发现、相似书籍、公共书评浏览等非范围能力。
- 不要交付伪功能。
- 不要为假设中的未来扩展牺牲清晰架构。
- 不要把过期实现计划重新作为默认文档入口。

## API 规则

- 每个 API 实现前必须阅读对应 skill 文档。
- 网关请求遵守 skill 文档中的统一调用规范。
- 时间、时长、计数口径不得凭直觉解释。
- 出现 `upgrade_info` 时必须中断当前 API 操作，向前端返回明确错误。

常用映射：

- 书架：`shelf.md`
- 笔记、划线、个人想法、笔记本：`notes.md`
- 阅读统计：`readdata.md`
- 搜索：`search.md`
- 书籍信息：`book.md`
- 总规范与深度链接：`SKILL.md`

## UI 规则

- UI 任务必须使用 UI 相关 skill。
- 视觉方向保持 Quiet Reading Ledger。
- **新页面/新组件使用 Tailwind CSS 工具类**，不新建独立 CSS 文件。设计令牌通过 Tailwind 工具类访问（如 `text-brand`、`bg-paper`、`p-3`、`rounded-md`）。现有 CSS 文件不迁移，除非重构。
- 不使用 emoji 作为正式图标。
- 不做大面积渐变、玻璃拟态、漂浮光球或营销化布局。
- 权限和隐私说明必须写清”会读取什么、为什么需要、数据保存在哪里”。
- 图标按钮必须有可读标签，关键操作不能只靠 hover 发现。

## 验收入口

默认运行：

```bash
./init.sh
```

`init.sh` 至少包含：

- `npm run frontend:typecheck`
- `npm run frontend:build`
- `cd src-tauri && cargo check`
- `git diff --check`

完成后必须更新：

- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/requirements-pool.md`
- 如功能完成，追加 `docs/archive/completed-requirements.md`

如果命令无法执行，必须说明原因和剩余风险。

## 文档落位

- 产品范围、页面、数据流、命令、导出：`mvp-design-doc.md`
- 视觉、组件、状态、交互：`ui-style-guide.md`
- UI 审计、执行计划、页面清单：`design.md`
- 当前阶段：`docs/current-context.md`
- 活跃需求：`docs/requirements-pool.md`
- 完成历史：`docs/archive/completed-requirements.md`
- 功能队列：`feature_list.json`
- 会话进展：`progress.md`
- 跨会话恢复：`session-handoff.md`
- 用户安装和使用说明：`README.md`
