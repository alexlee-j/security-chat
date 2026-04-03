//! Group Session Management for Signal Protocol
//!
//! Week 12: Group Chat Encryption
//!
//! This module manages the group encryption sessions, including:
//! - Group session initialization
//! - Sender key distribution
//! - Message encryption/decryption
//! - Member management integration

use crate::signal::sender_keys::{
    GroupEncryptedMessage, GroupInfo, GroupSession, SenderKeysStore, SharedSenderKeysStore,
    create_sender_keys_store,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use thiserror::Error;

/// Group session errors
#[derive(Error, Debug)]
pub enum GroupSessionError {
    #[error("Group not found: {0}")]
    GroupNotFound(String),
    #[error("Not a group member")]
    NotAMember,
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Invalid sender key state")]
    InvalidSenderKeyState,
}

/// Group message types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum GroupMessageType {
    Handshake = 1,   // Sender key distribution
    Text = 2,        // Text message
    Media = 3,       // Media/message with attachment
    System = 4,      // System message (member joined/left)
}

/// Group message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMessage {
    pub id: String,
    pub group_id: String,
    pub sender_id: String,
    pub message_type: GroupMessageType,
    pub content: Vec<u8>,        // Encrypted content
    pub timestamp: i64,
    pub local_timestamp: i64,
}

/// Handshake message for sender key distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupHandshakeMessage {
    pub group_id: String,
    pub sender_id: String,
    pub sender_key_id: u32,
    pub encrypted_sender_key: Vec<u8>,
}

/// Group session manager
/// Manages all group sessions for the local user
pub struct GroupSessionManager {
    /// Store for all sender keys
    sender_keys_store: SharedSenderKeysStore,
    /// Active group sessions
    active_sessions: HashMap<String, bool>,
}

impl GroupSessionManager {
    /// Create a new group session manager
    pub fn new(user_id: &str) -> Self {
        Self {
            sender_keys_store: create_sender_keys_store(user_id),
            active_sessions: HashMap::new(),
        }
    }

    /// Initialize a new group
    pub fn init_group(&mut self, group_id: &str, name: &str, group_type: i32) -> Result<GroupInfo, GroupSessionError> {
        let mut store = self.sender_keys_store.write()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        let group_info = store.create_group(group_id, name, group_type);
        self.active_sessions.insert(group_id.to_string(), true);

        Ok(group_info)
    }

    /// Join a group with sender key
    pub fn join_group(&mut self, group_id: &str, my_sender_key: &[u8]) -> Result<(), GroupSessionError> {
        // Get my user ID from the store
        let user_id = {
            let store = self.sender_keys_store.read()
                .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;
            store.user_id()
        };

        // Add myself to the group with my sender key
        let mut store = self.sender_keys_store.write()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        store.process_distribution_message(group_id, &user_id, my_sender_key)
            .map_err(|e| GroupSessionError::EncryptionFailed(e.to_string()))?;

        self.active_sessions.insert(group_id.to_string(), true);

        Ok(())
    }

    /// Leave a group
    pub fn leave_group(&mut self, group_id: &str) -> Result<(), GroupSessionError> {
        // Get my user ID
        let user_id = {
            let store = self.sender_keys_store.read()
                .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;
            store.user_id()
        };

        // Remove myself from the group
        let mut store = self.sender_keys_store.write()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        store.remove_member(group_id, &user_id)
            .map_err(|e| GroupSessionError::EncryptionFailed(e.to_string()))?;

        self.active_sessions.remove(group_id);

        Ok(())
    }

    /// Add a member to a group (admin only)
    pub fn add_member(&self, group_id: &str, member_id: &str) -> Result<Vec<u8>, GroupSessionError> {
        let mut store = self.sender_keys_store.write()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        store.add_member(group_id, member_id)
            .map_err(|e| GroupSessionError::EncryptionFailed(e.to_string()))
    }

    /// Remove a member from a group (admin only)
    pub fn remove_member(&self, group_id: &str, member_id: &str) -> Result<(), GroupSessionError> {
        let mut store = self.sender_keys_store.write()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        store.remove_member(group_id, member_id)
            .map_err(|e| GroupSessionError::EncryptionFailed(e.to_string()))
    }

