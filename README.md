# WeRead Skill Desktop

一款安静的桌面工具，帮你导出微信读书的划线、笔记与阅读统计。让数据真正属于你，随时可查阅、可备份、可迁移。

> 这不是微信读书客户端，而是你的私人阅读档案室。

---

## 功能

- **书架概览** — 一览全部藏书，标注已读与在读状态
- **笔记中心** — 划线与点评按章节归档，像整理过的阅读笔记
- **灵活导出** — 单本或批量导出为 Markdown，随时备份
- **阅读统计** — 时长、天数、偏好分类，用数据回顾阅读旅程

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

首次打开应用，进入「设置」页面，粘贴你的微信读书 Bearer Token。

> 如何获取 Token？
> 1. 在浏览器中打开 [微信读书 Skill 配置页](https://weread.qq.com/r/weread-skills#setup) 并登录
> 2. 点击「登录微信读书」按钮完成授权
> 3. 登录成功后即可看到并复制你的 API Key（即 Bearer Token）
> 4. 将复制的 Token 粘贴到应用设置中

### 2. 同步书架

配置 Token 后，进入「概览」页面，点击右上角的「刷新」按钮，即可同步书架、阅读统计和笔记本数据。

### 3. 浏览笔记

点击任意书籍进入详情页，按章节查看划线与个人想法/点评。

### 4. 导出数据

进入「导出」页面，选择：
- **导出范围** — 单本或全部书籍
- **导出格式** — Markdown
- **内容选项** — 是否包含划线、点评、元数据

点击「生成并导出」，选择保存目录即可。

---

## 开发贡献

### 技术栈

- **后端**：Rust + Tauri 2
- **前端**：React 19 + TypeScript + Tailwind CSS
- **构建**：Vite

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/Duosl/weread-skill-desktop.git
cd weread-skill-desktop

# 安装前端依赖
npm install

# 安装 Rust 依赖（Tauri CLI）
cargo install tauri-cli

# 启动开发服务器
npm run tauri dev
```

### 项目结构

```
weread-skill-desktop/
├── src/                    # 前端源码
│   ├── components/         # UI 组件
│   ├── pages/              # 页面组件
│   ├── hooks/              # React Hooks
│   ├── types/              # TypeScript 类型
│   └── utils/              # 工具函数
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── commands.rs     # Tauri 命令
│   │   ├── api.rs          # 微信读书 API 调用
│   │   ├── config.rs       # 配置管理
│   │   ├── export.rs       # 导出逻辑
│   │   └── types.rs        # 数据类型
│   └── tauri.conf.json     # Tauri 配置
├── landing/                # 产品落地页
└── README.md               # 本文档
```

### 提交 Issue / PR

欢迎提交 Issue 和 Pull Request！

- 提交 Bug 报告时，请附上操作系统版本和应用版本号
- 提交功能建议时，请描述使用场景和预期行为
- 提交代码前，请确保 `npm run frontend:typecheck` 和 `cargo check` 通过

---

## 交流群

加入用户交流群，获取使用帮助、分享阅读心得、第一时间了解更新动态。

> 群二维码失效，可添加个人微信，备注「WeRead」，我来拉你入群。

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

## License

本项目采用 [GNU General Public License v3.0](LICENSE) 开源许可。
