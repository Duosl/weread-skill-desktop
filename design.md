# WeRead Skill Desktop Design Playbook

最后更新：2026-05-21

本文件是后续 UI 开发和重构的执行型设计说明。`ui-style-guide.md` 定义长期视觉方向，本文件把它落成可执行的页面结构、组件规则、审计结论和验收清单。做 UI 任务时必须同时读取：

1. `AGENTS.md`
2. `ui-style-guide.md`
3. `design.md`
4. 当前要改的页面和 `src/index.css`
5. UI 相关 Skill：`frontend-design`、`ui-ux-pro-max`

这里的 UI 指完整产品界面质量，不只指“整体风格”。每次 UI 审计和改造必须覆盖：

- 视觉风格与品牌气质
- 字体族、字号、字重、行高、数字对齐
- 间距、密度、栅格、容器宽度
- 颜色、对比度、语义色、状态色
- 圆角、边框、分割线、阴影、层级
- 图标尺寸、按钮尺寸、触控/点击目标
- 页面标题、工具栏、筛选区、列表、卡片、弹窗
- 空态、加载态、错误态、成功态、禁用态、进行中状态
- 交互反馈、焦点态、键盘可访问性、动效克制
- 长文本、滚动区域、窗口尺寸和响应式保护

---

## 1. 设计目标

### 产品气质

WeRead Skill Desktop 不是微信读书客户端，也不是普通 SaaS 后台。它是一个“私人阅读档案工作台”：

- 书架像索引柜。
- 笔记像纸面上的划线与批注。
- 导出像资料装订工作台。
- 阅读报告像可归档的阅读档案。
- 智能体报告像本地生成的私人分析文件。

视觉关键词：

- Quiet Reading Ledger
- 私人档案
- 纸面、墨色、索引、划线
- 克制、清晰、可长期使用
- 桌面工具感，而不是营销页或 AI 炫技页

### 统一目标

下一轮 UI 收敛的目标不是“大改品牌”，而是把已经变散的页面重新拉回同一套系统：

- 页面标题、操作区、筛选区统一。
- 卡片、列表、表单、按钮、Tabs、弹窗统一。
- 基础页面和报告页面有差异，但差异有边界。
- 所有页面遵循同一套 token，不再在页面里随手写新的颜色、半径、阴影和间距。
- 用户一眼能判断：我在同一个应用里，而不是多个原型拼在一起。

---

## 2. 外部规范参考

本文件参考以下设计系统共识：

- USWDS Design Tokens：设计系统应使用有限的颜色、间距、字号、阴影等离散 tokens，减少任意值，提升设计和开发沟通效率。
- Apple UI Design Dos and Don’ts：布局要适配屏幕，不横向滚动；触控/点击目标至少 44pt；文本要有足够对比，控件要靠近其影响的内容。
- CMS Design System Spacing：间距应基于 8px 倍数，常规组件之间默认 16px，避免过大或过小的任意间距。
- Red Hat Spacing：间距 token 应建立在 4px 基础增量上，系统只保留一套可复用间距标尺，不随意新增。

落到本项目：

- 以 4px 为基础单位，常用间距仍走 8px 节奏。
- token 名称优先表达语义，而不是表达具体颜色。
- 组件样式只能消费 token 或已有组件 class，不在页面局部创造新系统。

---

## 3. 当前 UI 审计结论

### 3.1 全局问题

当前 `src/index.css` 已超过 4700 行，页面样式大量混在同一个文件里。它已经不只是 token + 组件层，而是同时包含：

- 全局 token
- layout shell
- 基础组件
- Settings 专用组件
- Dashboard 专用组件
- Notes / Export 工作台组件
- Report 模板目录
- Report 预览模板艺术风格
- 智能体任务弹窗
- 支持/打赏弹窗
- 响应式修正

这会导致后续开发继续叠加局部样式，视觉越来越难收敛。

下一步应先做样式分层，而不是继续在 `index.css` 尾部追加。

建议分层：

