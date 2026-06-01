use crate::api::WeReadClient;
use crate::cache::ApiCache;
use crate::report;
use crate::skill_registry;
use crate::types::{AppConfig, ConsentRequest, DataAccessRecord};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::io::Write;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayArgs {
    pub api_name: String,
    #[serde(flatten)]
    pub params: std::collections::HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayResult {
    pub success: bool,
    pub api_name: String,
    pub data: Option<Value>,
    pub error: Option<String>,
    /// True when the API requires user consent before execution.
    pub requires_consent: Option<bool>,
    /// The API name that needs consent.
    pub consent_api: Option<String>,
    pub privacy_level: Option<String>,
    pub access_record: Option<DataAccessRecord>,
    pub consent_request: Option<ConsentRequest>,
}

#[derive(Debug, Clone)]
struct PrivacyDescriptor {
    display_name: &'static str,
    data_categories: &'static [&'static str],
    data_category_labels: &'static [&'static str],
    contains_raw_text: bool,
    denial_effect: &'static str,
}

fn append_gateway_failure_record(call_id: Option<&str>, api_name: &str, params: &Value, result: &GatewayResult) {
    if result.success {
        return;
    }

    let record = json!({
        "time": Utc::now().to_rfc3339(),
        "callId": call_id.unwrap_or_default(),
        "apiName": api_name,
        "requestParams": params,
        "error": result.error,
        "requiresConsent": result.requires_consent,
        "consentApi": result.consent_api,
        "privacyLevel": result.privacy_level,
    });

    let path = ApiCache::cache_root()
        .join("logs")
        .join("gateway-failures.ndjson");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(file, "{record}");
    }
}

/// Render the full skill prompt (SKILL.md + all capability docs) for LLM context.
pub fn render_skills_prompt() -> String {
    skill_registry::render_skills_prompt()
}

/// The tool schema for `invoke_data_gateway`.
pub fn invoke_data_gateway_tool_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "api_name": {
                "type": "string",
                "description": "统一数据网关接口名。由 Skill 文档定义语义，网关负责白名单校验、参数校验和隐私授权；例如 /store/search、/shelf/sync、/review/list/mine"
            },
            "purpose": {
                "type": "string",
                "description": "必填。用一句面向用户的中文说明正在读取什么数据、为什么需要。例如「查看《原子习惯》的划线笔记」「读取你的个人想法列表」。该说明会直接展示给用户作为授权提示，不填会退回原始接口名。"
            }
        },
        "required": ["api_name", "purpose"],
        "additionalProperties": true
    })
}

/// Execute an `invoke_data_gateway` call.
///
/// Flow:
/// 1. Validate api_name against manifest whitelist
/// 2. Check required params
/// 3. Check privacy consent for sensitive APIs
/// 4. Special-case `export_report_html` (local write, no WeRead API)
/// 5. Call WeReadClient gateway
/// 6. Truncate large results
pub async fn invoke(client: Option<&WeReadClient>, call_id: Option<&str>, args: GatewayArgs, granted_consents: &HashSet<String>) -> GatewayResult {
    let api_name = args.api_name.clone();
    let purpose = args
        .params
        .get("purpose")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("读取相关阅读数据")
        .to_string();

    // Build params JSON (flatten the HashMap, remove api_name key)
    let params: Value = {
        let mut map = args.params.clone();
        map.remove("api_name");
        serde_json::to_value(&map).unwrap_or(json!({}))
    };

    // 1+2. Validate api_name and required params
    let api_entry = match skill_registry::validate_request(&api_name, &params) {
        Ok(entry) => entry,
        Err(e) => {
            let result = GatewayResult {
                success: false,
                api_name: api_name.clone(),
                data: None,
                error: Some(e),
                requires_consent: None,
                consent_api: None,
                privacy_level: None,
                access_record: None,
                consent_request: None,
            };
            append_gateway_failure_record(call_id, &api_name, &params, &result);
            return result;
        }
    };
    let descriptor = privacy_descriptor(&api_name);

    // 3. Check privacy consent for sensitive APIs (skip if already granted)
    let consent_key = consent_key_for_api(&api_name);
    if api_entry.requires_consent
        && !granted_consents.contains(&consent_key)
        && !granted_consents.contains(&api_name)
    {
        let access_record = build_access_record(
            "",
            &api_name,
            &purpose,
            &api_entry.privacy_level,
            "pending",
            &descriptor,
        );
        let consent_request = build_consent_request(&purpose, &descriptor);
        let result = GatewayResult {
            success: false,
            api_name: api_name.clone(),
            data: None,
            error: Some(format!(
                "「{}」需要用户授权后才能继续。",
                api_name
            )),
            requires_consent: Some(true),
            consent_api: Some(api_name.clone()),
            privacy_level: Some(api_entry.privacy_level.clone()),
            access_record: Some(access_record),
            consent_request: Some(consent_request),
        };
        append_gateway_failure_record(call_id, &api_name, &params, &result);
        return result;
    }

    // 4. Special-case: export_report_html (local write, no WeRead API call)
    if api_name == "/export/report_html" {
        return handle_export_report_html(&params).await;
    }

    // 5. Get WeReadClient
    let client = match client {
        Some(c) => c,
        None => {
            let result = GatewayResult {
                success: false,
                api_name: api_name.clone(),
                data: None,
                error: Some("微信读书 API Key 未配置，无法获取数据".to_string()),
                requires_consent: None,
                consent_api: None,
                privacy_level: None,
                access_record: None,
                consent_request: None,
            };
            append_gateway_failure_record(call_id, &api_name, &params, &result);
            return result;
        }
    };

    // 6. Call WeReadClient gateway with cache
    match client.gateway_value_with_cache(&api_name, params.clone(), false).await {
        Ok(data) => {
            let truncated = truncate_large_result(&api_name, data);
            GatewayResult {
                success: true,
                api_name: api_name.clone(),
                data: Some(truncated),
                error: None,
                requires_consent: None,
                consent_api: None,
                privacy_level: Some(api_entry.privacy_level.clone()),
                access_record: Some(build_access_record(
                    "",
                    &api_name,
                    &purpose,
                    &api_entry.privacy_level,
                    "completed",
                    &descriptor,
                )),
                consent_request: None,
            }
        }
        Err(e) => {
            let result = GatewayResult {
                success: false,
                api_name: api_name.clone(),
                data: None,
                error: Some(e),
                requires_consent: None,
                consent_api: None,
                privacy_level: None,
                access_record: Some(build_access_record(
                    "",
                    &api_name,
                    &purpose,
                    &api_entry.privacy_level,
                    "failed",
                    &descriptor,
                )),
                consent_request: None,
            };
            append_gateway_failure_record(call_id, &api_name, &params, &result);
            result
        },
    }
}

