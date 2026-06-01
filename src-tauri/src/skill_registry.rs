use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use tauri::AppHandle;
use tauri::Manager;
use serde::Serialize;

/// 补充 skill 的元数据 + 完整内容
#[allow(dead_code)]
pub struct SupplementarySkill {
    pub name: String,
    pub description: String,
    pub content: String,
}

/// 返回给前端的 skill 摘要（不含完整内容）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct SkillSummary {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SkillEntry {
    pub name: String,
    pub description: String,
    pub is_core: bool,
    pub lazy_content: Arc<LazySkillContent>,
}

#[derive(Debug, Clone)]
pub enum LazySkillContent {
    File { path: PathBuf },
    Inline { content: String },
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct Manifest {
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub gateway_tool: Option<String>,
    pub apis: HashMap<String, ManifestApi>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ManifestApi {
    pub handler: String,
    pub doc: String,
    pub privacy_level: String,
    #[serde(default)]
    pub requires_consent: bool,
    #[serde(default)]
    pub required: Vec<String>,
}

#[allow(dead_code)]
pub struct SkillRegistry {
    pub manifest: Manifest,
    pub docs: HashMap<String, String>,
    pub skill_md: String,
    /// 额外内置 skill 的 SKILL.md 内容（如 frontend-design、xhs-visual-director）
    pub supplementary_skills: Vec<SupplementarySkill>,
    pub entries: Vec<SkillEntry>,
}

static REGISTRY: OnceLock<SkillRegistry> = OnceLock::new();

#[allow(dead_code)]
pub fn init(app: &AppHandle) {
    let resource_dir = app
        .path()
        .resource_dir()
        .expect("failed to resolve resource dir");
    let skill_dir = resource_dir.join("skills").join("weread");

    // Load manifest
    let manifest_path = skill_dir.join("manifest.json");
    let manifest_str = std::fs::read_to_string(&manifest_path)
        .unwrap_or_else(|e| panic!("failed to read manifest.json at {:?}: {}", manifest_path, e));
    let manifest: Manifest =
        serde_json::from_str(&manifest_str).expect("failed to parse manifest.json");

    // Load all skill markdown docs referenced by manifest
    let mut docs = HashMap::new();
    for api in manifest.apis.values() {
        if !docs.contains_key(&api.doc) {
            let doc_path = skill_dir.join(&api.doc);
            if let Ok(content) = std::fs::read_to_string(&doc_path) {
                docs.insert(api.doc.clone(), content);
            }
        }
    }

    // Always load SKILL.md
    let skill_md_path = skill_dir.join("SKILL.md");
    let skill_md = std::fs::read_to_string(&skill_md_path)
        .unwrap_or_else(|e| panic!("failed to read SKILL.md at {:?}: {}", skill_md_path, e));

    let mut entries = Vec::new();
    {
        let (name, description) = parse_frontmatter(&skill_md);
        entries.push(SkillEntry {
            name: name.unwrap_or_else(|| manifest.name.clone()),
            description: description.unwrap_or_else(|| "应用内置核心数据能力声明。Skill 文档定义接口语义、参数、返回值和工作流；实际数据获取通过统一数据网关执行。".to_string()),
            is_core: true,
            lazy_content: Arc::new(LazySkillContent::File { path: skill_md_path.clone() }),
        });
    }

    // Load supplementary skills (non-weread dirs with SKILL.md at root)
    let mut supplementary_skills = Vec::new();
    let skills_root = resource_dir.join("skills");
    if let Ok(entries_dir) = std::fs::read_dir(&skills_root) {
        for entry in entries_dir.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if dir_name == "weread" {
                continue;
            }
            let skill_md_path = path.join("SKILL.md");
            if let Ok(content) = std::fs::read_to_string(&skill_md_path) {
                let (name, description) = parse_frontmatter(&content);
                let name = name.unwrap_or_else(|| dir_name.to_string());
                let description = description.unwrap_or_else(|| format!("{} 能力", name));
                supplementary_skills.push(SupplementarySkill {
                    name: name.clone(),
                    description: description.clone(),
                    content: content.clone(),
                });
                entries.push(SkillEntry {
                    name,
                    description,
                    is_core: false,
                    lazy_content: Arc::new(LazySkillContent::Inline { content }),
                });
            }
        }
    }

    let _ = REGISTRY.set(SkillRegistry {
        manifest,
        docs,
        skill_md,
        supplementary_skills,
        entries,
    });
}

#[allow(dead_code)]
pub fn registry() -> &'static SkillRegistry {
    REGISTRY.get().expect("SkillRegistry not initialized")
}

