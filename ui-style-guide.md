# WeRead Skill Desktop - UI 风格规范 (Design System)

> **风格定位：** Quiet Reading Ledger（安静的私人阅读账本）
>
> **核心理念：** 内容至上，像整理一份私人阅读档案：纸张、墨迹、划线、索引和导出工作台都应安静但有记忆点。

---

## 一、设计哲学

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   "Perfection is achieved, not when there is        │
│    nothing more to add, but when there is nothing   │
│    left to take away."                               │
│                                                     │
│   — Antoine de Saint-Exupéry                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 三大原则

| 原则 | 解释 | 体现 |
|------|------|------|
| **呼吸感** | 大量留白，元素不拥挤 | 卡片间距 ≥ 24px，行高宽松 |
| **层级清晰** | 通过字重/颜色/大小建立视觉层级 | 标题/正文/辅助文字对比明确 |
| **克制装饰** | 只在必要处使用色彩和动效 | 仅品牌色用于交互反馈 |

### 设计概念

这个应用不是通用 SaaS 后台，也不是阅读器。它是一张安静的书桌：左侧像索引，主体像阅读账本，笔记像纸面上的划线，导出页像把资料装订成文件的工作台。

必须形成三个可记住的视觉信号：

1. **阅读账本**：章节、日期、range、统计数据像可追溯的档案记录。
2. **纸面划线**：划线内容是 Notes 页的视觉主角，不应被普通卡片淹没。
3. **导出工作台**：Export 页要有明确的“选择 -> 配置 -> 预览 -> 生成”流程感，预览应像真实文件而不是表单附属物。

### 反泛化规则

- 不要做成普通 SaaS 仪表盘：避免满屏同质卡片、过强边框、营销式图标堆叠。
- 不要用 emoji 作为正式 UI 图标；所有产品图标使用统一图标库。
- 不要只依赖绿色 + 灰色完成所有视觉层次；应使用纸色、墨色、淡琥珀等低饱和辅助色建立阅读气质。
- 不要使用大面积渐变、玻璃拟态、紫蓝渐变、漂浮光球等通用 AI 审美。
- 不要让统计卡片抢走 Notes 和 Export 的核心体验。

---

## 二、字体系统

### 字体选择

```css
/* === 显示字体（标题/品牌）=== */
--font-display: 'DM Serif Display', 'Noto Serif SC', Georgia, serif;

/* === 正文字体（UI/内容）=== */
--font-body: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;

/* === 等宽字体（代码/引用）=== */
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;

/* === 中文衬线（书名/引文）=== */
--font-serif-zh: 'Noto Serif SC', 'Source Han Serif SC', serif;
```

### 字体加载策略

```html
<!-- Google Fonts - 精简加载 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
```

发布版桌面应用应优先本地打包字体，避免离线环境或网络限制导致字体回退。若不打包字体，必须定义稳定 fallback，并检查中文、英文、数字和等宽内容在 fallback 下仍然对齐。

### 字号阶梯

| 层级 | 尺寸 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| Display | 32px / 2rem | 400 (Regular) | 1.25 | 页面主标题（书名） |
| H1 | 24px / 1.5rem | 500 (Medium) | 1.3 | 区块标题 |
| H2 | 18px / 1.125rem | 500 (Medium) | 1.4 | 子区块标题 |
| H3 | 15px / 0.9375rem | 500 (Medium) | 1.5 | 卡片标题 |
| Body | 14px / 0.875rem | 300 (Light) | 1.7 | 正文内容（宽松行高） |
| Body-md | 14px / 0.875rem | 400 (Regular) | 1.6 | UI 文本 |
| Caption | 12px / 0.75rem | 400 (Regular) | 1.5 | 辅助说明、时间戳 |
| Overline | 11px / 0.6875rem | 600 (SemiBold) | 1.4 | 标签、Badge |

### Tailwind 配置扩展

```typescript
// tailwind.config.ts 或 CSS 变量定义
{
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        serif: ['var(--font-serif-zh)', 'serif'],
      },
      fontSize: {
        display: ['2rem', { lineHeight: '1.25', fontWeight: '400' }],
        'body-lg': ['0.875rem', { lineHeight: '1.7', fontWeight: '300' }],
      },
      letterSpacing: {
        tight: '-0.01em',
        normal: '0',
        relaxed: '0.02em',
        wide: '0.05em',
      }
    }
  }
}
```

---

## 三、色彩系统

