use crate::types::{AppConfig, TelemetryPingResult};
use serde::Serialize;
use uuid::Uuid;

const DEFAULT_ENDPOINT: &str = "https://duosl.dpdns.org/v1/installations/ping";
const ENDPOINT: Option<&str> = option_env!("WEREAD_TELEMETRY_ENDPOINT");
const APP_NAME: &str = match option_env!("WEREAD_TELEMETRY_APP_NAME") {
    Some(value) => value,
    None => env!("CARGO_PKG_NAME"),
};
const CHANNEL: &str = {
    if cfg!(debug_assertions) {
        "dev"
    } else {
        match option_env!("WEREAD_APP_CHANNEL") {
            Some(value) => value,
            None => "release",
        }
    }
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TelemetryPingPayload {
    schema_version: u8,
    app_name: String,
    installation_id: String,
    app_version: String,
    app_channel: String,
    platform: String,
    arch: String,
    locale: Option<String>,
}

pub fn endpoint_configured() -> bool {
    telemetry_endpoint().is_some()
}

pub fn set_enabled(enabled: bool) -> Result<AppConfig, String> {
    let mut config = AppConfig::load();
    config.telemetry_enabled = Some(enabled);
    config.save()?;
    Ok(config)
}

pub fn reset_installation_id() -> Result<AppConfig, String> {
    let mut config = AppConfig::load();
    config.telemetry_installation_id = Some(new_installation_id());
    config.save()?;
    Ok(config)
}

pub async fn send_startup_ping() -> Result<TelemetryPingResult, String> {
    let mut config = AppConfig::load();
    if !config.telemetry_enabled() {
        return Ok(TelemetryPingResult {
            sent: false,
            message: "匿名统计已关闭".to_string(),
        });
    }

    let installation_id = match config.telemetry_installation_id.clone() {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            let value = new_installation_id();
            config.telemetry_installation_id = Some(value.clone());
            config.save()?;
            value
        }
    };

    let Some(endpoint) = telemetry_endpoint() else {
        return Ok(TelemetryPingResult {
            sent: false,
            message: "未配置统计端点".to_string(),
        });
    };

    let payload = TelemetryPingPayload {
        schema_version: 1,
        app_name: APP_NAME.to_string(),
        installation_id,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        app_channel: CHANNEL.to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        locale: std::env::var("LANG").ok(),
    };

    let response = reqwest::Client::new()
        .post(endpoint)
        .json(&payload)
        .send()
        .await;

    match response {
        Ok(response) if response.status().is_success() => Ok(TelemetryPingResult {
            sent: true,
            message: "匿名统计已发送".to_string(),
        }),
        Ok(response) => Ok(TelemetryPingResult {
            sent: false,
            message: format!("统计端点返回 {}", response.status()),
        }),
        Err(error) => Ok(TelemetryPingResult {
            sent: false,
            message: format!("统计请求失败: {error}"),
        }),
    }
}

fn telemetry_endpoint() -> Option<&'static str> {
    let endpoint = ENDPOINT
        .map(str::trim)
        .filter(|value| value.starts_with("https://"))
        .unwrap_or(DEFAULT_ENDPOINT);
    Some(endpoint)
}

fn new_installation_id() -> String {
    Uuid::new_v4().to_string()
}
