mod api;
mod cache;
mod commands;
mod config;
mod export;
mod state;
mod types;

use state::RuntimeState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_api_key,
            commands::clear_api_key,
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
            commands::export_to_json,
            commands::open_export_folder,
            commands::open_in_weread,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
