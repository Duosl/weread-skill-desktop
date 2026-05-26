# 书迹

把微信读书笔记整理成可归档、可复盘、可分享的阅读资产。

> 这不是微信读书客户端，而是你的私人阅读档案室。

---

## 功能

- **书架概览** — 同步书架、笔记本和阅读统计，支持手动刷新真实数据
- **笔记中心** — 划线与想法可搜索、可筛选，并支持按章节或按时间浏览
- **Markdown 导出** — 单本或批量导出为 Markdown，文件头部包含 Frontmatter
- **真实预览** — 选择单本书时加载真实划线、想法、书籍信息和阅读进度生成预览
- **阅读统计** — 阅读时长、天数、偏好分类和阅读趋势，用数据回顾阅读旅程
- **本地缓存** — API 响应会写入本地缓存，设置页可调整自动刷新间隔

---

## 下载安装

访问 [GitHub Releases](https://github.com/Duosl/weread-skill-desktop/releases/latest) 下载对应平台的安装包：

| 平台 | 架构 | 文件 |
|------|------|------|
| macOS | Apple Silicon (M 系列) | `macos_apple-silicon.dmg` |
| macOS | Intel | `macos_intel.dmg` |
| Windows | x64 | `windows_x64-setup.exe` |
| Linux | x64 | `linux_x64.AppImage` |

---

## 使用指南

### 1. 配置 Token

首次打开应用，进入「设置」页面，粘贴你的微信读书 API Token。

> 如何获取 Token？
> 1. 在浏览器中打开 [微信读书 Skill 配置页](https://weread.qq.com/r/weread-skills#setup) 并登录
> 2. 点击「登录微信读书」按钮完成授权
> 3. 登录成功后即可看到并复制你的 API Key（即 Bearer Token）
> 4. 将复制的 Token 粘贴到应用设置中

### 2. 同步书架

配置 Token 后，进入「概览」页面，点击右上角的「刷新」按钮，即可同步书架、阅读统计和笔记本数据。

应用会缓存 API 响应，默认优先使用未过期缓存。你可以在「设置」页面调整缓存自动刷新间隔。

### 3. 浏览笔记

进入「笔记」页面后，从左侧选择一本有记录的书。你可以：

- 搜索划线或想法内容
- 在「全部 / 划线 / 想法」之间筛选
- 在「按章节 / 按时间」之间切换视图
- 点击右上角「微信读书」跳转到原书

### 4. 导出数据

进入「导出」页面，选择：
- **导出范围** — 单本或全部书籍
- **导出格式** — Markdown
- **内容选项** — 是否包含划线、想法
- **输出目录** — 可输入路径或点击「浏览」选择目录

选择单本书时，右侧会加载真实内容预览；选择多本书时不做合并预览。点击「导出」后，应用会在输出目录下生成 `markdown/` 子目录，每本书一个 Markdown 文件。

导出的 Markdown 会包含 Frontmatter，便于 Obsidian 等工具索引：

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

---

## 交流群

加入用户交流群，获取使用帮助、分享阅读心得、第一时间了解更新动态。

> 群二维码失效，可添加个人微信，备注「书迹」，我来拉你入群。

<p align="center">
  <img src="./docs/images/wechat-group-qrcode.jpg" width="300" alt="交流群二维码" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./docs/images/wechat-personal-qrcode.jpg" width="300" alt="个人二维码" />
</p>

---

## 喝杯咖啡

如果这个项目对你有帮助，欢迎请我喝杯咖啡，支持持续维护与更新。

> 扫码赞赏，任意金额都是鼓励。

<p align="center">
  <img src="./src/assets/reward-wechat.png" width="300" alt="微信收款码" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./src/assets/reward-alipay.png" width="300" alt="支付宝收款码" />
</p>

---

## 开发贡献

### 技术栈

- **后端**：Rust + Tauri 2
- **前端**：React 19 + TypeScript + Tailwind CSS 4
- **构建**：Vite 7

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/Duosl/weread-skill-desktop.git
cd weread-skill-desktop

# 安装前端依赖
npm install

# 启动桌面应用开发环境
npm run dev
```

常用验收命令：

```bash
npm run frontend:typecheck
npm run frontend:build
cd src-tauri && cargo check
```

### 项目结构

```
weread-skill-desktop/
├── src/                    # 前端源码
│   ├── components/         # UI 组件
│   ├── pages/              # 页面组件
│   ├── hooks/              # React Hooks
│   ├── types/              # TypeScript 类型
│   └── lib/                # 格式化与导出预览工具
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── commands.rs     # Tauri 命令
│   │   ├── api.rs          # 微信读书 API 调用
│   │   ├── cache.rs        # API 本地缓存与请求日志
│   │   ├── config.rs       # 配置管理
│   │   ├── telemetry.rs    # 匿名版本统计
│   │   ├── export.rs       # Markdown 导出逻辑
│   │   └── types.rs        # 数据类型
│   └── tauri.conf.json     # Tauri 配置
├── cloudflare/             # Cloudflare Worker / D1 辅助服务
├── landing/                # 产品落地页
└── README.md               # 本文档
```

### 提交 Issue / PR

欢迎提交 Issue 和 Pull Request！

- 提交 Bug 报告时，请附上操作系统版本和应用版本号
- 提交功能建议时，请描述使用场景和预期行为
- 提交代码前，请确保 `npm run frontend:typecheck` 和 `cargo check` 通过

---

## License

本项目采用 [GNU General Public License v3.0](LICENSE) 开源许可。