### 当前实现决策

`design.md` 是当前阶段 UI 落地的执行说明。当前应用实现已采用以下品牌分工：

- 桌面工具主操作色：蓝色 `--brand: #2f80ed`、`--brand-strong: #1769c2`、`--brand-soft: #eaf3ff`。
- 微信读书绿：作为阅读、完成、成长、成功等语义色，使用 `--reading: #1eb869`、`--reading-strong: #166534`、`--reading-soft: #edfdf4`。
- 页面纸面与墨色：继续使用 `--paper: #fffdf8`、`--app-surface: #f8f7f3`、`--ink: #171717`。

后续不要在页面局部混用新的蓝、绿、紫、橙等随机色值。新增颜色必须先成为 token，并说明用途。

### 核心调色板

```css
:root {
  /* === 品牌色（微信读书绿 - 降低饱和度更柔和）=== */
  --color-brand-50: #f0fdf4;
  --color-brand-100: #dcfce7;
  --color-brand-200: #bbf7d0;
  --color-brand-300: #86efac;
  --color-brand-400: #4ade80;
  --color-brand-500: #1EB869;  /* 主品牌 */
  --color-brand-600: #16a34a;
  --color-brand-700: #15803d;
  --color-brand-800: #166534;
  --color-brand-900: #14532d;

  /* === 中性色（冷灰调 - 更高级）=== */
  --color-gray-50: #FAFAFA;       /* 页面背景 */
  --color-gray-100: #F5F5F5;     /* 卡片背景 */
  --color-gray-200: #E8E8E8;     /* 边框 */
  --color-gray-300: #D4D4D4;     /* 分割线 */
  --color-gray-400: #A3A3A3;     /* 占位符 */
  --color-gray-500: #737373;     /* 次要文字 */
  --color-gray-600: #525252;     /* 正文 */
  --color-gray-700: #404040;     /* 标题 */
  --color-gray-800: #262626;     /* 强调 */
  --color-gray-900: #171717;     /* 主文字 */

  /* === 语义色 === */
  --color-success: #059669;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-info: #2563eb;

  /* === 特殊用途 === */
  --color-highlight: #FEF3C7;    /* 划线高亮背景 */
  --color-quote-bg: #F9FAFB;     /* 引用块背景 */
  --color-paper: #FFFDF7;        /* 文件/预览纸面 */
  --color-ink: #1F2933;          /* 长文本墨色 */
  --color-amber-soft: #F6E7B6;   /* 低饱和划线辅助色 */
}
```

### 色彩使用规则