/// Validate a gateway request against the manifest.
/// Returns Ok(ManifestApi) if valid, Err(message) if invalid.
pub fn validate_request(api_name: &str, params: &serde_json::Value) -> Result<&'static ManifestApi, String> {
    let reg = registry();

    // 1. Check api_name is in whitelist
    let api_entry = reg.manifest.apis.get(api_name).ok_or_else(|| {
        format!("接口「{}」不在允许的技能列表中", api_name)
    })?;

    // 2. Check required params
    for required in &api_entry.required {
        let has_param = params
            .get(required)
            .map(|v| !v.is_null())
            .unwrap_or(false);
        if !has_param {
            return Err(format!("缺少必填参数: {}", required));
        }
    }

    Ok(api_entry)
}

/// Render L1 metadata catalog for system prompt injection.
pub fn render_skills_prompt() -> String {
    let reg = registry();
    let mut lines = Vec::new();
    lines.push("## 可用能力（L1 元数据）".to_string());
    lines.push(String::new());
    lines.push("启动时只加载元数据，不预载完整 Skill 指令。当用户意图明确命中某个能力时，再调用 `load_skill` 加载完整文档；当需要真实数据时，再调用 `invoke_data_gateway`。".to_string());
    lines.push(String::new());

    for entry in &reg.entries {
        lines.push(format!("- **{}**：{}", entry.name, entry.description));
    }

    lines.push(String::new());
    lines.push("命中规则：优先根据用户意图匹配 name / description；只有在即将使用该能力时，才加载完整 Skill 正文。".to_string());

    lines.join("\n")
}

/// Get the list of all allowed API names.
#[allow(dead_code)]
pub fn allowed_apis() -> Vec<&'static str> {
    registry().manifest.apis.keys().map(|s| s.as_str()).collect()
}

/// Check if an API requires user consent.
#[allow(dead_code)]
pub fn requires_consent(api_name: &str) -> bool {
    registry()
        .manifest
        .apis
        .get(api_name)
        .map(|a| a.requires_consent)
        .unwrap_or(false)
}

/// Get the privacy level of an API.
#[allow(dead_code)]
pub fn privacy_level(api_name: &str) -> Option<&'static str> {
    registry()
        .manifest
        .apis
        .get(api_name)
        .map(|a| a.privacy_level.as_str())
}

/// 返回所有可用 skill 的摘要（名称 + 描述），供系统提示词使用。
#[allow(dead_code)]
pub fn skill_summaries() -> Vec<SkillSummary> {
    let reg = registry();
    reg.entries
        .iter()
        .map(|entry| SkillSummary {
            name: entry.name.clone(),
            description: entry.description.clone(),
        })
        .collect()
}

/// 按名称加载 skill 完整内容。找到返回 Some(content)，否则返回 None。
pub fn load_skill_content(skill_name: &str) -> Option<String> {
    let reg = registry();
    reg.entries
        .iter()
        .find(|entry| entry.name == skill_name)
        .and_then(|entry| match entry.lazy_content.as_ref() {
            LazySkillContent::File { path } => std::fs::read_to_string(path).ok(),
            LazySkillContent::Inline { content } => Some(content.clone()),
        })
}

/// 解析 SKILL.md 的 YAML frontmatter，提取 name 和 description。
fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    let trimmed = content.trim();
    if !trimmed.starts_with("---") {
        return (None, None);
    }
    let after_first = &trimmed[3..];
    let end = after_first.find("---").unwrap_or(0);
    let fm = &after_first[..end];
    let mut name = None;
    let mut description = None;
    for line in fm.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("name:") {
            name = Some(val.trim().trim_matches('"').to_string());
        } else if let Some(val) = line.strip_prefix("description:") {
            description = Some(val.trim().trim_matches('"').to_string());
        }
    }
    (name, description)
}