```text
src/styles/
  tokens.css
  base.css
  layout.css
  components.css
  pages/
    overview.css
    shelf.css
    notes-workbench.css
    report.css
    settings.css
```

如果暂时不拆文件，也必须在 `index.css` 内保持同样分区，不允许随意插入。

### 3.2 品牌色漂移

`ui-style-guide.md` 原始主品牌为微信读书绿 `#1EB869`。当前实际 CSS 使用蓝色：

```css
--brand: #2f80ed;
--brand-strong: #1769c2;
--brand-soft: #eaf3ff;
--brand-tint: #f4f8ff;
```

这不是小问题。现在页面中同时存在：

- 蓝色主操作
- 绿色成功/完成状态
- 琥珀纸面辅助
- 红色打赏支持
- 紫色笔记统计图标
- 年度报告深色金色风格

下一步 UI 统一必须先决策品牌色：

推荐方案：保留当前蓝色作为“桌面工具主操作色”，把微信读书绿降级为“阅读完成/成长/自然倾向”的语义色。原因：

- 当前大部分新页面已经围绕蓝色建立主操作和报告风格。
- 蓝色更像系统工具与数据工作台，适合桌面端。
- 绿色继续用于“完成、增长、阅读结果”，不会丢失微信读书联想。

如果选择回到绿色主品牌，需要一次性替换所有 `--brand` 蓝色相关状态，不能一页蓝、一页绿。

### 3.3 页面结构漂移

已审计页面：

- `OverviewPage`
- `DashboardPage`
- `NotesWorkbenchPage`
- `NotesPage`
- `ExportPage`
- `ReportPage`
- `SettingsPage`
- `RewardDialog`
- `Sidebar`
- `Toolbar`

主要不一致点：

- `PageShell` 只支持 `title` 和 `action`，缺少标准的 subtitle、tabs、toolbar、description slot，导致各页面自行拼标题和操作区。
- `DashboardPage` 的筛选 toolbar 使用 `Card className="toolbar-card"`，但 `toolbar-card` 实际背景透明，不像普通 Card。
- `NotesWorkbenchPage` 把 Tabs 塞入 H1 行内，视觉上紧凑但结构特殊，其他页面不能复用。
- `ReportPage` 同时承担基础模板、智能体模板、任务详情、历史、删除确认、HTML 预览，样式密度明显高于其他页面。
- `SettingsPage` 自建 `settings-card`、`about-action-btn`，没有复用基础 Card/Button 语义。
- `RewardDialog` 有自己的一套 modal、button、accent 系统，与 Report modal 和 book detail panel 不统一。

### 3.4 组件系统漂移

按钮至少存在这些系统：

- `.button`, `.button-primary`, `.button-secondary`, `.button-ghost`, `.button-danger`
- `.about-action-btn`
- `.inline-primary-action`
- `.inline-secondary-action`
- `.inline-danger-action`
- `.template-action-main`
- `.task-action-main`
- `.toolbar-btn`
- `.icon-button`
- `.sidebar-reward-btn`

这会造成主次动作不一致。下一步必须收敛为：

- `Button`: primary / secondary / ghost / danger
- `IconButton`: neutral / primary / danger
- `InlineAction`: link-like small action，用于表格/历史记录行
- 特殊场景只通过 class 扩展布局，不重写颜色和层级

卡片至少存在：

- `.card`
- `.settings-card`
- `.overview-stat-card`
- `.book-card`
- `.report-gallery-card`
- `.advanced-template-panel`
- `.advanced-task-status-card`
- `.reward-code-card`

下一步必须建立明确层级：

- Surface：页面级底板，不用卡片样式。
- Panel：功能区域容器。
- Card：重复列表项或可选择对象。
- Paper：报告/预览/文件纸面。
- Modal：覆盖层内容容器。

Tabs 至少存在：

- `.segmented`
- `.workbench-tabs`
- `.report-template-tabs`
- `.advanced-task-log-mode`

下一步统一为一个 segmented component：

