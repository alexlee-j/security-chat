//! Tauri Commands for Signal Protocol

use tauri::State;
use libsignal_protocol::{
    process_prekey_bundle,
    DeviceId,
    GenericSignedPreKey,
    IdentityKey,
    IdentityKeyStore,
    InMemSignalProtocolStore,
    KyberPreKeyStore,
    KyberPreKeyId,
    PreKeyStore,
    PreKeyBundle,
    PreKeyId,
    PreKeyRecord,
    ProtocolAddress,
    PublicKey,
    SignedPreKeyId,
    SignedPreKeyRecord,
    SignedPreKeyStore,
};
use crate::signal::store::{AppStore, create_store, initialize_store, get_prekey_bundle};
use crate::signal::cipher::{encrypt_message, decrypt_message, EncryptedMessage};
use std::sync::Arc;
use tokio::sync::RwLock;
use base64::{Engine, engine::general_purpose};
use serde::{Deserialize, Serialize};
use rand::TryRngCore as _;
use rand::rngs::OsRng;
use std::time::SystemTime;

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
) -> Result<LocalPrekeyUploadDto, String> {
    get_local_prekey_upload_impl(&state.store, 50).await
}

/// 获取注册所需的 identity/signed prekey（纯 Rust 生成）
#[tauri::command]
pub async fn get_registration_keys_command(
    state: State<'_, AppState>,
) -> Result<RegistrationKeysDto, String> {
    let bundle = get_prekey_bundle(&state.store).await.map_err(|e| e.to_string())?;
    Ok(RegistrationKeysDto {
        registration_id: bundle.registration_id().map_err(|e| e.to_string())?,
        identity_public_key: general_purpose::STANDARD.encode(
            bundle.identity_key().map_err(|e| e.to_string())?.serialize(),
        ),
        signed_pre_key: general_purpose::STANDARD.encode(
            bundle.signed_pre_key_public().map_err(|e| e.to_string())?.serialize(),
        ),
        signed_pre_key_signature: general_purpose::STANDARD.encode(
            bundle.signed_pre_key_signature().map_err(|e| e.to_string())?,
        ),
    })
}

/// 与其他用户建立会话（X3DH）
#[tauri::command]
pub async fn establish_session_command(
    recipient_id: String,
    recipient_device_id: String,
    prekey_bundle: RemotePrekeyBundleDto,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let address = ProtocolAddress::new(format!("{}#{}", recipient_id, recipient_device_id), DeviceId::new(1).unwrap());
    let bundle = convert_remote_prekey_bundle(prekey_bundle)?;
    let store_clone = state.store.clone();

    tokio::task::spawn_blocking(move || {
        let mut store_guard = store_clone.lock()
            .map_err(|_| "poisoned lock".to_string())?;
        let mut rng = OsRng.unwrap_err();
        let ptr = &mut *store_guard as *mut InMemSignalProtocolStore;
        unsafe {
            // Accept latest remote identity for this address before processing
            // the prekey bundle. In current desktop flow we don't expose manual
            // trust decisions yet, so we follow TOFU update to avoid hard send
            // failure when remote prekeys rotate.
            let remote_identity = *bundle.identity_key().map_err(|e| e.to_string())?;
            futures::executor::block_on(IdentityKeyStore::save_identity(
                &mut *ptr,
                &address,
                &remote_identity,
            ))
            .map_err(|e| e.to_string())?;

            futures::executor::block_on(process_prekey_bundle(
                &address,
                &mut *ptr,
                &mut *ptr,
                &bundle,
                SystemTime::now(),
                &mut rng,
            ))
            .map_err(|e| e.to_string())?;
        }
        Ok::<(), String>(())
    })
    .await
    .map_err(|_| "spawn task failed".to_string())??;

    Ok(true)
}

