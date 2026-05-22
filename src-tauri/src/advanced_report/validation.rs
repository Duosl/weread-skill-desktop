use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedReportValidation {
    pub ok: bool,
    pub warnings: Vec<String>,
}

pub(crate) fn validate_output(report_html: Option<&str>) -> AdvancedReportValidation {
    let mut warnings = Vec::new();

    match report_html {
        Some(html) => {
            if html.chars().count() < 12_000 {
                warnings.push("分析版内容偏短，可能不完整".to_string());
            }
            if !html.contains("你") {
                warnings.push("分析版没有使用“你”作为报告主语".to_string());
            }
            if html.contains("这个用户") || html.contains("该用户") {
                warnings.push("分析版仍包含第三人称用户称呼".to_string());
            }
            if !html.contains("https://github.com/Duosl/weread-skill-desktop") {
                warnings.push("分析版缺少开源项目 GitHub 地址".to_string());
            }
            if !html.contains("微信读书官方 Skill") {
                warnings.push("分析版缺少微信读书官方 Skill 数据来源说明".to_string());
            }
            let evidence_markers = [
                "证据",
                "依据",
                "来自",
                "数据",
                "阅读时长",
                "笔记",
                "划线",
                "想法",
            ];
            let evidence_hits = evidence_markers
                .iter()
                .filter(|marker| html.contains(*marker))
                .count();
            if evidence_hits < 3 {
                warnings.push("分析版证据链偏弱，主要结论可能缺少数据依据".to_string());
            }
            let lower_html = html.to_lowercase();
            let has_local_path = html.contains("file://")
                || html.contains("/Users/")
                || html.contains("/.weread-desktop/")
                || html.contains("\\Users\\")
                || html.contains("C:\\");
            if has_local_path {
                warnings.push(
                    "报告 HTML 暴露或引用了本地文件路径，可能触发浏览器 file 安全限制".to_string(),
                );
            }
            let has_embedded_local_frame = lower_html.contains("<iframe")
                || lower_html.contains("<object")
                || lower_html.contains("<embed");
            if has_embedded_local_frame {
                warnings.push(
                    "报告 HTML 包含嵌入式 frame/object/embed，本地 file 打开时容易触发安全限制"
                        .to_string(),
                );
            }
            let has_local_loading_script = html.contains("fetch(")
                || html.contains("XMLHttpRequest")
                || html.contains("window.open(")
                || html.contains("location.href")
                || html.contains("location.assign")
                || html.contains("location.replace");
            if has_local_loading_script && has_local_path {
                warnings.push(
                    "报告 HTML 可能通过脚本读取或跳转本地文件，需改为自包含单文件".to_string(),
                );
            }
            let xhs_markers = ["卡片", "截图", "图文", "轮播"];
            if html.contains("小红书") && !xhs_markers.iter().any(|marker| html.contains(*marker))
            {
                warnings.push("小红书图文风格缺少卡片化或截图友好的结构提示".to_string());
            }
            let has_xhs_output = html.contains("小红书")
                || html.contains("xiaohongshu")
                || html.contains("xhs")
                || html.contains("图文卡")
                || html.contains("轮播");
            let has_xhs_grid = html.contains("grid-template-columns")
                || html.contains("columns:")
                || html.contains("column-count")
                || html.contains("masonry");
            if has_xhs_output && !has_xhs_grid {
                warnings.push("小红书图文风格缺少多列卡片画廊，容易退化成单列长页面".to_string());
            }
            let has_xhs_card_ratio = html.contains("aspect-ratio: 3 / 4")
                || html.contains("aspect-ratio:3/4")
                || html.contains("1080")
                || html.contains("1440");
            if has_xhs_output && !has_xhs_card_ratio {
                warnings.push("小红书图文风格缺少 3:4 截图卡片比例，单张卡片不够稳定".to_string());
            }
            let has_xhs_cover =
                html.contains("封面") || html.contains("cover") || html.contains("Cover");
            let has_xhs_page_number = html.contains("页码")
                || html.contains("page")
                || html.contains("Page")
                || html.contains("card-index");
            if has_xhs_output && (!has_xhs_cover || !has_xhs_page_number) {
                warnings.push("小红书图文风格缺少封面卡或页码，截图成组后不利于传播".to_string());
            }
            let slide_markers = [
                "PPT",
                "演示",
                "第 1 屏",
                "第一屏",
                "Slide",
                "slide",
                "全屏",
                "下一页",
                "上一页",
                "keydown",
                "requestFullscreen",
                "aspect-ratio",
            ];
            if html.contains("PPT 风格")
                && !slide_markers.iter().any(|marker| html.contains(*marker))
            {
                warnings.push("PPT 风格缺少演示页式结构提示".to_string());
            }
            let has_slide_output = html.contains("PPT 风格")
                || html.contains("全屏演示")
                || html.contains("上一页")
                || html.contains("下一页")
                || html.contains("requestFullscreen");
            if has_slide_output && html.contains("keydown") && !html.contains("click") {
                warnings.push("PPT 风格只检测到键盘切换，缺少鼠标点击翻页绑定".to_string());
            }
            let has_wheel_turning = html.contains("wheel")
                || html.contains("deltaY")
                || html.contains("deltaX")
                || html.contains("onwheel");
            if has_slide_output && !has_wheel_turning {
                warnings.push("PPT 风格缺少鼠标滚轮或触控板滑动翻页支持".to_string());
            }
            let has_wheel_throttle = html.contains("throttle")
                || html.contains("wheelLock")
                || html.contains("lastWheel")
                || html.contains("setTimeout")
                || html.contains("Date.now()");
            if has_slide_output && has_wheel_turning && !has_wheel_throttle {
                warnings
                    .push("PPT 风格的滚轮/触控板翻页缺少节流，容易一次滑动连续翻多页".to_string());
            }
            if has_slide_output
                && (html.contains("deltaY < 0) next")
                    || html.contains("deltaY<0)next")
                    || html.contains("deltaY < 0 ? next")
                    || html.contains("deltaY<0?next"))
            {
                warnings.push(
                    "PPT 风格滚轮方向反直觉，应向下滑动进入下一页、向上滑动回到上一页".to_string(),
                );
            }
            if has_slide_output && !html.contains("aspect-ratio") {
                warnings.push("PPT 风格缺少固定 16:9 舞台，容易在不同屏幕尺寸下溢出".to_string());
            }
            let has_slide_display_none =
                html.contains("display: none") || html.contains("display:none");
            let has_slide_visibility_hidden =
                html.contains("visibility: hidden") || html.contains("visibility:hidden");
            let has_slide_opacity_hidden =
                html.contains("opacity: 0") || html.contains("opacity:0");
            let has_slide_aria_hidden = html.contains("aria-hidden");
            let has_slide_hidden_state =
                has_slide_display_none || (has_slide_visibility_hidden && has_slide_opacity_hidden);
            let has_slide_pointer_guard =
                html.contains("pointer-events: none") || html.contains("pointer-events:none");
            let has_slide_state_cleanup = (html.contains("slides.forEach")
                || html.contains(".forEach((slide")
                || html.contains("classList.remove"))
                && has_slide_aria_hidden
                && (html.contains("classList.toggle")
                    || html.contains("classList.remove")
                    || html.contains("className"));
            let has_single_slide_entry = html.contains("goTo(")
                || html.contains("renderSlides(")
                || html.contains("showSlide(")
                || html.contains("updateSlide(");
            if has_slide_output && (!has_slide_hidden_state || !has_slide_pointer_guard) {
                warnings.push(
                    "PPT 风格缺少非当前页隐藏态，上一页/下一页内容可能残留叠在当前页上".to_string(),
                );
            }
            if has_slide_output && !has_slide_state_cleanup {
                warnings.push(
                    "PPT 风格切页逻辑缺少全量清理 slide 状态，容易只做单向动画导致页面叠层"
                        .to_string(),
                );
            }
            if has_slide_output && !has_single_slide_entry {
                warnings.push("PPT 风格缺少统一切页入口，键盘/按钮/滚轮分散更新状态时容易出现上一页或下一页残影".to_string());
            }
            let has_slide_exiting_state = html.contains("is-exiting");
            let has_slide_exiting_cleanup = html.contains("animationend")
                || html.contains("transitionend")
                || html.contains("setTimeout");
            if has_slide_output && has_slide_exiting_state && !has_slide_exiting_cleanup {
                warnings.push(
                    "PPT 风格使用了离场动画状态，但缺少动画结束后的清理逻辑，可能留下上一页残影"
                        .to_string(),
                );
            }
            let has_slide_layout_pool = html.contains("版式")
                || html.contains("layout")
                || html.contains("Layout")
                || html.contains("data-layout")
                || html.contains("slide-type");
            if has_slide_output && !has_slide_layout_pool {
                warnings
                    .push("PPT 风格缺少明确版式池，模型容易逐页自由发挥导致风格漂移".to_string());
            }
            let has_invalid_calc_spacing = (html.contains("100vh-")
                || html.contains("100vw-")
                || html.contains("-96px")
                || html.contains("- 96px"))
                && !html.contains("100vh - 96px");
            let has_calc_multiply = html.contains("*16/9")
                || html.contains("* 16/9")
                || html.contains("*16 / 9")
                || html.contains("* 16 / 9")
                || html.contains("/9)")
                || html.contains("/ 9)");
            if has_slide_output && (has_invalid_calc_spacing || has_calc_multiply) {
                warnings.push("PPT 风格舞台尺寸 CSS 使用了浏览器不兼容的 calc 写法，应改为合法空格和无乘除法表达式".to_string());
            }
            let has_fixed_bottom_controls = html.contains("position:fixed")
                || html.contains("position: fixed")
                || html.contains("position:sticky")
                || html.contains("position: sticky");
            let has_slide_safe_area = html.contains("padding-bottom")
                || html.contains("calc(100vh")
                || html.contains("safe-area")
                || html.contains("bottom-spacer");
            if has_slide_output && has_fixed_bottom_controls && !has_slide_safe_area {
                warnings.push("PPT 风格底部控制条缺少内容安全区，可能遮挡最后一行内容".to_string());
            }
            let mentions_down_key = html.contains("下键")
                || html.contains("ArrowDown")
                || html.contains("↓")
                || html.contains("向下");
            let handles_down_key = html.contains("ArrowDown")
                || html.contains("key === 'Down'")
                || html.contains("key===\"Down\"")
                || html.contains("keyCode === 40")
                || html.contains("keyCode==40");
            if has_slide_output && mentions_down_key && !handles_down_key {
                warnings.push("PPT 风格快捷键提示和实际按键绑定不一致".to_string());
            }
            if has_slide_output
                && (html.contains("overflow-y: auto") || html.contains("overflow: auto"))
                && !html.contains("speaker-notes")
                && !html.contains("appendix")
            {
                warnings.push("PPT 风格主要内容依赖滚动阅读，应拆成更多固定比例页面".to_string());
            }
        }
        None => warnings.push("缺少报告".to_string()),
    }

    AdvancedReportValidation {
        ok: warnings.is_empty(),
        warnings,
    }
}