- 默认高度 36px。
- 小号高度 30px。
- 可放页面标题旁，但必须通过 PageShell slot，不直接塞入任意 H1。

### 3.5 报告页边界

报告页允许比普通页面更有“档案纸面”表现，但不能无限扩张成独立应用。

当前报告页有几个合理方向：

- 模板目录卡片可带更强纸面感。
- 报告预览可以像真实文件。
- 年度报告可拥有深色封面式艺术方向。
- 智能体输出流可以有轻量消息块。

需要收紧的地方：

- 模板卡片、模板工作台、任务状态区、确认弹窗的圆角和阴影不统一。
- `.report-modal-backdrop` z-index 40 低于 `.detail-backdrop` 300 和 `.reward-overlay` 1100，层级系统混乱。
- 报告页有许多单独 action class，应该回到 Button / IconButton / InlineAction。
- 报告生成日志是功能内容，不应像终端，也不应像聊天软件；保持“模型输出流档案”即可。

### 3.6 可访问性与交互问题

下一轮应重点查：

- icon-only button 必须有 `aria-label`。
- 关闭按钮、删除按钮、打开报告按钮要支持键盘 focus。
- 主要按钮高度至少 40px；modal 内关键按钮建议 44px。
- 文本对比必须避免浅灰对浅纸面。
- 所有弹窗要有 Escape 关闭；已有部分弹窗实现，但需统一。
- 所有可点击 card 如果是 button，必须有明确 focus-visible。
- 不依赖 hover 才能发现操作。

---

## 4. Design Tokens

后续样式只能新增 token 或消费 token。不要在页面组件里直接写任意 hex、任意 shadow、任意 radius。

### 4.1 颜色

```css
:root {
  /* Brand: desktop tool action */
  --color-brand-50: #f4f8ff;
  --color-brand-100: #eaf3ff;
  --color-brand-500: #2f80ed;
  --color-brand-600: #1769c2;
  --color-brand-700: #1252a3;

  /* Reading semantic green */
  --color-reading-50: #f0fdf4;
  --color-reading-100: #dcfce7;
  --color-reading-500: #1eb869;
  --color-reading-700: #166534;

  /* Paper and ink */
  --color-paper: #fffdf8;
  --color-paper-muted: #f8f7f3;
  --color-surface: #ffffff;
  --color-surface-muted: rgba(255, 255, 255, 0.72);
  --color-ink: #171717;
  --color-ink-soft: #2b2824;
  --color-text-muted: #756d62;
  --color-text-faint: #8a8174;

  /* Borders */
  --color-border: rgba(132, 111, 82, 0.14);
  --color-hairline: rgba(132, 111, 82, 0.09);

  /* Status */
  --color-success: #1f6f52;
  --color-warning: #b45309;
  --color-danger: #b42318;
  --color-info: #2462a8;
}
```

规则：

- 主操作用 brand blue。
- 成功、完成、阅读成长用 reading green。
- 文件、报告、预览用 paper。
- 长正文用 ink，不用纯黑。
- 页面背景只用 paper-muted，不用纯白。
- 紫色只能用于极少数分类辅助，不作为系统色。
- 支持/打赏红色只能存在支持入口，不扩散到核心产品 UI。

### 4.2 字体

当前字体方向保留：

```css
--font-display: "DM Serif Display", "Noto Serif SC", Georgia, serif;
--font-body: "Outfit", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-serif-zh: "Noto Serif SC", "Source Han Serif SC", serif;
--font-mono: "JetBrains Mono", "SF Mono", monospace;
```

使用规则：

- `font-display` 只用于页面主标题、报告封面标题、重要数字。
- `font-serif-zh` 用于书名、划线原文、报告长标题。
- `font-body` 用于 UI 控件、列表、设置、说明。
- `font-mono` 用于 range、路径、job id、代码式数据。

字号 token：

