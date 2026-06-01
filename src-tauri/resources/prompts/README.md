# resources/prompts

本目录只存放**系统级 Prompt 模板**，不存放 Skill 文档或业务配置。

当前约定：

- `system.md` 用于 AI 助手主系统提示词模板。
- 模板中可包含运行时占位符，例如：
  - `{{TIME_CONTEXT}}`
  - `{{REPORT_DESIGN}}`
  - `{{SKILL_PROMPT}}`
  - `{{SKILL_SUMMARIES}}`
- 这些占位符由 Rust 侧在运行时注入，不在模板里手写实时数据。

职责边界：

- **Prompt 模板**放 `resources/prompts/`
- **Skill 文档、manifest、能力说明**放 `skills/`

这样可以保持：

- Skill 是 Skill
- Prompt 是 Prompt
- 两者独立维护，互不污染
