use crate::types::{CreateCustomTemplateRequest, CustomTemplate};
use dirs::home_dir;
use std::fs;
use std::path::PathBuf;

const CONFIG_DIR_NAME: &str = ".weread-desktop";
const TEMPLATES_DIR_NAME: &str = "custom-templates";

fn templates_dir() -> PathBuf {
    home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(CONFIG_DIR_NAME)
        .join(TEMPLATES_DIR_NAME)
}

fn template_path(template_id: &str) -> PathBuf {
    templates_dir().join(format!("{}.json", template_id))
}

fn generate_id(name: &str) -> String {
    let slug = name
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
    format!("custom-{}-{}", slug.chars().take(24).collect::<String>(), ts)
}

pub fn list_custom_templates() -> Result<Vec<CustomTemplate>, String> {
    let dir = templates_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let entries =
        fs::read_dir(&dir).map_err(|e| format!("读取自定义模板目录失败: {e}"))?;
    let mut templates = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(template) = serde_json::from_str::<CustomTemplate>(&content) {
                templates.push(template);
            }
        }
    }
    templates.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(templates)
}

pub fn create_custom_template(
    request: CreateCustomTemplateRequest,
) -> Result<CustomTemplate, String> {
    if request.name.trim().is_empty() {
        return Err("模板名称不能为空".to_string());
    }
    if request.prompt_md.trim().is_empty() {
        return Err("提示词不能为空".to_string());
    }

    let dir = templates_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("创建模板目录失败: {e}"))?;

    let id = generate_id(&request.name);
    let now = chrono::Utc::now().to_rfc3339();

    let intent = request.intent.clone().or_else(|| Some(infer_intent(&request)));
    let template = CustomTemplate {
        id: id.clone(),
        name: request.name.trim().to_string(),
        description: request.description.trim().to_string(),
        category: "custom".to_string(),
        style_summary: String::new(),
        style_md: request.style_md.unwrap_or_default(),
        prompt_md: request.prompt_md,
        default_report_period: "all".to_string(),
        default_output_shape: request
            .default_output_shape
            .unwrap_or_else(|| "report".to_string()),
        output_shapes: request.output_shapes.unwrap_or_else(|| {
            vec![
                "report".to_string(),
                "slides".to_string(),
                "xiaohongshu".to_string(),
                "free".to_string(),
            ]
        }),
        requires_raw_notes_consent: request.requires_raw_notes_consent.unwrap_or(false),
        default_capabilities: vec![
            "profile.summary".to_string(),
            "shelf.sync".to_string(),
            "notes.notebooks".to_string(),
            "reading.stats".to_string(),
        ],
        optional_capabilities: vec![
            "book.info".to_string(),
            "book.progress".to_string(),
            "notes.bookmarks".to_string(),
            "notes.reviews".to_string(),
        ],
        created_at: now,
        source: "manual".to_string(),
        intent,
    };

    let content =
        serde_json::to_string_pretty(&template).map_err(|e| format!("序列化模板失败: {e}"))?;
    let path = template_path(&id);
    fs::write(&path, content).map_err(|e| format!("写入模板文件失败: {e}"))?;

    Ok(template)
}

pub fn update_custom_template(
    template_id: &str,
    request: CreateCustomTemplateRequest,
) -> Result<CustomTemplate, String> {
    if request.name.trim().is_empty() {
        return Err("模板名称不能为空".to_string());
    }
    if request.prompt_md.trim().is_empty() {
        return Err("提示词不能为空".to_string());
    }

    let path = template_path(template_id);
    if !path.exists() {
        return Err(format!("模板 {} 不存在", template_id));
    }

    let existing_content =
        fs::read_to_string(&path).map_err(|e| format!("读取模板文件失败: {e}"))?;
    let existing: CustomTemplate =
        serde_json::from_str(&existing_content).map_err(|e| format!("解析模板文件失败: {e}"))?;

    let intent = request.intent.clone().or_else(|| Some(infer_intent(&request)));
    let updated = CustomTemplate {
        id: existing.id,
        name: request.name.trim().to_string(),
        description: request.description.trim().to_string(),
        category: existing.category,
        style_summary: existing.style_summary,
        style_md: request.style_md.unwrap_or(existing.style_md),
        prompt_md: request.prompt_md,
        default_report_period: existing.default_report_period,
        default_output_shape: request
            .default_output_shape
            .unwrap_or(existing.default_output_shape),
        output_shapes: request.output_shapes.unwrap_or(existing.output_shapes),
        requires_raw_notes_consent: request
            .requires_raw_notes_consent
            .unwrap_or(existing.requires_raw_notes_consent),
        default_capabilities: existing.default_capabilities,
        optional_capabilities: existing.optional_capabilities,
        created_at: existing.created_at,
        source: existing.source,
        intent,
    };

    let content =
        serde_json::to_string_pretty(&updated).map_err(|e| format!("序列化模板失败: {e}"))?;
    fs::write(&path, content).map_err(|e| format!("写入模板文件失败: {e}"))?;

    Ok(updated)
}

fn infer_intent(request: &CreateCustomTemplateRequest) -> crate::types::TemplateIntent {
    crate::types::TemplateIntent {
        question: request.prompt_md.trim().to_string(),
        use_case: request.description.trim().to_string(),
        output_use: request
            .default_output_shape
            .clone()
            .unwrap_or_else(|| "report".to_string()),
        tone: request.style_md.clone().unwrap_or_default(),
        raw_text_policy: if request.requires_raw_notes_consent.unwrap_or(false) {
            "required".to_string()
        } else {
            "optional".to_string()
        },
    }
}

pub fn delete_custom_template(template_id: &str) -> Result<bool, String> {
    let path = template_path(template_id);
    if !path.exists() {
        return Err(format!("模板 {} 不存在", template_id));
    }
    fs::remove_file(&path).map_err(|e| format!("删除模板文件失败: {e}"))?;
    Ok(true)
}
