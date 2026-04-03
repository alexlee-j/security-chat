//! Security Chat - Tauri Backend
//!
//! A secure messaging application with end-to-end encryption using the Signal protocol.
//! R2-1, R2-2 修复：使用内存存储，统一命令命名
//! Week 10: 添加 SQLite 本地消息持久化

mod signal;
mod api;
mod db;

use api::commands::{
    AppState,
    initialize_identity_command,
    get_prekey_bundle_command,
    establish_session_command,
    encrypt_message_command,
    decrypt_message_command,
    set_current_user_command,
};
use db::commands::{
    AppDbState,
    db_save_message,
    db_get_messages,
    db_save_conversation,
    db_get_conversations,
    db_save_draft,
    db_get_draft,
    db_delete_draft,
    db_mark_message_read,
    db_get_unread_count,
    keychain_store,
    keychain_retrieve,
};
use std::path::PathBuf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize app state with in-memory store (R2-1 修复)
    let app_state = AppState::new().expect("Failed to create AppState");

    // Initialize database state with SQLite
    // 使用应用数据目录存储数据库
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("security-chat");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
    let db_path = app_dir.join("security-chat.db");
    let app_db_state = AppDbState::new(db_path).expect("Failed to create AppDbState");

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .manage(app_db_state)
        .invoke_handler(tauri::generate_handler![
            initialize_identity_command,
            get_prekey_bundle_command,
            establish_session_command,
            encrypt_message_command,
            decrypt_message_command,
            set_current_user_command,
            db_save_message,
            db_get_messages,
            db_save_conversation,
            db_get_conversations,
            db_save_draft,
            db_get_draft,
            db_delete_draft,
            db_mark_message_read,
            db_get_unread_count,
            keychain_store,
            keychain_retrieve,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
