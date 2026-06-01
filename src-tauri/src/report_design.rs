/// 共享报告设计规范，AI Chat 与 Advanced Report 共用。
///
/// 每个消费者导入需要的常量，拼接自身的提示词/样式补充。

/// 视觉风格：Quiet Reading Ledger 方向。
pub const AESTHETIC: &str = r#"**视觉风格：Quiet Reading Ledger（安静的私人阅读账本）**
- 像一本精心排版的阅读档案，不是营销页面，不是数据仪表盘
- 纸面、墨色、克制的色彩，不使用大面积渐变或花哨装饰
- 数据是主角，装饰服务于数据
- 不使用 emoji 作为图标或装饰
- 整体品质要求：排版清晰、层次分明、重点突出"#;

/// 叙事方式：第二人称、数据驱动、克制语气。
pub const NARRATIVE: &str = r#"**叙事方式：**
- 用"你"说话，不要用"用户""读者""您"
- 像写给一个认识很久的朋友的私人信件，不是写分析报告
- 开头直接说你发现的最有趣的事，不要用"根据数据显示"开头
- 每个数字背后给一个判断，不要只列数字
- 不说"太棒了""非常好""你真是个爱读书的人"，也不说"让我们一起""让我们深入"
- 不用"首先…其次…最后…"的排列，用自然段落推进"#;

/// 内容结构：标题 → 核心发现 → 分析 → 亮点 → 总结。
pub const STRUCTURE: &str = r#"**内容结构：**
- 报告标题：简洁有力，体现报告核心主题
- 核心发现（1-3 个）：最值得用户注意的阅读特征
- 分类分析：阅读偏好、时间习惯、笔记密度等维度
- 书籍亮点：挑出几本最有代表性的书深入分析
- 结尾：一个有温度的总结，不空洞"#;

/// 数据展示规则：时间格式、列表、来源标注。
pub const DATA_DISPLAY: &str = r#"**数据展示：**
- 时长统一转为"X小时Y分钟"格式
- 时间戳转为 YYYY-MM-DD 格式
- 列表用编号，方便引用
- 引用数据时标注来源（如"来自阅读统计""来自书架"）
- 统计数字放大展示：font-size: 2em; font-weight: 700
- 数字下方加小字说明：font-size: 0.85em; color: #888
- 图表使用内联 SVG 或纯 CSS 实现，不引入外部库
- 柱状图颜色使用低饱和色系，不要彩虹色
- 进度条/比例使用 linear-gradient + 固定高度"#;

/// 反 AI 味写作禁令：禁止 LLM 使用典型的 AI 生成痕迹。
pub const ANTI_AI_STYLE: &str = r#"**去 AI 味（必须遵守）：**

以下写法是大模型生成的典型痕迹，禁止出现在报告中：
- 禁止使用过渡词串联：「值得注意的是」「总的来说」「让我们来看看」「接下来」「首先…其次…最后…」「综上所述」「不难发现」「由此可见」
- 禁止使用空洞总结句：「这充分说明了…」「这反映了…的重要性」「让我们拭目以待」「相信在未来」
- 禁止使用过度修饰：「丰富多样」「琳琅满目」「举足轻重」「不可或缺」「令人印象深刻」
- 禁止使用假客套：「感谢你的阅读」「希望这份报告对你有帮助」「如果你有任何疑问」
- 禁止使用 AI 常见开头：「在这个…的时代」「随着…的发展」「在当今社会」
- 禁止使用列表+粗体小标题的万能模板结构，用自然段落代替
- 禁止在每个段落末尾加一句空洞的升华
- 写法参考：像写给一个你认识很久的朋友的私人信件，不像写给领导的工作汇报"#;

/// 具体 CSS 规格：字体、配色、布局、动效。
pub const VISUAL_SPECS: &str = r#"**字体规格：**
- 正文：Georgia, "Noto Serif SC", "Source Han Serif SC", serif
- 标题：无衬线对比，"Helvetica Neue", "PingFang SC", sans-serif
- 数字/统计：等宽，"SF Mono", "Fira Code", monospace
- 禁止使用 Inter、Roboto、Arial 做正文
- 不超过 3 种字体
- 中文正文字号 15-16px，标题 20-28px，注释 12-13px

**配色规格：**
- 背景：#faf8f5 或 #f5f0eb（温暖纸色）
- 正文：#2c2c2c 或 #1a1a1a（深墨色）
- 辅助色：#b8860b、#8b7355（低饱和琥珀/赭石）
- 强调色：#2d6a4f（克制的绿）或 #4a6fa5（蓝灰）
- 禁止：紫色渐变、霓虹色、大面积高饱和色、玻璃拟态、漂浮光球

**布局：**
- 单栏，最大宽度 720px，左右留白充足
- 段落间距 1.5em，行高 1.7-1.8
- 卡片/数据块：border: 1px solid rgba(0,0,0,0.08) + border-radius: 8px
- 不使用多列网格布局
- 移动端：max-width: 100%; padding: 16px

**动效：**
- 页面加载交错淡入：每块内容延迟 100-200ms
- @keyframes fadeInUp: opacity 0→1, transform translateY(12px)→0
- 过渡时间 0.4-0.6s, ease-out
- 不使用：滚动触发动画、视差效果、3D 变换
- 图表可用 stroke-dashoffset 描边动画

**禁止的 HTML 用法：**
- 不使用 iframe、object、embed
- 不引用外部 CDN、字体库、JS 库
- 不使用 position: fixed 做导航栏
- 不使用渐变文字（background-clip: text）做标题
- 不使用卡片阴影叠加超过 2 层
- 不使用毛玻璃效果
- 不使用超过 3 种字体"#;

/// HTML 自包含要求：移动端适配、Footer 三件套。
pub const HTML_REQUIREMENTS: &str = r#"**HTML 要求：**
- 自包含单文件 HTML，所有 CSS 内联，不引用外部资源
- 移动端适配（max-width + 响应式）

**报告底部 Footer（必须包含）：**

报告底部必须同时出现以下三类信息，缺一不可：
1. 数据来源：`数据来源：微信读书官方 Skill`
2. 大模型风险提示：`大模型可能会出错，本报告基于已导出的微信读书数据生成，分析结论请结合原始数据判断。`
3. 开源项目入口：`也想生成自己的阅读报告？这份报告由开源桌面工具-「书迹」使用大模型进行整理生成，你可以在 GitHub 获取项目。` 并展示仓库地址 `https://github.com/Duosl/weread-skill-desktop`，不要只写软件名或只裸露 URL。"#;

/// 组装完整的设计规范块。
pub fn full_design_guidelines() -> String {
    format!(
        "{aesthetic}\n\n{narrative}\n\n{structure}\n\n{data_display}\n\n{anti_ai}\n\n{visual}\n\n{html}",
        aesthetic = AESTHETIC,
        narrative = NARRATIVE,
        structure = STRUCTURE,
        data_display = DATA_DISPLAY,
        anti_ai = ANTI_AI_STYLE,
        visual = VISUAL_SPECS,
        html = HTML_REQUIREMENTS,
    )
}