| Token | Size | Line | Weight | Usage |
| --- | ---: | ---: | ---: | --- |
| `--text-display` | 40px | 1.08 | 400 | 仅报告封面/概览核心数字 |
| `--text-page-title` | 34px | 1.12 | 400 | 页面 H1 |
| `--text-section` | 18px | 1.35 | 600 | 区块标题 |
| `--text-card-title` | 15px | 1.45 | 600 | 卡片标题 |
| `--text-body` | 14px | 1.65 | 400 | UI 正文 |
| `--text-caption` | 12px | 1.5 | 500 | 辅助信息 |
| `--text-overline` | 11px | 1.4 | 800 | 标签、kicker |

禁止：

- 页面内自己发明 17px、22px、27px 等孤立字号，除非加入 token。
- 大面积使用 `font-weight: 800`，它只能用于 overline、badge、重要状态。
- 让普通工作台标题超过报告标题的视觉权重。

### 4.3 间距

基于 4px 基础单位，常规使用 8px 节奏：

| Token | Value | Usage |
| --- | ---: | --- |
| `--space-1` | 4px | 图标与文字内部间距 |
| `--space-2` | 8px | 小控件间距 |
| `--space-3` | 12px | 卡片内部紧凑间距 |
| `--space-4` | 16px | 常规组件间距 |
| `--space-5` | 24px | 页面区块间距 |
| `--space-6` | 32px | 大区块间距 |
| `--space-7` | 48px | 只用于空态/大预览 |

规则：

- 页面 padding：24px。
- Page header 到内容：20px 或 24px。
- 卡片内部 padding：16px，密集列表可 12px。
- 卡片之间：12px 或 16px。
- 大区块之间：20px 或 24px。
- 禁止出现 13px、17px、19px 这种无法解释的布局间距。

### 4.4 圆角

当前圆角偏大且不统一。下一轮收敛：

| Token | Value | Usage |
| --- | ---: | --- |
| `--radius-xs` | 4px | code、range |
| `--radius-sm` | 6px | 书封面、报告内部小块 |
| `--radius-md` | 8px | buttons、inputs、chips |
| `--radius-lg` | 12px | card、panel |
| `--radius-xl` | 16px | modal、paper preview |
| `--radius-pill` | 999px | badges、segmented outer only |

规则：

- 普通卡片默认 12px，密集列表 8px。
- 按钮/输入 8px 或 10px，不超过 10px。
- 报告纸面、弹窗可 16px。
- 不使用 18px、20px、22px 这类新值。

### 4.5 阴影

```css
--shadow-panel: 0 14px 34px rgba(55, 43, 27, 0.045);
--shadow-card: 0 16px 42px rgba(55, 43, 27, 0.055);
--shadow-hover: 0 18px 46px rgba(47, 128, 237, 0.12);
--shadow-modal: 0 32px 90px rgba(25, 38, 51, 0.24);
```

规则：

- 页面上不同时出现过多强阴影。
- 普通 Card 用 `--shadow-card`。
- hover 用轻微位移和 `--shadow-hover`，不要每个元素都跳。
- modal 用 `--shadow-modal`。
- 报告内纸面可以用 border 代替阴影，避免卡片堆叠。

### 4.6 Z-index

建立固定层级：

| Token | Value | Usage |
| --- | ---: | --- |
| `--z-toolbar` | 100 | 顶部拖拽条 |
| `--z-sidebar` | 120 | 侧栏 |
| `--z-popover` | 300 | dropdown/popover |
| `--z-panel` | 500 | book detail side panel |
| `--z-modal` | 900 | report/support modal |
| `--z-confirm` | 1000 | destructive confirm |
| `--z-toast` | 1100 | toast |

不要再出现 `.report-modal-backdrop { z-index: 40 }` 这种低于页面面板的 modal。

---

## 5. Layout System

### 5.1 App Shell

保留：

- 顶部 toolbar 高 38px。
- 左侧 sidebar 宽 160px。
- 主页面滚动在 `.page` 内。

改进：