| 场景 | 颜色 | 说明 |
|------|------|------|
| **页面背景** | `gray-50` (#FAFAFA) | 极浅灰，纯白太刺眼 |
| **卡片/容器** | `white` + 微妙阴影 | 与背景形成层次 |
| **主文字** | `gray-900` (#171717) | 近黑但不纯黑 |
| **次要文字** | `gray-500` (#737373) | 明显弱于主文字 |
| **品牌强调** | `brand-500` | 按钮、链接、活跃状态 |
| **划线标记** | `brand-50` 或 `amber-soft` 背景 + `gray-800` 文字 | 像纸面标注，柔和不突兀 |
| **边框** | `gray-200` (#E8E8E8) | 几乎可见但不过重 |
| **导出预览** | `paper` (#FFFDF7) + `ink` | 像真实文件纸面 |

### 色彩比例

页面主色比例建议：

- 70%：中性背景、纸色、白色。
- 20%：墨色文字、灰阶边框、层级阴影。
- 8%：品牌绿，用于主操作和选中状态。
- 2%：淡琥珀或轻微纸张色，用于划线与导出预览的记忆点。

品牌绿不应铺满页面。它是导航和操作线索，不是背景主题。

### 渐变使用（极度克制）

```css
/* 仅允许的两处渐变 */
.gradient-brand-subtle {
  background: linear-gradient(135deg, 
    rgba(30, 184, 105, 0.04) 0%, 
    rgba(30, 184, 105, 0.00) 60%
  );
}

.gradient-stats-card {
  background: linear-gradient(180deg,
    #ffffff 0%,
    #fafafa 100%
  );
}
```

---

## 四、间距与布局

### 8pt 网格系统

```
基础单位：4px
常用间距：4 | 8 | 12 | 16 | 24 | 32 | 48 | 64 | 96
```

### 组件间距规范

```
┌─────────────────────────────────────────┐
│                                         │
│  padding: 32px                          │ ← 页面内边距
│  ┌─────────────────────────────────┐    │
│  │  gap: 24px                      │    │ ← 卡片间距
│  │  ┌──────────┐ ┌──────────┐     │    │
│  │  │ p: 20px  │ │ p: 20px  │     │    │ ← 卡片内边距
│  │  │          │ │          │     │    │
│  │  │ gap: 12px│ │gap: 12px │     │    │ ← 元素内部间距
│  │  └──────────┘ └──────────┘     │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 侧边栏规范

```
宽度：240px（固定）
内边距：24px 20px
导航项：
  高度：40px
  padding: 0 12px
  border-radius：8px
  间距：4px（紧凑）
  
活跃态：
  背景：brand-50
  左侧指示条：3px brand-500
  文字：gray-900
  
悬停态：
  背景：gray-100
  文字：gray-800
```

---

## 五、组件设计规范

### 5.0 当前实现入口

后续 UI 开发优先使用现有组件和 class：

- 页面结构：`PageShell`，使用 `title`、`subtitle`、`meta`、`tabs`、`actions`、`toolbar` 插槽。
- 按钮：`Button`，只使用 `primary`、`secondary`、`ghost`、`danger`。
- 图标按钮：`IconButton`，必须提供 `aria-label`。
- 分段控件 / Tabs：`SegmentedControl`，不要再新建页面专属 tabs 样式。
- 弹窗和覆盖层：使用全局 z-index token：`--z-panel`、`--z-modal`、`--z-confirm`、`--z-toast`。

页面可以扩展布局 class，但不要重写新的按钮系统、Tab 系统或弹窗层级系统。

### 5.0.1 信息密度与文案去重

工具页和配置弹窗应优先呈现当前可操作对象，而不是层层解释功能。一个事实只出现一次：

- 页面级标题负责定位当前位置，不再额外增加大段 intro，除非用户第一次进入会无法判断页面用途。
- 卡片标题说明“这个连接器是什么”，弹窗面板说明“当前要配置什么”，空态说明“为什么没有结果以及下一步怎么做”；三者不要重复同一段背景。
- 自动加载、自动同步这类默认行为不需要额外说明占位；若保留主动刷新或重试，把按钮放在它影响的标题行右侧，作为低干扰操作，不要单独占一行。
- 状态标签用用户决策语言，例如“已选择”“未配置”，避免“默认”这类容易和系统默认值混淆的说法。
- 隐私、权限、数据范围可以说明，但应放在真正发生授权、导入、导出的位置，不在入口、卡片、弹窗、空态多次重复。

### 5.1 卡片 (Card)

```css
.card {
  background: white;
  border-radius: 16px;           /* 大圆角，柔和感 */
  border: 1px solid var(--color-gray-200);
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.02),    /* 极淡阴影 */
    0 4px 12px rgba(0, 0, 0, 0.03);   /* 扩散阴影 */
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.03),
    0 8px 24px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);         /* 极微上浮 */
}
```

**变体：**

| 类型 | 差异 | 用途 |
|------|------|------|
| Default | 白底 + 边框 | 书籍卡片、设置项 |
| Elevated | 无边框 + 更强阴影 | 统计概览卡片 |
| Subtle | 无边框无阴影，仅 bg-gray-100 | 导出预览区 |
| Selected | brand-50 背景 + brand-200 边框 | 选中状态 |

### 5.2 按钮 (Button)

```css
/* 主按钮 - 品牌填充 */
.btn-primary {
  height: 38px;
  padding: 0 20px;
  background: var(--color-brand-500);
  color: white;
  border-radius: 10px;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: -0.01em;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--color-brand-600);
  box-shadow: 0 4px 12px rgba(30, 184, 105, 0.25);
}

.btn-primary:active {
  transform: scale(0.98);
}

/* 次按钮 - 描边 */
.btn-secondary {
  height: 38px;
  padding: 0 20px;
  background: transparent;
  color: var(--color-gray-700);
  border: 1px solid var(--color-gray-300);
  border-radius: 10px;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background: var(--color-gray-50);
  border-color: var(--color-gray-400);
}

/* 幽灵按钮 - 无边框 */
.btn-ghost {
  height: 38px;
  padding: 0 12px;
  background: transparent;
  color: var(--color-gray-500);
  border-radius: 8px;
  font-weight: 400;
  font-size: 13px;
}

.btn-ghost:hover {
  background: var(--color-gray-100);
  color: var(--color-gray-700);
}
```

**尺寸规格：**

| 尺寸 | 高度 | 内边距 | 字号 | 用途 |
|------|------|--------|------|------|
| Small | 30px | 0 12px | 12px | 表格操作、紧凑场景 |
| Medium (Default) | 38px | 0 20px | 14px | 主要操作 |
| Large | 44px | 0 28px | 15px | CTA、主要行动点 |

### 5.3 输入框 (Input)

```css
.input {
  height: 40px;
  padding: 0 14px;
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: 10px;
  font-size: 14px;
  color: var(--color-gray-900);
  transition: all 0.15s ease;
}

.input::placeholder {
  color: var(--color-gray-400);
}

.input:hover {
  border-color: var(--color-gray-300);
}

.input:focus {
  outline: none;
  border-color: var(--color-brand-400);
  box-shadow: 0 0 0 3px rgba(30, 184, 105, 0.1);
}
```

### 5.4 Badge / Tag

```css
.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.badge-success { background: #ecfdf5; color: #065f46; }
.badge-neutral { background: #f3f4f6; color: #374151; }
.badge-brand { background: #ecfdf5; color: #15803d; }
```

### 5.5 进度条 (Reading Progress)

```css
.progress-track {
  height: 4px;
  background: var(--color-gray-200);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, 
    var(--color-brand-400) 0%, 
    var(--color-brand-500) 100%
  );
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 5.6 划线样式 (Bookmark Style)

```css
/* 划线文本展示 */
.bookmark-text {
  position: relative;
  padding: 12px 16px;
  margin: 8px 0;
  background: #F0FDF4;           /* 极淡绿 */
  border-left: 3px solid #86EFAC; /* 柔和绿色左边框 */
  border-radius: 0 8px 8px 0;
  font-family: var(--font-serif-zh);
  font-size: 14px;
  line-height: 1.8;
  color: var(--color-gray-800);
}

.bookmark-text::before {
  content: '"';
  position: absolute;
  top: -2px;
  left: 8px;
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--color-brand-200);
  line-height: 1;
}
```

### 5.7 点评卡片 (Review Card)

```css
.review-card {
  padding: 16px 20px;
  margin: 12px 0;
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
}

.review-card .review-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-brand-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.review-card .review-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-gray-700);
  font-style: italic;
}

.review-card .review-meta {
  margin-top: 10px;
  font-size: 11px;
  color: var(--color-gray-400);
}
```

---

## 六、图标规范

### 图标库选择

```
首选：Lucide Icons（线性、一致、精致）
备选：Heroicons（如需更多选择）
```

### 使用规则

| 属性 | 规格 |
|------|------|
| 尺寸 | 18px (默认) / 20px (导航) / 16px (紧凑) |
| 描边 | 1.5px stroke-width |
| 颜色 | 继承当前文字色，或 `currentColor` |
| 圆角 | 2px (lucide-linecap round) |

### 导航图标映射

| 页面 | 图标 (Lucide) | 说明 |
|------|---------------|------|
| 书架 | `BookOpen` 或 `Library` | 已选 |
| 笔记 | `Highlighter` 或 `MessageSquareQuote` | 已选 |
| 导出 | `Download` 或 `FileOutput` | 已选 |
| 设置 | `Settings` | 已选 |

---

## 七、动效规范

### 动效原则

> "动画应该解释关系，而不是吸引注意力。"

**只允许以下几类动效：**

| 类型 | 时长 | 缓动函数 | 使用场景 |
|------|------|----------|----------|
| **微交互** | 150ms | `ease-out` | 按钮 hover、输入框 focus |
| **状态切换** | 200ms | `ease-in-out` | 展开/收起、Tab 切换 |
| **入场动画** | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | 页面加载、列表出现 |
| **进度类** | 600ms+ | `cubic-bezier(0.4, 0, 0.2, 1)` | 进度条填充、数字滚动 |

### 具体动效实现

```css
/* === 页面入场：淡入 + 微上移 === */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* 列表项交错出现 */
.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 40ms; }
.stagger-item:nth-child(3) { animation-delay: 80ms; }
.stagger-item:nth-child(4) { animation-delay: 120ms; }
.stagger-item:nth-child(5) { animation-delay: 160ms; }

/* === 加载骨架屏 === */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-gray-100) 0%,
    var(--color-gray-50) 50%,
    var(--color-gray-100) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

/* === 数字递增动画 === */
@keyframes countUp {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 八、暗色模式（可选增强）

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-gray-50: #0a0a0a;
    --color-gray-100: #141414;
    --color-gray-200: #262626;
    --color-gray-300: #404040;
    --color-gray-400: #525252;
    --color-gray-500: #a3a3a3;
    --color-gray-600: #d4d4d4;
    --color-gray-700: #e5e5e5;
    --color-gray-800: #f5f5f5;
    --color-gray-900: #fafafa;
    
    /* 暗色下卡片 */
    .card {
      background: var(--color-gray-100);
      border-color: var(--color-gray-300);
    }
  }
}
```

> ⚠️ **MVP 阶段建议先专注亮色模式，暗色可作为 P1 增强**

---

## 九、页面级视觉规范

### 9.1 Dashboard（仪表盘）

```
视觉重点：阅读账本首页，而不是通用数据后台

结构：
├── 顶部：页面标题 + 同步状态 + 最近更新时间
├── 统计摘要：4 个指标可以存在，但视觉上应轻，不抢书架
├── 工具栏：本地搜索 + 状态筛选器 + 一级类别筛选行
└── 书籍列表：
    ├── 列表模式（默认）：每行一本书，像目录索引
    ├── 封面尺寸稳定，不因长书名变形
    └── 完整类别、读完标签和最近阅读时间清晰可扫；只给读完书籍显示「读完」标签
```

### 9.2 NotesPage（笔记详情）

```
视觉重点：整站核心体验。划线内容是主角，页面应像一本整理过的阅读笔记

结构：
├── 页面标题 + 浏览 / 导出 Tab，Tab 紧跟「笔记」标题
├── 页面头部操作：导出当前书 / 微信读书，随当前选中书籍启用
├── 工具条：全部 / 划线 / 点评 + 章节筛选
└── 内容流：
    ├── 章节分组标题像索引，不像普通卡片标题
    ├── 划线块有纸面质感、左侧标注线、range/日期元信息
    ├── 点评与划线有明显层级关系
    └── 无法关联到划线的点评单独归组展示
```

### 9.3 ExportPage（导出中心）

```
视觉重点：导出工作台。用户应感觉在把阅读资料装订成文件

结构：
├── 步骤指示器：① 选择 → ② 选项 → ③ 预览
├── 选择区域：
│   ├── 全部有笔记的书 / 自选书籍
│   └── 书籍列表保持紧凑，可批量扫描
├── 选项区域：
│   ├── 格式选择（Segmented Control）
│   └── 内容选项与输出目录
└── 操作区：
    ├── 预览面板应像真实 Markdown/JSON 文件纸面
    ├── 进度与结果状态明确
    └── CTA 按钮不应被其他装饰抢走注意力
```

### 9.3.1 ReportPage（阅读报告）

```
视觉重点：报告模板目录。页面本体只负责选择报告模板，具体预览进入接近全屏的报告工作台

页面结构：
├── 左侧模板类型切换：基础模板 / 智能体模板
├── 基础模板 Tab：阅读分析报告 / 读书旅程 / 年度阅读报告
└── 智能体模板 Tab：阅读人格、知识盲区、下一阶段建议等；卡片只负责进入单个模板

报告工作台弹窗：
├── 顶部：模板名、类型、关闭按钮
├── 主预览区：像真实 HTML 报告纸面
└── 操作区：数据范围 / 浏览器打开 / 数据状态

智能体模板工作台：
├── 顶部：通过 PageShell 返回模板目录
├── 生成配置：数据范围、输出形态、本地 Agent、隐私确认和自定义要求
├── 当前结果：状态、浏览器打开、取消或删除任务
└── 历史记录：查看详情、浏览器打开、删除
```

### 9.4 SettingsPage（设置）

```
视觉重点：安全感 + 清晰的操作反馈

结构：
├── 页面标题
├── API Key 区域：
│   ├── 状态指示（绿点 + 文字）
│   ├── 脱敏显示（mono 字体）
│   └── 操作按钮组
├── 默认设置区域（Grouped Form）
└── 关于区域（居中 + 弱化）
```

---

## 十、空状态与错误状态

### 空状态 (Empty State)

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.empty-state-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 20px;
  color: var(--color-gray-300);
}

.empty-state-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-gray-700);
  margin-bottom: 8px;
}

.empty-state-desc {
  font-size: 14px;
  color: var(--color-gray-500);
  max-width: 280px;
  line-height: 1.6;
}
```

### 错误状态 (Error Banner)

```css
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: #FEF2F2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  font-size: 13px;
  color: #991b1b;
}

