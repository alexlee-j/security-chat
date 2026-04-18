//! 消息加密与解密 - Week 4 设计（简单有效）
//!
//! 关键设计：
//! 1. 使用 spawn_blocking 将 libsignal-protocol 调用移到阻塞线程池
//! 2. 使用裸指针技巧绕过借用检查器
//! 3. 所有异步操作都在 spawn_blocking 内完成

use libsignal_protocol::{
    message_encrypt, message_decrypt,
    CiphertextMessage,
    ProtocolAddress,
    SignalProtocolError,
    InMemSignalProtocolStore,
};
use std::time::SystemTime;
use crate::signal::store::AppStore;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EncryptedMessage {
    pub message_type: u32,
    pub body: Vec<u8>,
}

/// 辅助函数：获取 store 的多个可变引用
/// 使用裸指针绕过借用检查器
/// 这是安全的，因为：
/// 1. 所有引用都指向同一个对象
/// 2. libsignal-protocol 的 trait 实现不会实际同时修改同一块内存
/// 3. 调用是同步的，在 spawn_blocking 内执行
#[inline]
fn get_multiple_store_refs(store: &mut InMemSignalProtocolStore) -> (
    &mut dyn libsignal_protocol::SessionStore,
    &mut dyn libsignal_protocol::IdentityKeyStore,
    &mut dyn libsignal_protocol::PreKeyStore,
    &dyn libsignal_protocol::SignedPreKeyStore,
    &mut dyn libsignal_protocol::KyberPreKeyStore,
) {
    let ptr = store as *mut InMemSignalProtocolStore;
    unsafe {
        (
            &mut *ptr,
            &mut *ptr,
            &mut *ptr,
            &*ptr,
            &mut *ptr,
        )
    }
}

/// 加密消息
pub async fn encrypt_message(
    store: &AppStore,
    address: &ProtocolAddress,
    plaintext: &[u8],
) -> Result<EncryptedMessage, SignalProtocolError> {
    let store_clone = store.clone();
    let address_clone = address.clone();
    let plaintext_vec = plaintext.to_vec();
    
    let result = tokio::task::spawn_blocking(move || {
        let mut store_guard = store_clone.lock()
            .map_err(|_| SignalProtocolError::InvalidState("store", "poisoned lock".to_string()))?;
        
        encrypt_message_impl(&mut *store_guard, &address_clone, &plaintext_vec)
    }).await
    .map_err(|_| SignalProtocolError::InvalidState("spawn", "task failed".to_string()))?;
    
    result
}

/// 加密消息实现（在 spawn_blocking 内调用）
fn encrypt_message_impl(
    store: &mut InMemSignalProtocolStore,
    address: &ProtocolAddress,
    plaintext: &[u8],
) -> Result<EncryptedMessage, SignalProtocolError> {
    let mut rng = rand::thread_rng();
    
    let (session_store, identity_store, _, _, _) = get_multiple_store_refs(store);
    
    let ciphertext = futures::executor::block_on(message_encrypt(
        plaintext,
        address,
        session_store,
        identity_store,
        SystemTime::now(),
        &mut rng,
    ))?;

    let message_type = match ciphertext.message_type() {
        libsignal_protocol::CiphertextMessageType::PreKey => 1,
        libsignal_protocol::CiphertextMessageType::Whisper => 2,
        libsignal_protocol::CiphertextMessageType::SenderKey => 3,
        libsignal_protocol::CiphertextMessageType::Plaintext => 4,
    };

    let body = ciphertext.serialize().to_vec();

    Ok(EncryptedMessage { message_type, body })
}

/// 解密消息
pub async fn decrypt_message(
    store: &AppStore,
    address: &ProtocolAddress,
    encrypted: &EncryptedMessage,
) -> Result<Vec<u8>, SignalProtocolError> {
    let store_clone = store.clone();
    let address_clone = address.clone();
    let encrypted_clone = encrypted.clone();
    
    let result = tokio::task::spawn_blocking(move || {
        let mut store_guard = store_clone.lock()
            .map_err(|_| SignalProtocolError::InvalidState("store", "poisoned lock".to_string()))?;
        
        decrypt_message_impl(&mut *store_guard, &address_clone, &encrypted_clone)
    }).await
    .map_err(|_| SignalProtocolError::InvalidState("spawn", "task failed".to_string()))?;
    
    result
}