- `body` 当前 `min-width: 1024px` 适合桌面；本项目不按手机网页做小屏适配，低于 1024px 依赖窗口最小尺寸限制。
- 响应式工作只覆盖桌面端最小窗口保护和宽屏优化：1024px 下不横向溢出，1280px 为默认设计尺寸，1440px 及以上优化信息密度；不要为了 375px / 390px 手机宽度重构页面结构。
- sidebar 折叠时，page header 不应重新发明布局。
- app 背景只能有非常轻的纸面层次，不再增加新的 radial/gradient 装饰。

### 5.2 PageShell

当前 `PageShell` 太弱，应升级为标准页面入口。

建议 API：

```tsx
type PageShellProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  tabs?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
};
```

标准结构：

```text
Page
  PageHeader
    TitleStack
      H1
      subtitle
    HeaderActions
  Optional Tabs Row
  Optional Toolbar Row
  Content
```

规则：

- 页面级 Tabs 放在 title 右侧或 header 下方，由 `PageShell` 管。
- 页面级刷新、导出、打开等操作放在 `actions`。
- 筛选和搜索放在 `toolbar`。
- 页面内部 section 不再复制 page header。
- 页面和弹窗只保留一层必要说明。若页面标题、卡片标题、面板说明、空态说明表达的是同一件事，优先只保留最靠近用户操作的一处说明。
- 自动发生的低风险动作不需要额外说明，但可以保留低干扰的主动操作。刷新、重试这类次要动作应贴近它影响的标题行右侧，不单独占一行，不打断说明文字和列表。
- 状态文案服务于当前决策，不重复解释产品背景。卡片外层展示“已配置 / 已选择”，弹窗内部展示具体配置和选择，不再把同一段能力介绍铺在多个层级。

### 5.3 Workbench Layout

适用于 Notes / Export / Report：

```text
Workbench
  Sidebar Panel 240-300px
  Main Panel minmax(0, 1fr)
```

规则：

- 左侧选择列表 sticky，但高度必须统一。
- 右侧主内容可滚动，但不要出现多个互相嵌套的滚动区域。
- 搜索框宽度和列表高度统一。
- 导出和笔记同属“笔记工作台”，应该复用 Workbench shell。

### 5.4 Modal Layout

标准 modal：

```text
ModalBackdrop
  Modal
    ModalHeader
      Kicker / Title / Description
      IconButton close
    ModalBody
    Optional ModalRail / Actions
```

尺寸：

- compact：`min(720px, calc(100vw - 48px))`
- workbench：`min(1120px, calc(100vw - 72px))`
- full：`min(1320px, calc(100vw - 72px))`

规则：

- 所有 modal 使用同一 backdrop。
- Escape 关闭。
- close button 必须有 `aria-label`。
- destructive confirm 使用专门 confirm modal，不混在普通 modal。

---

## 6. Component Rules

### 6.1 Buttons

唯一合法 Button variants：

- `primary`：本页唯一主动作。
- `secondary`：常规操作。
- `ghost`：轻量动作。
- `danger`：删除、清除、取消生成等危险动作。

尺寸：

| Size | Height | Padding |
| --- | ---: | --- |
| default | 40px | 14px horizontal |
| small | 32px | 10px horizontal |
| large/modal primary | 44px | 18px horizontal |

规则：

- 每个页面最多一个 primary action 区域。
- 图标按钮用 `IconButton`，不用空 `Button`。
- inline 操作用 `InlineAction`，不新增颜色系统。
- 不再新增 `.about-action-btn`、`.template-action-main` 这类按钮体系。

### 6.2 Cards and Panels

区分：

- `Panel`：功能容器，如筛选区、设置区。
- `Card`：重复项，如书籍卡片、模板卡片、历史记录。
- `Paper`：文件/报告/Markdown 预览。
- `StateCard`：加载、空、错误、成功。

规则：

- 普通 Card 不嵌套 Card。
- 页面 section 不要伪装成大卡片；用无边界 section + 内部 cards。
- 模板卡片可比普通卡片更具纸面感，但仍使用同一 token。
- 选择型 Card 必须有 hover、active、focus-visible。

### 6.3 Tabs and Segmented Control