.error-banner .error-action {
  margin-left: auto;
  flex-shrink: 0;
}
```

---

## 十一、macOS 原生适配细节

### 标题栏区域

```css
/* 为红绿灯预留空间 */
.titlebar-area {
  height: 52px;  /* macOS 标准高度 + 适当padding */
  -webkit-app-region: drag;
  
  /* Windows/Linux 不需要 */
}

.sidebar {
  padding-top: 52px;  /* 避开红绿灯 */
}
```

### 滚动条样式

```css
/* 自定义滚动条 - 极简 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-gray-300);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-gray-400);
}
```

### 窗口控制

```css
/* 关闭按钮 hover 态保持 macOS 风格 */
/* 不自定义，使用系统原生 */
```

---

## 十二、响应式断点（桌面端为主）

本应用是 Tauri 桌面端工具，不按手机网页做小屏适配。设计和验收以桌面窗口为准：

- 最小支持宽度为 1024px；低于该宽度依赖窗口最小尺寸限制，不再单独设计移动端布局。
- 默认设计尺寸为 1280px 宽，宽屏优化参考 1440px 及以上。
- 允许为 1024px 最小窗口做布局保护，例如减少列数、收紧间距、避免内容横向溢出；不要为了 375px / 390px 手机宽度重构页面结构。
- 报告预览、弹窗、工作台和列表优先保证桌面端信息密度、阅读性和操作效率。

```css
/* 由于是 Tauri 桌面应用，断点简化 */
--breakpoint-sm: 1024px;   /* 最小支持尺寸 */
--breakpoint-md: 1280px;   /* 默认设计尺寸 */
--breakpoint-lg: 1440px;   /* 大屏优化 */
```

---

## 十三、设计 Token 汇总（Tailwind 自定义）

```javascript
// 完整的 Tailwind 主题扩展配置
{
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#1EB869',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#fafafa',
          muted: '#f5f5f5',
          paper: '#FFFDF7',
        },
        ink: '#1F2933',
        amberSoft: '#F6E7B6',
      },
      fontFamily: {
        display: ['DM Serif Display', 'Noto Serif SC', 'Georgia', 'serif'],
        body: ['Outfit', 'SF Pro Display', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      borderRadius: {
        'sm': '6px',
        DEFAULT: '10px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.03)',
        'card-hover': '0 2px 4px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.06)',
        'focus-ring': '0 0 0 3px rgba(30, 184, 105, 0.1)',
        'brand-glow': '0 4px 12px rgba(30, 184, 105, 0.25)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      }
    }
  }
}
```

---

## 十四、设计检查清单 (Design Review Checklist)

开发完成后，逐项验证：

### 视觉一致性
- [ ] 页面整体呈现“私人阅读账本/导出工作台”的明确概念，而不是通用 SaaS 后台
- [ ] 所有卡片圆角统一为 16px（或对应 token）
- [ ] 间距符合 8pt 网格
- [ ] 字号严格遵循阶梯表
- [ ] 颜色仅从 Design Token 中取值
- [ ] 图标尺寸/描边粗细一致
- [ ] 正式 UI 不使用 emoji 图标

### 交互体验
- [ ] 所有可点击元素有 hover 态
- [ ] 按钮有 active 态（scale 0.98）
- [ ] 输入框有 focus 态（绿色光晕）
- [ ] 页面切换有过渡动画
- [ ] 列表加载有交错入场效果

### 内容呈现
- [ ] 划线样式有引号装饰
- [ ] 点评用斜体区分
- [ ] 章节分组有明确分隔
- [ ] 导出预览像真实文件纸面，而不是普通表单附属区域
- [ ] 空状态友好且可操作
- [ ] 错误提示清晰且有恢复路径

### 性能与细节
- [ ] 字体加载策略适合桌面应用；发布版优先本地打包字体或验证 fallback
- [ ] 动画使用 GPU 加速属性（transform/opacity）
- [ ] 滚动条样式自定义
- [ ] macOS 红绿灯不遮挡内容
- [ ] 无障碍：对比度 ≥ 4.5:1

---

*版本：v1.0*
*风格方向：Refined Minimalism（精致极简）*
*最后更新：2026-05-19*
