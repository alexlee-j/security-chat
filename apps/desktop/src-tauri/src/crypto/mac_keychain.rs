//! macOS Keychain 底层实现
//!
//! 使用 security_framework 库实现 macOS Keychain 存储
//! Week 11: 密钥安全存储

use security_framework::passwords::{get_generic_password, set_generic_password};
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

fn is_not_found_error_message(error_message: &str) -> bool {
    let normalized = error_message.to_ascii_lowercase();
    normalized.contains("itemnotfound")
        || normalized.contains("errsecitemnotfound")
        || normalized.contains("could not be found")
        || normalized.contains("not found")
}

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
                if is_not_found_error_message(&err_str) {
                    Err(KeychainError::NotFound(key_type.to_string()))
                } else {
                    Err(KeychainError::SecurityFramework(err_str))
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::is_not_found_error_message;

    #[test]
    fn detects_not_found_message_variants() {
        assert!(is_not_found_error_message(
            "The specified item could not be found in the keychain."
        ));
        assert!(is_not_found_error_message("ItemNotFound"));
        assert!(is_not_found_error_message("errSecItemNotFound"));
    }
}
