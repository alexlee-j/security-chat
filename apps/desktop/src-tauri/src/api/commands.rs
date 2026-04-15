//! Tauri Commands for Signal Protocol

use tauri::State;
use libsignal_protocol::{ProtocolAddress, DeviceId, PreKeyBundle};
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

    // 获取各字段并构建可序列化结构
    let registration_id = bundle.registration_id().map_err(|e| e.to_string())?;
    let device_id = bundle.device_id().map_err(|e| e.to_string())?;
    let identity_key = bundle.identity_key().map_err(|e| e.to_string())?;
    let signed_prekey_id = bundle.signed_pre_key_id().map_err(|e| e.to_string())?;
    let signed_prekey_public = bundle.signed_pre_key_public().map_err(|e| e.to_string())?;
    let signed_prekey_sig = bundle.signed_pre_key_signature().map_err(|e| e.to_string())?;
    let pre_key_public = bundle.pre_key_public().map_err(|e| e.to_string())?;
    let pre_key_id = bundle.pre_key_id().map_err(|e| e.to_string())?;
    let kyber_prekey_id = bundle.kyber_pre_key_id().map_err(|e| e.to_string())?;
    let kyber_prekey_public = bundle.kyber_pre_key_public().map_err(|e| e.to_string())?;
    let kyber_prekey_sig = bundle.kyber_pre_key_signature().map_err(|e| e.to_string())?;

    // 构建 one_time_prekey（如果有）
    let one_time_prekey = if let (Some(id), Some(pk)) = (pre_key_id, pre_key_public) {
        Some(serde_json::json!({
            "key_id": u32::from(id),
            "public_key": pk.serialize(),
        }))
    } else {
        None
    };

    // 手动构建可序列化的结构
    let serializable = serde_json::json!({
        "registration_id": registration_id,
        "device_id": u32::from(device_id),
        "identity_key": identity_key.public_key().serialize(),
        "signed_prekey": {
            "key_id": u32::from(signed_prekey_id),
            "public_key": signed_prekey_public.serialize(),
            "signature": signed_prekey_sig.to_vec(),
        },
        "one_time_prekey": one_time_prekey,
        "kyber_prekey": {
            "key_id": u32::from(kyber_prekey_id),
            "public_key": kyber_prekey_public.serialize(),
            "signature": kyber_prekey_sig.to_vec(),
        },
    });

    let json = serde_json::to_string(&serializable).map_err(|e| e.to_string())?;
    Ok(general_purpose::STANDARD.encode(&json))
}