使用场景：

- 页面大分类：Tabs，放 PageShell。
- 小范围模式切换：Segmented，如“简洁/详细”。
- 不使用 tab 样式承载按钮动作。

规则：

- 默认高度 36px。
- active 使用白色纸面 + 微阴影。
- inactive 使用 muted text。
- 图标大小 16px。

### 6.4 Forms

规则：

- label 必须可见。
- hint 放在控件下方，不只依赖 placeholder。
- input/select 高度 42px。
- focus ring 使用 brand 12% 透明，不移除。
- checkbox/radio 与文字间距 8px 或 12px。
- 错误信息靠近相关字段。

### 6.5 Lists

规则：

- 书架卡片是视觉卡片网格。
- 笔记本/导出选择是密集列表。
- 历史记录是 row list，不是 card grid。
- 行内操作放右侧，保持 8px gap。
- 数字使用 tabular-nums。

### 6.6 Empty / Error / Loading / Success

统一状态：

- EmptyState：最少一个标题、一句说明、可选动作。
- ErrorBanner：红色浅底，不使用 toast 代替持久错误。
- Success：短暂反馈可用 toast；导出结果这种可追溯信息用成功面板。
- Loading：超过 300ms 显示 spinner 或 skeleton；列表加载不应造成页面跳动。

---

## 7. Page-Specific Direction

### 7.1 概览

目标：阅读账本封面。

保留：

- 阅读总时长 hero。
- 阅读统计卡片。
- 阅读曲线。

收敛：

- `overview-hero` 和 `overview-stat-card` 使用 Panel/Card tokens。
- 图标色不要继续扩张到更多 hue。
- 图表 hover 可以保留，但动画要克制。

### 7.2 书架

目标：索引柜。

保留：

- 书籍网格。
- 分类筛选。
- 书籍详情侧滑面板。

收敛：

- toolbar 使用 PageShell toolbar slot。
- 分类 chip 使用 Chip component。
- book detail panel 层级改用 `--z-panel`。
- 书封面固定比例，图片不可变形。

### 7.3 笔记工作台

目标：浏览和导出同一个笔记资料库。

保留：

- 浏览 / 导出两个 tab。
- 从当前书进入导出。
- 左侧笔记本列表 + 右侧内容。

收敛：

- Tabs 从 H1 内特殊实现迁移到 PageShell tabs。
- 浏览和导出复用 Workbench layout。
- 左侧 sticky panel 宽度统一 260px。
- 筛选 row 与搜索 row 使用统一 toolbar/list-search。

### 7.4 导出

目标：资料装订工作台。

保留：

- 选择 -> 配置 -> 预览 -> 生成流程。
- Markdown 预览像文件。

收敛：

- 预览不要使用深色代码块作为唯一样式；Markdown 预览应更像纸面文件，深色仅可作为“源码查看”模式。
- 导出进度和结果使用 StateCard。
- 多本选择提示放在 Paper 空态里，不另造样式。

### 7.5 阅读报告

目标：模板目录 + 文件预览工作台。

保留：

- 基础模板 / 智能体模板双 Tab。
- 模板目录卡片。
- 基础报告预览可以保留接近全屏的报告工作台弹窗。
- 智能体模板使用页面级工作台承载生成设置、当前结果、生成过程和历史。
- 数据范围和本地 Agent 选择属于单个模板的生成配置，不放在模板目录页顶部。
- 从模板目录的进行中、已完成、失败等状态卡进入时，工作台优先展示对应的最近一次任务；从普通模板卡进入时，优先展示生成配置和页面级「开始生成」按钮。
- 最近一次任务区应是紧凑的状态摘要 + ModelOutput，不再用多层卡片嵌套；完成态的「再次生成」放在「删除任务」之后，使用 outline/secondary 视觉，不抢浏览器打开。
- 最近一次任务和历史记录必须展示可追溯生成配置：报告风格、数据范围、本地 Agent、模型配置。模型未显式指定时显示“CLI 默认配置”，不要猜测具体模型名。
- 正在生成的任务只出现在当前任务状态卡中，不重复进入历史记录列表；生成过程日志应放在当前任务状态卡内部，不作为同级独立卡片。
- 智能体报告以 `output/report.html` 是否存在作为可打开报告的主判据；`report.meta.json` 解析失败或本地 Agent 结束码异常，只要 HTML 已生成，就降级为警告状态，保留浏览器打开入口，并给出可让 AI 修正的提示。
- 智能体模板历史记录是工作台子标题，使用 H2 级视觉，不用 overline 标签；自定义提示词输入框下方不显示提示文案或字数计数，也不设置固定最大字数限制。
- 自定义提示词在生成配置内默认是两行紧凑输入框，不支持用户拖拽改变高度；输入框内提供展开图标，打开接近全屏的编辑弹窗承载长文本输入。

