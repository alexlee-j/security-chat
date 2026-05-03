//! libsignal-protocol Store 使用 SQLite 持久化存储

use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use libsignal_protocol::{
    Direction, GenericSignedPreKey, IdentityChange, IdentityKey, IdentityKeyPair, IdentityKeyStore,
    KeyPair, KyberPreKeyId, KyberPreKeyRecord, KyberPreKeyStore, PreKeyId, PreKeyRecord,
    PreKeyStore, PrivateKey, ProtocolAddress, PublicKey, SessionRecord, SessionStore,
    SignalProtocolError, SignedPreKeyId, SignedPreKeyRecord, SignedPreKeyStore, Timestamp,
};
use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;

const ENCRYPTED_PREFIX: &[u8] = b"v1:";

/// SQLite Signal Protocol Store
///
/// 整合所有 Store trait 到一个结构体中
pub struct SQLiteStore {
    pool: SqlitePool,
}

impl SQLiteStore {
    /// 创建新的 SQLite Store
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let options = SqliteConnectOptions::from_str(database_url)
            .map_err(|error| sqlx::Error::Configuration(Box::new(error)))?
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;
        let store = Self { pool };
        store.init_schema().await?;
        Ok(store)
    }

    /// 获取连接池引用（用于 get_prekey_bundle 等函数）
    #[cfg(test)]
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn pre_key_ids(&self, limit: usize) -> Result<Vec<u32>, sqlx::Error> {
        let rows = sqlx::query_scalar::<_, i64>(
            "SELECT pre_key_id FROM pre_keys ORDER BY pre_key_id ASC LIMIT ?",
        )
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(|id| id as u32).collect())
    }

    pub async fn pre_key_count(&self) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar("SELECT COUNT(*) FROM pre_keys")
            .fetch_one(&self.pool)
            .await
    }

    pub async fn max_pre_key_id(&self) -> Result<u32, sqlx::Error> {
        let max_id: Option<i64> = sqlx::query_scalar("SELECT MAX(pre_key_id) FROM pre_keys")
            .fetch_one(&self.pool)
            .await?;
        Ok(max_id.unwrap_or(0) as u32)
    }

    pub async fn has_signed_pre_key(&self, signed_pre_key_id: u32) -> Result<bool, sqlx::Error> {
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM signed_pre_keys WHERE signed_pre_key_id = ?")
                .bind(signed_pre_key_id as i64)
                .fetch_one(&self.pool)
                .await?;
        Ok(count > 0)
    }

    pub async fn has_kyber_pre_key(&self, kyber_pre_key_id: u32) -> Result<bool, sqlx::Error> {
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM kyber_pre_keys WHERE kyber_pre_key_id = ?")
                .bind(kyber_pre_key_id as i64)
                .fetch_one(&self.pool)
                .await?;
        Ok(count > 0)
    }

    async fn init_schema(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS identity_keys (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                public_key BLOB NOT NULL,
                private_key BLOB NOT NULL,
                registration_id INTEGER NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS pre_keys (
                pre_key_id INTEGER PRIMARY KEY,
                key_pair_public BLOB NOT NULL,
                key_pair_private BLOB NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS signed_pre_keys (
                signed_pre_key_id INTEGER PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                key_pair_public BLOB NOT NULL,
                key_pair_private BLOB NOT NULL,
                signature BLOB NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS kyber_pre_keys (
                kyber_pre_key_id INTEGER PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                public_key BLOB NOT NULL,
                secret_key BLOB NOT NULL,
                signature BLOB NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                recipient_id TEXT NOT NULL,
                device_id INTEGER NOT NULL,
                session_data BLOB NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (recipient_id, device_id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 初始化身份密钥
    pub async fn init_identity(
        &self,
        identity_key_pair: &IdentityKeyPair,
        registration_id: u32,
    ) -> Result<(), sqlx::Error> {
        // 检查是否已存在身份密钥
        let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM identity_keys")
            .fetch_one(&self.pool)
            .await?;

        if existing > 0 {
            return Ok(()); // 已存在，跳过
        }

        sqlx::query(
            r#"
            INSERT INTO identity_keys (id, public_key, private_key, registration_id)
            VALUES (1, ?, ?, ?)
            "#,
        )
        .bind(identity_key_pair.public_key().serialize())
        .bind(Self::encrypt_blob(
            &identity_key_pair.private_key().serialize(),
        )?)
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
        let key_pair = record
            .key_pair()
            .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO pre_keys (pre_key_id, key_pair_public, key_pair_private)
            VALUES (?, ?, ?)
            "#,
        )
        .bind(pre_key_id as i64)
        .bind(key_pair.public_key.serialize())
        .bind(Self::encrypt_blob(&key_pair.private_key.serialize())?)
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
        let key_pair = record
            .key_pair()
            .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO signed_pre_keys 
            (signed_pre_key_id, timestamp, key_pair_public, key_pair_private, signature)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(signed_pre_key_id as i64)
        .bind(
            record
                .timestamp()
                .map_err(|e| sqlx::Error::Protocol(e.to_string()))?
                .epoch_millis() as i64,
        )
        .bind(key_pair.public_key.serialize())
        .bind(Self::encrypt_blob(&key_pair.private_key.serialize())?)
        .bind(
            record
                .signature()
                .map_err(|e| sqlx::Error::Protocol(e.to_string()))?,
        )
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
        let key_pair = record
            .key_pair()
            .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
        let timestamp = record
            .timestamp()
            .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
        let signature = record
            .signature()
            .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO kyber_pre_keys
            (kyber_pre_key_id, timestamp, public_key, secret_key, signature)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(kyber_pre_key_id as i64)
        .bind(timestamp.epoch_millis() as i64)
        .bind(key_pair.public_key.serialize())
        .bind(Self::encrypt_blob(&key_pair.secret_key.serialize())?)
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
        let session_data = record
            .serialize()
            .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
        let device_id: u8 = address.device_id().into();

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO sessions (recipient_id, device_id, session_data, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            "#,
        )
        .bind(address.name())
        .bind(device_id as i64)
        .bind(Self::encrypt_blob(&session_data)?)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    fn encrypt_blob(plaintext: &[u8]) -> Result<Vec<u8>, sqlx::Error> {
        let key = Self::signal_store_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|error| sqlx::Error::Protocol(format!("cipher init failed: {error}")))?;
        let nonce_bytes = rand::random::<[u8; 12]>();
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|error| sqlx::Error::Protocol(format!("encrypt failed: {error}")))?;

        let mut out =
            Vec::with_capacity(ENCRYPTED_PREFIX.len() + nonce_bytes.len() + ciphertext.len());
        out.extend_from_slice(ENCRYPTED_PREFIX);
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&ciphertext);
        Ok(out)
    }

    fn decrypt_blob(stored: &[u8]) -> Result<Vec<u8>, sqlx::Error> {
        if !stored.starts_with(ENCRYPTED_PREFIX) {
            return Ok(stored.to_vec());
        }
        let body = &stored[ENCRYPTED_PREFIX.len()..];
        if body.len() < 12 {
            return Err(sqlx::Error::Protocol(
                "encrypted blob is truncated".to_string(),
            ));
        }
        let (nonce_bytes, ciphertext) = body.split_at(12);
        let key = Self::signal_store_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|error| sqlx::Error::Protocol(format!("cipher init failed: {error}")))?;
        cipher
            .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
            .map_err(|error| sqlx::Error::Protocol(format!("decrypt failed: {error}")))
    }

    #[cfg(test)]
    fn signal_store_key() -> Result<[u8; 32], sqlx::Error> {
        Ok([0x51; 32])
    }

    #[cfg(not(test))]
    fn signal_store_key() -> Result<[u8; 32], sqlx::Error> {
        crate::crypto::secure_key_provider::load_or_create_key(
            crate::crypto::secure_key_provider::SecureKeySlot::SignalStore,
        )
        .map_err(|error| sqlx::Error::Protocol(format!("secure key provider failed: {error}")))
    }
}

// ============== IdentityKeyStore 实现 ==============

#[async_trait::async_trait(?Send)]
impl IdentityKeyStore for SQLiteStore {
    async fn get_identity_key_pair(&self) -> Result<IdentityKeyPair, SignalProtocolError> {
        let row = sqlx::query_as::<_, (Vec<u8>, Vec<u8>, i64)>(
            "SELECT public_key, private_key, registration_id FROM identity_keys LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("identity", e.to_string()))?;

        match row {
            Some((public_key_bytes, private_key_bytes, _)) => {
                let private_key_bytes = Self::decrypt_blob(&private_key_bytes)
                    .map_err(|e| SignalProtocolError::InvalidState("identity", e.to_string()))?;
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
        let row = sqlx::query_scalar::<_, i64>("SELECT registration_id FROM identity_keys LIMIT 1")
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
        _address: &ProtocolAddress,
        _identity_key: &IdentityKey,
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

    async fn get_identity(
        &self,
        _address: &ProtocolAddress,
    ) -> Result<Option<IdentityKey>, SignalProtocolError> {
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

    async fn get_pre_key(&self, pre_key_id: PreKeyId) -> Result<PreKeyRecord, SignalProtocolError> {
        let pre_key_id_u32: u32 = pre_key_id.into();
        let row = sqlx::query_as::<_, (Vec<u8>, Vec<u8>)>(
            "SELECT key_pair_public, key_pair_private FROM pre_keys WHERE pre_key_id = ?",
        )
        .bind(pre_key_id_u32 as i64)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("prekey", e.to_string()))?;

        match row {
            Some((public_bytes, private_bytes)) => {
                let private_bytes = Self::decrypt_blob(&private_bytes)
                    .map_err(|e| SignalProtocolError::InvalidState("prekey", e.to_string()))?;
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

    async fn remove_pre_key(&mut self, pre_key_id: PreKeyId) -> Result<(), SignalProtocolError> {
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
                let private_bytes = Self::decrypt_blob(&private_bytes).map_err(|e| {
                    SignalProtocolError::InvalidState("signed_prekey", e.to_string())
                })?;
                let key_pair = KeyPair {
                    public_key: PublicKey::deserialize(&public_bytes).map_err(|e| {
                        SignalProtocolError::InvalidState("signed_prekey", e.to_string())
                    })?,
                    private_key: PrivateKey::deserialize(&private_bytes).map_err(|e| {
                        SignalProtocolError::InvalidState("signed_prekey", e.to_string())
                    })?,
                };
                Ok(SignedPreKeyRecord::new(
                    signed_pre_key_id,
                    Timestamp::from_epoch_millis(timestamp as u64),
                    &key_pair,
                    &signature,
                ))
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
                let secret_bytes = Self::decrypt_blob(&secret_bytes).map_err(|e| {
                    SignalProtocolError::InvalidState("kyber_prekey", e.to_string())
                })?;
                let public_key = libsignal_protocol::kem::PublicKey::deserialize(&public_bytes)
                    .map_err(|e| {
                        SignalProtocolError::InvalidState("kyber_prekey", e.to_string())
                    })?;

                let secret_key = libsignal_protocol::kem::SecretKey::deserialize(&secret_bytes)
                    .map_err(|e| {
                        SignalProtocolError::InvalidState("kyber_prekey", e.to_string())
                    })?;

                let key_pair = libsignal_protocol::kem::KeyPair {
                    public_key,
                    secret_key,
                };

                let kyber_pre_key_record = KyberPreKeyRecord::new(
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
            "SELECT session_data FROM sessions WHERE recipient_id = ? AND device_id = ?",
        )
        .bind(address.name())
        .bind(device_id as i64)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SignalProtocolError::InvalidState("session", e.to_string()))?;

        match row {
            Some((session_data,)) => {
                let session_data = Self::decrypt_blob(&session_data)
                    .map_err(|e| SignalProtocolError::InvalidState("session", e.to_string()))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use libsignal_protocol::{IdentityKeyStore, SessionRecord};
    async fn initialized_store() -> SQLiteStore {
        let store = SQLiteStore::new("sqlite::memory:")
            .await
            .expect("create store");
        let mut rng = rand::rng();
        let identity_key_pair = IdentityKeyPair::generate(&mut rng);
        store
            .init_identity(&identity_key_pair, 31337)
            .await
            .expect("init identity");
        store
    }

    #[tokio::test]
    async fn new_store_initializes_signal_schema() {
        let store = initialized_store().await;
        let registration_id = store
            .get_local_registration_id()
            .await
            .expect("registration id should round trip");

        assert_eq!(registration_id, 31337);
    }

    #[tokio::test]
    async fn identity_private_key_is_not_stored_as_plaintext() {
        let store = initialized_store().await;
        let identity = store
            .get_identity_key_pair()
            .await
            .expect("identity key pair");
        let plaintext_private = identity.private_key().serialize();
        let stored_private: Vec<u8> =
            sqlx::query_scalar("SELECT private_key FROM identity_keys LIMIT 1")
                .fetch_one(store.pool())
                .await
                .expect("raw stored private key");

        assert_ne!(stored_private, plaintext_private);
    }

    #[tokio::test]
    async fn session_record_is_not_stored_as_plaintext() {
        let store = initialized_store().await;
        let address = ProtocolAddress::new(
            "bob#device".to_string(),
            libsignal_protocol::DeviceId::new(1).unwrap(),
        );
        let record = SessionRecord::new_fresh();
        let plaintext_session = record.serialize().expect("serialize session");

        store
            .save_session(&address, &record)
            .await
            .expect("save session");
        let stored_session: Vec<u8> =
            sqlx::query_scalar("SELECT session_data FROM sessions LIMIT 1")
                .fetch_one(store.pool())
                .await
                .expect("raw stored session");

        assert_ne!(stored_session, plaintext_session);
        let restored = store.load_session(&address).await.expect("load session");
        assert!(restored.is_some());
    }

    #[tokio::test]
    async fn identity_key_survives_store_reopen() {
        let db_path =
            std::env::temp_dir().join(format!("security-chat-signal-{}.db", uuid::Uuid::new_v4()));
        let database_url = format!("sqlite://{}", db_path.display());

        let store = initialized_file_store(&database_url).await;
        let original = store
            .get_identity_key_pair()
            .await
            .expect("original identity");
        drop(store);

        let reopened = SQLiteStore::new(&database_url).await.expect("reopen store");
        let restored = reopened
            .get_identity_key_pair()
            .await
            .expect("restored identity");

        assert_eq!(
            restored.identity_key().serialize(),
            original.identity_key().serialize()
        );
        assert_eq!(
            restored.private_key().serialize(),
            original.private_key().serialize()
        );

        let _ = std::fs::remove_file(db_path);
    }

    async fn initialized_file_store(database_url: &str) -> SQLiteStore {
        let store = SQLiteStore::new(database_url)
            .await
            .expect("create file store");
        let mut rng = rand::rng();
        let identity_key_pair = IdentityKeyPair::generate(&mut rng);
        store
            .init_identity(&identity_key_pair, 31337)
            .await
            .expect("init identity");
        store
    }
}