/// 加密消息
#[tauri::command]
pub async fn encrypt_message_command(
    recipient_id: String,
    recipient_device_id: String,
    plaintext: String,
    state: State<'_, AppState>,
) -> Result<EncryptedMessage, String> {
    let address = ProtocolAddress::new(format!("{}#{}", recipient_id, recipient_device_id), DeviceId::new(1).unwrap());
    encrypt_message(&state.store, &address, plaintext.as_bytes())
        .await
        .map_err(|e| e.to_string())
}

/// 解密消息
#[tauri::command]
pub async fn decrypt_message_command(
    sender_id: String,
    sender_device_id: String,
    encrypted: EncryptedMessage,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let address = ProtocolAddress::new(format!("{}#{}", sender_id, sender_device_id), DeviceId::new(1).unwrap());
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemotePrekeyBundleDto {
    pub registration_id: u32,
    pub identity_key: String,
    pub signed_prekey: RemoteSignedPrekeyDto,
    pub one_time_prekey: Option<RemoteOneTimePrekeyDto>,
    pub kyber_prekey: Option<RemoteKyberPrekeyDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSignedPrekeyDto {
    pub key_id: u32,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteOneTimePrekeyDto {
    pub key_id: u32,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteKyberPrekeyDto {
    pub key_id: u32,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationKeysDto {
    pub registration_id: u32,
    pub identity_public_key: String,
    pub signed_pre_key: String,
    pub signed_pre_key_signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalPrekeyUploadDto {
    pub registration_id: u32,
    pub identity_public_key: String,
    pub signed_prekey: RemoteSignedPrekeyDto,
    pub one_time_prekeys: Vec<RemoteOneTimePrekeyDto>,
    pub kyber_prekey: Option<RemoteKyberPrekeyDto>,
}

fn convert_remote_prekey_bundle(input: RemotePrekeyBundleDto) -> Result<PreKeyBundle, String> {
    let identity = IdentityKey::decode(
        &general_purpose::STANDARD.decode(input.identity_key).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    let signed_public = PublicKey::deserialize(
        &general_purpose::STANDARD.decode(input.signed_prekey.public_key).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    let signed_sig = general_purpose::STANDARD
        .decode(input.signed_prekey.signature)
        .map_err(|e| e.to_string())?;
    let prekey = match input.one_time_prekey {
        Some(one_time) => {
            let public = PublicKey::deserialize(
                &general_purpose::STANDARD.decode(one_time.public_key).map_err(|e| e.to_string())?
            ).map_err(|e| e.to_string())?;
            Some((PreKeyId::from(one_time.key_id), public))
        }
        None => None,
    };
    let kyber = input.kyber_prekey.ok_or_else(|| "missing kyber_prekey in remote bundle".to_string())?;
    let kyber_public = libsignal_protocol::kem::PublicKey::deserialize(
        &general_purpose::STANDARD.decode(kyber.public_key).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    let kyber_sig = general_purpose::STANDARD.decode(kyber.signature).map_err(|e| e.to_string())?;

    PreKeyBundle::new(
        input.registration_id,
        DeviceId::new(1).unwrap(),
        prekey,
        SignedPreKeyId::from(input.signed_prekey.key_id),
        signed_public,
        signed_sig,
        KyberPreKeyId::from(kyber.key_id),
        kyber_public,
        kyber_sig,
        identity,
    )
    .map_err(|e| e.to_string())
}

async fn get_local_prekey_upload_impl(store: &AppStore, max_prekeys: usize) -> Result<LocalPrekeyUploadDto, String> {
    let store_clone = store.clone();
    tokio::task::spawn_blocking(move || {
        let store_guard = store_clone.lock().map_err(|_| "poisoned lock".to_string())?;
        let registration_id = futures::executor::block_on(store_guard.identity_store.get_local_registration_id())
            .map_err(|e| e.to_string())?;
        let identity_pair = futures::executor::block_on(store_guard.identity_store.get_identity_key_pair())
            .map_err(|e| e.to_string())?;
        let identity_public_key = general_purpose::STANDARD.encode(identity_pair.identity_key().serialize());

        let signed_prekey_record: SignedPreKeyRecord = futures::executor::block_on(
            store_guard.signed_pre_key_store.get_signed_pre_key(SignedPreKeyId::from(1))
        ).map_err(|e| e.to_string())?;
        let signed_pair = signed_prekey_record.key_pair().map_err(|e| e.to_string())?;
        let signed_signature = signed_prekey_record.signature().map_err(|e| e.to_string())?;

        let mut one_time_prekeys = Vec::new();
        for prekey_id in store_guard.all_pre_key_ids().take(max_prekeys) {
            let prekey_record: PreKeyRecord = futures::executor::block_on(
                store_guard.pre_key_store.get_pre_key(*prekey_id)
            ).map_err(|e| e.to_string())?;
            let pair = prekey_record.key_pair().map_err(|e| e.to_string())?;
            one_time_prekeys.push(RemoteOneTimePrekeyDto {
                key_id: u32::from(*prekey_id),
                public_key: general_purpose::STANDARD.encode(pair.public_key.serialize()),
            });
        }

        let kyber_prekey = match futures::executor::block_on(
            store_guard.kyber_pre_key_store.get_kyber_pre_key(KyberPreKeyId::from(1))
        ) {
            Ok(record) => {
                let pair = record.key_pair().map_err(|e| e.to_string())?;
                let signature = record.signature().map_err(|e| e.to_string())?;
                Some(RemoteKyberPrekeyDto {
                    key_id: 1,
                    public_key: general_purpose::STANDARD.encode(pair.public_key.serialize()),
                    signature: general_purpose::STANDARD.encode(signature),
                })
            }
            Err(_) => None,
        };

        Ok(LocalPrekeyUploadDto {
            registration_id,
            identity_public_key,
            signed_prekey: RemoteSignedPrekeyDto {
                key_id: 1,
                public_key: general_purpose::STANDARD.encode(signed_pair.public_key.serialize()),
                signature: general_purpose::STANDARD.encode(signed_signature),
            },
            one_time_prekeys,
            kyber_prekey,
        })
    })
    .await
    .map_err(|_| "spawn task failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signal::cipher::{decrypt_message, encrypt_message};
    use crate::signal::store::{create_store, initialize_store};

    #[tokio::test]
    async fn establish_session_with_remote_bundle_and_roundtrip_message() {
        let alice_store = create_store().expect("create alice store");
        let bob_store = create_store().expect("create bob store");
        initialize_store(&alice_store).await.expect("init alice");
        initialize_store(&bob_store).await.expect("init bob");

        let bob_bundle = get_local_prekey_upload_impl(&bob_store, 1).await.expect("export bob bundle");
        let remote_bundle = RemotePrekeyBundleDto {
            registration_id: bob_bundle.registration_id,
            identity_key: bob_bundle.identity_public_key,
            signed_prekey: bob_bundle.signed_prekey.clone(),
            one_time_prekey: bob_bundle.one_time_prekeys.first().cloned(),
            kyber_prekey: bob_bundle.kyber_prekey.clone(),
        };
        let converted = convert_remote_prekey_bundle(remote_bundle).expect("convert remote bundle");

        let bob_addr = ProtocolAddress::new("bob#device".to_string(), DeviceId::new(1).unwrap());
        {
            let mut guard = alice_store.lock().expect("lock alice");
            let mut rng = OsRng.unwrap_err();
            let ptr = &mut *guard as *mut InMemSignalProtocolStore;
            unsafe {
                futures::executor::block_on(process_prekey_bundle(
                    &bob_addr,
                    &mut *ptr,
                    &mut *ptr,
                    &converted,
                    SystemTime::now(),
                    &mut rng,
                ))
                .expect("establish session");
            }
        }

        let encrypted = encrypt_message(&alice_store, &bob_addr, b"hello-rust-signal")
            .await
            .expect("encrypt");
        let decrypted = decrypt_message(&bob_store, &bob_addr, &encrypted)
            .await
            .expect("decrypt");

        assert_eq!(decrypted, b"hello-rust-signal");
    }
}