    /// Encrypt a message for a group
    pub fn encrypt_message(&self, group_id: &str, plaintext: &[u8]) -> Result<GroupMessage, GroupSessionError> {
        let mut store = self.sender_keys_store.write()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        let encrypted = store.encrypt_message(group_id, plaintext)
            .map_err(|e| GroupSessionError::EncryptionFailed(e.to_string()))?;

        let now = chrono::Utc::now().timestamp_millis();

        Ok(GroupMessage {
            id: uuid::Uuid::new_v4().to_string(),
            group_id: group_id.to_string(),
            sender_id: store.user_id(),
            message_type: GroupMessageType::Text,
            content: serde_json::to_vec(&encrypted)
                .map_err(|e| GroupSessionError::EncryptionFailed(e.to_string()))?,
            timestamp: now,
            local_timestamp: now,
        })
    }

    /// Decrypt a group message
    pub fn decrypt_message(&self, group_id: &str, message: &GroupMessage) -> Result<Vec<u8>, GroupSessionError> {
        let encrypted: GroupEncryptedMessage = serde_json::from_slice(&message.content)
            .map_err(|e| GroupSessionError::DecryptionFailed(e.to_string()))?;

        let store = self.sender_keys_store.read()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        store.decrypt_message(group_id, &encrypted)
            .map_err(|e| GroupSessionError::DecryptionFailed(e.to_string()))
    }

    /// Create a sender key distribution message
    pub fn create_distribution_message(&self, group_id: &str) -> Result<GroupHandshakeMessage, GroupSessionError> {
        let mut store = self.sender_keys_store.write()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        let user_id = store.user_id();
        let session = store.get_session(group_id)
            .ok_or(GroupSessionError::GroupNotFound(group_id.to_string()))?;

        let encrypted_key = session.get_encrypted_sender_key(&user_id)
            .map_err(|e| GroupSessionError::EncryptionFailed(e.to_string()))?;

        Ok(GroupHandshakeMessage {
            group_id: group_id.to_string(),
            sender_id: user_id,
            sender_key_id: 1, // Simplified - in production use proper ID
            encrypted_sender_key: encrypted_key,
        })
    }

    /// Process a sender key distribution message from another member
    pub fn process_distribution(&self, msg: &GroupHandshakeMessage) -> Result<(), GroupSessionError> {
        let mut store = self.sender_keys_store.write()
            .map_err(|_| GroupSessionError::EncryptionFailed("Lock error".to_string()))?;

        store.process_distribution_message(
            &msg.group_id,
            &msg.sender_id,
            &msg.encrypted_sender_key,
        ).map_err(|e| GroupSessionError::EncryptionFailed(e.to_string()))
    }

    /// Check if user is member of a group
    pub fn is_member(&self, group_id: &str) -> bool {
        if let Ok(mut store) = self.sender_keys_store.write() {
            store.get_session(group_id).is_some()
        } else {
            false
        }
    }

    /// Check if group session is active
    pub fn is_session_active(&self, group_id: &str) -> bool {
        self.active_sessions.get(group_id).copied().unwrap_or(false)
    }
}

/// Thread-safe wrapper
pub type SharedGroupSessionManager = Arc<RwLock<GroupSessionManager>>;

/// Create a new shared group session manager
pub fn create_group_session_manager(user_id: &str) -> SharedGroupSessionManager {
    Arc::new(RwLock::new(GroupSessionManager::new(user_id)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_group_init() {
        let mut manager = GroupSessionManager::new("alice");
        let result = manager.init_group("group1", "Test Group", 1);
        assert!(result.is_ok());
    }

    #[test]
    fn test_join_and_encrypt() {
        // This test uses a single manager simulating one user's perspective
        // In real Signal Protocol, Alice and Bob would be on different devices
        // with proper sender key distribution through servers
        let mut alice_manager = GroupSessionManager::new("alice");
        alice_manager.init_group("group1", "Test Group", 1).unwrap();

        // Alice adds Bob and gets his sender key
        alice_manager.add_member("group1", "bob").unwrap();

        // Alice encrypts a message - she encrypts using her own sender key
        let message = alice_manager.encrypt_message("group1", b"Hello!").unwrap();
        assert_eq!(message.sender_id, "alice");
        // Message is encrypted and can be sent to the group
    }

    #[test]
    fn test_leave_group() {
        let mut alice_manager = GroupSessionManager::new("alice");
        alice_manager.init_group("group1", "Test Group", 1).unwrap();

        // Alice is already in the group she created - no need to join
        assert!(alice_manager.is_member("group1"));
        assert!(alice_manager.is_session_active("group1"));

        alice_manager.leave_group("group1").unwrap();

        assert!(!alice_manager.is_session_active("group1"));
    }
}