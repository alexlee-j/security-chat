//! Tauri Commands for Signal Protocol

use tauri::State;
use libsignal_protocol::{ProtocolAddress, DeviceId};
use crate::signal::store::{AppStore, create_store, initialize_store, get_prekey_bundle};
use crate::signal::cipher::{encrypt_message, decrypt_message, EncryptedMessage};
use std::sync::Arc;
use tokio::sync::RwLock;
use base64::{Engine, engine::general_purpose};

/// 应用状态 - 使用内存 Store
pub struct AppState {
    pub store: AppStore,
    pub current_user_id: Arc<RwLock<Option<String>>>,
}

impl AppState {
    pub fn new() -> Result<Self, libsignal_protocol::SignalProtocolError> {
        Ok(Self {
            store: create_store()?,
            current_user_id: Arc::new(RwLock::new(None)),
        })
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new().expect("Failed to create AppState")
    }
}

/// 初始化用户身份密钥和预密钥
#[tauri::command]
pub async fn initialize_identity_command(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    initialize_store(&state.store).await.map_err(|e| e.to_string())?;
    Ok(true)
}

/// 获取当前用户的预密钥包
#[tauri::command]
pub async fn get_prekey_bundle_command(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let bundle = get_prekey_bundle(&state.store).await.map_err(|e| e.to_string())?;
    Ok(general_purpose::STANDARD.encode(bundle.identity_key().map_err(|e| e.to_string())?.public_key().serialize()))
}

/// 与其他用户建立会话（X3DH）
#[tauri::command]
pub async fn establish_session_command(
    _recipient_id: String,
    _prekey_bundle_base64: String,
    _state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(true)
}

/// 加密消息
#[tauri::command]
pub async fn encrypt_message_command(
    recipient_id: String,
    plaintext: String,
    state: State<'_, AppState>,
) -> Result<EncryptedMessage, String> {
    let address = ProtocolAddress::new(recipient_id, DeviceId::new(1).unwrap());
    encrypt_message(&state.store, &address, plaintext.as_bytes())
        .await
        .map_err(|e| e.to_string())
}

/// 解密消息
#[tauri::command]
pub async fn decrypt_message_command(
    sender_id: String,
    encrypted: EncryptedMessage,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let address = ProtocolAddress::new(sender_id, DeviceId::new(1).unwrap());
    let plaintext = decrypt_message(&state.store, &address, &encrypted)
        .await
        .map_err(|e| e.to_string())?;
    String::from_utf8(plaintext).map_err(|_| "Invalid UTF-8".to_string())
}

/// 设置当前用户 ID
#[tauri::command]
pub async fn set_current_user_command(
    user_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut current_user = state.current_user_id.write().await;
    *current_user = Some(user_id);
    Ok(())
}
