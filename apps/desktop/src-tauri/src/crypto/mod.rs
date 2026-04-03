//! Crypto Module - 密钥安全存储
//!
//! Week 11: macOS Keychain 集成和加密存储方案

pub mod mac_keychain;
pub mod keychain;

pub use mac_keychain::MacKeychain;
pub use keychain::{KeyType, SecureKeychain, SecureKeychainHandle, create_secure_keychain};