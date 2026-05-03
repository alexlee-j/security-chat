//! Tauri Commands for Signal Protocol

use crate::db::sqlite_store::SQLiteStore;
use crate::signal::cipher::EncryptedMessage;
use crate::signal::sender_keys::{GroupEncryptedMessage, SenderKeysStore};
use base64::{Engine, engine::general_purpose};
use libsignal_protocol::{
    CiphertextMessage, DeviceId, GenericSignedPreKey, IdentityKey, IdentityKeyPair,
    IdentityKeyStore, KeyPair, KyberPreKeyId, KyberPreKeyRecord, KyberPreKeyStore, PreKeyBundle,
    PreKeyId, PreKeyRecord, PreKeyStore, ProtocolAddress, PublicKey, SignalProtocolError,
    SignedPreKeyId, SignedPreKeyRecord, SignedPreKeyStore, Timestamp, message_decrypt,
    message_encrypt, process_prekey_bundle,
};
use rand::Rng as _;
use rand::TryRngCore as _;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tauri::State;
use tokio::sync::RwLock;

/// 应用状态 - 使用本地加密 SQLite Signal Store
pub struct AppState {
    pub signal_store: Arc<Mutex<SQLiteStore>>,
    pub current_user_id: Arc<RwLock<Option<String>>>,
    pub sender_keys_store: Arc<RwLock<SenderKeysStore>>,
}

impl AppState {
    pub fn new(signal_database_url: &str) -> Result<Self, String> {
        let signal_store = tauri::async_runtime::block_on(SQLiteStore::new(signal_database_url))
            .map_err(|error| error.to_string())?;
        Ok(Self {
            signal_store: Arc::new(Mutex::new(signal_store)),
            current_user_id: Arc::new(RwLock::new(None)),
            sender_keys_store: Arc::new(RwLock::new(SenderKeysStore::new(""))),
        })
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new("sqlite::memory:").expect("Failed to create AppState")
    }
}

/// 初始化用户身份密钥和预密钥
#[tauri::command]
pub async fn initialize_identity_command(state: State<'_, AppState>) -> Result<bool, String> {
    let store = state.signal_store.clone();
    run_signal_store_job(store, |store| {
        tauri::async_runtime::block_on(initialize_persistent_signal_store(store))
    })
    .await?;
    Ok(true)
}

/// 获取当前用户的预密钥包
#[tauri::command]
pub async fn get_prekey_bundle_command(
    state: State<'_, AppState>,
) -> Result<LocalPrekeyUploadDto, String> {
    let store = state.signal_store.clone();
    run_signal_store_job(store, |store| {
        tauri::async_runtime::block_on(get_local_prekey_upload_impl(store, 50))
    })
    .await
}

/// 获取注册所需的 identity/signed prekey（纯 Rust 生成）
#[tauri::command]
pub async fn get_registration_keys_command(
    state: State<'_, AppState>,
) -> Result<RegistrationKeysDto, String> {
    let store = state.signal_store.clone();
    let local = run_signal_store_job(store, |store| {
        tauri::async_runtime::block_on(get_local_prekey_upload_impl(store, 1))
    })
    .await?;
    Ok(RegistrationKeysDto {
        registration_id: local.registration_id,
        identity_public_key: local.identity_public_key,
        signed_pre_key: local.signed_prekey.public_key,
        signed_pre_key_signature: local.signed_prekey.signature,
    })
}

/// 与其他用户建立会话（X3DH）
#[tauri::command]
pub async fn establish_session_command(
    recipient_id: String,
    recipient_device_id: String,
    recipient_signal_device_id: u8,
    prekey_bundle: RemotePrekeyBundleDto,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let store = state.signal_store.clone();
    run_signal_store_job(store, move |store| {
        tauri::async_runtime::block_on(async move {
            let address = ProtocolAddress::new(
                format!("{}#{}", recipient_id, recipient_device_id),
                device_id_from_signal_device_id(recipient_signal_device_id)?,
            );
            let bundle = convert_remote_prekey_bundle(prekey_bundle)?;
            let mut rng = OsRng.unwrap_err();
            let ptr = store as *mut SQLiteStore;
            unsafe {
                // Accept latest remote identity for this address before processing
                // the prekey bundle. In current desktop flow we don't expose manual
                // trust decisions yet, so we follow TOFU update to avoid hard send
                // failure when remote prekeys rotate.
                let remote_identity = *bundle.identity_key().map_err(|e| e.to_string())?;
                IdentityKeyStore::save_identity(&mut *ptr, &address, &remote_identity)
                    .await
                    .map_err(|e| e.to_string())?;

                process_prekey_bundle(
                    &address,
                    &mut *ptr,
                    &mut *ptr,
                    &bundle,
                    SystemTime::now(),
                    &mut rng,
                )
                .await
                .map_err(|e| e.to_string())?;
            }

            Ok(true)
        })
    })
    .await
}

