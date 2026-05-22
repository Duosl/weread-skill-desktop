use crate::types::{AppConfig, AppSettings};
use dirs::home_dir;
use std::fs;
use std::path::PathBuf;

const CONFIG_DIR_NAME: &str = ".weread-desktop";
const CONFIG_FILE_NAME: &str = "config.json";
pub const DEFAULT_CACHE_TTL_SECONDS: i64 = 24 * 60 * 60;
pub const MIN_CACHE_TTL_SECONDS: i64 = 30 * 60;

impl AppConfig {
    pub fn config_path() -> PathBuf {
        home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(CONFIG_DIR_NAME)
            .join(CONFIG_FILE_NAME)
    }

    pub fn default_export_dir() -> PathBuf {
        home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Documents")
            .join("WereadNotes")
    }

    pub fn load() -> Self {
        let config_path = Self::config_path();
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(mut config) = serde_json::from_str::<AppConfig>(&content) {
                config.config_path = config_path;
                return config;
            }
        }

        Self {
            api_key: None,
            last_export_dir: Some(Self::default_export_dir().to_string_lossy().to_string()),
            default_format: Some("markdown".to_string()),
            cache_ttl_seconds: Some(DEFAULT_CACHE_TTL_SECONDS),
            ima_client_id: None,
            ima_api_key: None,
            ima_knowledge_base_id: None,
            ima_knowledge_base_name: None,
            config_path,
        }
    }

    pub fn save(&self) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败: {e}"))?;
        }
        let content =
            serde_json::to_string_pretty(self).map_err(|e| format!("序列化配置失败: {e}"))?;
        fs::write(&self.config_path, content).map_err(|e| format!("写入配置文件失败: {e}"))
    }

    pub fn masked_api_key(&self) -> Option<String> {
        Self::masked_secret(self.api_key.as_deref())
    }

    pub fn masked_ima_client_id(&self) -> Option<String> {
        Self::masked_secret(self.ima_client_id.as_deref())
    }

    pub fn masked_ima_api_key(&self) -> Option<String> {
        Self::masked_secret(self.ima_api_key.as_deref())
    }

    fn masked_secret(value: Option<&str>) -> Option<String> {
        value.map(|key| {
            if key.len() <= 8 {
                "****".to_string()
            } else {
                format!("{}****{}", &key[..4], &key[key.len() - 4..])
            }
        })
    }

    pub fn to_settings(&self) -> AppSettings {
        AppSettings {
            api_key_set: self.api_key.is_some(),
            api_key_masked: self.masked_api_key(),
            api_key_full: self.api_key.clone(),
            last_export_dir: self
                .last_export_dir
                .clone()
                .unwrap_or_else(|| Self::default_export_dir().to_string_lossy().to_string()),
            default_format: self
                .default_format
                .clone()
                .unwrap_or_else(|| "markdown".to_string()),
            cache_ttl_seconds: self.cache_ttl_seconds(),
            ima_client_id_set: self.ima_client_id.is_some(),
            ima_client_id_masked: self.masked_ima_client_id(),
            ima_client_id_full: self.ima_client_id.clone(),
            ima_api_key_set: self.ima_api_key.is_some(),
            ima_api_key_masked: self.masked_ima_api_key(),
            ima_api_key_full: self.ima_api_key.clone(),
            ima_knowledge_base_id: self.ima_knowledge_base_id.clone(),
            ima_knowledge_base_name: self.ima_knowledge_base_name.clone(),
        }
    }

    pub fn cache_ttl_seconds(&self) -> i64 {
        self.cache_ttl_seconds
            .unwrap_or(DEFAULT_CACHE_TTL_SECONDS)
            .max(MIN_CACHE_TTL_SECONDS)
    }
}
