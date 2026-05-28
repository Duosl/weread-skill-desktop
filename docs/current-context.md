# 书迹当前工程上下文

最后更新：2026-05-28

## 当前阶段

项目已进入 Post-MVP 收敛阶段。核心链路已经可用：配置微信读书 API Key、同步书架和统计、浏览划线与想法、导出 Markdown、生成阅读报告、同步到 ima、生成分享卡片。

当前重点不是继续扩成微信读书客户端，而是围绕真实用户反馈优化：

- 导出可信度。
- 笔记内容可读性。
- 报告产物质量。
- 隐私授权说明。
- 个人资料库集成体验。

## 当前会话任务

当前没有正在实现的功能。

最近完成：`feat-024 / REQ-024 当前项目落地页重新生成`。

## 默认阅读入口

开始实现前默认读取：

1. `AGENTS.md`
2. `docs/current-context.md`
3. `docs/requirements-pool.md`
4. `feature_list.json`
5. `progress.md`
6. `session-handoff.md`

按任务需要再读取：

- 产品范围、命令、数据流：`mvp-design-doc.md`
- UI 和落地页：`ui-style-guide.md`、`design.md`
- API 字段与调用口径：`~/.agents/skills/weread-skills/`
- 已完成历史：`docs/archive/completed-requirements.md`

## 当前产品边界

继续保持：

- 桌面工具。
- 私人阅读档案。
- Markdown-first 导出。
- 明确的本地数据与隐私说明。
- 报告和分享作为增值能力，不影响主导出链路。

暂不进入：

- PDF 导出。
- 在线阅读。
- 书城推荐、相似推荐、公共书评浏览。
- 在线分享平台。
- 完整 HTML 编辑器。

## 下一建议

默认下一步：`feat-014 / REQ-014 智能体模板原文权限说明优化`。
