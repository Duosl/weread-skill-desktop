use std::borrow::Cow;

#[derive(Debug, Clone)]
pub(crate) struct BuiltinAdvancedTemplate {
    pub(crate) id: Cow<'static, str>,
    pub(crate) name: Cow<'static, str>,
    pub(crate) description: Cow<'static, str>,
    pub(crate) category: Cow<'static, str>,
    pub(crate) style_summary: Cow<'static, str>,
    pub(crate) style_md: Cow<'static, str>,
    pub(crate) prompt_md: Cow<'static, str>,
    pub(crate) default_report_period: Cow<'static, str>,
    pub(crate) default_output_shape: Cow<'static, str>,
    pub(crate) requires_raw_notes_consent: bool,
    pub(crate) default_capabilities: Vec<Cow<'static, str>>,
    pub(crate) optional_capabilities: Vec<Cow<'static, str>>,
}

#[derive(Debug, Clone)]
pub(crate) struct BuiltinOutputShape {
    pub(crate) id: &'static str,
    pub(crate) name: &'static str,
    pub(crate) description: &'static str,
    pub(crate) brief_md: &'static str,
}

pub(crate) fn builtin_templates() -> Vec<BuiltinAdvancedTemplate> {
    vec![
        BuiltinAdvancedTemplate {
            id: Cow::Borrowed("reading-personality"),
            name: Cow::Borrowed("阅读人格分析"),
            description: Cow::Borrowed("从书架、阅读统计和笔记密度中识别阅读偏好、选择模式和表达气质。"),
            category: Cow::Borrowed("advanced"),
            style_summary: Cow::Borrowed("私人档案、心理侧写、克制但有洞察。"),
            style_md: Cow::Borrowed(PERSONALITY_STYLE),
            prompt_md: Cow::Borrowed(PERSONALITY_PROMPT),
            default_report_period: Cow::Borrowed("all"),
            default_output_shape: Cow::Borrowed("report"),
            requires_raw_notes_consent: true,
            default_capabilities: vec![
                Cow::Borrowed("profile.summary"),
                Cow::Borrowed("shelf.sync"),
                Cow::Borrowed("notes.notebooks"),
                Cow::Borrowed("reading.stats"),
            ],
            optional_capabilities: vec![
                Cow::Borrowed("book.info"),
                Cow::Borrowed("book.progress"),
                Cow::Borrowed("notes.bookmarks"),
                Cow::Borrowed("notes.reviews"),
            ],
        },
        BuiltinAdvancedTemplate {
            id: Cow::Borrowed("knowledge-map"),
            name: Cow::Borrowed("知识结构盲区"),
            description: Cow::Borrowed("识别主题分布、知识连接、重复投入区和下一阶段值得补齐的结构。"),
            category: Cow::Borrowed("advanced"),
            style_summary: Cow::Borrowed("知识地图、主题索引、结构化诊断。"),
            style_md: Cow::Borrowed(KNOWLEDGE_STYLE),
            prompt_md: Cow::Borrowed(KNOWLEDGE_PROMPT),
            default_report_period: Cow::Borrowed("all"),
            default_output_shape: Cow::Borrowed("report"),
            requires_raw_notes_consent: true,
            default_capabilities: vec![
                Cow::Borrowed("profile.summary"),
                Cow::Borrowed("shelf.sync"),
                Cow::Borrowed("notes.notebooks"),
                Cow::Borrowed("reading.stats"),
            ],
            optional_capabilities: vec![
                Cow::Borrowed("book.info"),
                Cow::Borrowed("book.progress"),
                Cow::Borrowed("notes.bookmarks"),
                Cow::Borrowed("notes.reviews"),
            ],
        },
        BuiltinAdvancedTemplate {
            id: Cow::Borrowed("growth-path"),
            name: Cow::Borrowed("下一阶段阅读建议"),
            description: Cow::Borrowed("基于已有阅读路径生成下一阶段主题、书单方向和可执行的阅读节奏。"),
            category: Cow::Borrowed("advanced"),
            style_summary: Cow::Borrowed("路线图、阶段计划、轻量行动建议。"),
            style_md: Cow::Borrowed(GROWTH_STYLE),
            prompt_md: Cow::Borrowed(GROWTH_PROMPT),
            default_report_period: Cow::Borrowed("all"),
            default_output_shape: Cow::Borrowed("report"),
            requires_raw_notes_consent: false,
            default_capabilities: vec![
                Cow::Borrowed("profile.summary"),
                Cow::Borrowed("shelf.sync"),
                Cow::Borrowed("notes.notebooks"),
                Cow::Borrowed("reading.stats"),
            ],
            optional_capabilities: vec![
                Cow::Borrowed("book.info"),
                Cow::Borrowed("book.progress"),
                Cow::Borrowed("notes.bookmarks"),
                Cow::Borrowed("notes.reviews"),
            ],
        },
        BuiltinAdvancedTemplate {
            id: Cow::Borrowed("annual-keywords"),
            name: Cow::Borrowed("年度阅读关键词"),
            description: Cow::Borrowed("提炼年度阅读关键词、主题标签和一眼能分享的个人阅读摘要。"),
            category: Cow::Borrowed("share-ready"),
            style_summary: Cow::Borrowed("年度标签、关键词档案、适合截图传播。"),
            style_md: Cow::Borrowed(ANNUAL_KEYWORDS_STYLE),
            prompt_md: Cow::Borrowed(ANNUAL_KEYWORDS_PROMPT),
            default_report_period: Cow::Borrowed("last_year"),
            default_output_shape: Cow::Borrowed("xiaohongshu"),
            requires_raw_notes_consent: false,
            default_capabilities: vec![
                Cow::Borrowed("profile.summary"),
                Cow::Borrowed("shelf.sync"),
                Cow::Borrowed("notes.notebooks"),
                Cow::Borrowed("reading.stats"),
            ],
            optional_capabilities: vec![
                Cow::Borrowed("book.info"),
                Cow::Borrowed("book.progress"),
                Cow::Borrowed("notes.bookmarks"),
                Cow::Borrowed("notes.reviews"),
            ],
        },
        BuiltinAdvancedTemplate {
            id: Cow::Borrowed("top-books"),
            name: Cow::Borrowed("年度 Top 书单"),
            description: Cow::Borrowed("从阅读完成度、笔记投入和主题代表性中生成可分享的年度书单。"),
            category: Cow::Borrowed("share-ready"),
            style_summary: Cow::Borrowed("书单榜、选择理由、私人推荐语。"),
            style_md: Cow::Borrowed(TOP_BOOKS_STYLE),
            prompt_md: Cow::Borrowed(TOP_BOOKS_PROMPT),
            default_report_period: Cow::Borrowed("last_year"),
            default_output_shape: Cow::Borrowed("xiaohongshu"),
            requires_raw_notes_consent: false,
            default_capabilities: vec![
                Cow::Borrowed("profile.summary"),
                Cow::Borrowed("shelf.sync"),
                Cow::Borrowed("notes.notebooks"),
                Cow::Borrowed("reading.stats"),
            ],
            optional_capabilities: vec![
                Cow::Borrowed("book.info"),
                Cow::Borrowed("book.progress"),
                Cow::Borrowed("notes.bookmarks"),
                Cow::Borrowed("notes.reviews"),
            ],
        },
        BuiltinAdvancedTemplate {
            id: Cow::Borrowed("reading-radar"),
            name: Cow::Borrowed("阅读偏好雷达"),
            description: Cow::Borrowed("把阅读偏好拆成主题、节奏、深度、笔记和完成度等维度，形成个人阅读画像。"),
            category: Cow::Borrowed("share-ready"),
            style_summary: Cow::Borrowed("雷达图、坐标轴、可解释的偏好分数。"),
            style_md: Cow::Borrowed(READING_RADAR_STYLE),
            prompt_md: Cow::Borrowed(READING_RADAR_PROMPT),
            default_report_period: Cow::Borrowed("all"),
            default_output_shape: Cow::Borrowed("slides"),
            requires_raw_notes_consent: false,
            default_capabilities: vec![
                Cow::Borrowed("profile.summary"),
                Cow::Borrowed("shelf.sync"),
                Cow::Borrowed("notes.notebooks"),
                Cow::Borrowed("reading.stats"),
            ],
            optional_capabilities: vec![
                Cow::Borrowed("book.info"),
                Cow::Borrowed("book.progress"),
                Cow::Borrowed("notes.bookmarks"),
                Cow::Borrowed("notes.reviews"),
            ],
        },
        BuiltinAdvancedTemplate {
            id: Cow::Borrowed("spirit-bookshelf"),
            name: Cow::Borrowed("精神书架"),
            description: Cow::Borrowed("从代表性书籍、划线和想法中整理一组能代表你的私人精神书架。"),
            category: Cow::Borrowed("share-ready"),
            style_summary: Cow::Borrowed("精选书架、短句摘录、个人主题陈列。"),
            style_md: Cow::Borrowed(SPIRIT_BOOKSHELF_STYLE),
            prompt_md: Cow::Borrowed(SPIRIT_BOOKSHELF_PROMPT),
            default_report_period: Cow::Borrowed("all"),
            default_output_shape: Cow::Borrowed("xiaohongshu"),
            requires_raw_notes_consent: true,
            default_capabilities: vec![
                Cow::Borrowed("profile.summary"),
                Cow::Borrowed("shelf.sync"),
                Cow::Borrowed("notes.notebooks"),
                Cow::Borrowed("reading.stats"),
            ],
            optional_capabilities: vec![
                Cow::Borrowed("book.info"),
                Cow::Borrowed("book.progress"),
                Cow::Borrowed("notes.bookmarks"),
                Cow::Borrowed("notes.reviews"),
            ],
        },
    ]
}

