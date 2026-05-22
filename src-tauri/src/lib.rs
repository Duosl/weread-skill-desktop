mod advanced_report;
mod agent_bridge;
mod api;
mod cache;
mod commands;
mod config;
mod export;
mod ima;
mod report;
mod state;
mod types;

use state::RuntimeState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            commands::open_in_weread,
            commands::get_app_version,
            commands::detect_local_agents,
            commands::invoke_local_agent,
            commands::cancel_local_agent,
            commands::list_advanced_report_templates,
            commands::create_advanced_report_job,
            commands::read_advanced_report_output,
            commands::read_advanced_report_logs,
            commands::export_advanced_report_output,
            commands::start_advanced_report_task,
            commands::list_advanced_report_tasks,
            commands::cancel_advanced_report_task,
            commands::delete_advanced_report_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
