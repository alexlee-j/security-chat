//! 密钥安全存储 - 加密存储方案
//!
//! 使用主密钥加密其他密钥的方案
//! Week 11: 密钥安全存储
//!
//! 设计：
//! 1. 生成随机的主密钥 (master key) 并存储在 macOS Keychain
//! 2. 使用 AES-256-GCM 加密其他密钥
//! 3. 加密后的数据存储在 SQLite 的 keychain 表中
//!
//! 密钥层级：
//! - Level 1: Master Key (存储在 macOS Keychain) - 用于加密
//! - Level 2: 业务密钥 (identity_key, session_key 等) - 存储在 SQLite

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::{Rng as _, TryRngCore as _};
use rand::rngs::OsRng;
use std::sync::{Arc, Mutex};
use thiserror::Error;

/// Keychain 错误类型
#[derive(Error, Debug)]
pub enum KeychainError {
    #[error("加密失败: {0}")]
    EncryptionFailed(String),
    #[error("解密失败: {0}")]
    DecryptionFailed(String),
    #[error("密钥不存在: {0}")]
    NotFound(String),
    #[error("Master Key 未初始化")]
    MasterKeyNotInitialized,
    #[error("macOS Keychain 错误: {0}")]
    MacKeychain(#[from] crate::crypto::mac_keychain::KeychainError),
}

/// 密钥类型标识
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KeyType {
    Identity,
    Session,
    SignedPreKey,
    KyberPreKey,
    Other(String),
}

impl KeyType {
    pub fn as_str(&self) -> &str {
        match self {
            KeyType::Identity => "identity_key",
            KeyType::Session => "session_key",
            KeyType::SignedPreKey => "signed_prekey",
            KeyType::KyberPreKey => "kyber_prekey",
            KeyType::Other(s) => s,
        }
    }
}

/// 加密存储的密钥数据
#[derive(Debug, Clone)]
pub struct EncryptedKey {
    /// 密钥类型
    pub key_type: String,
    /// 加密后的数据 (nonce || ciphertext)
    pub encrypted_data: Vec<u8>,
}

/// 加密存储管理器
///
/// 使用 master key 加密所有业务密钥
pub struct SecureKeychain {
    /// Master Key (32 bytes for AES-256)
    master_key: [u8; 32],
}

impl SecureKeychain {
    /// 创建新的 SecureKeychain
    ///
    /// 生成随机 master key 并存储到 macOS Keychain
    pub fn new() -> Result<Self, KeychainError> {
        let mut master_key = [0u8; 32];
        let mut rng = OsRng.unwrap_err();
        rng.fill(&mut master_key);

        // 存储 master key 到 macOS Keychain
        crate::crypto::mac_keychain::MacKeychain::store(
            "master_key",
            &master_key,
        )?;

        Ok(Self { master_key })
    }

    /// 从 macOS Keychain 加载 master key
    pub fn load() -> Result<Self, KeychainError> {
        let master_key = crate::crypto::mac_keychain::MacKeychain::retrieve("master_key")?
            .try_into()
            .map_err(|_| KeychainError::EncryptionFailed("Invalid master key length".to_string()))?;

        Ok(Self { master_key })
    }

    /// 检查 master key 是否已存在
    pub fn exists() -> bool {
        crate::crypto::mac_keychain::MacKeychain::exists("master_key")
    }

    /// 存储密钥（加密后）
    pub fn store_key(&self, key_type: &KeyType, key_data: &[u8]) -> Result<EncryptedKey, KeychainError> {
        let encrypted_data = self.encrypt(key_data)?;

        Ok(EncryptedKey {
            key_type: key_type.as_str().to_string(),
            encrypted_data,
        })
    }

    /// 加密数据
    fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>, KeychainError> {
        let cipher = Aes256Gcm::new_from_slice(&self.master_key)
            .map_err(|e| KeychainError::EncryptionFailed(e.to_string()))?;

        // 生成随机 12-byte nonce
        let mut nonce_bytes = [0u8; 12];
        let mut rng = OsRng.unwrap_err();
        rng.fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // 加密 (ciphertext includes auth tag)
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| KeychainError::EncryptionFailed(e.to_string()))?;

        // 格式: nonce (12 bytes) || ciphertext
        let mut result = nonce_bytes.to_vec();
        result.extend(ciphertext);

        Ok(result)
    }

    /// 解密数据
    fn decrypt(&self, encrypted_data: &[u8]) -> Result<Vec<u8>, KeychainError> {
        if encrypted_data.len() < 12 {
            return Err(KeychainError::DecryptionFailed("Data too short".to_string()));
        }

        let cipher = Aes256Gcm::new_from_slice(&self.master_key)
            .map_err(|e| KeychainError::DecryptionFailed(e.to_string()))?;

        // 提取 nonce 和 ciphertext
        let nonce = Nonce::from_slice(&encrypted_data[..12]);
        let ciphertext = &encrypted_data[12..];

        // 解密
        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| KeychainError::DecryptionFailed(e.to_string()))
    }

    /// 检索并解密密钥
    pub fn retrieve_key(&self, encrypted: &EncryptedKey) -> Result<Vec<u8>, KeychainError> {
        if encrypted.key_type.is_empty() {
            return Err(KeychainError::NotFound("Empty key type".to_string()));
        }

        self.decrypt(&encrypted.encrypted_data)
    }

    /// 删除密钥（只删除加密数据，master key 保留）
    pub fn delete_key(&self, _key_type: &KeyType) -> Result<(), KeychainError> {
        // 注意：这里只删除加密后的数据，实际删除由调用方处理
        Ok(())
    }

    /// 删除 master key（会导致所有密钥无法解密）
    pub fn delete_master_key() -> Result<(), KeychainError> {
        crate::crypto::mac_keychain::MacKeychain::delete("master_key")?;
        Ok(())
    }
}

/// 使用 Arc<Mutex<...>> 包装以便在 Tauri 命令中使用
pub type SecureKeychainHandle = Arc<Mutex<SecureKeychain>>;

/// 创建 SecureKeychain
pub fn create_secure_keychain() -> Result<SecureKeychainHandle, String> {
    let keychain = if SecureKeychain::exists() {
        SecureKeychain::load().map_err(|e| e.to_string())?
    } else {
        SecureKeychain::new().map_err(|e| e.to_string())?
    };

    Ok(Arc::new(Mutex::new(keychain)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let keychain = SecureKeychain::load().expect("should load keychain");

        let plaintext = b"secret_message_12345";
        let key_type = KeyType::Identity;

        // 加密
        let encrypted = keychain.store_key(&key_type, plaintext).expect("should encrypt");

        // 解密
        let decrypted = keychain.retrieve_key(&encrypted).expect("should decrypt");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_key_type() {
        assert_eq!(KeyType::Identity.as_str(), "identity_key");
        assert_eq!(KeyType::Session.as_str(), "session_key");
        assert_eq!(KeyType::SignedPreKey.as_str(), "signed_prekey");
        assert_eq!(KeyType::KyberPreKey.as_str(), "kyber_prekey");
        assert_eq!(KeyType::Other("custom".to_string()).as_str(), "custom");
    }
}