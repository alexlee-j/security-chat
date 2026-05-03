//! SQLite Local Store - 本地消息持久化存储
//!
//! 使用 rusqlite 实现本地 SQLite 数据库操作
//! 支持会话、消息、草稿的 CRUD
//!
//! Week 10 实现：替代内存存储，实现持久化

use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use chrono::Utc;
use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

const LOCAL_MESSAGE_CONTENT_PREFIX: &str = "v1:";

/// 对话结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    #[serde(rename = "type")]
    pub conversation_type: i32,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_message_at: Option<i64>,
    pub last_message_preview: Option<String>,
}

/// 消息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: String,
    #[serde(rename = "type")]
    pub message_type: i32,
    pub content: Option<String>,
    pub nonce: String,
    pub is_burn: bool,
    pub burn_duration: Option<i32>,
    pub is_read: bool,
    pub created_at: i64,
    pub server_timestamp: Option<i64>,
    pub local_timestamp: i64,
}

/// 草稿结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Draft {
    pub id: String,
    pub conversation_id: String,
    pub content: Option<String>,
    pub updated_at: i64,
}

/// SQLite 数据库连接包装
pub struct SqliteStore {
    conn: Connection,
}

impl SqliteStore {
    /// 创建新的 SQLite 存储
    pub fn new(db_path: &PathBuf) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;
        let store = Self { conn };
        store.init_schema()?;
        Ok(store)
    }

    /// 创建内存数据库（用于测试）
    #[allow(dead_code)]
    pub fn new_in_memory() -> SqliteResult<Self> {
        let conn = Connection::open_in_memory()?;
        let store = Self { conn };
        store.init_schema()?;
        Ok(store)
    }

    /// 初始化数据库表结构
    fn init_schema(&self) -> SqliteResult<()> {
        // 会话表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                type INTEGER NOT NULL,
                name TEXT,
                avatar_url TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                last_message_at INTEGER,
                last_message_preview TEXT
            )",
            [],
        )?;

        // 消息表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                type INTEGER NOT NULL,
                content TEXT,
                nonce TEXT NOT NULL,
                is_burn INTEGER DEFAULT 0,
                burn_duration INTEGER,
                is_read INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                server_timestamp INTEGER,
                local_timestamp INTEGER NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            )",
            [],
        )?;

        // 草稿表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS drafts (
                id TEXT PRIMARY KEY,
                conversation_id TEXT UNIQUE NOT NULL,
                content TEXT,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 密钥表 (安全存储)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS keychain (
                id TEXT PRIMARY KEY,
                key_type TEXT NOT NULL,
                key_data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 创建索引
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_drafts_conversation ON drafts(conversation_id)",
            [],
        )?;

        self.migrate_plaintext_message_content()?;

        Ok(())
    }

    fn migrate_plaintext_message_content(&self) -> SqliteResult<()> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content FROM messages
             WHERE content IS NOT NULL AND content NOT LIKE 'v1:%'",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let pending: SqliteResult<Vec<(String, String)>> = rows.collect();

        for (id, plaintext) in pending? {
            let encrypted = Self::encrypt_message_content(&plaintext)?;
            self.conn.execute(
                "UPDATE messages SET content = ?1 WHERE id = ?2",
                params![encrypted, id],
            )?;
        }

        Ok(())
    }

    // ==================== Conversation CRUD ====================

    /// 保存或更新会话
    pub fn save_conversation(&self, conv: &Conversation) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO conversations (id, type, name, avatar_url, created_at, updated_at, last_message_at, last_message_preview)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                conv.id,
                conv.conversation_type,
                conv.name,
                conv.avatar_url,
                conv.created_at,
                conv.updated_at,
                conv.last_message_at,
                conv.last_message_preview,
            ],
        )?;
        Ok(())
    }

    /// 获取所有会话
    pub fn get_conversations(&self) -> SqliteResult<Vec<Conversation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, type, name, avatar_url, created_at, updated_at, last_message_at, last_message_preview
             FROM conversations ORDER BY last_message_at DESC NULLS LAST, updated_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                conversation_type: row.get(1)?,
                name: row.get(2)?,
                avatar_url: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                last_message_at: row.get(6)?,
                last_message_preview: row.get(7)?,
            })
        })?;

        rows.collect()
    }

    /// 获取单个会话
    #[allow(dead_code)]
    pub fn get_conversation(&self, id: &str) -> SqliteResult<Option<Conversation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, type, name, avatar_url, created_at, updated_at, last_message_at, last_message_preview
             FROM conversations WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Conversation {
                id: row.get(0)?,
                conversation_type: row.get(1)?,
                name: row.get(2)?,
                avatar_url: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                last_message_at: row.get(6)?,
                last_message_preview: row.get(7)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// 删除会话及其关联消息
    #[allow(dead_code)]
    pub fn delete_conversation(&self, id: &str) -> SqliteResult<()> {
        self.conn.execute(
            "DELETE FROM messages WHERE conversation_id = ?1",
            params![id],
        )?;
        self.conn
            .execute("DELETE FROM drafts WHERE conversation_id = ?1", params![id])?;
        self.conn
            .execute("DELETE FROM conversations WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== Message CRUD ====================

    /// 保存消息
    pub fn save_message(&self, msg: &Message) -> SqliteResult<()> {
        let encrypted_content = msg
            .content
            .as_deref()
            .map(Self::encrypt_message_content)
            .transpose()?;

        self.conn.execute(
            "INSERT OR REPLACE INTO messages (id, conversation_id, sender_id, type, content, nonce, is_burn, burn_duration, is_read, created_at, server_timestamp, local_timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
                conversation_id = excluded.conversation_id,
                sender_id = excluded.sender_id,
                type = excluded.type,
                content = COALESCE(excluded.content, messages.content),
                nonce = excluded.nonce,
                is_burn = excluded.is_burn,
                burn_duration = excluded.burn_duration,
                is_read = excluded.is_read,
                created_at = excluded.created_at,
                server_timestamp = COALESCE(excluded.server_timestamp, messages.server_timestamp),
                local_timestamp = excluded.local_timestamp",
            params![
                msg.id,
                msg.conversation_id,
                msg.sender_id,
                msg.message_type,
                encrypted_content,
                msg.nonce,
                msg.is_burn as i32,
                msg.burn_duration,
                msg.is_read as i32,
                msg.created_at,
                msg.server_timestamp,
                msg.local_timestamp,
            ],
        )?;
        Ok(())
    }

    /// 获取会话消息（分页）
    pub fn get_messages(
        &self,
        conversation_id: &str,
        limit: u32,
        before: Option<i64>,
    ) -> SqliteResult<Vec<Message>> {
        match before {
            Some(ts) => {
                let mut stmt = self.conn.prepare(
                    "SELECT id, conversation_id, sender_id, type, content, nonce, is_burn, burn_duration, is_read, created_at, server_timestamp, local_timestamp
                     FROM messages WHERE conversation_id = ?1 AND created_at < ?2
                     ORDER BY created_at DESC LIMIT ?3"
                )?;
                let rows = stmt.query_map(params![conversation_id, ts, limit], |row| {
                    self.row_to_message(row)
                })?;
                rows.collect()
            }
            None => {
                let mut stmt = self.conn.prepare(
                    "SELECT id, conversation_id, sender_id, type, content, nonce, is_burn, burn_duration, is_read, created_at, server_timestamp, local_timestamp
                     FROM messages WHERE conversation_id = ?1
                     ORDER BY created_at DESC LIMIT ?2"
                )?;
                let rows = stmt.query_map(params![conversation_id, limit], |row| {
                    self.row_to_message(row)
                })?;
                rows.collect()
            }
        }
    }

    fn row_to_message(&self, row: &rusqlite::Row) -> SqliteResult<Message> {
        let encrypted_content: Option<String> = row.get(4)?;
        let content = encrypted_content
            .as_deref()
            .map(Self::decrypt_message_content)
            .transpose()?;

        Ok(Message {
            id: row.get(0)?,
            conversation_id: row.get(1)?,
            sender_id: row.get(2)?,
            message_type: row.get(3)?,
            content,
            nonce: row.get(5)?,
            is_burn: row.get::<_, i32>(6)? != 0,
            burn_duration: row.get(7)?,
            is_read: row.get::<_, i32>(8)? != 0,
            created_at: row.get(9)?,
            server_timestamp: row.get(10)?,
            local_timestamp: row.get(11)?,
        })
    }

    fn encrypt_message_content(plaintext: &str) -> SqliteResult<String> {
        let key = Self::local_message_store_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|error| Self::crypto_error(format!("cipher init failed: {error}")))?;
        let nonce_bytes = rand::random::<[u8; 12]>();
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|error| Self::crypto_error(format!("encrypt failed: {error}")))?;
        let mut encoded = nonce_bytes.to_vec();
        encoded.extend(ciphertext);
        Ok(format!(
            "{}{}",
            LOCAL_MESSAGE_CONTENT_PREFIX,
            BASE64_STANDARD.encode(encoded),
        ))
    }

    fn decrypt_message_content(stored: &str) -> SqliteResult<String> {
        if !stored.starts_with(LOCAL_MESSAGE_CONTENT_PREFIX) {
            return Ok(stored.to_string());
        }

        let encoded = stored.trim_start_matches(LOCAL_MESSAGE_CONTENT_PREFIX);
        let encrypted = BASE64_STANDARD
            .decode(encoded)
            .map_err(|error| Self::crypto_error(format!("base64 decode failed: {error}")))?;
        if encrypted.len() < 13 {
            return Err(Self::crypto_error(
                "encrypted content is too short".to_string(),
            ));
        }

        let key = Self::local_message_store_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|error| Self::crypto_error(format!("cipher init failed: {error}")))?;
        let nonce = Nonce::from_slice(&encrypted[..12]);
        let plaintext = cipher
            .decrypt(nonce, &encrypted[12..])
            .map_err(|error| Self::crypto_error(format!("decrypt failed: {error}")))?;

        String::from_utf8(plaintext)
            .map_err(|error| Self::crypto_error(format!("utf8 decode failed: {error}")))
    }

    #[cfg(test)]
    fn local_message_store_key() -> SqliteResult<[u8; 32]> {
        Ok([0x42; 32])
    }

    #[cfg(not(test))]
    fn local_message_store_key() -> SqliteResult<[u8; 32]> {
        crate::crypto::secure_key_provider::load_or_create_key(
            crate::crypto::secure_key_provider::SecureKeySlot::LocalMessageStore,
        )
        .map_err(|error| Self::crypto_error(format!("secure key provider failed: {error}")))
    }

    fn crypto_error(message: String) -> rusqlite::Error {
        rusqlite::Error::InvalidParameterName(format!("local message crypto error: {message}"))
    }

    /// 获取单条消息
    #[allow(dead_code)]
    pub fn get_message(&self, id: &str) -> SqliteResult<Option<Message>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, conversation_id, sender_id, type, content, nonce, is_burn, burn_duration, is_read, created_at, server_timestamp, local_timestamp
             FROM messages WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(self.row_to_message(row)?))
        } else {
            Ok(None)
        }
    }

    /// 删除消息
    #[allow(dead_code)]
    pub fn delete_message(&self, id: &str) -> SqliteResult<()> {
        self.conn
            .execute("DELETE FROM messages WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// 标记消息已读
    #[allow(dead_code)]
    pub fn mark_message_read(&self, id: &str) -> SqliteResult<()> {
        self.conn
            .execute("UPDATE messages SET is_read = 1 WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// 获取未读消息数量
    #[allow(dead_code)]
    pub fn get_unread_count(&self, conversation_id: &str) -> SqliteResult<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE conversation_id = ?1 AND is_read = 0",
            params![conversation_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    // ==================== Draft CRUD ====================

    /// 保存草稿
    pub fn save_draft(&self, draft: &Draft) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO drafts (id, conversation_id, content, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                draft.id,
                draft.conversation_id,
                draft.content,
                draft.updated_at,
            ],
        )?;
        Ok(())
    }

    /// 获取草稿
    #[allow(dead_code)]
    pub fn get_draft(&self, conversation_id: &str) -> SqliteResult<Option<Draft>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, conversation_id, content, updated_at FROM drafts WHERE conversation_id = ?1"
        )?;

        let mut rows = stmt.query(params![conversation_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Draft {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                content: row.get(2)?,
                updated_at: row.get(3)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// 删除草稿
    #[allow(dead_code)]
    pub fn delete_draft(&self, conversation_id: &str) -> SqliteResult<()> {
        self.conn.execute(
            "DELETE FROM drafts WHERE conversation_id = ?1",
            params![conversation_id],
        )?;
        Ok(())
    }

    // ==================== Keychain CRUD ====================

    /// 存储密钥
    #[allow(dead_code)]
    pub fn keychain_store(&self, id: &str, key_type: &str, key_data: &[u8]) -> SqliteResult<()> {
        let now = Utc::now().timestamp();
        self.conn.execute(
            "INSERT OR REPLACE INTO keychain (id, key_type, key_data, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                id,
                key_type,
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, key_data),
                now,
                now,
            ],
        )?;
        Ok(())
    }

    /// 检索密钥
    #[allow(dead_code)]
    pub fn keychain_retrieve(&self, key_type: &str) -> SqliteResult<Option<Vec<u8>>> {
        let mut stmt = self
            .conn
            .prepare("SELECT key_data FROM keychain WHERE key_type = ?1")?;

        let mut rows = stmt.query(params![key_type])?;
        if let Some(row) = rows.next()? {
            let data: String = row.get(0)?;
            let decoded = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &data)
                .map_err(|e| {
                    rusqlite::Error::InvalidParameterName(format!("base64 decode error: {}", e))
                })?;
            Ok(Some(decoded))
        } else {
            Ok(None)
        }
    }

    /// 删除密钥
    #[allow(dead_code)]
    pub fn keychain_delete(&self, key_type: &str) -> SqliteResult<()> {
        self.conn.execute(
            "DELETE FROM keychain WHERE key_type = ?1",
            params![key_type],
        )?;
        Ok(())
    }
}

/// 使用 Arc<Mutex<...>> 包装以便在 Tauri 命令中使用
pub type DbStore = Arc<Mutex<SqliteStore>>;

/// 创建数据库存储
pub fn create_db_store(db_path: &PathBuf) -> Result<DbStore, String> {
    let store = SqliteStore::new(db_path).map_err(|e| e.to_string())?;
    Ok(Arc::new(Mutex::new(store)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_store() -> SqliteStore {
        SqliteStore::new_in_memory().expect("should create in-memory store")
    }

    #[test]
    fn test_conversation_crud() {
        let store = create_test_store();
        let now = Utc::now().timestamp();

        let conv = Conversation {
            id: "conv1".to_string(),
            conversation_type: 1,
            name: Some("Test Chat".to_string()),
            avatar_url: None,
            created_at: now,
            updated_at: now,
            last_message_at: None,
            last_message_preview: None,
        };

        // Save
        store
            .save_conversation(&conv)
            .expect("should save conversation");

        // Get
        let result = store
            .get_conversation("conv1")
            .expect("should get conversation");
        assert!(result.is_some());
        let loaded = result.unwrap();
        assert_eq!(loaded.id, "conv1");
        assert_eq!(loaded.name, Some("Test Chat".to_string()));

        // Get all
        let all = store
            .get_conversations()
            .expect("should get all conversations");
        assert_eq!(all.len(), 1);

        // Delete
        store
            .delete_conversation("conv1")
            .expect("should delete conversation");
        let result = store
            .get_conversation("conv1")
            .expect("should get conversation");
        assert!(result.is_none());
    }

    #[test]
    fn test_message_crud() {
        let store = create_test_store();
        let now = Utc::now().timestamp();

        // Create conversation first
        let conv = Conversation {
            id: "conv1".to_string(),
            conversation_type: 1,
            name: None,
            avatar_url: None,
            created_at: now,
            updated_at: now,
            last_message_at: None,
            last_message_preview: None,
        };
        store
            .save_conversation(&conv)
            .expect("should save conversation");

        // Save message
        let msg = Message {
            id: "msg1".to_string(),
            conversation_id: "conv1".to_string(),
            sender_id: "user1".to_string(),
            message_type: 1,
            content: Some("Hello".to_string()),
            nonce: "nonce123".to_string(),
            is_burn: false,
            burn_duration: None,
            is_read: false,
            created_at: now,
            server_timestamp: None,
            local_timestamp: now,
        };
        store.save_message(&msg).expect("should save message");

        // Get messages
        let messages = store
            .get_messages("conv1", 10, None)
            .expect("should get messages");
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, Some("Hello".to_string()));

        // Delete message
        store.delete_message("msg1").expect("should delete message");
        let messages = store
            .get_messages("conv1", 10, None)
            .expect("should get messages");
        assert!(messages.is_empty());
    }

    #[test]
    fn test_message_content_is_not_stored_as_plaintext() {
        let store = create_test_store();
        let now = Utc::now().timestamp();
        store
            .save_conversation(&Conversation {
                id: "conv-secure".to_string(),
                conversation_type: 1,
                name: None,
                avatar_url: None,
                created_at: now,
                updated_at: now,
                last_message_at: None,
                last_message_preview: None,
            })
            .expect("should save conversation");

        store
            .save_message(&Message {
                id: "msg-secure".to_string(),
                conversation_id: "conv-secure".to_string(),
                sender_id: "user1".to_string(),
                message_type: 1,
                content: Some("cached plaintext".to_string()),
                nonce: "nonce-secure".to_string(),
                is_burn: false,
                burn_duration: None,
                is_read: false,
                created_at: now,
                server_timestamp: Some(1),
                local_timestamp: now,
            })
            .expect("should save message");

        let raw_content: String = store
            .conn
            .query_row(
                "SELECT content FROM messages WHERE id = ?1",
                params!["msg-secure"],
                |row| row.get(0),
            )
            .expect("should read raw content");
        assert_ne!(raw_content, "cached plaintext");
        assert!(raw_content.starts_with("v1:"));
    }

    #[test]
    fn test_encrypted_message_content_reads_back_as_plaintext() {
        let store = create_test_store();
        let now = Utc::now().timestamp();
        store
            .save_conversation(&Conversation {
                id: "conv-readable".to_string(),
                conversation_type: 1,
                name: None,
                avatar_url: None,
                created_at: now,
                updated_at: now,
                last_message_at: None,
                last_message_preview: None,
            })
            .expect("should save conversation");

        store
            .save_message(&Message {
                id: "msg-readable".to_string(),
                conversation_id: "conv-readable".to_string(),
                sender_id: "user1".to_string(),
                message_type: 1,
                content: Some("readable after decrypt".to_string()),
                nonce: "nonce-readable".to_string(),
                is_burn: false,
                burn_duration: None,
                is_read: false,
                created_at: now,
                server_timestamp: Some(1),
                local_timestamp: now,
            })
            .expect("should save message");

        let messages = store
            .get_messages("conv-readable", 10, None)
            .expect("should get messages");
        assert_eq!(messages.len(), 1);
        assert_eq!(
            messages[0].content,
            Some("readable after decrypt".to_string())
        );
    }

    #[test]
    fn test_duplicate_message_save_is_idempotent_and_preserves_content() {
        let store = create_test_store();
        let now = Utc::now().timestamp();
        store
            .save_conversation(&Conversation {
                id: "conv-idempotent".to_string(),
                conversation_type: 1,
                name: None,
                avatar_url: None,
                created_at: now,
                updated_at: now,
                last_message_at: None,
                last_message_preview: None,
            })
            .expect("should save conversation");

        let first = Message {
            id: "msg-idempotent".to_string(),
            conversation_id: "conv-idempotent".to_string(),
            sender_id: "user1".to_string(),
            message_type: 1,
            content: Some("first readable body".to_string()),
            nonce: "nonce-idempotent".to_string(),
            is_burn: false,
            burn_duration: None,
            is_read: false,
            created_at: now,
            server_timestamp: Some(1),
            local_timestamp: now,
        };
        store.save_message(&first).expect("should save message");

        let second = Message {
            content: None,
            is_read: true,
            server_timestamp: Some(2),
            local_timestamp: now + 1,
            ..first
        };
        store.save_message(&second).expect("should update message");

        let count: i64 = store
            .conn
            .query_row(
                "SELECT COUNT(*) FROM messages WHERE id = ?1",
                params!["msg-idempotent"],
                |row| row.get(0),
            )
            .expect("should count rows");
        let messages = store
            .get_messages("conv-idempotent", 10, None)
            .expect("should get messages");
        assert_eq!(count, 1);
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, Some("first readable body".to_string()));
        assert!(messages[0].is_read);
        assert_eq!(messages[0].server_timestamp, Some(2));
    }

    #[test]
    fn test_draft_crud() {
        let store = create_test_store();
        let now = Utc::now().timestamp();

        let draft = Draft {
            id: "draft1".to_string(),
            conversation_id: "conv1".to_string(),
            content: Some("Draft message".to_string()),
            updated_at: now,
        };

        store.save_draft(&draft).expect("should save draft");

        let loaded = store.get_draft("conv1").expect("should get draft");
        assert!(loaded.is_some());
        assert_eq!(loaded.unwrap().content, Some("Draft message".to_string()));

        store.delete_draft("conv1").expect("should delete draft");
        let loaded = store.get_draft("conv1").expect("should get draft");
        assert!(loaded.is_none());
    }

    #[test]
    fn test_keychain_crud() {
        let store = create_test_store();
        let key_data = b"secret_key_data";

        store
            .keychain_store("key1", "identity", key_data)
            .expect("should store key");

        let retrieved = store
            .keychain_retrieve("identity")
            .expect("should retrieve key");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap(), key_data);

        store
            .keychain_delete("identity")
            .expect("should delete key");
        let retrieved = store
            .keychain_retrieve("identity")
            .expect("should retrieve key");
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_unread_count() {
        let store = create_test_store();
        let now = Utc::now().timestamp();

        // Create conversation
        let conv = Conversation {
            id: "conv1".to_string(),
            conversation_type: 1,
            name: None,
            avatar_url: None,
            created_at: now,
            updated_at: now,
            last_message_at: None,
            last_message_preview: None,
        };
        store
            .save_conversation(&conv)
            .expect("should save conversation");

        // Add messages
        for i in 0..5 {
            let msg = Message {
                id: format!("msg{}", i),
                conversation_id: "conv1".to_string(),
                sender_id: "user1".to_string(),
                message_type: 1,
                content: Some(format!("Message {}", i)),
                nonce: "nonce".to_string(),
                is_burn: false,
                burn_duration: None,
                is_read: i < 2, // First 2 are read
                created_at: now + i as i64,
                server_timestamp: None,
                local_timestamp: now + i as i64,
            };
            store.save_message(&msg).expect("should save message");
        }

        let count = store
            .get_unread_count("conv1")
            .expect("should get unread count");
        assert_eq!(count, 3); // 5 - 2 = 3 unread
    }
}