pub(crate) fn output_shapes() -> Vec<BuiltinOutputShape> {
    vec![
        BuiltinOutputShape {
            id: "report",
            name: "通用网页",
            description: "",
            brief_md: r#"- 输出为完整长文报告，优先保证分析深度和证据链完整。
- 页面可以是可滚动 HTML，章节之间要有清晰层级。
- 适合在浏览器中阅读和保存，不追求逐屏演示节奏。"#,
        },
        BuiltinOutputShape {
            id: "slides",
            name: "PPT 风格",
            description: "可放映的演示页式 HTML，适合逐屏讲述和截图汇报。",
            brief_md: r#"- 输出仍然是网页报告，不是 `.pptx` 文件。
- 参考 `/Users/duoshilin/duosl/forks/html-anything` 的 deck skill 思路：先选定一个清晰方向，再用有限版式池生成，不要每页临时发明布局。阅读报告优先使用两类方向：`editorial-ledger`（纸面、墨色、章节封面、数字账本、引文证据，适合叙事和阅读画像）或 `swiss-data`（16 列网格、强对齐、单一强调色、数据柱/横条/对比，适合分析和雷达）。
- 必须使用固定 16:9 演示舞台，而不是普通长网页：页面外层是 viewport，内部是固定比例 stage。CSS 必须使用浏览器兼容写法，不要在 `calc()` 中写乘除法，不要写 `calc((100vh-96px)*16/9)` 这类会被浏览器丢弃的表达式。推荐写法：`.deck-stage { aspect-ratio: 16 / 9; width: min(100vw, calc(177.78vh - 170.67px)); height: min(56.25vw, calc(100vh - 96px)); max-width: 100vw; max-height: calc(100vh - 96px); }`。`calc()` 里的 `+` / `-` 两侧必须有空格，例如 `calc(100vh - 96px)`。
- 版式池必须明确写在 HTML 注释或 JS 配置中，并至少覆盖这些页面类型：封面、核心结论、关键数字、主题/分类图、证据卡、对比页、建议页、来源说明。每页只能使用一个版式类型，不能把多种布局硬塞进一屏。
- `body` / 主容器应使用 `overflow: hidden` 或等价方式禁用整页滚动；底部导航、页码和来源栏不应遮挡舞台内容。
- 每一屏必须围绕一个结论或一个证据组，内容必须装进 16:9 舞台安全区；如果内容放不下，必须拆成下一屏、减少卡片数量或缩短正文，不要让卡片超出舞台、不要把主要内容放到屏幕下方。
- 单屏信息密度上限：标题 1 个、核心观点 1 到 2 条、图表或卡片组 1 组；列表一般不超过 5 项，网格卡片一般不超过 4 张，超过就拆页。长解释放到下一屏，不要在幻灯片里做大段滚动阅读。
- 所有图表必须可由本地 CSS / 内联 SVG 绘制，不依赖外部库；图表高度、条形宽度、雷达点位必须来自报告数据或明确标注为相对表达，不要伪装成精密测评。
- 幻灯片状态机必须完整，不能只做单向进入动画。必须采用“默认隐藏，当前页唯一可见”的模型：所有 `.slide` 默认必须 `position: absolute; inset: 0; opacity: 0; visibility: hidden; pointer-events: none; z-index: 0; transform: translateX(40px);`；只有 `.slide.is-active` 可见并可交互：`opacity: 1; visibility: visible; pointer-events: auto; z-index: 2; transform: translateX(0);`。这样不会禁止动画，只是要求动画基于状态机：推荐做当前页入场动画；如果要做离场动画，只能使用短暂的 `.is-exiting` 状态，且必须 `pointer-events: none; z-index: 1;`，并在 `animationend` 或 350ms 以内兜底定时器中移除，最后回到默认隐藏态。
- 切页函数必须是唯一状态入口，上一页 / 下一页 / 键盘 / 滚轮 / 点击都只能调用同一个 `goTo(index, direction)` 或等价函数；禁止在不同事件里分别手写 active 逻辑。函数里必须先清理过期的 `is-active`、`is-prev`、`is-next`、`is-exiting` 和 `aria-hidden`，再只激活当前页；如果使用离场动画，只允许上一张当前页短暂保留 `is-exiting`，并且必须注册一次性清理。推荐直接使用这个骨架：
  `function renderSlides(direction = "forward") { deck.dataset.direction = direction; slides.forEach((slide, index) => { const active = index === current; slide.classList.toggle("is-active", active); slide.classList.toggle("is-prev", !active && index < current); slide.classList.toggle("is-next", !active && index > current); slide.setAttribute("aria-hidden", active ? "false" : "true"); }); }`
  `function goTo(index) { const next = Math.max(0, Math.min(index, slides.length - 1)); if (next === current) return; const direction = next > current ? "forward" : "backward"; current = next; renderSlides(direction); updateControls(); }`
  不要只给下一页添加 active，也不要只改变 transform 而不清掉上一页/下一页的可见性。
- 切页动画必须是双向的：向前和向后都要正确处理进入页和离开页。可以用 `[data-direction="forward"]` / `[data-direction="backward"]` 控制当前页从不同方向进入，或使用 `is-prev` / `is-next` 作为非当前页位置提示；非当前页默认必须 `opacity: 0`、`visibility: hidden`、`pointer-events: none`。如果使用 `.is-exiting` 做离场，它只能存在一个动画周期，不能接收点击，不能盖住当前页内容，动画结束后必须彻底隐藏。
- 必须支持浏览器内演示：提供“全屏演示”按钮；支持鼠标点击“上一页 / 下一页”切换；支持方向键切换；Home / End 跳到首页 / 末页。
- 方向键必须和页面切换动画一致：横向 slide 动画使用 ArrowLeft / ArrowRight；纵向 slide 动画使用 ArrowUp / ArrowDown。可以同时额外支持另一组方向键，但页面上的快捷键提示必须准确列出实际支持的按键。不要在只绑定左右键时提示“下键下一张”。
- 页面必须包含可见页码、上一页 / 下一页按钮，并用 `addEventListener("click", ...)` 或等价的按钮点击绑定实现鼠标操作；不要只实现 `keydown`。
- 必须支持鼠标滚轮 / 触控板滑动翻页：监听 `wheel` 事件，根据主要位移方向判断上一页 / 下一页；触控板连续事件必须做节流或锁定，例如 550-800ms 内只翻一页，忽略很小的 `deltaX` / `deltaY`，并在演示容器内 `preventDefault()` 防止页面滚动。滚轮向下或触控板向下滑动时进入下一页，滚轮向上或触控板向上滑动时回到上一页；横向动画可优先响应 `deltaX`，其中 `deltaX > 0` 进入下一页、`deltaX < 0` 回到上一页。页面快捷提示要写清楚“滚轮 / 触控板滑动可翻页”。
- 底部控制条如果使用 `position: fixed` 或 `sticky`，必须给幻灯片主体预留安全区，例如主体 `padding-bottom: 96px`，或让舞台容器使用 `max-height: calc(100vh - 96px)` 并保留底部内边距；任何卡片、证据块、正文都不能被底部导航压住或贴边。
- 鼠标交互应是显式按钮优先，也可以额外支持点击左 / 右侧热区翻页；第一页禁用“上一页”，最后一页禁用“下一页”，禁用态要可见。
- 使用原生 HTML/CSS/JS 实现，不依赖外部 CDN；全屏使用浏览器 Fullscreen API，浏览器不支持时仍可正常逐屏切换。
- 可选的页面内滚动只允许用于隐藏的讲者备注或附录，不用于主要幻灯片内容；默认演示体验必须是一页一屏、一键切换。"#,
        },
        BuiltinOutputShape {
            id: "xiaohongshu",
            name: "小红书图文风格",
            description: "卡片化图文 HTML，适合网页浏览和截图成多图内容。",
            brief_md: r#"- 输出仍然是网页报告，不是图片文件。
- 参考 `/Users/duoshilin/duosl/forks/html-anything` 的 `card-xiaohongshu` / `deck-xhs-*` 思路，但必须收敛到阅读报告气质：有分享感，不做营销感。
- 页面主体必须是多卡片图文画廊，而不是普通长报告，也不是所有卡片在页面中线单列排队。桌面宽度下优先使用 2 到 4 列 CSS Grid；也可以使用 CSS columns / masonry 风格瀑布流；顶部可以有整体摘要，随后进入卡片区。
- 每张卡片必须是可截图单元，使用固定或近似固定比例：优先 `aspect-ratio: 3 / 4`，可用 `width: min(360px, 100%)` 或等价桌面尺寸；卡片内容不允许溢出，内容放不下就拆成新卡片。不要生成无固定比例的普通网页卡片。
- 卡片数量由内容决定：短报告至少 5 张，常规报告建议 7 到 12 张，信息多时继续拆分；每张卡只承载一个核心观点、一个关键数据或一个证据组。第一张是封面，最后一张是总结 / 下一步建议 / 来源说明。
- 卡片结构建议：封面卡、年度数字卡、主题偏好卡、Top 书卡、笔记证据卡、阅读节奏卡、风险/盲区卡、行动建议卡、来源卡。每张卡必须有页码或序号，方便截图后排序。
- 视觉应保持 Quiet Reading Ledger：纸色、墨色、淡琥珀/低饱和辅助色、清楚层级；允许轻柔色块和圆角，但不要 emoji 装饰、夸张营销话术、过度渐变、漂浮光球或大面积粉紫。
- 字号必须按截图阅读设计：标题足够大，正文短句化，列表一般不超过 4 项；长解释拆卡，不要在单张卡里塞长段落。"#,
        },
        BuiltinOutputShape {
            id: "free",
            name: "不限",
            description: "不约束输出形态，由内容决定最佳呈现方式。",
            brief_md: r#"- 不限制版式、布局和视觉风格。
- 根据内容特征自行决定最佳呈现方式。
- 可以是长文、卡片、图表、清单或任何适合的形式。
- 不需要固定比例，不需要多列网格，不需要 PPT 切页逻辑。
"#,
        },
    ]
}