/// 加密消息
#[tauri::command]
pub async fn encrypt_message_command(
    recipient_id: String,
    recipient_device_id: String,
    recipient_signal_device_id: u8,
    plaintext: String,
    state: State<'_, AppState>,
) -> Result<EncryptedMessage, String> {
    let store = state.signal_store.clone();
    run_signal_store_job(store, move |store| {
        tauri::async_runtime::block_on(async move {
            let address = ProtocolAddress::new(
                format!("{}#{}", recipient_id, recipient_device_id),
                device_id_from_signal_device_id(recipient_signal_device_id)?,
            );
            encrypt_with_persistent_store(store, &address, plaintext.as_bytes()).await
        })
    })
    .await
}

/// 解密消息
#[tauri::command]
pub async fn decrypt_message_command(
    sender_id: String,
    sender_device_id: String,
    sender_signal_device_id: u8,
    encrypted: EncryptedMessage,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let store = state.signal_store.clone();
    run_signal_store_job(store, move |store| {
        tauri::async_runtime::block_on(async move {
            let address = ProtocolAddress::new(
                format!("{}#{}", sender_id, sender_device_id),
                device_id_from_signal_device_id(sender_signal_device_id)?,
            );
            let plaintext = decrypt_with_persistent_store(store, &address, &encrypted).await?;
            String::from_utf8(plaintext).map_err(|_| "Invalid UTF-8".to_string())
        })
    })
    .await
}

/// 设置当前用户 ID
#[tauri::command]
pub async fn set_current_user_command(
    user_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut current_user = state.current_user_id.write().await;
    let mut sender_keys = state.sender_keys_store.write().await;
    *sender_keys = SenderKeysStore::new(&user_id);
    *current_user = Some(user_id);
    Ok(())
}

async fn run_signal_store_job<T, F>(store: Arc<Mutex<SQLiteStore>>, job: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&mut SQLiteStore) -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = store
            .lock()
            .map_err(|error| format!("signal store lock poisoned: {error}"))?;
        job(&mut guard)
    })
    .await
    .map_err(|error| error.to_string())?
}

