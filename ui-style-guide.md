# 书迹 UI 风格规范

最后更新：2026-05-28

## 风格定位

Quiet Reading Ledger：安静的私人阅读账本。

书迹的界面应像一个长期使用的阅读档案工作台：纸面、墨色、索引、划线、文件预览和克制的系统操作共同组成体验。它不是营销站、不是通用 SaaS 后台，也不是微信读书客户端。

## 设计原则

- **内容优先**：划线、想法、书籍、报告和导出文件是主角，装饰不能喧宾夺主。
- **档案感**：时间、章节、书名、作者、进度、来源和导出结果要清楚可追溯。
- **工作台感**：筛选、预览、导出、同步、生成报告等操作要形成明确流程。
- **克制记忆点**：使用纸色、墨色、淡琥珀、蓝色操作线索和少量阅读绿色，不使用大面积渐变、玻璃拟态、漂浮光斑或营销化插画。
- **普通用户语言**：界面不展示 `jobId`、`rawNotesConsent`、`templateId`、`CLI` 等内部概念；说明要写清“会读取什么、为什么需要、数据保存在哪里”。

## 色彩

当前主色分工：

```css
:root {
  --app-bg: #f7f5ef;
  --surface: #ffffff;
  --paper: #fffdf8;
  --ink: #171717;
  --muted: #6f6a60;
  --line: #e5dfd4;

  --brand: #2f80ed;
  --brand-strong: #1769c2;
  --brand-soft: #eaf3ff;

  --reading: #1eb869;
  --reading-strong: #166534;
  --reading-soft: #edfdf4;

  --amber-soft: #f6e7b6;
  --danger: #dc2626;
  --warning: #d97706;
}
```

规则：

- 蓝色是桌面工具主操作色，用于主按钮、选中态、链接和关键反馈。
- 绿色只用于阅读、完成、增长、成功等语义，不作为全页面背景。
- 纸色用于预览、报告、分享卡片和档案类内容。
- 琥珀色用于划线和轻强调。
- 新增颜色必须先沉淀为 token，并说明用途。

## 字体

```css
--font-display: "DM Serif Display", "Noto Serif SC", Georgia, serif;
--font-body: "Outfit", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-serif-zh: "Noto Serif SC", "Source Han Serif SC", serif;
--font-mono: "JetBrains Mono", "SF Mono", ui-monospace, monospace;
```

使用规则：

- 品牌、报告封面、阅读档案标题可使用 display/serif。
- UI 控件、导航、表单、列表使用 body。
- 数字、路径、技术辅助信息使用 mono。
- 正文字号不低于 14px；移动或落地页正文不低于 16px。
- 不使用负 letter-spacing；长文本保证 1.55 以上行高。

## 布局与密度

- 基础单位为 4px，主要间距沿 8px 节奏。
- 页面内容应保持明确最大宽度，不让长文本横向铺满。
- 桌面端侧边栏是索引；主体区域是工作台。
- 卡片只用于重复对象、可选择对象、弹窗内容和真正需要框住的工具区域。
- 不把页面大区块全部做成浮动卡片，不做卡片套卡片。
- 固定格式元素如封面墙、分享卡片、报告预览和工具栏要有稳定尺寸，避免 hover 或动态内容造成布局跳动。

## 组件规则

### 按钮

- 主操作：`primary`，每个区域只保留一个最强主操作。
- 次操作：`secondary`。
- 轻操作：`ghost` 或 inline action。
- 危险操作：`danger`，必须和普通操作视觉区隔。
- 图标按钮必须有 `aria-label`，尺寸不小于 36px，关键弹窗内建议 40-44px。

### 选择与筛选

- 互斥模式用 segmented control。
- 二元开关用 toggle 或 checkbox。
- 类别筛选可以使用低强调 pill，但必须可键盘聚焦。
- 不依赖 hover 才能发现关键操作。

### 列表与卡片

- 书架列表强调书名、作者、分类、最近阅读和完成状态。
- 封面墙强调封面和 hover/focus 后的来源信息；无封面时使用统一占位。
- 笔记卡片强调原文或想法内容，来源信息弱化但可追溯。
- 分享卡片工作台用侧向抽屉结构，不做营销弹窗。

### 弹窗与抽屉

- 必须有 `role="dialog"`、可见标题、关闭按钮和 Escape 关闭。
- 打开后管理焦点；关闭后不留下不可见可聚焦元素。
- 删除、清除、取消任务等破坏性操作需要确认。

### 报告

- 报告页可以比普通页面更有纸面和档案表现，但仍属于同一个应用。
- 模板目录用于选择，具体模板在接近全屏的工作台中配置、预览、导出和查看状态。
- Agent 输出日志不是聊天界面，也不是终端界面；应表现为“生成过程档案”。

## 状态

每个主要功能必须有：

- 加载态：说明正在读取什么。
- 空态：说明为什么为空和下一步。
- 错误态：说明发生了什么、能否重试、下一步做什么。
- 成功态：说明生成/保存/同步到了哪里。
- 禁用态：说明条件不足，而不是只把按钮变灰。

## 可访问性

- 正文对比度不低于 WCAG AA。
- 所有交互元素支持键盘焦点。
- icon-only button 必须有可读标签。
- 表单字段使用可见 label，不只依赖 placeholder。
- 动效使用 transform/opacity，尊重 `prefers-reduced-motion`。
- 页面在 375px 宽度下不出现横向滚动。

## 落地页补充

落地页可以比应用界面更有第一眼记忆点，但仍要符合 Quiet Reading Ledger：

- 首屏必须直接出现「书迹」和产品核心价值。
- 不做空泛 hero，不用纯渐变或装饰光球当视觉主体。
- 使用真实产品能力做视觉：书架、笔记、Markdown、报告、分享卡片、ima。
- CTA 保持克制：下载、查看源码/文档即可。
- 单文件 HTML 可以存在于 `landing/index.html`，应可直接用浏览器打开。

## Tailwind CSS 使用规范

项目使用 Tailwind CSS v4，设计令牌已通过 `@theme` 映射为 Tailwind 工具类。

### 可用工具类速查

| 类别 | 工具类示例 | 对应设计令牌 |
|------|-----------|-------------|
| 颜色 | `text-brand`、`bg-paper`、`border-hairline` | `--color-brand`、`--color-paper`、`--color-hairline` |
| 字体 | `font-body`、`font-display`、`font-mono` | `--font-body`、`--font-display`、`--font-mono` |
| 间距 | `p-1`~`p-6`、`m-2`、`gap-3` | `--spacing-1`~`--spacing-6` |
| 圆角 | `rounded-xs`、`rounded-md`、`rounded-lg`、`rounded-pill` | `--radius-xs`~`--radius-pill` |

### 规则

- 新页面、新组件优先使用 Tailwind 工具类，不新建独立 CSS 文件。
- 颜色使用语义化 token 名（`text-brand`），不使用硬编码色值。
- 布局使用 `flex`、`grid`、`gap` 等工具类，不手写 `display: flex`。
- 现有 CSS 文件（`index.css`、`chat.css`、`settings.css` 等）不迁移，除非重构。
- 如需新增设计令牌，先在 `index.css` 的 `:root` 和 `@theme` 中定义，再使用。