/// Handle the `export_report_html` special case: save HTML to disk.
async fn handle_export_report_html(params: &Value) -> GatewayResult {
    let api_name = "/export/report_html".to_string();

    let html = match params.get("html").and_then(|v| v.as_str()) {
        Some(h) if !h.trim().is_empty() => h,
        _ => {
            return GatewayResult {
                success: false,
                api_name,
                data: None,
                error: Some("报告 HTML 内容不能为空".to_string()),
                requires_consent: None,
                consent_api: None,
                privacy_level: None,
                access_record: None,
                consent_request: None,
            };
        }
    };

    let title = params
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("阅读报告");

    let config = AppConfig::load();
    let output_dir = config
        .last_export_dir
        .clone()
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_default()
                .join("Documents")
                .join("WereadNotes")
                .to_string_lossy()
                .to_string()
        });

    match report::export_report_html(&output_dir, title, html) {
        Ok(file_path) => GatewayResult {
            success: true,
            api_name: api_name.clone(),
            data: Some(json!({
                "filePath": file_path,
                "title": title,
            })),
            error: None,
            requires_consent: None,
            consent_api: None,
            privacy_level: Some("local-write".to_string()),
            access_record: Some(build_access_record(
                "",
                &api_name,
                "保存阅读报告到本机",
                "local-write",
                "completed",
                &privacy_descriptor(&api_name),
            )),
            consent_request: None,
        },
        Err(e) => GatewayResult {
            success: false,
            api_name: api_name.clone(),
            data: None,
            error: Some(e),
            requires_consent: None,
            consent_api: None,
            privacy_level: None,
            access_record: Some(build_access_record(
                "",
                &api_name,
                "保存阅读报告到本机",
                "local-write",
                "failed",
                &privacy_descriptor(&api_name),
            )),
            consent_request: None,
        },
    }
}

fn privacy_descriptor(api_name: &str) -> PrivacyDescriptor {
    match api_name {
        "/shelf/sync" => PrivacyDescriptor {
            display_name: "书架",
            data_categories: &["bookshelf"],
            data_category_labels: &["书架"],
            contains_raw_text: false,
            denial_effect: "跳过后，我会少一些关于书籍范围的判断。",
        },
        "/readdata/detail" => PrivacyDescriptor {
            display_name: "阅读统计",
            data_categories: &["reading_stats"],
            data_category_labels: &["阅读统计"],
            contains_raw_text: false,
            denial_effect: "跳过后，我会少一些关于阅读时长和节奏的判断。",
        },
        "/user/notebooks" => PrivacyDescriptor {
            display_name: "笔记概览",
            data_categories: &["note_overview"],
            data_category_labels: &["笔记概览"],
            contains_raw_text: false,
            denial_effect: "跳过后，我会少一些关于笔记分布的判断。",
        },
        "/book/bookmarklist" | "/book/bestbookmarks" => PrivacyDescriptor {
            display_name: "划线内容",
            data_categories: &["bookmark_raw_text"],
            data_category_labels: &["划线内容"],
            contains_raw_text: true,
            denial_effect: "跳过后，我会只用统计和笔记概览继续分析。",
        },
        "/review/list/mine" | "/review/single" => PrivacyDescriptor {
            display_name: "个人想法",
            data_categories: &["review_raw_text"],
            data_category_labels: &["个人想法"],
            contains_raw_text: true,
            denial_effect: "跳过后，我会只用统计和笔记概览继续分析。",
        },
        "/export/report_html" => PrivacyDescriptor {
            display_name: "本地报告文件",
            data_categories: &["local_report"],
            data_category_labels: &["本地报告"],
            contains_raw_text: false,
            denial_effect: "跳过后，不会保存这份报告。",
        },
        "/store/search" | "/book/info" | "/book/chapterinfo" | "/book/getprogress" => {
            PrivacyDescriptor {
                display_name: "书籍信息",
                data_categories: &["book_info"],
                data_category_labels: &["书籍信息"],
                contains_raw_text: false,
                denial_effect: "跳过后，我会少一些关于具体书籍的判断。",
            }
        }
        _ => PrivacyDescriptor {
            display_name: "阅读数据",
            data_categories: &["reading_data"],
            data_category_labels: &["阅读数据"],
            contains_raw_text: false,
            denial_effect: "跳过后，我会基于已有信息继续分析。",
        },
    }
}