const PERSONALITY_STYLE: &str = r#"# 阅读人格分析风格

整体像一份私人阅读侧写档案。允许使用人物画像、阅读倾向坐标、证据摘录、节奏曲线和书目索引。避免泛 SaaS 卡片堆叠、大面积渐变、夸张心理诊断和无证据判断。

版式建议：先给出一句“你的阅读人格不是标签，而是一种使用书的方式”，再分成 3 到 5 个画像维度，每个维度包含短标题、解释、证据和一个可行动提醒。
"#;

const PERSONALITY_PROMPT: &str = r#"# 阅读人格分析

请根据可用数据判断你如何选书、如何投入注意力、如何表达想法。报告结构由你决定，不要套固定模板。结论必须能回到数据证据。

必须包含：
- 一个不超过 16 字的阅读人格命名。
- 3 到 5 个维度，例如选书动机、注意力投入方式、笔记表达方式、主题偏好、完成倾向。
- 每个维度至少引用一种证据：分类、书名、阅读时长、笔记数量、划线或想法。
- 结尾给出 3 条下一阶段建议，每条都说明适合你的原因。

不要做 MBTI 式伪科学诊断，不要把分数写得像医学或心理测评。
"#;

const KNOWLEDGE_STYLE: &str = r#"# 知识结构盲区风格