async fn initialize_persistent_signal_store(store: &mut SQLiteStore) -> Result<(), String> {
    let mut rng = rand::thread_rng();
    if store.get_identity_key_pair().await.is_err() {
        let identity_key_pair = IdentityKeyPair::generate(&mut rng);
        let registration_id: u32 = rng.random_range(1..65536);
        store
            .init_identity(&identity_key_pair, registration_id)
            .await
            .map_err(|e| e.to_string())?;
    }

    let pre_key_count = store.pre_key_count().await.map_err(|e| e.to_string())?;
    if pre_key_count < 100 {
        let mut next_pre_key_id = store.max_pre_key_id().await.map_err(|e| e.to_string())? + 1;
        for _ in pre_key_count..100 {
            let pre_key_id = PreKeyId::from(next_pre_key_id);
            let key_pair = KeyPair::generate(&mut rng);
            let pre_key_record = PreKeyRecord::new(pre_key_id, &key_pair);
            store
                .save_pre_key_record(next_pre_key_id, &pre_key_record)
                .await
                .map_err(|e| e.to_string())?;
            next_pre_key_id += 1;
        }
    }

    if !store
        .has_signed_pre_key(1)
        .await
        .map_err(|e| e.to_string())?
    {
        let identity_key_pair = store
            .get_identity_key_pair()
            .await
            .map_err(|e| e.to_string())?;
        let signed_pre_key_id = SignedPreKeyId::from(1);
        let key_pair = KeyPair::generate(&mut rng);
        let signature = identity_key_pair
            .private_key()
            .calculate_signature(&key_pair.public_key.serialize(), &mut rng)
            .map_err(|e| e.to_string())?;
        let signed_pre_key_record = SignedPreKeyRecord::new(
            signed_pre_key_id,
            Timestamp::from_epoch_millis(
                SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_millis() as u64,
            ),
            &key_pair,
            &signature,
        );
        store
            .save_signed_pre_key_record(1, &signed_pre_key_record)
            .await
            .map_err(|e| e.to_string())?;
    }

    if !store
        .has_kyber_pre_key(1)
        .await
        .map_err(|e| e.to_string())?
    {
        let identity_key_pair = store
            .get_identity_key_pair()
            .await
            .map_err(|e| e.to_string())?;
        let kyber_pre_key_id = KyberPreKeyId::from(1);
        let kyber_key_pair = libsignal_protocol::kem::KeyPair::generate(
            libsignal_protocol::kem::KeyType::Kyber1024,
            &mut rng,
        );
        let signature = identity_key_pair
            .private_key()
            .calculate_signature(&kyber_key_pair.public_key.serialize(), &mut rng)
            .map_err(|e| e.to_string())?;
        let kyber_pre_key_record = <KyberPreKeyRecord as GenericSignedPreKey>::new(
            kyber_pre_key_id,
            Timestamp::from_epoch_millis(
                SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_millis() as u64,
            ),
            &kyber_key_pair,
            &signature,
        );
        store
            .save_kyber_pre_key_record(1, &kyber_pre_key_record)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn encrypt_with_persistent_store(
    store: &mut SQLiteStore,
    address: &ProtocolAddress,
    plaintext: &[u8],
) -> Result<EncryptedMessage, String> {
    let mut rng = rand::thread_rng();
    let ptr = store as *mut SQLiteStore;
    let ciphertext = unsafe {
        message_encrypt(
            plaintext,
            address,
            &mut *ptr,
            &mut *ptr,
            SystemTime::now(),
            &mut rng,
        )
        .await
    }
    .map_err(|e| e.to_string())?;

    let message_type = match ciphertext.message_type() {
        libsignal_protocol::CiphertextMessageType::PreKey => 1,
        libsignal_protocol::CiphertextMessageType::Whisper => 2,
        libsignal_protocol::CiphertextMessageType::SenderKey => 3,
        libsignal_protocol::CiphertextMessageType::Plaintext => 4,
    };

    Ok(EncryptedMessage {
        message_type,
        body: ciphertext.serialize().to_vec(),
    })
}

async fn decrypt_with_persistent_store(
    store: &mut SQLiteStore,
    address: &ProtocolAddress,
    encrypted: &EncryptedMessage,
) -> Result<Vec<u8>, String> {
    let ciphertext = match encrypted.message_type {
        1 => {
            let msg = libsignal_protocol::PreKeySignalMessage::try_from(encrypted.body.as_slice())
                .map_err(|e| e.to_string())?;
            CiphertextMessage::PreKeySignalMessage(msg)
        }
        2 => {
            let msg = libsignal_protocol::SignalMessage::try_from(encrypted.body.as_slice())
                .map_err(|e| e.to_string())?;
            CiphertextMessage::SignalMessage(msg)
        }
        3 => {
            let msg = libsignal_protocol::SenderKeyMessage::try_from(encrypted.body.as_slice())
                .map_err(|e| e.to_string())?;
            CiphertextMessage::SenderKeyMessage(msg)
        }
        4 => {
            let msg = libsignal_protocol::PlaintextContent::try_from(encrypted.body.as_slice())
                .map_err(|e| e.to_string())?;
            CiphertextMessage::PlaintextContent(msg)
        }
        _ => {
            return Err(SignalProtocolError::InvalidMessage(
                libsignal_protocol::CiphertextMessageType::Whisper,
                "Unknown message type",
            )
            .to_string());
        }
    };

    let mut rng = rand::thread_rng();
    let ptr = store as *mut SQLiteStore;
    unsafe {
        message_decrypt(
            &ciphertext,
            address,
            &mut *ptr,
            &mut *ptr,
            &mut *ptr,
            &*ptr,
            &mut *ptr,
            &mut rng,
        )
        .await
    }
    .map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupEncryptedMessageDto {
    pub sender_id: String,
    pub message_number: u32,
    pub ciphertext: Vec<u8>,
    pub chain_key: Vec<u8>,
}

impl GroupEncryptedMessageDto {
    fn from_inner(value: GroupEncryptedMessage) -> Self {
        Self {
            sender_id: value.sender_id,
            message_number: value.message_number,
            ciphertext: value.ciphertext,
            chain_key: value.chain_key.to_vec(),
        }
    }

    fn into_inner(self) -> Result<GroupEncryptedMessage, String> {
        let chain_key: [u8; 32] = self
            .chain_key
            .as_slice()
            .try_into()
            .map_err(|_| "invalid group chain_key length".to_string())?;
        Ok(GroupEncryptedMessage {
            sender_id: self.sender_id,
            message_number: self.message_number,
            ciphertext: self.ciphertext,
            chain_key,
        })
    }
}

/// 同步群聊成员到本地 Sender Key 会话
#[tauri::command]
pub async fn sync_group_members_command(
    group_id: String,
    member_user_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let user_id = state
        .current_user_id
        .read()
        .await
        .clone()
        .ok_or_else(|| "current user is not set".to_string())?;
    let mut sender_keys = state.sender_keys_store.write().await;

    let mut expected_members: std::collections::HashSet<String> =
        member_user_ids.into_iter().collect();
    expected_members.insert(user_id.clone());

    let existing_members = sender_keys.list_members(&group_id).unwrap_or_default();
    let existing_set: std::collections::HashSet<String> = existing_members.into_iter().collect();
    let membership_changed = existing_set != expected_members;
    if sender_keys.get_session(&group_id).is_none() || membership_changed {
        // 成员变更时重建会话，触发 sender key 轮换
        sender_keys.create_group(&group_id, "Conversation Group", 1);
    }

    let session = sender_keys
        .get_session(&group_id)
        .ok_or_else(|| "group session not found".to_string())?;
    for member_id in &expected_members {
        if !session.has_member(member_id) {
            session.generate_sender_key(member_id);
        }
    }

    Ok(())
}

/// 群聊消息加密（Rust Sender Key 路径）
#[tauri::command]
pub async fn encrypt_group_message_command(
    group_id: String,
    plaintext: String,
    state: State<'_, AppState>,
) -> Result<GroupEncryptedMessageDto, String> {
    let mut sender_keys = state.sender_keys_store.write().await;
    let encrypted = sender_keys
        .encrypt_message(&group_id, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(GroupEncryptedMessageDto::from_inner(encrypted))
}

/// 群聊消息解密（Rust Sender Key 路径）
#[tauri::command]
pub async fn decrypt_group_message_command(
    group_id: String,
    encrypted: GroupEncryptedMessageDto,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let sender_keys = state.sender_keys_store.read().await;
    let inner = encrypted.into_inner()?;
    let plaintext = sender_keys
        .decrypt_message(&group_id, &inner)
        .map_err(|e| e.to_string())?;
    String::from_utf8(plaintext).map_err(|_| "Invalid UTF-8".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemotePrekeyBundleDto {
    pub registration_id: u32,
    pub signal_device_id: u8,
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
        &general_purpose::STANDARD
            .decode(input.identity_key)
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let signed_public = PublicKey::deserialize(
        &general_purpose::STANDARD
            .decode(input.signed_prekey.public_key)
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let signed_sig = general_purpose::STANDARD
        .decode(input.signed_prekey.signature)
        .map_err(|e| e.to_string())?;
    let prekey = match input.one_time_prekey {
        Some(one_time) => {
            let public = PublicKey::deserialize(
                &general_purpose::STANDARD
                    .decode(one_time.public_key)
                    .map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            Some((PreKeyId::from(one_time.key_id), public))
        }
        None => None,
    };
    let kyber = input
        .kyber_prekey
        .ok_or_else(|| "missing kyber_prekey in remote bundle".to_string())?;
    let kyber_public = libsignal_protocol::kem::PublicKey::deserialize(
        &general_purpose::STANDARD
            .decode(kyber.public_key)
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let kyber_sig = general_purpose::STANDARD
        .decode(kyber.signature)
        .map_err(|e| e.to_string())?;

    PreKeyBundle::new(
        input.registration_id,
        device_id_from_signal_device_id(input.signal_device_id)?,
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

fn device_id_from_signal_device_id(signal_device_id: u8) -> Result<DeviceId, String> {
    DeviceId::new(signal_device_id)
        .map_err(|_| format!("invalid signal_device_id: {}", signal_device_id))
}

async fn get_local_prekey_upload_impl(
    store: &SQLiteStore,
    max_prekeys: usize,
) -> Result<LocalPrekeyUploadDto, String> {
    let registration_id = store
        .get_local_registration_id()
        .await
        .map_err(|e| e.to_string())?;
    let identity_pair = store
        .get_identity_key_pair()
        .await
        .map_err(|e| e.to_string())?;
    let identity_public_key =
        general_purpose::STANDARD.encode(identity_pair.identity_key().serialize());

    let signed_prekey_record = store
        .get_signed_pre_key(SignedPreKeyId::from(1))
        .await
        .map_err(|e| e.to_string())?;
    let signed_pair = signed_prekey_record.key_pair().map_err(|e| e.to_string())?;
    let signed_signature = signed_prekey_record
        .signature()
        .map_err(|e| e.to_string())?;

    let mut one_time_prekeys = Vec::new();
    for prekey_id in store
        .pre_key_ids(max_prekeys)
        .await
        .map_err(|e| e.to_string())?
    {
        let prekey_record = store
            .get_pre_key(PreKeyId::from(prekey_id))
            .await
            .map_err(|e| e.to_string())?;
        let pair = prekey_record.key_pair().map_err(|e| e.to_string())?;
        one_time_prekeys.push(RemoteOneTimePrekeyDto {
            key_id: prekey_id,
            public_key: general_purpose::STANDARD.encode(pair.public_key.serialize()),
        });
    }

    let kyber_prekey = match store.get_kyber_pre_key(KyberPreKeyId::from(1)).await {
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn persistent_store_establishes_session_and_roundtrips_message() {
        let mut alice_store = SQLiteStore::new("sqlite::memory:")
            .await
            .expect("create alice store");
        let mut bob_store = SQLiteStore::new("sqlite::memory:")
            .await
            .expect("create bob store");
        initialize_persistent_signal_store(&mut alice_store)
            .await
            .expect("init alice");
        initialize_persistent_signal_store(&mut bob_store)
            .await
            .expect("init bob");

        let bob_bundle = get_local_prekey_upload_impl(&bob_store, 1)
            .await
            .expect("export bob bundle");
        let remote_bundle = RemotePrekeyBundleDto {
            registration_id: bob_bundle.registration_id,
            signal_device_id: 7,
            identity_key: bob_bundle.identity_public_key,
            signed_prekey: bob_bundle.signed_prekey.clone(),
            one_time_prekey: bob_bundle.one_time_prekeys.first().cloned(),
            kyber_prekey: bob_bundle.kyber_prekey.clone(),
        };
        let converted = convert_remote_prekey_bundle(remote_bundle).expect("convert remote bundle");

        let bob_addr = ProtocolAddress::new("bob#device".to_string(), DeviceId::new(7).unwrap());
        {
            let mut rng = OsRng.unwrap_err();
            let ptr = &mut alice_store as *mut SQLiteStore;
            unsafe {
                process_prekey_bundle(
                    &bob_addr,
                    &mut *ptr,
                    &mut *ptr,
                    &converted,
                    SystemTime::now(),
                    &mut rng,
                )
                .await
                .expect("establish session");
            }
        }

        let encrypted =
            encrypt_with_persistent_store(&mut alice_store, &bob_addr, b"hello-rust-signal")
                .await
                .expect("encrypt");
        let decrypted = decrypt_with_persistent_store(&mut bob_store, &bob_addr, &encrypted)
            .await
            .expect("decrypt");

        assert_eq!(decrypted, b"hello-rust-signal");
    }

    #[tokio::test]
    async fn prekey_top_up_does_not_reuse_removed_one_time_prekey_id() {
        let mut store = SQLiteStore::new("sqlite::memory:")
            .await
            .expect("create store");
        initialize_persistent_signal_store(&mut store)
            .await
            .expect("init store");

        PreKeyStore::remove_pre_key(&mut store, PreKeyId::from(1))
            .await
            .expect("remove used prekey");
        initialize_persistent_signal_store(&mut store)
            .await
            .expect("top up store");

        let ids = store.pre_key_ids(101).await.expect("prekey ids");
        assert!(!ids.contains(&1));
        assert!(ids.contains(&101));
        assert_eq!(ids.len(), 100);
    }
}
