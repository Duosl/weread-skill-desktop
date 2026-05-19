use crate::api::WeReadClient;
use crate::types::AppConfig;
use tokio::sync::RwLock;

pub struct RuntimeState {
    pub client: RwLock<Option<WeReadClient>>,
}

impl RuntimeState {
    pub fn new() -> Self {
        let config = AppConfig::load();
        let client = config.api_key.map(WeReadClient::new);
        Self {
            client: RwLock::new(client),
        }
    }

    pub async fn set_api_key(&self, api_key: String) {
        *self.client.write().await = Some(WeReadClient::new(api_key));
    }

    pub async fn clear_api_key(&self) {
        *self.client.write().await = None;
    }

    pub async fn client(&self) -> Result<WeReadClient, String> {
        self.client
            .read()
            .await
            .clone()
            .ok_or_else(|| "请先配置 API Key".to_string())
    }
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self::new()
    }
}
