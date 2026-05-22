use crate::cache::ApiCache;
use crate::types::{
    AppConfig, ImaConnectionTestResult, ImaKnowledgeBaseOption, ImaKnowledgeBasePage,
};
use reqwest::Client;
use serde_json::{json, Value};

const IMA_API_BASE_URL: &str = "https://ima.qq.com";
const IMA_WIKI_BASE_PATH: &str = "openapi/wiki/v1";
const IMA_NOTE_BASE_PATH: &str = "openapi/note/v1";
const IMA_KNOWLEDGE_BASE_CACHE_API: &str = "ima/search_knowledge_base/all_own";
const IMA_KNOWLEDGE_BASE_CACHE_TTL_SECONDS: i64 = 24 * 60 * 60;

pub struct ImaClient {
    client: Client,
    client_id: String,
    api_key: String,
}

impl ImaClient {
    pub fn from_config(config: &AppConfig) -> Result<Self, String> {
        let client_id = config
            .ima_client_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "请先配置 ima Client ID".to_string())?;
        let api_key = config
            .ima_api_key
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "请先配置 ima API Key".to_string())?;

        Ok(Self {
            client: Client::new(),
            client_id: client_id.to_string(),
            api_key: api_key.to_string(),
        })
    }

    async fn post(&self, path: &str, body: Value) -> Result<Value, String> {
        self.post_to(IMA_WIKI_BASE_PATH, path, body).await
    }

    async fn post_note(&self, path: &str, body: Value) -> Result<Value, String> {
        self.post_to(IMA_NOTE_BASE_PATH, path, body).await
    }

    async fn post_to(&self, base_path: &str, path: &str, body: Value) -> Result<Value, String> {
        let url = format!("{IMA_API_BASE_URL}/{base_path}/{path}");
        let response = self
            .client
            .post(url)
            .header("ima-openapi-clientid", &self.client_id)
            .header("ima-openapi-apikey", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("ima 网络请求失败: {e}"))?;

        let status = response.status().as_u16();
        let text = response
            .text()
            .await
            .map_err(|e| format!("读取 ima 响应失败: {e}"))?;
        if status != 200 {
            let detail = text.chars().take(400).collect::<String>();
            return Err(match status {
                401 | 403 => {
                    format!("ima 连接失败：Client ID 或 API Key 无效，或当前账号没有权限。响应：{detail}")
                }
                _ => format!("ima 请求失败 (HTTP {status})：{detail}"),
            });
        }

        let value: Value =
            serde_json::from_str(&text).map_err(|e| format!("解析 ima 响应失败: {e}"))?;
        let code = value.get("code").and_then(Value::as_i64).unwrap_or(0);
        if code != 0 {
            let message = value
                .get("msg")
                .and_then(Value::as_str)
                .unwrap_or("ima 返回未知错误");
            return Err(format!("ima 请求失败：{message}"));
        }
        Ok(value.get("data").cloned().unwrap_or(value))
    }

    pub async fn list_own_knowledge_bases(
        &self,
        cursor: Option<String>,
        limit: Option<u32>,
        force_refresh: bool,
    ) -> Result<ImaKnowledgeBasePage, String> {
        let limit = limit.unwrap_or(20).clamp(1, 20);
        let requested_cursor = cursor.unwrap_or_default();
        let cache_request = json!({
            "query": "",
            "scope": "own-created-personal",
            "clientIdFingerprint": fingerprint(&self.client_id),
        });

        if !force_refresh {
            if let Some(cached) = ApiCache::read(
                IMA_KNOWLEDGE_BASE_CACHE_API,
                &cache_request,
                IMA_KNOWLEDGE_BASE_CACHE_TTL_SECONDS,
            ) {
                let page: ImaKnowledgeBasePage = serde_json::from_value(cached)
                    .map_err(|e| format!("解析 ima 知识库缓存失败: {e}"))?;
                return Ok(slice_cached_knowledge_base_page(
                    page,
                    &requested_cursor,
                    limit,
                ));
            }
        }

        let mut items = Vec::new();
        let mut next_cursor = String::new();
        let is_end;

        loop {
            let data = self
                .post(
                    "search_knowledge_base",
                    json!({
                        "query": "",
                        "cursor": next_cursor,
                        "limit": limit,
                    }),
                )
                .await?;
            let page = parse_knowledge_base_network_page(&data);
            items.extend(page.items);
            let page_is_end = page.is_end;
            match page.next_cursor {
                Some(cursor) if !cursor.is_empty() && !page_is_end => {
                    next_cursor = cursor;
                }
                _ => {
                    is_end = page_is_end;
                    break;
                }
            }
        }

        let page = ImaKnowledgeBasePage {
            items,
            next_cursor: None,
            is_end,
        };
        let cached_page =
            serde_json::to_value(&page).map_err(|e| format!("序列化 ima 知识库缓存失败: {e}"))?;
        ApiCache::write(IMA_KNOWLEDGE_BASE_CACHE_API, &cache_request, &cached_page)?;
        Ok(slice_cached_knowledge_base_page(
            page,
            &requested_cursor,
            limit,
        ))
    }

    pub async fn test_connection(&self) -> Result<ImaConnectionTestResult, String> {
        let page = self.list_own_knowledge_bases(None, Some(20), true).await?;
        let count = page.items.len();
        let message = if count == 0 {
            "ima 连接成功，但没有找到你自己创建的个人知识库。请先在 ima 中手动创建一个知识库。"
                .to_string()
        } else {
            format!("ima 连接成功，找到 {count} 个你自己创建的个人知识库。")
        };
        Ok(ImaConnectionTestResult {
            ok: true,
            message,
            knowledge_bases: page.items,
        })
    }

    pub async fn find_note_by_title(&self, title: &str) -> Result<Option<String>, String> {
        let data = self
            .post_note(
                "search_note",
                json!({
                    "search_type": 0,
                    "query_info": { "title": title },
                    "start": 0,
                    "end": 20,
                }),
            )
            .await?;
        Ok(parse_note_search_result(&data, title))
    }

    pub async fn import_markdown_note(&self, content: &str) -> Result<String, String> {
        if content.is_empty() {
            return Err("ima 笔记内容为空，无法同步".to_string());
        }
        let data = self
            .post_note(
                "import_doc",
                json!({
                    "content_format": 1,
                    "content": content,
                }),
            )
            .await?;
        parse_note_id(&data).ok_or_else(|| "ima 已创建笔记但未返回笔记 ID".to_string())
    }

    pub async fn add_note_to_knowledge_base(
        &self,
        knowledge_base_id: &str,
        title: &str,
        note_id: &str,
    ) -> Result<String, String> {
        let data = self
            .post(
                "add_knowledge",
                json!({
                    "media_type": 11,
                    "note_info": { "content_id": note_id },
                    "title": title,
                    "knowledge_base_id": knowledge_base_id,
                }),
            )
            .await?;
        parse_media_id(&data).ok_or_else(|| "ima 已添加到知识库但未返回条目 ID".to_string())
    }
}

