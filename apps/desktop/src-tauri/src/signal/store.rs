//! libsignal-protocol Store - Week 4 设计（简单有效）
//! 
//! 关键设计：
//! 1. 使用 std::sync::Mutex 而不是 tokio::sync::RwLock
//! 2. 所有异步操作包装在 spawn_blocking 中
//! 3. 使用裸指针技巧绕过借用检查器

use libsignal_protocol::{
    InMemSignalProtocolStore,
    IdentityKeyPair, IdentityKeyStore,
    PreKeyStore, SignedPreKeyStore, KyberPreKeyStore,
    GenericSignedPreKey,
    PreKeyRecord, SignedPreKeyRecord, KyberPreKeyRecord,
    PreKeyId, SignedPreKeyId, KyberPreKeyId,
    DeviceId, KeyPair, kem, Timestamp,
    SignalProtocolError,
};
use rand::TryRngCore as _;
use rand::Rng as _;
use rand::rngs::OsRng;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

/// AppStore 类型：使用 Mutex 包装 InMemSignalProtocolStore
pub type AppStore = Arc<Mutex<InMemSignalProtocolStore>>;

/// 创建新的 store
pub fn create_store() -> Result<AppStore, SignalProtocolError> {
    let mut rng = OsRng.unwrap_err();
    let identity_key_pair = IdentityKeyPair::generate(&mut rng);
    let registration_id: u32 = rng.random_range(1..65536);
    let store = InMemSignalProtocolStore::new(identity_key_pair, registration_id)?;
    Ok(Arc::new(Mutex::new(store)))
}

/// 初始化 store（生成预密钥、签名预密钥、Kyber 预密钥）
pub async fn initialize_store(store: &AppStore) -> Result<(), SignalProtocolError> {
    let store_clone = store.clone();
    
    tokio::task::spawn_blocking(move || {
        let mut store_guard = store_clone.lock()
            .map_err(|_| SignalProtocolError::InvalidState("store", "poisoned lock".to_string()))?;
        
        let mut rng = OsRng.unwrap_err();

        // 生成预密钥 (100 个)
        for i in 1..=100 {
            let pre_key_id = PreKeyId::from(i);
            let key_pair: KeyPair = KeyPair::generate(&mut rng);
            let pre_key_record = PreKeyRecord::new(pre_key_id, &key_pair);
            futures::executor::block_on(store_guard.pre_key_store.save_pre_key(pre_key_id, &pre_key_record))?;
        }

        // 生成签名预密钥
        let signed_pre_key_id = SignedPreKeyId::from(1);
        let identity_key_pair: IdentityKeyPair = futures::executor::block_on(store_guard.identity_store.get_identity_key_pair())?;
        let key_pair: KeyPair = KeyPair::generate(&mut rng);
        let signature = identity_key_pair.private_key()
            .calculate_signature(&key_pair.public_key.serialize(), &mut rng)?;

        let signed_pre_key_record = <SignedPreKeyRecord as GenericSignedPreKey>::new(
            signed_pre_key_id,
            Timestamp::from_epoch_millis(SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_millis() as u64),
            &key_pair,
            &signature,
        );
        futures::executor::block_on(store_guard.signed_pre_key_store.save_signed_pre_key(signed_pre_key_id, &signed_pre_key_record))?;

        // 生成 Kyber 预密钥（后量子）
        let kyber_pre_key_id = KyberPreKeyId::from(1);
        let identity_key_pair: IdentityKeyPair = futures::executor::block_on(store_guard.identity_store.get_identity_key_pair())?;
        let kyber_key_pair: kem::KeyPair = kem::KeyPair::generate(kem::KeyType::Kyber1024, &mut rng);
        let signature = identity_key_pair.private_key()
            .calculate_signature(&kyber_key_pair.public_key.serialize(), &mut rng)?;

        let kyber_pre_key_record = <KyberPreKeyRecord as GenericSignedPreKey>::new(
            kyber_pre_key_id,
            Timestamp::from_epoch_millis(SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_millis() as u64),
            &kyber_key_pair,
            &signature,
        );
        futures::executor::block_on(store_guard.kyber_pre_key_store.save_kyber_pre_key(kyber_pre_key_id, &kyber_pre_key_record))?;

        Ok::<_, SignalProtocolError>(())
    }).await
    .map_err(|_| SignalProtocolError::InvalidState("spawn", "task failed".to_string()))?
}

/// 获取预密钥包
pub async fn get_prekey_bundle(store: &AppStore) -> Result<libsignal_protocol::PreKeyBundle, SignalProtocolError> {
    let store_clone = store.clone();
    tokio::task::spawn_blocking(move || {
        let store_guard = store_clone.lock()
            .map_err(|_| SignalProtocolError::InvalidState("store", "poisoned lock".to_string()))?;
        futures::executor::block_on(get_prekey_bundle_impl(&*store_guard))
    }).await
    .map_err(|_| SignalProtocolError::InvalidState("spawn", "task failed".to_string()))?
}

async fn get_prekey_bundle_impl(store: &InMemSignalProtocolStore) -> Result<libsignal_protocol::PreKeyBundle, SignalProtocolError> {
    let identity_key_pair: IdentityKeyPair = store.identity_store.get_identity_key_pair().await?;
    
    let pre_key_id = store.all_pre_key_ids()
        .max()
        .copied()
        .ok_or(SignalProtocolError::InvalidPreKeyId)?;
    
    let pre_key_record: PreKeyRecord = store.pre_key_store.get_pre_key(pre_key_id).await?;
    let signed_pre_key_record: SignedPreKeyRecord = store.signed_pre_key_store.get_signed_pre_key(SignedPreKeyId::from(1)).await?;
    let kyber_pre_key_record: KyberPreKeyRecord = store.kyber_pre_key_store.get_kyber_pre_key(KyberPreKeyId::from(1)).await?;

    let device_id = DeviceId::new(1).unwrap();
    let pre_key_keypair = pre_key_record.key_pair()?;
    
    let bundle = libsignal_protocol::PreKeyBundle::new(
        store.identity_store.get_local_registration_id().await?,
        device_id,
        Some((pre_key_id, pre_key_keypair.public_key)),
        SignedPreKeyId::from(1),
        signed_pre_key_record.key_pair()?.public_key,
        signed_pre_key_record.signature()?.to_vec(),
        KyberPreKeyId::from(1),
        kyber_pre_key_record.key_pair()?.public_key,
        kyber_pre_key_record.signature()?.to_vec(),
        *identity_key_pair.identity_key(),
    )?;

    Ok(bundle)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_store() {
        let store = create_store().expect("should create store");
        let guard = store.lock().unwrap();
        assert!(futures::executor::block_on(guard.identity_store.get_identity_key_pair()).is_ok());
    }

    #[tokio::test]
    async fn test_initialize_store() {
        let store = create_store().expect("should create store");
        initialize_store(&store).await.expect("should initialize store");
        
        let guard = store.lock().unwrap();
        assert!(guard.all_pre_key_ids().count() > 0);
    }

    #[tokio::test]
    async fn test_get_prekey_bundle() {
        let store = create_store().expect("should create store");
        initialize_store(&store).await.expect("should initialize store");
        
        let bundle = get_prekey_bundle(&store).await.expect("should get bundle");
        assert!(bundle.identity_key().is_ok());
        assert!(bundle.signed_pre_key_public().is_ok());
        assert!(bundle.kyber_pre_key_public().is_ok());
    }
}
