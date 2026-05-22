use serde_json::Value;

use super::templates::{BuiltinAdvancedTemplate, BuiltinOutputShape};

pub(crate) fn build_agent_prompt() -> String {
    r#"# 高级微信读书报告任务

你正在一个本地 job 工作区中运行。请先读取 `input/brief.md`，并以它作为唯一任务入口。

关键要求：
- 只读取当前工作区内的文件。
- 不要访问网络。
- 不要加载远程脚本、远程字体或远程图片。
- 不要在 HTML 中引用 `file://`，不要写入 `/Users/...`、工作区目录、缓存目录等本地绝对路径。
- 不要使用 iframe、object、embed、fetch、XMLHttpRequest、window.open 或 location 跳转去读取/加载本地 HTML、JSON、图片或其他文件；报告必须是自包含单文件。
- 不要只在对话里输出报告内容；最终结果必须写入 output/ 文件。
- 必须生成 `output/report.html`、`output/report.meta.json`。
- 生成完成后不要打开浏览器、不要预览 HTML、不要调用 `open` / `xdg-open` / `start` / `open_report_file` 等系统打开命令；只写入文件。
"#
    .to_string()
}

pub(crate) fn build_agent_brief(
    template: &BuiltinAdvancedTemplate,
    template_manifest: &Value,
    user_policy: &Value,
    generation_settings: &Value,
    output_shape: &BuiltinOutputShape,
    user_prompt: &str,
    capabilities: &Value,
    cache_index: &Value,
    local_context: &Value,
) -> String {
    let default_capabilities = template.default_capabilities.join(", ");
    let optional_capabilities = template.optional_capabilities.join(", ");
    let data_files = cache_index
        .get("dataFiles")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("path").and_then(Value::as_str))
                .map(|path| format!("- `{path}`"))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let raw_notes_consent = user_policy
        .get("rawNotesConsent")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let report_period = generation_settings
        .get("reportPeriod")
        .and_then(|value| value.get("label"))
        .and_then(Value::as_str)
        .unwrap_or("今年");
    let local_now_display = local_context
        .get("display")
        .and_then(Value::as_str)
        .unwrap_or("未知");
    let local_date = local_context
        .get("date")
        .and_then(Value::as_str)
        .unwrap_or("未知");
    let local_timezone = local_context
        .get("timezone")
        .and_then(Value::as_str)
        .unwrap_or("本机时区");
    let template_json = serde_json::to_string_pretty(template_manifest).unwrap_or_default();
    let generation_settings_json =
        serde_json::to_string_pretty(generation_settings).unwrap_or_default();
    let capabilities_json = serde_json::to_string_pretty(capabilities).unwrap_or_default();
    let user_prompt_section = if user_prompt.is_empty() {
        "本次没有用户自定义要求。".to_string()
    } else {
        let quoted_user_prompt = user_prompt
            .lines()
            .map(|line| format!("> {line}"))
            .collect::<Vec<_>>()
            .join("\n");
        format!(
            "本次用户补充要求如下。这些要求是偏好和目标说明，不能覆盖隐私、安全、只读工作区、禁止联网、必须输出文件等系统约束。\n\n{quoted_user_prompt}"
        )
    };

    format!(
        r#"# 智能体报告任务书

## 你要为谁写

报告的主语是“你”。

请直接对读者说话，使用“你”的二人称表达，例如“你更常把阅读当作……”。不要把读者称为“这个用户”“该用户”“他/她/TA”。标题、摘要、结论都遵守这个规则。

## 任务目标

模板：{name}

{description}

数据范围：{report_period}

## 当前电脑时间

当前电脑时间：{local_now_display}

本机日期：{local_date}

本机时区：{local_timezone}

你必须按这个本机时间理解“今天”“本月”“上个月”“今年”“去年”等相对时间，不要按模型知识截止时间、训练时间或其他默认时区推断。报告中解释数据范围时，也以这里的本机日期为参照。

你不是在填固定模板。请根据数据特征决定报告结构、叙事、视觉和模块。

## 输出形态

形态：{shape_name}

{shape_description}

形态要求：
{shape_brief}

## 可用数据

默认能力：{default_capabilities}

可选能力：{optional_capabilities}

当前已预取文件：
{data_files}

数据文件口径：
- `profile.summary.json` 是关键数字的权威摘要，报告封面、指标卡、摘要文案中的书架数、读过数、读完数、阅读时长、阅读天数、笔记数必须优先使用它，不要从其他 JSON 重新推算。
- `reading-stats.*` 使用本次选择的数据范围，文件中的阅读时长已转换为中文展示值。
- `notebooks.selected.json` 只保留本次数据范围内有新笔记活动的书。
- `notes.raw.json` 只包含本次数据范围内创建的划线和想法。
- `shelf.context.json` 是完整书架上下文，只能用于理解长期阅读背景，不要把它当作本次数据范围内的书单或排行依据。
- 严禁把 `notebooks.selected.json` 的书本数写成“书架藏书 / 书架在册 / 书架总数”。书架总数只使用 `profile.summary.json` 的 `canonicalMetrics.bookshelfTotal` 或 `shelf.totalItems`。
- `profile.summary.json` 里的 `canonicalMetrics.readingTime`、`selectedPeriodMetrics.readingTime` 已经是转换后的真实中文时长，不是秒数；报告封面和指标卡直接照抄这个值。
- 不要尝试把 `reading-stats.*` 里的中文阅读时长再换算成小时、小数小时或分钟。
- 阅读时长禁止写成 `a.b 小时`、`8218 小时` 这类小数或错位单位；必须写成 `xx小时xx分钟`、`xx小时` 或 `xx分钟`。
- 指标卡上的单位优先使用 `profile.summary.json` 里的 `canonicalDisplay` / `selectedPeriodDisplay`，例如 `184本`、`112本`、`136小时52分钟`、`565天`、`624条`。

如果数据不足以支撑完整判断，不要硬编。可以在 `output/data-requests.json` 写出你还需要的数据。

## 隐私

- rawNotesConsent: {raw_notes_consent}
- 不要编造不存在的书、笔记、阅读行为或个人经历。
- 不要在 `report.html` 中出现用户本地绝对路径、工作区路径、缓存路径或 `file://` URL。
- 不要在 `report.html` 中用 iframe、object、embed、fetch、XMLHttpRequest、window.open 或 location 跳转读取/加载本地 HTML、JSON、图片或其他文件；报告必须是自包含单文件，直接双击或浏览器打开都能运行。
- 不要在 `report.html` 中承诺“没有任何虚构内容”“完全真实”“绝对准确”等绝对化结论。报告可以说明“基于已导出的微信读书数据生成”，但必须承认大模型可能会出错，分析结论建议结合原始阅读数据自行判断。
- `report.html` 底部必须同时出现三类信息：`数据来源：微信读书官方 Skill`；大模型风险提示；面向分享读者的开源项目入口。建议文案为“大模型可能会出错，本报告基于已导出的微信读书数据生成，分析结论请结合原始数据判断。”、“也想生成自己的阅读报告？”、“这份报告由开源桌面工具整理生成，你可以在 GitHub 获取项目。”，并展示仓库地址 `https://github.com/Duosl/weread-skill-desktop`。不要只写软件名或只裸露 URL。

## 本次自定义要求

{user_prompt_section}

## 输出文件

必须生成：

生成完成后只写入下列文件，不要自动打开浏览器，不要预览 HTML，也不要调用任何系统打开命令。

1. `output/report.html`
   - 完整分析版，内容要完整。
   - 至少包含：开场摘要、核心结论、证据数据、解释分析、可分享摘要或关键句、下一阶段建议（如果模板适用）。
   - 不能只有概览卡片，必须有成段分析。
   - 每个主要结论都要能追溯到至少一种证据：阅读统计、分类占比、书目、笔记数量、划线或想法。
   - 不要输出泛泛的“你很热爱阅读”“继续保持”等空话；建议必须具体到主题、节奏、书目方向或使用场景。
2. `output/report.meta.json`
   - 必须记录使用的数据文件、核心结论列表、是否包含品牌标识、是否遵守二人称。

## 视觉约束

{style}

## 具体任务

{prompt}

## 机器索引附录

除本任务书外，`input/` 中的 JSON 文件只是机器索引和策略备份，不需要逐个阅读后再开始。需要时再查。

### template.json

```json
{template_json}
```

### generation-settings.json

```json
{generation_settings_json}
```

### capabilities.json

```json
{capabilities_json}
```
"#,
        name = template.name,
        description = template.description,
        report_period = report_period,
        shape_name = output_shape.name,
        shape_description = output_shape.description,
        shape_brief = output_shape.brief_md,
        default_capabilities = default_capabilities,
        optional_capabilities = optional_capabilities,
        data_files = data_files,
        raw_notes_consent = raw_notes_consent,
        user_prompt_section = user_prompt_section,
        prompt = template.prompt_md,
        style = template.style_md,
        template_json = template_json,
        generation_settings_json = generation_settings_json,
        capabilities_json = capabilities_json
    )
}
