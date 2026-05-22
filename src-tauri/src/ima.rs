use crate::types::{
    AppConfig, ImaConnectionTestResult, ImaKnowledgeBaseOption, ImaKnowledgeBasePage,
};
use reqwest::Client;
use serde_json::{json, Value};

const IMA_BASE_URL: &str = "https://ima.qq.com/openapi/wiki/v1";

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
        let url = format!("{IMA_BASE_URL}/{path}");
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

    pub async fn list_addable_knowledge_bases(
        &self,
        cursor: Option<String>,
        limit: Option<u32>,
    ) -> Result<ImaKnowledgeBasePage, String> {
        let limit = limit.unwrap_or(50).clamp(1, 50);
        let data = self
            .post(
                "get_addable_knowledge_base_list",
                json!({
                    "cursor": cursor.unwrap_or_default(),
                    "limit": limit,
                }),
            )
            .await?;

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
            .map(|items| items.iter().filter_map(parse_knowledge_base).collect())
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

        Ok(ImaKnowledgeBasePage {
            items,
            next_cursor,
            is_end,
        })
    }

    pub async fn test_connection(&self) -> Result<ImaConnectionTestResult, String> {
        let page = self.list_addable_knowledge_bases(None, Some(20)).await?;
        let count = page.items.len();
        let message = if count == 0 {
            "ima 连接成功，但没有找到可添加的知识库。请先在 ima 中手动创建一个知识库。"
                .to_string()
        } else {
            format!("ima 连接成功，找到 {count} 个可添加的知识库。")
        };
        Ok(ImaConnectionTestResult {
            ok: true,
            message,
            knowledge_bases: page.items,
        })
    }
}

fn parse_knowledge_base(value: &Value) -> Option<ImaKnowledgeBaseOption> {
    let id = value
        .get("id")
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
        .or_else(|| value.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("未命名知识库")
        .to_string();
    Some(ImaKnowledgeBaseOption { id, name })
}