整体像知识地图和研究索引。允许使用主题地图、连接关系、盲区雷达、书目矩阵和下一步路径。避免把分类列表机械堆成表格。

版式建议：把已有知识区、重复投入区、薄弱连接区和下一步补齐区分开。每个区块都要有“为什么这么判断”和“下一步怎么补”的小结。
"#;

const KNOWLEDGE_PROMPT: &str = r#"# 知识结构盲区

请识别你已经投入的主题、主题之间的连接、重复投入区域、薄弱区域和下一阶段可以补齐的知识结构。不要伪造不存在的阅读经历。

必须包含：
- 当前知识地图：3 到 6 个主题区，每个主题区列出代表书或数据证据。
- 结构盲区：只写能从数据中推断的缺口，不要凭空劝读热门领域。
- 重复投入区：说明哪些主题被反复阅读，可能代表兴趣、工作需要或理解瓶颈。
- 补齐路线：给出 3 条主题路径，每条包含“为什么补、怎么补、先看什么类型的书”。
"#;

const GROWTH_STYLE: &str = r#"# 下一阶段阅读建议风格

整体像可执行的私人阅读路线图。允许使用阶段计划、主题路径、节奏建议和轻量书单方向。保持克制、具体、可行动。

版式建议：用路线图而不是普通建议清单。把建议分为“继续深挖”“横向连接”“节奏调整”三类，最后给出一个 30 天轻量行动表。
"#;