/// 与其他用户建立会话（X3DH）
#[tauri::command]
pub async fn establish_session_command(
    recipient_id: String,
    prekey_bundle_base64: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    use libsignal_protocol::{process_prekey_bundle, DeviceId, IdentityKey, PreKeyId, SignedPreKeyId, KyberPreKeyId};
    use libsignal_protocol::kem::PublicKey as KemPublicKey;
    use libsignal_protocol::PublicKey;
    use std::time::SystemTime;

    // 解码 base64
    let json_bytes = general_purpose::STANDARD.decode(&prekey_bundle_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    let json_str = String::from_utf8(json_bytes)
        .map_err(|e| format!("Invalid UTF-8: {}", e))?;

    // 解析 JSON
    let json_val: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse bundle JSON: {}", e))?;

    // 提取各字段
    let registration_id = json_val["registration_id"]
        .as_u64()
        .ok_or("Missing or invalid registration_id")? as u32;
    let device_id_val = json_val["device_id"]
        .as_u64()
        .ok_or("Missing or invalid device_id")? as u32;
    let identity_key_str = json_val["identity_key"]
        .as_str()
        .ok_or("Missing or invalid identity_key")?;
    let identity_key_bytes = general_purpose::STANDARD.decode(identity_key_str)
        .map_err(|e| format!("Invalid base64 identity_key: {}", e))?;

    // Signed prekey
    let signed_prekey_id_val = json_val["signed_prekey"]["key_id"]
        .as_u64()
        .ok_or("Missing or invalid signed_prekey.key_id")? as u32;
    let signed_prekey_public_str = json_val["signed_prekey"]["public_key"]
        .as_str()
        .ok_or("Missing or invalid signed_prekey.public_key")?;
    let signed_prekey_public_bytes = general_purpose::STANDARD.decode(signed_prekey_public_str)
        .map_err(|e| format!("Invalid base64 signed_prekey.public_key: {}", e))?;
    let signed_prekey_sig_str = json_val["signed_prekey"]["signature"]
        .as_str()
        .ok_or("Missing or invalid signed_prekey.signature")?;
    let signed_prekey_sig = general_purpose::STANDARD.decode(signed_prekey_sig_str)
        .map_err(|e| format!("Invalid base64 signed_prekey.signature: {}", e))?;

    // Kyber prekey
    let kyber_prekey_id_val = json_val["kyber_prekey"]["key_id"]
        .as_u64()
        .ok_or("Missing or invalid kyber_prekey.key_id")? as u32;
    let kyber_prekey_public_str = json_val["kyber_prekey"]["public_key"]
        .as_str()
        .ok_or("Missing or invalid kyber_prekey.public_key")?;
    let kyber_prekey_public_bytes = general_purpose::STANDARD.decode(kyber_prekey_public_str)
        .map_err(|e| format!("Invalid base64 kyber_prekey.public_key: {}", e))?;
    let kyber_prekey_sig_str = json_val["kyber_prekey"]["signature"]
        .as_str()
        .ok_or("Missing or invalid kyber_prekey.signature")?;
    let kyber_prekey_sig = general_purpose::STANDARD.decode(kyber_prekey_sig_str)
        .map_err(|e| format!("Invalid base64 kyber_prekey.signature: {}", e))?;

    // One-time prekey (可选)
    let pre_key = if let Some(otpk_val) = json_val["one_time_prekey"].as_object() {
        let otpk_id = otpk_val["key_id"]
            .as_u64()
            .ok_or("Invalid one_time_prekey.key_id")? as u32;
        let otpk_public_str = otpk_val["public_key"]
            .as_str()
            .ok_or("Invalid one_time_prekey.public_key")?;
        let otpk_public_bytes = general_purpose::STANDARD.decode(otpk_public_str)
            .map_err(|e| format!("Invalid base64 one_time_prekey.public_key: {}", e))?;
        // 添加 0x05 前缀（DJB key type）
        let mut with_prefix = vec![0x05];
        with_prefix.extend_from_slice(&otpk_public_bytes);
        let pk = PublicKey::deserialize(&with_prefix)
            .map_err(|e| format!("Invalid one-time prekey public key: {:?}", e))?;
        Some((PreKeyId::from(otpk_id), pk))
    } else {
        None
    };

    // 构建类型
    let device_id: DeviceId = device_id_val.try_into()
        .map_err(|_| "Invalid device_id (must be 1-127)")?;

    // 添加 0x05 前缀（DJB key type for x25519）
    let mut identity_key_with_prefix = vec![0x05];
    identity_key_with_prefix.extend_from_slice(&identity_key_bytes);
    let identity_key = IdentityKey::new(
        PublicKey::deserialize(&identity_key_with_prefix)
            .map_err(|e| format!("Invalid identity_key: {:?}", e))?
    );

    // Signed prekey public key - 添加 0x05 前缀
    let mut signed_prekey_with_prefix = vec![0x05];
    signed_prekey_with_prefix.extend_from_slice(&signed_prekey_public_bytes);
    let signed_prekey_public = PublicKey::deserialize(&signed_prekey_with_prefix)
        .map_err(|e| format!("Invalid signed_prekey.public_key: {:?}", e))?;

    // Kyber public key - 使用 deserialize（需要包含 key type byte）
    let kyber_prekey_public = KemPublicKey::deserialize(&kyber_prekey_public_bytes)
        .map_err(|e| format!("Invalid kyber_prekey.public_key: {:?}", e))?;

    // 构建 PreKeyBundle
    let bundle = PreKeyBundle::new(
        registration_id,
        device_id,
        pre_key,
        SignedPreKeyId::from(signed_prekey_id_val),
        signed_prekey_public,
        signed_prekey_sig,
        KyberPreKeyId::from(kyber_prekey_id_val),
        kyber_prekey_public,
        kyber_prekey_sig,
        identity_key,
    ).map_err(|e| format!("Failed to create PreKeyBundle: {:?}", e))?;

    // 建立会话
    let address = ProtocolAddress::new(recipient_id, DeviceId::new(1).unwrap());
    let store_clone = state.store.clone();

    tokio::task::spawn_blocking(move || {
        let mut store_guard = store_clone.lock()
            .map_err(|_| libsignal_protocol::SignalProtocolError::InvalidState("store", "poisoned".to_string()))?;

        let mut rng = rand::thread_rng();
        let ptr = &mut *store_guard as *mut libsignal_protocol::InMemSignalProtocolStore;

        unsafe {
            futures::executor::block_on(process_prekey_bundle(
                &address,
                &mut *ptr,
                &mut *ptr,
                &bundle,
                SystemTime::now(),
                &mut rng,
            ))
        }
    }).await
    .map_err(|e| format!("Spawn failed: {}", e))?
    .map_err(|e| format!("Failed to establish session: {:?}", e))?;

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