fn slice_cached_knowledge_base_page(
    page: ImaKnowledgeBasePage,
    cursor: &str,
    limit: u32,
) -> ImaKnowledgeBasePage {
    let start = cursor.parse::<usize>().unwrap_or(0);
    let limit = limit as usize;
    if limit == 0 {
        return ImaKnowledgeBasePage {
            items: Vec::new(),
            next_cursor: None,
            is_end: true,
        };
    }
    let total = page.items.len();
    let end = start.saturating_add(limit).min(total);
    let items = if start < total {
        page.items[start..end].to_vec()
    } else {
        Vec::new()
    };
    let next_cursor = if end < total {
        Some(end.to_string())
    } else {
        None
    };
    ImaKnowledgeBasePage {
        items,
        is_end: next_cursor.is_none(),
        next_cursor,
    }
}

fn parse_knowledge_base_network_page(data: &Value) -> ImaKnowledgeBasePage {
    let items_value = data
        .get("addable_knowledge_base_list")
        .or_else(|| data.get("addableKnowledgeBaseList"))
        .or_else(|| data.get("info_list"))
        .or_else(|| data.get("infoList"))
        .or_else(|| data.get("infos"))
        .or_else(|| data.get("knowledge_bases"))
        .or_else(|| data.get("list"))
        .or_else(|| data.get("items"));
    let items = items_value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter(|item| is_personal_created_knowledge_base(item))
                .filter_map(parse_knowledge_base)
                .collect()
        })
        .unwrap_or_default();
    let next_cursor = data
        .get("next_cursor")
        .or_else(|| data.get("nextCursor"))
        .or_else(|| data.get("cursor"))
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let is_end = data
        .get("is_end")
        .or_else(|| data.get("isEnd"))
        .and_then(Value::as_bool)
        .unwrap_or_else(|| next_cursor.is_none());

    ImaKnowledgeBasePage {
        items,
        next_cursor,
        is_end,
    }
}

fn parse_knowledge_base(value: &Value) -> Option<ImaKnowledgeBaseOption> {
    let id = value
        .get("id")
        .or_else(|| value.get("kb_id"))
        .or_else(|| value.get("knowledge_base_id"))
        .or_else(|| value.get("knowledgeBaseId"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    if id.is_empty() {
        return None;
    }
    let name = value
        .get("name")
        .or_else(|| value.get("kb_name"))
        .or_else(|| value.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("未命名知识库")
        .to_string();
    Some(ImaKnowledgeBaseOption { id, name })
}

fn parse_note_search_result(data: &Value, expected_title: &str) -> Option<String> {
    let items = data
        .get("search_note_infos")
        .or_else(|| data.get("searchNoteInfos"))
        .or_else(|| data.get("list"))
        .or_else(|| data.get("items"))
        .and_then(Value::as_array)?;

    items.iter().find_map(|item| {
        let note = item
            .get("note_book_info")
            .or_else(|| item.get("noteBookInfo"))
            .unwrap_or(item);
        let title = note
            .get("title")
            .or_else(|| note.get("doc_title"))
            .and_then(Value::as_str)
            .unwrap_or_default();
        if title.trim() != expected_title.trim() {
            return None;
        }
        parse_note_id(note)
    })
}

fn parse_note_id(value: &Value) -> Option<String> {
    value
        .get("note_id")
        .or_else(|| value.get("noteId"))
        .or_else(|| value.get("content_id"))
        .or_else(|| value.get("contentId"))
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn parse_media_id(value: &Value) -> Option<String> {
    value
        .get("media_id")
        .or_else(|| value.get("mediaId"))
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn is_personal_created_knowledge_base(value: &Value) -> bool {
    let role_type = value
        .get("role_type")
        .or_else(|| value.get("roleType"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    let base_type = value
        .get("base_type")
        .or_else(|| value.get("baseType"))
        .and_then(Value::as_str)
        .unwrap_or_default();

    role_type == "创建者" && base_type == "个人知识库"
}

fn fingerprint(value: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}