const GROWTH_PROMPT: &str = r#"# 下一阶段阅读建议

请基于已有阅读轨迹生成你的下一阶段阅读方向。重点是方向和策略，不要凭空指定你没有兴趣的路线。

必须包含：
- 先判断当前阶段：你更像在积累、探索、验证、补课还是输出前整理。
- 给出 3 条下一阶段路线，每条都有目标、适合原因、可选书籍类型和一条执行方式。
- 给出一份轻量节奏建议，例如每周阅读、笔记整理和复盘方式。
- 如果数据不足，明确哪些判断只是保守建议。
"#;

const ANNUAL_KEYWORDS_STYLE: &str = r#"# 年度阅读关键词风格

整体像一组可以截图分享的年度阅读标签页。允许使用关键词云、年度标签、短句标题、少量关键数字和代表性书目。保持纸面感和档案感，避免夸张营销、情绪煽动和空泛金句。

版式建议：输出适合网页浏览和截图分享的卡片画廊。桌面宽度下使用多列网格或瀑布流展示关键词卡片，不要排成单列长页面。每张卡片只有一个关键词、一个解释、2 到 3 个证据点。标题短，正文可读，不使用 emoji。
"#;

const ANNUAL_KEYWORDS_PROMPT: &str = r#"# 年度阅读关键词