收敛：

- 报告页可以有更强 art direction，但入口、工作台、弹窗和按钮必须统一。
- 模板卡片统一为 TemplateCard component。
- 智能体任务状态统一为页面内 StateCard，不再为复杂生成设置创建详情弹窗。
- 日志输出流统一为 ModelOutput component。
- 删除确认统一 ConfirmDialog。

代码边界：

- `ReportPage` 只负责页面级状态编排、模板选择、任务动作和路由式返回，不直接承载大段任务卡片、历史记录或日志解析 JSX。
- 智能体任务展示拆为 `AdvancedTaskResultCard`、`AdvancedTaskHistory`、`ModelOutput`；状态标签、日志块归并、最新输出行等纯展示规则放在 `src/lib/report/advancedTaskView.ts`。
- 报告页专属样式放在 `src/styles/pages/report.css`；`src/index.css` 只保留全局 token、基础组件和未拆分页面的过渡样式。
- 后端 `advanced_report` 保持分层：`templates.rs` 管模板定义，`validation.rs` 管输出质量校验，`prompts.rs` 管 agent prompt / brief 构建；主模块只编排 job、数据准备、任务执行、输出读取和文件操作。

### 7.6 设置

目标：安静的系统设置页。

保留：

- API Key 配置。
- 缓存设置。
- 更新状态。
- 支持入口。

收敛：

- `settings-card` 改为 Panel/Card variants。
- `about-action-btn` 改为 Button。
- 设置页不需要比报告页更强视觉表现。
- 成功 toast 保留，但使用全局 toast token。

### 7.7 支持/交流群弹窗

目标：辅助入口，不喧宾夺主。

保留：

- 二维码大图。
- 社群和打赏两个 tone。

收敛：

- backdrop / modal / close button 使用全局 Modal。
- tone 只能改变 accent，不改变结构。
- 二维码卡片使用 Card token。

---

## 8. Implementation Rules

### 8.1 CSS 写法

必须：

- 新增样式先判断属于 tokens/base/layout/components/pages 哪一层。
- 优先复用 `.button`、`.card`、`.segmented`、`.empty-state` 等系统组件。
- 新颜色先看 token；没有 token 才讨论新增。
- 页面 class 命名以页面前缀开头，例如 `report-`、`settings-`、`notes-`。

禁止：

- 在页面尾部随手追加无分区 CSS。
- 用 `!important` 解决层级问题。
- 新增随机 hex。
- 新增随机 border-radius / shadow。
- 新增按钮系统。
- 使用 emoji 作为正式图标。
- 大面积渐变、玻璃拟态、紫蓝渐变、漂浮光球。

### 8.2 React 组件

优先抽取：

- `PageShell`
- `PageToolbar`
- `SegmentedControl`
- `Panel`
- `Card`
- `Button`
- `IconButton`
- `Modal`
- `ConfirmDialog`
- `StateCard`
- `ListSearch`
- `TemplateCard`

不要让页面组件继续承担：

- 通用 modal 结构。
- 通用 button 变体。
- 通用 tabs。
- 通用状态反馈。

### 8.3 Accessibility

最低要求：

