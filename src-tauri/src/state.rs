use crate::api::WeReadClient;
use crate::types::AppConfig;
use agent_cli_bridge::InvokeCancelHandle;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct RuntimeState {
    pub client: RwLock<Option<WeReadClient>>,
    agent_jobs: RwLock<HashMap<String, InvokeCancelHandle>>,
    advanced_report_jobs: RwLock<HashMap<String, crate::advanced_report::AdvancedReportTask>>,
    pub llm_chat_cancel: RwLock<HashMap<String, Arc<tokio::sync::watch::Sender<bool>>>>,
    /// Consent channels: job_id -> sender that signals when user grants consent
    pub llm_chat_consent: RwLock<HashMap<String, Arc<tokio::sync::watch::Sender<Option<bool>>>>>,
    /// Per-job granted consents: job_id -> set of structured consent keys
    pub llm_chat_granted_consents: RwLock<HashMap<String, HashSet<String>>>,
    /// Ask-user channels: job_id -> oneshot sender for user response
    pub llm_chat_ask_user: RwLock<HashMap<String, tokio::sync::oneshot::Sender<String>>>,
    /// 本次对话免审（新对话清空）
    pub conversation_granted_consents: RwLock<HashSet<String>>,
    /// 本次应用免审（重启才清空）
    pub session_granted_consents: RwLock<HashSet<String>>,
}

impl RuntimeState {
    pub fn new() -> Self {
        let config = AppConfig::load();
        let client = config.api_key.map(WeReadClient::new);
        Self {
            client: RwLock::new(client),
            agent_jobs: RwLock::new(HashMap::new()),
            advanced_report_jobs: RwLock::new(HashMap::new()),
            llm_chat_cancel: RwLock::new(HashMap::new()),
            llm_chat_consent: RwLock::new(HashMap::new()),
            llm_chat_granted_consents: RwLock::new(HashMap::new()),
            llm_chat_ask_user: RwLock::new(HashMap::new()),
            conversation_granted_consents: RwLock::new(HashSet::new()),
            session_granted_consents: RwLock::new(HashSet::new()),
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

    // ========== Consent Management ==========

    /// Register a consent channel for a job. Returns the receiver.
    pub async fn register_consent_channel(
        &self,
        job_id: String,
    ) -> tokio::sync::watch::Receiver<Option<bool>> {
        let (tx, rx) = tokio::sync::watch::channel(None);
        self.llm_chat_consent
            .write()
            .await
            .insert(job_id, Arc::new(tx));
        rx
    }

    /// Resolve consent for a job. Returns true if the channel was found.
    pub async fn resolve_consent(&self, job_id: &str, granted: bool) -> bool {
        let handle = self.llm_chat_consent.read().await.get(job_id).cloned();
        if let Some(tx) = handle {
            let _ = tx.send(Some(granted));
            self.llm_chat_consent.write().await.remove(job_id);
            true
        } else {
            false
        }
    }

    /// Grant a specific data-access consent.
    /// scope: "session" = current conversation only, "app" = until app restart
    pub async fn grant_api_consent(&self, job_id: &str, api_name: &str, scope: Option<&str>) {
        let consent_key = crate::agent_gateway::consent_key_for_api(api_name);
        // 始终记住到 job 级别（当前对话内生效）
        self.llm_chat_granted_consents
            .write()
            .await
            .entry(job_id.to_string())
            .or_insert_with(HashSet::new)
            .insert(consent_key.clone());

        if scope == Some("session") {
            // 本次对话免审：记住到对话级别（新对话清空）
            self.conversation_granted_consents
                .write()
                .await
                .insert(consent_key.clone());
        } else if scope == Some("app") {
            // 本次应用免审：记住到应用级别（重启才清空）
            self.session_granted_consents
                .write()
                .await
                .insert(consent_key);
        }
    }

    /// Get the set of granted API consents for a job (merges all levels).
    pub async fn get_granted_consents(&self, job_id: &str) -> HashSet<String> {
        let mut result = self.session_granted_consents.read().await.clone();
        result.extend(self.conversation_granted_consents.read().await.iter().cloned());
        if let Some(job_consents) = self.llm_chat_granted_consents.read().await.get(job_id) {
            result.extend(job_consents.iter().cloned());
        }
        result
    }

    /// Clear conversation-level consents (called when starting a new conversation).
    /// App-level consents persist until restart.
    pub async fn clear_conversation_consents(&self) {
        self.llm_chat_granted_consents.write().await.clear();
        self.conversation_granted_consents.write().await.clear();
    }

    /// Cleanup job-level consent state (session-level persists).
    pub async fn cleanup_consent(&self, job_id: &str) {
        self.llm_chat_consent.write().await.remove(job_id);
        self.llm_chat_granted_consents.write().await.remove(job_id);
    }

    // ========== Ask User Management ==========

    /// Register an ask-user channel for a job. Returns the receiver.
    pub async fn register_ask_user_channel(
        &self,
        job_id: String,
    ) -> tokio::sync::oneshot::Receiver<String> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.llm_chat_ask_user
            .write()
            .await
            .insert(job_id, tx);
        rx
    }

    /// Respond to an ask-user prompt. Returns true if the channel was found.
    pub async fn respond_ask_user(&self, job_id: &str, response: String) -> bool {
        let tx = self.llm_chat_ask_user.write().await.remove(job_id);
        if let Some(tx) = tx {
            tx.send(response).is_ok()
        } else {
            false
        }
    }
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self::new()
    }
}
