use crate::api::WeReadClient;
use crate::types::AppConfig;
use agent_cli_bridge::InvokeCancelHandle;
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct RuntimeState {
    pub client: RwLock<Option<WeReadClient>>,
    agent_jobs: RwLock<HashMap<String, InvokeCancelHandle>>,
    advanced_report_jobs: RwLock<HashMap<String, crate::advanced_report::AdvancedReportTask>>,
}

impl RuntimeState {
    pub fn new() -> Self {
        let config = AppConfig::load();
        let client = config.api_key.map(WeReadClient::new);
        Self {
            client: RwLock::new(client),
            agent_jobs: RwLock::new(HashMap::new()),
            advanced_report_jobs: RwLock::new(HashMap::new()),
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

    pub async fn register_agent_job(&self, job_id: String, cancel: InvokeCancelHandle) {
        self.agent_jobs.write().await.insert(job_id, cancel);
    }

    pub async fn unregister_agent_job(&self, job_id: &str) {
        self.agent_jobs.write().await.remove(job_id);
    }

    pub async fn cancel_agent_job(&self, job_id: &str) -> bool {
        let handle = self.agent_jobs.read().await.get(job_id).cloned();
        if let Some(handle) = handle {
            handle.cancel();
            true
        } else {
            false
        }
    }

    pub async fn upsert_advanced_report_task(
        &self,
        task: crate::advanced_report::AdvancedReportTask,
    ) {
        self.advanced_report_jobs
            .write()
            .await
            .insert(task.job_id.clone(), task);
    }

    pub async fn update_advanced_report_task_status(
        &self,
        job_id: &str,
        status: crate::advanced_report::AdvancedReportTaskStatus,
        message: Option<String>,
    ) {
        if let Some(task) = self.advanced_report_jobs.write().await.get_mut(job_id) {
            task.status = status;
            task.message = message;
            task.updated_at = chrono::Utc::now().to_rfc3339();
            let _ = crate::advanced_report::persist_task_snapshot(task);
        }
    }

    pub async fn advanced_report_tasks(&self) -> Vec<crate::advanced_report::AdvancedReportTask> {
        let mut tasks = self
            .advanced_report_jobs
            .read()
            .await
            .values()
            .cloned()
            .collect::<Vec<_>>();
        tasks.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        tasks
    }

    pub async fn has_active_advanced_report_template(&self, template_id: &str) -> bool {
        self.advanced_report_jobs.read().await.values().any(|task| {
            task.template_id == template_id
                && matches!(
                    task.status,
                    crate::advanced_report::AdvancedReportTaskStatus::Preparing
                        | crate::advanced_report::AdvancedReportTaskStatus::Running
                )
        })
    }

    pub async fn has_active_advanced_report_job(&self, job_id: &str) -> bool {
        self.advanced_report_jobs
            .read()
            .await
            .get(job_id)
            .map(|task| {
                matches!(
                    task.status,
                    crate::advanced_report::AdvancedReportTaskStatus::Preparing
                        | crate::advanced_report::AdvancedReportTaskStatus::Running
                )
            })
            .unwrap_or(false)
    }

    pub async fn remove_advanced_report_task(&self, job_id: &str) {
        self.advanced_report_jobs.write().await.remove(job_id);
    }
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self::new()
    }
}
