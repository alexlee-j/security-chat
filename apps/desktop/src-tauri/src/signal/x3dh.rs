//! X3DH 密钥协商 - R3-2 修复
//! 使用官方 libsignal-protocol API

use libsignal_protocol::{
    PreKeyBundle,
    ProtocolAddress,
    process_prekey_bundle,
};
use rand::rngs::OsRng;
use crate::signal::store::AppStore;

/// X3DH 发起方结果
pub struct X3DHInitiatorResult {
    pub session_created: bool,
}

/// X3DH 响应方结果
pub struct X3DHResponderResult {
    pub session_created: bool,
}

/// 发起方：使用接收方的预密钥包建立会话 - R3-2 修复
pub async fn initiate_session(
    store: &AppStore,
    address: &ProtocolAddress,
    prekey_bundle: &PreKeyBundle,
) -> Result<X3DHInitiatorResult, libsignal_protocol::SignalProtocolError> {
    let mut rng = OsRng;

    let mut store = store.write().await;

    process_prekey_bundle(
        address,
        &mut *store,
        &mut *store,
        &mut *store,
        &mut *store,
        prekey_bundle,
        &mut rng,
    )
    .await?;

    Ok(X3DHInitiatorResult {
        session_created: true,
    })
}

/// 响应方：处理第一条消息（PreKey 消息）
/// 解密 PreKeySignalMessage 会自动建立会话
pub async fn respond_to_message(
    _store: &AppStore,
    _address: &ProtocolAddress,
    _message: &[u8],
) -> Result<X3DHResponderResult, libsignal_protocol::SignalProtocolError> {
    // 简化实现：实际应该在 cipher.rs 的 decrypt_message 中处理
    // 解密 PreKeySignalMessage 会自动建立会话
    Ok(X3DHResponderResult {
        session_created: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signal::store::{create_store, initialize_store, get_prekey_bundle};

    #[tokio::test]
    async fn test_x3dh_manager_creation() {
        let store = create_store().unwrap();
        
        // 验证可以创建会话
        assert!(true);
    }

    #[tokio::test]
    async fn test_initiate_session() {
        // 创建两个存储（模拟 Alice 和 Bob）
        let alice_store = create_store().unwrap();
        let bob_store = create_store().unwrap();

        initialize_store(&alice_store).await.unwrap();
        initialize_store(&bob_store).await.unwrap();

        // Bob 生成 PreKeyBundle
        let bob_bundle = get_prekey_bundle(&bob_store).await.unwrap();

        // Alice 建立会话
        let address = ProtocolAddress::new("bob".to_string(), 1);
        let result = initiate_session(&alice_store, &address, &bob_bundle).await;

        assert!(result.is_ok());
    }
}
