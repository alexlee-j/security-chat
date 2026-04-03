//! Session Management - 暂时禁用未使用的代码

#![allow(dead_code)]

use libsignal_protocol::{
    process_prekey_bundle,
    PreKeyBundle,
    ProtocolAddress,
    SignalProtocolError, DeviceId,
};
use crate::signal::store::AppStore;
use rand::TryRngCore as _;
use rand::rngs::OsRng;
use std::time::SystemTime;

/// X3DH 会话管理器
pub struct X3DHManager {
    store: AppStore,
}

impl X3DHManager {
    pub fn new(store: AppStore) -> Self {
        Self { store }
    }

    /// 作为发起方：获取对方 PreKeyBundle 并建立会话
    pub async fn initiate_session(
        &self,
        recipient_id: &str,
        bundle: &PreKeyBundle,
    ) -> Result<(), SignalProtocolError> {
        let address = ProtocolAddress::new(recipient_id.to_string(), DeviceId::new(1).unwrap());
        let mut rng = OsRng.unwrap_err();
        let mut store = self.store.lock().unwrap();

        let ptr = &mut *store as *mut libsignal_protocol::InMemSignalProtocolStore;
        unsafe {
            futures::executor::block_on(process_prekey_bundle(
                &address,
                &mut *ptr,
                &mut *ptr,
                bundle,
                SystemTime::now(),
                &mut rng,
            ))
        }
    }

    /// 作为响应方：处理发起方的第一条消息
    pub async fn respond_to_message(
        &self,
        _sender_id: &str,
        _prekey_message: &[u8],
    ) -> Result<Vec<u8>, SignalProtocolError> {
        todo!("Implement in cipher.rs")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signal::store::create_store;

    #[tokio::test]
    async fn test_x3dh_manager_creation() {
        let store = create_store().unwrap();
        let _manager = X3DHManager::new(store);
        assert!(true);
    }
}
