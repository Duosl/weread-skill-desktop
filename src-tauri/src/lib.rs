mod advanced_report;
mod agent_bridge;
mod agent_gateway;
mod api;
mod cache;
mod commands;
mod config;
mod custom_templates;
mod export;
mod ima;
mod llm_chat;
mod report;
mod report_design;
mod skill_registry;
mod state;
mod system_prompt;
mod telemetry;
mod types;

use state::RuntimeState;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(RuntimeState::new()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // 初始化 Skill Registry（加载 bundled skills）
            skill_registry::init(app.handle());
            system_prompt::init();
            tauri::async_runtime::spawn(async {
                let _ = telemetry::send_startup_ping().await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_api_key,
            commands::clear_api_key,
            commands::save_ima_credentials,
            commands::clear_ima_credentials,
            commands::test_ima_connection,
            commands::list_addable_ima_knowledge_bases,
            commands::save_ima_target,
            commands::sync_books_to_ima,
            commands::save_export_settings,
            commands::save_cache_settings,
            commands::save_telemetry_enabled,
            commands::reset_telemetry_installation_id,
            commands::send_telemetry_ping,
            commands::get_api_cache_info,
            commands::clear_api_cache,
            commands::sync_shelf,
            commands::get_book_info,
            commands::get_book_progress,
            commands::get_bookmarks,
            commands::get_my_reviews,
            commands::get_notebooks,
            commands::get_reading_stats,
            commands::export_to_markdown,
            commands::export_report_html,
            commands::preview_report_html,
            commands::open_export_folder,
            commands::open_report_file,
            commands::open_report_folder,
            commands::open_in_weread,
            commands::get_app_version,
            commands::detect_local_agents,
            commands::invoke_local_agent,
            commands::cancel_local_agent,
            commands::list_advanced_report_templates,
            commands::preview_advanced_report_data_access,
            commands::create_advanced_report_job,
            commands::read_advanced_report_output,
            commands::read_advanced_report_logs,
            commands::export_advanced_report_output,
            commands::start_advanced_report_task,
            commands::list_advanced_report_tasks,
            commands::cancel_advanced_report_task,
            commands::delete_advanced_report_job,
            commands::save_image_file,
            commands::save_llm_config,
            commands::clear_llm_config,
            commands::test_llm_connection,
            commands::list_custom_templates,
            commands::create_custom_template,
            commands::delete_custom_template,
            commands::update_custom_template,
            commands::start_llm_chat,
            commands::cancel_llm_chat,
            commands::grant_consent,
            commands::deny_consent,
            commands::clear_conversation_consents,
            commands::respond_ask_user,
            commands::save_llm_report,
            commands::save_chat_as_template,
            commands::save_chat_history,
            commands::load_chat_history,
            commands::list_chat_histories,
            commands::delete_chat_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
