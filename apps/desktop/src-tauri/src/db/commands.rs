//! Tauri Commands for Local SQLite Database
//!
//! Week 10 实现：提供数据库操作的 Tauri IPC 接口

use crate::db::local_store::{Conversation, DbStore, Draft, Message};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;

/// 应用数据库状态
pub struct AppDbState {
    pub store: DbStore,
    pub db_path: PathBuf,
}

impl AppDbState {
    /// 创建新的数据库状态
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        let store = crate::db::local_store::create_db_store(&db_path)?;
        Ok(Self { store, db_path })
    }
}

/// 初始化数据库
#[tauri::command]
pub async fn db_init(db_path: String) -> Result<bool, String> {
    let path = PathBuf::from(db_path);
    let state = AppDbState::new(path)?;
    // Store state in app managed state would be done in main.rs
    Ok(true)
}

/// 保存消息
#[tauri::command]
pub async fn db_save_message(
    msg: Message,
    state: State<'_, AppDbState>,
) -> Result<(), String> {
    let store = state.store.clone();
    let msg_clone = msg.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.save_message(&msg_clone).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 获取消息列表
#[tauri::command]
pub async fn db_get_messages(
    conversation_id: String,
    limit: u32,
    before: Option<i64>,
    state: State<'_, AppDbState>,
) -> Result<Vec<Message>, String> {
    let store = state.store.clone();
    let conv_id = conversation_id.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.get_messages(&conv_id, limit, before).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 保存会话
#[tauri::command]
pub async fn db_save_conversation(
    conv: Conversation,
    state: State<'_, AppDbState>,
) -> Result<(), String> {
    let store = state.store.clone();
    let conv_clone = conv.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.save_conversation(&conv_clone).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 获取所有会话
#[tauri::command]
pub async fn db_get_conversations(
    state: State<'_, AppDbState>,
) -> Result<Vec<Conversation>, String> {
    let store = state.store.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.get_conversations().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 保存草稿
#[tauri::command]
pub async fn db_save_draft(
    draft: Draft,
    state: State<'_, AppDbState>,
) -> Result<(), String> {
    let store = state.store.clone();
    let draft_clone = draft.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.save_draft(&draft_clone).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 获取草稿
#[tauri::command]
pub async fn db_get_draft(
    conversation_id: String,
    state: State<'_, AppDbState>,
) -> Result<Option<Draft>, String> {
    let store = state.store.clone();
    let conv_id = conversation_id.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.get_draft(&conv_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 删除草稿
#[tauri::command]
pub async fn db_delete_draft(
    conversation_id: String,
    state: State<'_, AppDbState>,
) -> Result<(), String> {
    let store = state.store.clone();
    let conv_id = conversation_id.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.delete_draft(&conv_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 标记消息已读
#[tauri::command]
pub async fn db_mark_message_read(
    message_id: String,
    state: State<'_, AppDbState>,
) -> Result<(), String> {
    let store = state.store.clone();
    let msg_id = message_id.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.mark_message_read(&msg_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 获取未读消息数量
#[tauri::command]
pub async fn db_get_unread_count(
    conversation_id: String,
    state: State<'_, AppDbState>,
) -> Result<i64, String> {
    let store = state.store.clone();
    let conv_id = conversation_id.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.get_unread_count(&conv_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 存储密钥到 Keychain
#[tauri::command]
pub async fn keychain_store(
    id: String,
    key_type: String,
    key_data: Vec<u8>,
    state: State<'_, AppDbState>,
) -> Result<(), String> {
    let store = state.store.clone();
    let id_clone = id.clone();
    let key_type_clone = key_type.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.keychain_store(&id_clone, &key_type_clone, &key_data).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 从 Keychain 检索密钥
#[tauri::command]
pub async fn keychain_retrieve(
    key_type: String,
    state: State<'_, AppDbState>,
) -> Result<Option<Vec<u8>>, String> {
    let store = state.store.clone();
    let key_type_clone = key_type.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.keychain_retrieve(&key_type_clone).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 从 Keychain 删除密钥
#[tauri::command]
pub async fn keychain_delete(
    key_type: String,
    state: State<'_, AppDbState>,
) -> Result<(), String> {
    let store = state.store.clone();
    let key_type_clone = key_type.clone();

    tokio::task::spawn_blocking(move || {
        let guard = store.lock().map_err(|e| e.to_string())?;
        guard.keychain_delete(&key_type_clone).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}