pub fn consent_key_for_api(api_name: &str) -> String {
    let descriptor = privacy_descriptor(api_name);
    format!(
        "{}|{}|raw:{}",
        api_name,
        descriptor.data_categories.join("+"),
        descriptor.contains_raw_text
    )
}

fn build_consent_request(purpose: &str, descriptor: &PrivacyDescriptor) -> ConsentRequest {
    ConsentRequest {
        title: "确认读取笔记内容".to_string(),
        purpose: purpose.to_string(),
        read_description: format!("书迹 AI 需要读取{}，用于回答这次问题。", descriptor.display_name),
        destination_description: if descriptor.contains_raw_text {
            "内容会发送到你配置的 AI 服务用于分析，不会发送到书迹服务器。".to_string()
        } else {
            "这次读取主要用于整理你的阅读概览。".to_string()
        },
        denial_effect: descriptor.denial_effect.to_string(),
    }
}

fn build_access_record(
    call_id: &str,
    api_name: &str,
    purpose: &str,
    privacy_level: &str,
    status: &str,
    descriptor: &PrivacyDescriptor,
) -> DataAccessRecord {
    let status_label = match status {
        "completed" => "已读取",
        "denied" => "未读取",
        "failed" => "读取失败",
        "pending" => "等待确认",
        _ => "已处理",
    };
    DataAccessRecord {
        call_id: call_id.to_string(),
        api_name: api_name.to_string(),
        display_name: descriptor.display_name.to_string(),
        purpose: purpose.to_string(),
        data_categories: descriptor.data_categories.iter().map(|item| item.to_string()).collect(),
        data_category_labels: descriptor
            .data_category_labels
            .iter()
            .map(|item| item.to_string())
            .collect(),
        privacy_level: privacy_level.to_string(),
        contains_raw_text: descriptor.contains_raw_text,
        destination: if api_name == "/export/report_html" {
            "local_only".to_string()
        } else {
            "user_configured_llm".to_string()
        },
        scope: None,
        status: status.to_string(),
        denial_effect: descriptor.denial_effect.to_string(),
        summary_text: format!("{}：{}", status_label, descriptor.display_name),
    }
}

/// Truncate large results to avoid overwhelming the LLM context.
/// Returns the data as-is if under the threshold.
fn truncate_large_result(_api_name: &str, data: Value) -> Value {
    let serialized = serde_json::to_string(&data).unwrap_or_default();
    const MAX_CHARS: usize = 8000;

    if serialized.len() <= MAX_CHARS {
        return data;
    }

    // For array results, try to summarize
    if let Some(arr) = data.as_array() {
        let count = arr.len();
        let truncated: Vec<Value> = arr.into_iter().take(20).cloned().collect();
        let mut result = json!({
            "truncated": true,
            "total_count": count,
            "showing": truncated.len(),
            "items": truncated,
        });
        // Preserve other top-level fields
        if let Some(obj) = data.as_object() {
            for (k, v) in obj {
                if k != "books" && k != "reviews" && k != "updated" && k != "items" {
                    result[k] = v.clone();
                }
            }
        }
        return result;
    }

    // For object results, try to reduce nested arrays
    if let Some(obj) = data.as_object() {
        let mut result = data.clone();
        for (k, v) in obj {
            if let Some(arr) = v.as_array() {
                if arr.len() > 20 {
                    let truncated: Vec<Value> = arr.into_iter().take(20).cloned().collect();
                    result[k] = json!({
                        "truncated": true,
                        "total_count": arr.len(),
                        "showing": truncated.len(),
                        "items": truncated,
                    });
                }
            }
        }
        return result;
    }

    // Last resort: truncate the string representation
    let truncated_str: String = serialized.chars().take(MAX_CHARS).collect();
    json!({
        "truncated": true,
        "raw": truncated_str,
        "note": "数据过大已截断，请减少查询范围或分页查询"
    })
}
