use std::sync::OnceLock;

use serde::Serialize;


static PROMPT_TEMPLATE: OnceLock<String> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
pub(crate) struct RenderedSystemPrompt {
    pub system_text: String,
    pub time_context: String,
    pub skill_prompt: String,
}

pub(crate) fn init() {
    let _ = PROMPT_TEMPLATE.get_or_init(|| {
        let template = load_prompt_template();
        if !template.contains("{{TIME_CONTEXT}}") {
            eprintln!("system prompt template missing {{TIME_CONTEXT}} placeholder");
        }
        template
    });
}

pub(crate) fn render() -> RenderedSystemPrompt {
    let template = PROMPT_TEMPLATE.get_or_init(load_prompt_template);
    let now = chrono::Local::now();
    let year_int: i32 = now.format("%Y").to_string().parse().unwrap_or(2026);
    let month_int: u32 = now.format("%m").to_string().parse().unwrap_or(1);

    let weekday = match now.format("%u").to_string().as_str() {
        "1" => "周一",
        "2" => "周二",
        "3" => "周三",
        "4" => "周四",
        "5" => "周五",
        "6" => "周六",
        "7" => "周日",
        _ => "",
    };

    let year_start = chrono::NaiveDate::from_ymd_opt(year_int, 1, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_local_timezone(chrono::Local)
        .unwrap()
        .timestamp();

    let last_month_ts = if month_int == 1 {
        chrono::NaiveDate::from_ymd_opt(year_int - 1, 12, 15)
    } else {
        chrono::NaiveDate::from_ymd_opt(year_int, month_int - 1, 15)
    }
    .unwrap()
    .and_hms_opt(12, 0, 0)
    .unwrap()
    .and_local_timezone(chrono::Local)
    .unwrap()
    .timestamp();

    let time_context = format!(
        r#"今天是 {year}年{month}月{day}日（{weekday}）。
- 用户提到“今年” → `mode=annually`, `baseTime={year_start}`。
- 用户提到“去年” → `mode=annually`, `baseTime` 取 {last_year} 年内时间戳。
- 用户提到“本月” → `mode=monthly`, `baseTime=0`。
- 用户提到“上个月” → `mode=monthly`, `baseTime={last_month}`。
- 用户提到“本周” → `mode=weekly`, `baseTime=0`。
- 用户提到“全部/总共/所有” → `mode=overall`, `baseTime=0`。
- 用户明确说“{last_year}年” → `mode=annually`, `baseTime` 取 {last_year} 年内任意时间戳。
- 用户明确说“{year}年” → `mode=annually`, `baseTime={year_start}`。
- 用户没有提到任何时间词时，默认使用 `mode=overall`, `baseTime=0`。
- 不要用 `mode=overall` 回答明确指定年份的问题。"#,
        year = now.format("%Y"),
        month = now.format("%m"),
        day = now.format("%d"),
        weekday = weekday,
        year_start = year_start,
        last_year = year_int - 1,
        last_month = last_month_ts,
    );

    let skill_prompt = crate::agent_gateway::render_skills_prompt();
    let report_design = crate::report_design::full_design_guidelines();

    let mut system_text = template.clone();
    system_text = system_text.replace("{{TIME_CONTEXT}}", &time_context);
    system_text = system_text.replace("{{REPORT_DESIGN}}", &report_design);
    system_text = system_text.replace("{{SKILL_PROMPT}}", &skill_prompt);
    system_text = system_text
        .replace("\r\n", "\n")
        .split('\n')
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\n");

    while system_text.contains("\n\n\n") {
        system_text = system_text.replace("\n\n\n", "\n\n");
    }

    RenderedSystemPrompt {
        system_text: system_text.trim().to_string(),
        time_context,
        skill_prompt,
    }
}



fn load_prompt_template() -> String {
    let candidates = [
        "resources/prompts/system.md".to_string(),
        "resources\\prompts\\system.md".to_string(),
    ];

    for candidate in &candidates {
        if let Ok(content) = std::fs::read_to_string(candidate) {
            return content;
        }
    }

    eprintln!("failed to load bundled system prompt template, fallback to minimal prompt");
    "你是书迹内置的阅读数据助手。\n\n{{TIME_CONTEXT}}\n\n{{REPORT_DESIGN}}\n\n{{SKILL_PROMPT}}\n\n{{SKILL_SUMMARIES}}".to_string()
}