- icon-only button 有 `aria-label`。
- modal 有 `role="dialog"` 或等效语义。
- destructive confirm 有明确标题和取消动作。
- focus-visible 清晰可见。
- 主要交互目标不小于 40px；modal 关键按钮建议 44px。
- 文本不低于 12px；主体文本 14px 以上。
- 不横向滚动主页面。
- 键盘 Tab 顺序和视觉顺序一致。

### 8.4 Motion

允许：

- hover translateY(-1px/-2px)
- modal fade + slight translate
- progress width transition
- chart bar height transition

限制：

- 动效 150-300ms。
- 不使用装饰性持续动画。
- 不动画 width/height 造成布局抖动，除 progress/chart 这种语义场景。
- 后续应补 `prefers-reduced-motion`。

---

## 9. Refactor Plan

### Phase 1: Audit and Token Lock

1. 确认品牌色方案：推荐 blue primary + green reading semantic。
2. 把当前 `:root` token 改为本文件 token。
3. 建立 z-index token。
4. 列出所有非 token hex 和 shadow。

### Phase 2: Foundation Components

1. 升级 `PageShell`。
2. 新增或收敛 `IconButton`、`SegmentedControl`、`Modal`、`Panel`、`ConfirmDialog`。
3. 迁移 Settings / Report / RewardDialog 的自定义按钮到 Button 系统。

### Phase 3: Page Harmonization

1. Overview：统一 hero/stat/chart 卡片。
2. Shelf：toolbar + chip + detail panel。
3. NotesWorkbench：PageShell tabs + shared workbench layout。
4. Export：纸面预览 + StateCard。
5. Report：模板卡片、基础预览 modal、智能体模板工作台和任务状态收敛。
6. Settings：Panel 化。

### Phase 4: Regression

必须检查：

- macOS 默认窗口 1280x800。
- 最小窗口 1024x700。
- 宽屏窗口 1440x900。
- 长书名、长作者、长划线、长想法。
- API Key 缺失状态。
- 加载、错误、空、成功。
- 报告生成中、完成、失败、取消。

---

## 10. Acceptance Checklist

每次 UI 相关改动完成前逐项检查：

### Visual

- [ ] 页面标题结构一致。
- [ ] 主操作位置一致。
- [ ] 搜索/筛选/配置区位置一致。
- [ ] 卡片圆角、阴影、边框使用 token。
- [ ] 色彩没有偏离 blue primary + paper + ink + reading green。
- [ ] 报告页有差异化，但没有破坏系统。

### UX

- [ ] 主路径一眼可见。
- [ ] 每页只有一个主要 CTA 区域。
- [ ] 危险动作有确认或明显 danger 样式。
- [ ] 状态反馈靠近相关内容。
- [ ] 不依赖 hover 才能完成关键操作。

### Accessibility

- [ ] icon-only buttons 有 `aria-label`。
- [ ] focus-visible 可见。
- [ ] 文本对比足够。
- [ ] 交互目标不小于 40px。
- [ ] 弹窗可 Escape 关闭。

### Technical

- [ ] 没有新增任意 hex，除非同步 token。
- [ ] 没有新增按钮体系。
- [ ] 没有新增任意 z-index。
- [ ] 没有新增无分区 CSS。
- [ ] `npm run frontend:typecheck` 通过。
- [ ] `npm run frontend:build` 通过。
- [ ] `cd src-tauri && cargo check` 通过。

---

## 11. Immediate Next Task

下一次真正动 UI 时，先不要直接改页面。按下面顺序：

1. 基于本文件更新 `ui-style-guide.md` 中已经稳定的规则。
2. 锁定 token：颜色、字体、间距、圆角、阴影、z-index。
3. 升级 `PageShell`，补齐 subtitle / tabs / toolbar / actions。
4. 新增统一 Modal / IconButton / SegmentedControl。
5. 迁移最混乱的页面：优先 `ReportPage` 和 `SettingsPage`。
6. 再统一 NotesWorkbench / Export / Dashboard。

不要跳过基础组件直接美化单页。
