//! macOS Keychain 底层实现
//!
//! 使用 security_framework 库实现 macOS Keychain 存储
//! Week 11: 密钥安全存储

use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};
use thiserror::Error;

/// Keychain 错误类型
#[derive(Error, Debug)]
pub enum KeychainError {
    #[error("Keychain error: {0}")]
    SecurityFramework(String),
    #[error("密钥不存在: {0}")]
    NotFound(String),
    #[error("存储失败: {0}")]
    StoreFailed(String),
}

/// macOS Keychain 服务名称
const SERVICE_NAME: &str = "com.security-chat.app";

/// macOS Keychain 底层操作
pub struct MacKeychain;

impl MacKeychain {
    /// 存储密钥到 Keychain
    ///
    /// # Arguments
    /// * `key_type` - 密钥类型标识（如 "identity_key", "session_key"）
    /// * `key_data` - 密钥数据
    pub fn store(key_type: &str, key_data: &[u8]) -> Result<(), KeychainError> {
        set_generic_password(SERVICE_NAME, key_type, key_data)
            .map_err(|e| KeychainError::StoreFailed(e.to_string()))?;
        Ok(())
    }

    /// 从 Keychain 检索密钥
    ///
    /// # Arguments
    /// * `key_type` - 密钥类型标识
    ///
    /// # Returns
    /// 密钥数据，如果不存在则返回 NotFound 错误
    pub fn retrieve(key_type: &str) -> Result<Vec<u8>, KeychainError> {
        match get_generic_password(SERVICE_NAME, key_type) {
            Ok(data) => Ok(data),
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("ItemNotFound") || err_str.contains("not found") {
                    Err(KeychainError::NotFound(key_type.to_string()))
                } else {
                    Err(KeychainError::SecurityFramework(err_str))
                }
            }
        }
    }

    /// 从 Keychain 删除密钥
    ///
    /// # Arguments
    /// * `key_type` - 密钥类型标识
    pub fn delete(key_type: &str) -> Result<(), KeychainError> {
        match delete_generic_password(SERVICE_NAME, key_type) {
            Ok(_) => Ok(()),
            Err(e) => {
                let err_str = e.to_string();
                // ItemNotFound 错误认为删除成功
                if err_str.contains("ItemNotFound") || err_str.contains("not found") {
                    Ok(())
                } else {
                    Err(KeychainError::SecurityFramework(err_str))
                }
            }
        }
    }

    /// 检查密钥是否存在
    ///
    /// # Arguments
    /// * `key_type` - 密钥类型标识
    pub fn exists(key_type: &str) -> bool {
        matches!(get_generic_password(SERVICE_NAME, key_type), Ok(_))
    }
}
