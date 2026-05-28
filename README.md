# 书迹

把微信读书笔记整理成可归档、可复盘、可分享的阅读资产。

书迹不是微信读书客户端，也不提供在线阅读、推荐发现或公共书评浏览。它是一款桌面整理工具：连接你的微信读书数据，浏览书架和笔记，导出 Markdown，生成阅读报告，并把内容同步到个人知识库。

## 现在可以做什么

- **概览**：查看阅读总时长、读过/读完数量、笔记数量、阅读天数、分类偏好和阅读趋势。
- **书架**：同步微信读书书架，按最近阅读或笔记数量排序，在列表视图和封面墙视图之间切换。
- **划线与想法**：按书浏览划线、个人想法和点评，支持本地搜索、类型筛选、颜色筛选、章节/时间视图。
- **分享卡片**：把单条划线或想法生成适合保存的 PNG 卡片，带书名、作者、章节和「书迹」桌面端署名。
- **Markdown 导出**：单本或批量导出微信读书笔记，带 Obsidian / 资料库友好的 Frontmatter。
- **阅读报告**：生成基础 HTML 阅读报告；也可调用本机已安装的 Codex / Claude / Gemini CLI 生成高级报告、PPT 风格网页或小红书图文风格网页。
- **ima 知识库**：配置 ima 凭证后，把选中的 Markdown 笔记导入指定知识库。
- **设置与维护**：管理 API Key、缓存刷新间隔、匿名安装统计、版本更新、交流群和支持入口。

## 下载安装

访问 [GitHub Releases](https://github.com/Duosl/weread-skill-desktop/releases/latest) 下载对应平台安装包。

| 平台 | 架构 | 文件 |
| --- | --- | --- |
| macOS | Apple Silicon | `macos_apple-silicon.dmg` |
| macOS | Intel | `macos_intel.dmg` |
| Windows | x64 | `windows_x64-setup.exe` |
| Linux | x64 | `linux_x64.AppImage` |

## 首次使用

1. 打开「设置」，粘贴微信读书 API Key。
2. 回到「概览」刷新数据，等待书架、笔记本和阅读统计同步。
3. 在「划线与想法」浏览或筛选笔记。
4. 切到「导出」选择范围、内容和目录，生成 Markdown。

API Key 获取入口：[微信读书 Skill 配置页](https://weread.qq.com/r/weread-skills#setup)。

## Markdown 输出

导出文件会放在所选目录的 `markdown/` 子目录下，每本书一个 Markdown 文件。文件包含 Frontmatter，方便 Obsidian、ima 或其他资料库索引。

```yaml
---
bookId: "123456"
isbn: "9780000000000"
title: 书名
author: 作者
cover: https://...
lastReadDate: 2026-05-20 21:30:00
finishedDate: 2026-05-20 22:10:00
reading-time: 3小时20分钟
progress: 100%
---
```

## 隐私说明

- API Key 保存在本机配置文件中，设置页只展示脱敏结果。
- 微信读书 API 响应会写入本地缓存，用于减少重复请求；可在设置中调整刷新间隔或清空缓存。
- 匿名安装统计只用于估算安装规模，发送随机安装编号、版本、平台、架构和语言区域，不采集微信读书内容、API Key、文件路径或用户操作事件。
- 高级报告只有在用户确认时才会把所需数据准备给本机 Agent；涉及划线原文和个人想法的模板会明确提示。
- ima 同步只会把用户选择导出的 Markdown 内容发送到用户配置的 ima 知识库。

## 本地开发

技术栈：

- Tauri 2 + Rust
- React 19 + TypeScript + Vite 7
- Tailwind CSS 4

常用命令：

```bash
npm install
npm run dev
./init.sh
```

`./init.sh` 是统一验收入口，包含前端类型检查、前端构建、Rust `cargo check` 和 `git diff --check`。

## 项目结构

```text
src/                 React 前端页面、组件、hooks、报告渲染与导出预览
src-tauri/src/       Rust 配置、微信读书 API、缓存、导出、报告、ima、Agent 桥接
landing/index.html   可独立打开的产品落地页
docs/                当前上下文、需求池和完成归档
assets/brand/        书迹品牌图标源文件
public/              前端静态资源
```

## 交流与支持

交流群二维码和赞赏入口保留在应用内「设置」页面，也可查看仓库中的 `docs/images/` 与 `src/assets/`。

## License

[GNU General Public License v3.0](LICENSE)