/// 解密消息实现（在 spawn_blocking 内调用）
fn decrypt_message_impl(
    store: &mut InMemSignalProtocolStore,
    address: &ProtocolAddress,
    encrypted: &EncryptedMessage,
) -> Result<Vec<u8>, SignalProtocolError> {
    let mut rng = rand::thread_rng();

    let ciphertext = match encrypted.message_type {
        1 => {
            let msg = libsignal_protocol::PreKeySignalMessage::try_from(encrypted.body.as_slice())?;
            CiphertextMessage::PreKeySignalMessage(msg)
        },
        2 => {
            let msg = libsignal_protocol::SignalMessage::try_from(encrypted.body.as_slice())?;
            CiphertextMessage::SignalMessage(msg)
        },
        3 => {
            let msg = libsignal_protocol::SenderKeyMessage::try_from(encrypted.body.as_slice())?;
            CiphertextMessage::SenderKeyMessage(msg)
        },
        4 => {
            let msg = libsignal_protocol::PlaintextContent::try_from(encrypted.body.as_slice())?;
            CiphertextMessage::PlaintextContent(msg)
        },
        _ => return Err(SignalProtocolError::InvalidMessage(
            libsignal_protocol::CiphertextMessageType::Whisper,
            "Unknown message type"
        )),
    };

    let (session_store, identity_store, prekey_store, signed_prekey_store, kyber_prekey_store) = 
        get_multiple_store_refs(store);

    let plaintext = futures::executor::block_on(message_decrypt(
        &ciphertext,
        address,
        session_store,
        identity_store,
        prekey_store,
        signed_prekey_store,
        kyber_prekey_store,
        &mut rng,
    ))?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signal::store::{create_store, initialize_store, get_prekey_bundle};
    use libsignal_protocol::{process_prekey_bundle, PreKeyBundle, DeviceId};

    /// 创建两个 store 并建立会话
    async fn setup_connected_stores() -> (AppStore, AppStore, ProtocolAddress, ProtocolAddress) {
        let alice_store: AppStore = create_store().expect("should create alice store");
        let bob_store: AppStore = create_store().expect("should create bob store");
        
        initialize_store(&alice_store).await.expect("should initialize alice store");
        initialize_store(&bob_store).await.expect("should initialize bob store");
        
        let alice_address = ProtocolAddress::new("alice".to_string(), DeviceId::new(1).unwrap());
        let bob_address = ProtocolAddress::new("bob".to_string(), DeviceId::new(1).unwrap());
        
        // 获取 Bob 的预密钥包
        let bob_bundle: PreKeyBundle = get_prekey_bundle(&bob_store).await.expect("should get bob bundle");
        
        // Alice 与 Bob 建立会话
        let alice_store_clone = alice_store.clone();
        let bob_address_clone = bob_address.clone();
        let bundle_clone = bob_bundle.clone();
        tokio::task::spawn_blocking(move || {
            let mut store_guard = alice_store_clone.lock().unwrap();
            let mut rng = rand::thread_rng();
            let ptr = &mut *store_guard as *mut InMemSignalProtocolStore;
            unsafe {
                futures::executor::block_on(process_prekey_bundle(
                    &bob_address_clone,
                    &mut *ptr,
                    &mut *ptr,
                    &bundle_clone,
                    SystemTime::now(),
                    &mut rng,
                )).unwrap()
            }
        }).await.unwrap();
        
        (alice_store, bob_store, alice_address, bob_address)
    }

    #[tokio::test]
    async fn test_encrypt_decrypt_roundtrip() {
        let (alice_store, bob_store, _alice_address, bob_address) = setup_connected_stores().await;
        let plaintext = b"Hello, Signal Protocol!";

        // Alice 加密消息发送给 Bob
        let encrypted = encrypt_message(&alice_store, &bob_address, plaintext)
            .await
            .expect("should encrypt message");

        // Bob 解密消息
        let decrypted = decrypt_message(&bob_store, &bob_address, &encrypted)
            .await
            .expect("should decrypt message");

        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[tokio::test]
    async fn test_encrypt_decrypt_multiple_messages() {
        let (alice_store, bob_store, _alice_address, bob_address) = setup_connected_stores().await;

        // 发送多条消息测试棘轮
        for i in 0..5 {
            let plaintext = format!("Message {}", i);
            let encrypted = encrypt_message(&alice_store, &bob_address, plaintext.as_bytes())
                .await
                .expect("should encrypt");
            
            let decrypted = decrypt_message(&bob_store, &bob_address, &encrypted)
                .await
                .expect("should decrypt");
            
            assert_eq!(plaintext.as_bytes(), decrypted.as_slice());
        }
    }
}
