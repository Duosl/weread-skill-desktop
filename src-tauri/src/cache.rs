use crate::types::{ApiCacheEntry, ApiCacheInfo};
use chrono::Utc;
use dirs::home_dir;
use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::PathBuf;

const CACHE_DIR_NAME: &str = ".weread-desktop";
const API_CACHE_DIR: &str = "cache/api";
const API_LOG_DIR: &str = "logs";
const API_LOG_FILE: &str = "api-requests.ndjson";

pub struct ApiCache;

impl ApiCache {
    pub fn cache_root() -> PathBuf {
        home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(CACHE_DIR_NAME)
    }

    pub fn api_cache_dir() -> PathBuf {
        Self::cache_root().join(API_CACHE_DIR)
    }

    pub fn request_log_path() -> PathBuf {
        Self::cache_root().join(API_LOG_DIR).join(API_LOG_FILE)
    }

    pub fn read(api_name: &str, request_body: &Value, ttl_seconds: i64) -> Option<Value> {
        let path = Self::entry_path(api_name, request_body);
        let content = fs::read_to_string(path).ok()?;
        let entry = serde_json::from_str::<ApiCacheEntry>(&content).ok()?;
        let age_seconds = Utc::now().timestamp().saturating_sub(entry.fetched_at);
        if age_seconds > ttl_seconds {
            return None;
        }
        Some(entry.response)
    }

    pub fn write(api_name: &str, request_body: &Value, response: &Value) -> Result<(), String> {
        let path = Self::entry_path(api_name, request_body);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建 API 缓存目录失败: {e}"))?;
        }

        let entry = ApiCacheEntry {
            api_name: api_name.to_string(),
            skill_version: request_body
                .get("skill_version")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            request: request_body.clone(),
            fetched_at: Utc::now().timestamp(),
            response: response.clone(),
        };
        let content = serde_json::to_string_pretty(&entry)
            .map_err(|e| format!("序列化 API 缓存失败: {e}"))?;
        fs::write(&path, content).map_err(|e| format!("写入 API 缓存失败: {e}"))?;
        Self::append_request_log(api_name, request_body, response, &path)?;
        Ok(())
    }

    pub fn clear() -> Result<(), String> {
        let dir = Self::api_cache_dir();
        if dir.exists() {
            fs::remove_dir_all(&dir).map_err(|e| format!("清理 API 缓存失败: {e}"))?;
        }
        Ok(())
    }

    pub fn info() -> ApiCacheInfo {
        let dir = Self::api_cache_dir();
        let mut entry_count = 0usize;
        let mut total_bytes = 0u64;
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        entry_count += 1;
                        total_bytes += metadata.len();
                    }
                }
            }
        }

        ApiCacheInfo {
            cache_dir: dir.to_string_lossy().to_string(),
            request_log_path: Self::request_log_path().to_string_lossy().to_string(),
            entry_count,
            total_bytes,
        }
    }

    fn entry_path(api_name: &str, request_body: &Value) -> PathBuf {
        let key = cache_key(api_name, request_body);
        Self::api_cache_dir().join(format!("{key}.json"))
    }

    fn append_request_log(
        api_name: &str,
        request_body: &Value,
        response: &Value,
        cache_path: &PathBuf,
    ) -> Result<(), String> {
        let path = Self::request_log_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建 API 日志目录失败: {e}"))?;
        }
        let record = json!({
            "time": Utc::now().to_rfc3339(),
            "apiName": api_name,
            "cachePath": cache_path,
            "request": request_body,
            "response": response
        });
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| format!("打开 API 请求日志失败: {e}"))?;
        writeln!(file, "{record}").map_err(|e| format!("写入 API 请求日志失败: {e}"))
    }
}

fn cache_key(api_name: &str, request_body: &Value) -> String {
    let source = format!("{api_name}:{}", request_body);
    format!("{:016x}", fnv1a64(source.as_bytes()))
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