请从阅读统计、书架主题、笔记密度和完成情况中提炼 5 到 9 个年度阅读关键词。每个关键词必须给出证据来源，例如来自哪些书、哪些分类、阅读时长或笔记数量。最后生成一段适合用户分享的短摘要，但不要泄露原始私密笔记。
"#;

const TOP_BOOKS_STYLE: &str = r#"# 年度 Top 书单风格

整体像私人年度书单榜。允许使用榜单、书封占位、推荐语、选择理由和主题标签。版面要适合网页浏览和逐张截图，标题清楚、信息密度适中，避免把所有书机械排成表格。

版式建议：每本书是一张可截图书单卡，包含排名、书名、入选理由、证据标签和一句私人推荐语。桌面宽度下使用多列网格或瀑布流展示书单卡，不要把书单做成纯表格，也不要把卡片排成单列竖线。
"#;

const TOP_BOOKS_PROMPT: &str = r#"# 年度 Top 书单

请生成一份年度 Top 书单。排序不要只看阅读时长，应综合完成情况、笔记投入、主题代表性和对用户阅读路径的意义。每本书需要一句私人推荐语和简短证据。不要推荐用户没有读过或数据中不存在的书。
"#;

const READING_RADAR_STYLE: &str = r#"# 阅读偏好雷达风格

