//! libsignal-protocol Store 使用 SQLite 持久化存储

use libsignal_protocol::{
    IdentityKeyPair,
    IdentityKey,
    IdentityKeyStore,
    PreKeyRecord,
    PreKeyStore,
    PreKeyId,
    SignedPreKeyRecord,
    SignedPreKeyStore,
    SignedPreKeyId,
    KyberPreKeyRecord,
    KyberPreKeyStore,
    KyberPreKeyId,
    SessionRecord,
    SessionStore,
    ProtocolAddress,
    SignalProtocolError,
    PrivateKey,
    PublicKey,
    KeyPair,
    Timestamp,
    GenericSignedPreKey,
    Direction,
    IdentityChange,
};
use sqlx::SqlitePool;
use std::sync::Arc;

/// SQLite 连接池类型
pub type DbPool = SqlitePool;

/// SQLite Signal Protocol Store
///
/// 整合所有 Store trait 到一个结构体中
pub struct SQLiteStore {
    pool: SqlitePool,
}

impl SQLiteStore {
    /// 创建新的 SQLite Store
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePool::connect(database_url).await?;
        Ok(Self { pool })
    }

    /// 从现有连接池创建
    pub fn from_pool(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// 获取连接池引用（用于 get_prekey_bundle 等函数）
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// 初始化身份密钥
    pub async fn init_identity(
        &self,
        identity_key_pair: &IdentityKeyPair,
        registration_id: u32,
    ) -> Result<(), sqlx::Error> {
        // 检查是否已存在身份密钥
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM identity_keys"
        )
        .fetch_one(&self.pool)
        .await?;

        if existing > 0 {
            return Ok(()); // 已存在，跳过
        }

        sqlx::query(
            r#"
            INSERT INTO identity_keys (public_key, private_key, registration_id)
            VALUES (?, ?, ?)
            "#,
        )
        .bind(identity_key_pair.public_key().serialize())
        .bind(identity_key_pair.private_key().serialize())
        .bind(registration_id as i64)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 保存预密钥
    pub async fn save_pre_key_record(
        &self,
        pre_key_id: u32,
        record: &PreKeyRecord,
    ) -> Result<(), sqlx::Error> {
        let key_pair = record.key_pair().map_err(|e| sqlx::Error::Protocol(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO pre_keys (pre_key_id, key_pair_public, key_pair_private)
            VALUES (?, ?, ?)
            "#,
        )
        .bind(pre_key_id as i64)
        .bind(key_pair.public_key.serialize())
        .bind(key_pair.private_key.serialize())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 保存签名预密钥
    pub async fn save_signed_pre_key_record(
        &self,
        signed_pre_key_id: u32,
        record: &SignedPreKeyRecord,
    ) -> Result<(), sqlx::Error> {
        let key_pair = record.key_pair().map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO signed_pre_keys 
            (signed_pre_key_id, timestamp, key_pair_public, key_pair_private, signature)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(signed_pre_key_id as i64)
        .bind(record.timestamp().value() as i64)
        .bind(key_pair.public_key.serialize())
        .bind(key_pair.private_key.serialize())
        .bind(record.signature())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 保存 Kyber 预密钥
    pub async fn save_kyber_pre_key_record(
        &self,
        kyber_pre_key_id: u32,
        record: &KyberPreKeyRecord,
    ) -> Result<(), sqlx::Error> {
        let key_pair = record.key_pair().map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
        let timestamp = record.timestamp().map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
        let signature = record.signature().map_err(|e| sqlx::Error::Protocol(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO kyber_pre_keys
            (kyber_pre_key_id, timestamp, public_key, secret_key, signature)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(kyber_pre_key_id as i64)
        .bind(timestamp.value() as i64)
        .bind(key_pair.public_key.serialize())
        .bind(key_pair.secret_key.serialize())
        .bind(signature)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 保存会话
    pub async fn save_session(
        &self,
        address: &ProtocolAddress,
        record: &SessionRecord,
    ) -> Result<(), sqlx::Error> {
        let session_data = record.serialize()?;
        let device_id: u8 = address.device_id().into();
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO sessions (recipient_id, device_id, session_data, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            "#,
        )
        .bind(address.name())
        .bind(device_id as i64)
        .bind(session_data)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

// ============== IdentityKeyStore 实现 ==============

#[async_trait::async_trait(?Send)]
impl IdentityKeyStore for SQLiteStore {
    async fn get_identity_key_pair(&self) -> Result<IdentityKeyPair, SignalProtocolError> {
        let row = sqlx::query_as::<_, (Vec<u8>, Vec<u8>, i64)>(
            "SELECT public_key, private_key, registration_id FROM identity_keys LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("identity", e.to_string()))?;

        match row {
            Some((public_key_bytes, private_key_bytes, _)) => {
                let public_key = IdentityKey::decode(&public_key_bytes)
                    .map_err(|e| SignalProtocolError::InvalidState("identity", e.to_string()))?;
                let private_key = PrivateKey::deserialize(&private_key_bytes)
                    .map_err(|e| SignalProtocolError::InvalidState("identity", e.to_string()))?;
                Ok(IdentityKeyPair::new(public_key, private_key))
            }
            None => Err(SignalProtocolError::InvalidState(
                "identity",
                "No identity key pair found".to_string(),
            )),
        }
    }

    async fn get_local_registration_id(&self) -> Result<u32, SignalProtocolError> {
        let row = sqlx::query_scalar::<_, i64>(
            "SELECT registration_id FROM identity_keys LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("identity", e.to_string()))?;

        match row {
            Some(reg_id) => Ok(reg_id as u32),
            None => Err(SignalProtocolError::InvalidState(
                "identity",
                "No registration id found".to_string(),
            )),
        }
    }

    async fn save_identity(
        &mut self,
        address: &ProtocolAddress,
        identity_key: &IdentityKey,
    ) -> Result<IdentityChange, SignalProtocolError> {
        // 简化实现：存储联系人身份密钥用于验证
        // 这里返回 NewOrUnchanged 表示身份未改变
        Ok(IdentityChange::NewOrUnchanged)
    }

    async fn is_trusted_identity(
        &self,
        _address: &ProtocolAddress,
        _identity_key: &IdentityKey,
        _direction: Direction,
    ) -> Result<bool, SignalProtocolError> {
        // 简化实现：总是信任
        Ok(true)
    }

    async fn get_identity(&self, _address: &ProtocolAddress) -> Result<Option<IdentityKey>, SignalProtocolError> {
        // 简化实现：返回 None
        Ok(None)
    }
}

// ============== PreKeyStore 实现 ==============

#[async_trait::async_trait(?Send)]
impl PreKeyStore for SQLiteStore {
    async fn save_pre_key(
        &mut self,
        pre_key_id: PreKeyId,
        record: &PreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        let pre_key_id_u32: u32 = pre_key_id.into();
        self.save_pre_key_record(pre_key_id_u32, record)
            .await
            .map_err(|e| SignalProtocolError::InvalidState("prekey", e.to_string()))
    }

    async fn get_pre_key(
        &self,
        pre_key_id: PreKeyId,
    ) -> Result<PreKeyRecord, SignalProtocolError> {
        let pre_key_id_u32: u32 = pre_key_id.into();
        let row = sqlx::query_as::<_, (Vec<u8>, Vec<u8>)>(
            "SELECT key_pair_public, key_pair_private FROM pre_keys WHERE pre_key_id = ?"
        )
        .bind(pre_key_id_u32 as i64)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("prekey", e.to_string()))?;

        match row {
            Some((public_bytes, private_bytes)) => {
                let key_pair = KeyPair {
                    public_key: PublicKey::deserialize(&public_bytes)
                        .map_err(|e| SignalProtocolError::InvalidState("prekey", e.to_string()))?,
                    private_key: PrivateKey::deserialize(&private_bytes)
                        .map_err(|e| SignalProtocolError::InvalidState("prekey", e.to_string()))?,
                };
                Ok(PreKeyRecord::new(pre_key_id, &key_pair))
            }
            None => Err(SignalProtocolError::InvalidPreKeyId),
        }
    }

    async fn remove_pre_key(
        &mut self,
        pre_key_id: PreKeyId,
    ) -> Result<(), SignalProtocolError> {
        let pre_key_id_u32: u32 = pre_key_id.into();
        sqlx::query("DELETE FROM pre_keys WHERE pre_key_id = ?")
            .bind(pre_key_id_u32 as i64)
            .execute(&self.pool)
            .await
            .map_err(|e| SignalProtocolError::InvalidState("prekey", e.to_string()))?;
        Ok(())
    }
}

// ============== SignedPreKeyStore 实现 ==============

#[async_trait::async_trait(?Send)]
impl SignedPreKeyStore for SQLiteStore {
    async fn save_signed_pre_key(
        &mut self,
        signed_pre_key_id: SignedPreKeyId,
        record: &SignedPreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        let signed_pre_key_id_u32: u32 = signed_pre_key_id.into();
        self.save_signed_pre_key_record(signed_pre_key_id_u32, record)
            .await
            .map_err(|e| SignalProtocolError::InvalidState("signed_prekey", e.to_string()))
    }

    async fn get_signed_pre_key(
        &self,
        signed_pre_key_id: SignedPreKeyId,
    ) -> Result<SignedPreKeyRecord, SignalProtocolError> {
        let signed_pre_key_id_u32: u32 = signed_pre_key_id.into();
        let row = sqlx::query_as::<_, (i64, Vec<u8>, Vec<u8>, Vec<u8>)>(
            "SELECT timestamp, key_pair_public, key_pair_private, signature FROM signed_pre_keys WHERE signed_pre_key_id = ?"
        )
        .bind(signed_pre_key_id_u32 as i64)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("signed_prekey", e.to_string()))?;

        match row {
            Some((timestamp, public_bytes, private_bytes, signature)) => {
                let key_pair = KeyPair {
                    public_key: PublicKey::deserialize(&public_bytes)
                        .map_err(|e| SignalProtocolError::InvalidState("signed_prekey", e.to_string()))?,
                    private_key: PrivateKey::deserialize(&private_bytes)
                        .map_err(|e| SignalProtocolError::InvalidState("signed_prekey", e.to_string()))?,
                };
                SignedPreKeyRecord::new(
                    signed_pre_key_id,
                    Timestamp::from_epoch_millis(timestamp as u64),
                    &key_pair,
                    &signature,
                )
                .map_err(|e| SignalProtocolError::InvalidState("signed_prekey", e.to_string()))
            }
            None => Err(SignalProtocolError::InvalidSignedPreKeyId),
        }
    }
}

// ============== KyberPreKeyStore 实现 ==============

#[async_trait::async_trait(?Send)]
impl KyberPreKeyStore for SQLiteStore {
    async fn save_kyber_pre_key(
        &mut self,
        kyber_pre_key_id: KyberPreKeyId,
        record: &KyberPreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        let kyber_pre_key_id_u32: u32 = kyber_pre_key_id.into();
        self.save_kyber_pre_key_record(kyber_pre_key_id_u32, record)
            .await
            .map_err(|e| SignalProtocolError::InvalidState("kyber_prekey", e.to_string()))
    }

    async fn get_kyber_pre_key(
        &self,
        kyber_pre_key_id: KyberPreKeyId,
    ) -> Result<KyberPreKeyRecord, SignalProtocolError> {
        let kyber_pre_key_id_u32: u32 = kyber_pre_key_id.into();
        let row = sqlx::query_as::<_, (i64, Vec<u8>, Vec<u8>, Vec<u8>)>(
            "SELECT timestamp, public_key, secret_key, signature FROM kyber_pre_keys WHERE kyber_pre_key_id = ?"
        )
        .bind(kyber_pre_key_id_u32 as i64)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("kyber_prekey", e.to_string()))?;

        match row {
            Some((timestamp, public_bytes, secret_bytes, signature)) => {
                let public_key = libsignal_protocol::kem::PublicKey::deserialize(&public_bytes)
                    .map_err(|e| SignalProtocolError::InvalidState("kyber_prekey", e.to_string()))?;
                
                let secret_key = libsignal_protocol::kem::SecretKey::deserialize(&secret_bytes)
                    .map_err(|e| SignalProtocolError::InvalidState("kyber_prekey", e.to_string()))?;
                
                let key_pair = libsignal_protocol::kem::KeyPair {
                    public_key,
                    secret_key,
                };

                let mut kyber_pre_key_record = KyberPreKeyRecord::new(
                    kyber_pre_key_id,
                    Timestamp::from_epoch_millis(timestamp as u64),
                    &key_pair,
                    &signature,
                );
                Ok(kyber_pre_key_record)
            }
            None => Err(SignalProtocolError::InvalidKyberPreKeyId),
        }
    }

    async fn mark_kyber_pre_key_used(
        &mut self,
        _kyber_pre_key_id: KyberPreKeyId,
        _ec_prekey_id: SignedPreKeyId,
        _base_key: &PublicKey,
    ) -> Result<(), SignalProtocolError> {
        // 简化实现：不删除 Kyber 预密钥
        // 实际应该标记为已使用或删除
        Ok(())
    }
}

// ============== SessionStore 实现 ==============

#[async_trait::async_trait(?Send)]
impl SessionStore for SQLiteStore {
    async fn load_session(
        &self,
        address: &ProtocolAddress,
    ) -> Result<Option<SessionRecord>, SignalProtocolError> {
        let device_id: u8 = address.device_id().into();
        let row = sqlx::query_as::<_, (Vec<u8>,)>(
            "SELECT session_data FROM sessions WHERE recipient_id = ? AND device_id = ?"
        )
        .bind(address.name())
        .bind(device_id as i64)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("session", e.to_string()))?;

        match row {
            Some((session_data,)) => {
                let record = SessionRecord::deserialize(&session_data)?;
                Ok(Some(record))
            }
            None => Ok(None),
        }
    }

    async fn store_session(
        &mut self,
        address: &ProtocolAddress,
        record: &SessionRecord,
    ) -> Result<(), SignalProtocolError> {
        self.save_session(address, record)
            .await
            .map_err(|e| SignalProtocolError::InvalidState("session", e.to_string()))
    }
}

/// 创建 SQLite Store 用于测试
pub async fn create_test_store() -> Result<Arc<SQLiteStore>, sqlx::Error> {
    // 使用内存数据库进行测试
    let store = SQLiteStore::new("sqlite::memory:").await?;
    Ok(Arc::new(store))
}