整体像一份可解释的个人阅读偏好仪表。允许使用雷达图、维度条、坐标轴、评分说明和证据卡片。视觉要克制、清晰、可截图，不要使用无法从数据解释的伪精密分数。

版式建议：PPT 风格下按一屏一个维度组织：总览雷达、维度解释、证据卡、下一步建议。分数只能作为相对表达，不能伪装成精密测评。
"#;

const READING_RADAR_PROMPT: &str = r#"# 阅读偏好雷达

请把用户的阅读偏好拆成 5 到 7 个维度，例如主题集中度、阅读完成度、笔记密度、长读耐心、探索广度、实用导向、文学/思想偏好等。每个维度可以给出相对分数或等级，但必须解释依据。分数是表达辅助，不是科学测评。
"#;

const SPIRIT_BOOKSHELF_STYLE: &str = r#"# 精神书架风格

整体像一面私人精神书架。允许使用分层书架、主题分区、少量摘录、书目标签和短评。强调安静、珍藏、可回看；如果使用原始划线或想法，只选少量代表性内容并避免暴露过于私密的上下文。

版式建议：把书架分为 3 到 5 层，每层像一块真实书架标签。每层包含主题名、代表书、少量解释和一条可选摘录。
"#;

const SPIRIT_BOOKSHELF_PROMPT: &str = r#"# 精神书架

请从代表性书籍、主题分布、划线和想法中整理一面“精神书架”。书架应分成 3 到 5 个主题层，例如思想底色、现实工具、审美经验、长期问题等。每层列出代表书和为什么它们属于这一层。若用户未授权原始笔记，则只基于书架、统计和笔记数量生成，不要编造摘录。
"#;
