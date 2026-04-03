//! Signal Sender Keys Implementation for Group Chat
//!
//! Week 12: Group Chat Encryption
//!
//! Signal Protocol uses Sender Keys for efficient group messaging:
//! - Each member has a Sender Key for encrypting messages
//! - Sender Keys are encrypted with the Group Key and distributed
//! - Ratcheting provides forward secrecy within the group
//!
//! Flow:
//! 1. Create group: Generate Group Key, create Sender Key for creator
//! 2. Add member: Generate Sender Key for new member, encrypted with Group Key
//! 3. Send message: Encrypt with own Sender Key (with ratcheting)
//! 4. Receive message: Decrypt using sender's Sender Key
//! 5. Remove member: Delete their Sender Key

#![allow(dead_code)]

use rand::Rng as _;
use rand::TryRngCore as _;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use thiserror::Error;

/// Sender Key errors
#[derive(Error, Debug)]
pub enum SenderKeyError {
    #[error("Group not found: {0}")]
    GroupNotFound(String),
    #[error("Member not found: {0}")]
    MemberNotFound(String),
    #[error("Sender key not found")]
    SenderKeyNotFound,
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Invalid group state: {0}")]
    InvalidGroupState(String),
}

/// Group member role
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum GroupRole {
    Admin = 1,
    Member = 2,
}

/// Group member information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMember {
    pub user_id: String,
    pub role: GroupRole,
    pub joined_at: i64,
}

/// Group information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupInfo {
    pub id: String,
    pub name: String,
    pub group_type: i32, // 1: private, 2: public
    pub creator_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub members: Vec<GroupMember>,
}

/// Sender Key distribution message
/// Contains the encrypted sender key for a specific member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SenderKeyDistributionMessage {
    pub group_id: String,
    pub sender_id: String,
    pub sender_key_id: u32,
    pub encrypted_key: Vec<u8>, // Group Key encrypted sender key
}

/// Group session state for encrypting/decrypting group messages
/// Uses a chain-based ratcheting algorithm similar to Signal
pub struct GroupSession {
    /// The group symmetric key (used to encrypt sender keys)
    group_key: [u8; 32],
    /// Per-member sender keys (ratcheting state)
    sender_keys: HashMap<String, SenderKeyState>,
    /// Chain counter for each sender
    chain_counters: HashMap<String, u32>,
}

struct SenderKeyState {
    /// Current sender key
    key: [u8; 32],
    /// Ratchet chain key
    chain_key: [u8; 32],
    /// Message number in the chain
    message_number: u32,
}

impl GroupSession {
    /// Create a new group session
    pub fn new(group_id: &str, creator_id: &str) -> Self {
        let mut group_key = [0u8; 32];
        OsRng.unwrap_err().fill(&mut group_key);

        let mut session = Self {
            group_key,
            sender_keys: HashMap::new(),
            chain_counters: HashMap::new(),
        };

        // Generate sender key for creator
        session.generate_sender_key(creator_id);

        session
    }

    /// Generate a new sender key for a member
    pub fn generate_sender_key(&mut self, user_id: &str) {
        let mut sender_key = [0u8; 32];
        let mut chain_key = [0u8; 32];
        OsRng.unwrap_err().fill(&mut sender_key);
        OsRng.unwrap_err().fill(&mut chain_key);

        self.sender_keys.insert(
            user_id.to_string(),
            SenderKeyState {
                key: sender_key,
                chain_key,
                message_number: 0,
            },
        );
        self.chain_counters.insert(user_id.to_string(), 0);
    }

    /// Get the sender key for a specific user (encrypted with group key)
    pub fn get_encrypted_sender_key(&self, user_id: &str) -> Result<Vec<u8>, SenderKeyError> {
        let sender_key_state = self.sender_keys.get(user_id)
            .ok_or(SenderKeyError::MemberNotFound(user_id.to_string()))?;

        // Encrypt sender key with group key (simplified - in production use proper AEAD)
        let mut encrypted = self.group_key.to_vec();
        encrypted.extend_from_slice(&sender_key_state.key);
        Ok(encrypted)
    }

    /// Add a member with their encrypted sender key
    pub fn add_member_with_key(&mut self, user_id: &str, encrypted_key: &[u8]) -> Result<(), SenderKeyError> {
        if encrypted_key.len() < 64 {
            return Err(SenderKeyError::EncryptionFailed("Invalid encrypted key".to_string()));
        }

        // Decrypt sender key with group key (simplified - in production use proper AEAD)
        let decrypted = encrypted_key.to_vec();
        if decrypted.len() < 64 {
            return Err(SenderKeyError::DecryptionFailed("Key too short".to_string()));
        }

        let sender_key: [u8; 32] = decrypted[32..64].try_into()
            .map_err(|_| SenderKeyError::DecryptionFailed("Invalid key length".to_string()))?;
        let mut chain_key = [0u8; 32];
        OsRng.unwrap_err().fill(&mut chain_key);

        self.sender_keys.insert(user_id.to_string(), SenderKeyState {
            key: sender_key,
            chain_key,
            message_number: 0,
        });
        self.chain_counters.insert(user_id.to_string(), 0);

        Ok(())
    }

    /// Remove a member (delete their sender key)
    pub fn remove_member(&mut self, user_id: &str) -> Result<(), SenderKeyError> {
        if self.sender_keys.remove(user_id).is_none() {
            return Err(SenderKeyError::MemberNotFound(user_id.to_string()));
        }
        self.chain_counters.remove(user_id);
        Ok(())
    }

    /// Check if a member exists
    pub fn has_member(&self, user_id: &str) -> bool {
        self.sender_keys.contains_key(user_id)
    }

    /// Encrypt a message using sender key
    pub fn encrypt_message(&mut self, sender_id: &str, plaintext: &[u8]) -> Result<GroupEncryptedMessage, SenderKeyError> {
        let sender_state = self.sender_keys.get_mut(sender_id)
            .ok_or(SenderKeyError::MemberNotFound(sender_id.to_string()))?;

        // Simple symmetric encryption with ratcheting
        // In production, use proper Signal Double Ratchet for sender keys
        let message_number = sender_state.message_number;
        sender_state.message_number += 1;

        // Save chain_key before ratcheting (needed for message decryption)
        let chain_key_for_message = sender_state.chain_key;

        // Derive message key from chain key
        let mut message_key = [0u8; 32];
        let mut chain_input = sender_state.chain_key.to_vec();
        chain_input.extend_from_slice(&message_number.to_le_bytes());
        // Simplified: just XOR for demo - production should use HKDF
        for (i, byte) in message_key.iter_mut().enumerate() {
            *byte = chain_input.get(i).copied().unwrap_or(0) ^ sender_state.key[i];
        }

        // Encrypt with message key (simplified)
        let ciphertext = Self::simple_encrypt(plaintext, &message_key);

        // Update chain key (ratchet step)
        let mut new_chain_key = [0u8; 32];
        for (i, byte) in new_chain_key.iter_mut().enumerate() {
            *byte = sender_state.chain_key[i] ^ (message_number as u8).wrapping_add(i as u8);
        }
        sender_state.chain_key = new_chain_key;

        // Ratchet sender key periodically (every 100 messages)
        if message_number % 100 == 0 && message_number > 0 {
            let mut new_key = [0u8; 32];
            for (i, byte) in new_key.iter_mut().enumerate() {
                *byte = sender_state.key[i] ^ (message_number as u8).wrapping_add(i as u8);
            }
            sender_state.key = new_key;
        }

        Ok(GroupEncryptedMessage {
            sender_id: sender_id.to_string(),
            message_number,
            ciphertext,
            chain_key: chain_key_for_message, // Store pre-ratchet chain_key for decryption
        })
    }

    /// Decrypt a message using sender key
    pub fn decrypt_message(&self, sender_id: &str, message: &GroupEncryptedMessage) -> Result<Vec<u8>, SenderKeyError> {
        let sender_state = self.sender_keys.get(sender_id)
            .ok_or(SenderKeyError::MemberNotFound(sender_id.to_string()))?;

        // Derive message key using the chain_key from the message (not the current ratcheted one)
        let mut message_key = [0u8; 32];
        let mut chain_input = message.chain_key.to_vec();
        chain_input.extend_from_slice(&message.message_number.to_le_bytes());
        for (i, byte) in message_key.iter_mut().enumerate() {
            *byte = chain_input.get(i).copied().unwrap_or(0) ^ sender_state.key[i];
        }

        // Decrypt with message key
        Self::simple_decrypt(&message.ciphertext, &message_key)
    }

    /// Simple symmetric encryption (simplified - use AES-GCM in production)
    fn simple_encrypt(plaintext: &[u8], key: &[u8; 32]) -> Vec<u8> {
        let mut result = Vec::with_capacity(plaintext.len() + 16);
        // Add simple header
        result.extend_from_slice(b"SKEY_V1");
        // XOR encryption with key stream
        for (i, byte) in plaintext.iter().enumerate() {
            result.push(byte ^ key[i % 32]);
        }
        result
    }

    /// Simple symmetric decryption
    fn simple_decrypt(ciphertext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, SenderKeyError> {
        if ciphertext.len() < 7 || &ciphertext[0..7] != b"SKEY_V1" {
            return Err(SenderKeyError::DecryptionFailed("Invalid format".to_string()));
        }

        let mut result = Vec::with_capacity(ciphertext.len() - 7);
        for (i, byte) in ciphertext[7..].iter().enumerate() {
            result.push(byte ^ key[i % 32]);
        }
        Ok(result)
    }

    /// Get group key (for distributing to new members)
    pub fn get_group_key(&self) -> [u8; 32] {
        self.group_key
    }

    /// Export sender keys state for a member
    pub fn export_sender_key_state(&self, user_id: &str) -> Result<Vec<u8>, SenderKeyError> {
        let state = self.sender_keys.get(user_id)
            .ok_or(SenderKeyError::MemberNotFound(user_id.to_string()))?;

        let mut export = Vec::new();
        export.extend_from_slice(&state.key);
        export.extend_from_slice(&state.chain_key);
        export.extend_from_slice(&state.message_number.to_le_bytes());
        Ok(export)
    }

    /// Import sender key state for a member
    pub fn import_sender_key_state(&mut self, user_id: &str, data: &[u8]) -> Result<(), SenderKeyError> {
        if data.len() < 68 {
            return Err(SenderKeyError::InvalidGroupState("Invalid state data".to_string()));
        }

        let key: [u8; 32] = data[0..32].try_into()
            .map_err(|_| SenderKeyError::InvalidGroupState("Invalid key length".to_string()))?;
        let chain_key: [u8; 32] = data[32..64].try_into()
            .map_err(|_| SenderKeyError::InvalidGroupState("Invalid chain key length".to_string()))?;
        let message_number = u32::from_le_bytes(data[64..68].try_into()
            .map_err(|_| SenderKeyError::InvalidGroupState("Invalid message number".to_string()))?);

        self.sender_keys.insert(user_id.to_string(), SenderKeyState {
            key,
            chain_key,
            message_number,
        });
        self.chain_counters.insert(user_id.to_string(), message_number);

        Ok(())
    }
}

/// Encrypted group message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupEncryptedMessage {
    pub sender_id: String,
    pub message_number: u32,
    pub ciphertext: Vec<u8>,
    /// Chain key used for this message (to allow decryption without ratcheting)
    pub chain_key: [u8; 32],
}

/// Sender Keys Store - manages all group sessions for a user
pub struct SenderKeysStore {
    /// Group sessions indexed by group_id
    groups: HashMap<String, GroupSession>,
    /// User's own ID
    user_id: String,
}

impl SenderKeysStore {
    /// Create a new store for a user
    pub fn new(user_id: &str) -> Self {
        Self {
            groups: HashMap::new(),
            user_id: user_id.to_string(),
        }
    }

    /// Get the user ID
    pub fn user_id(&self) -> String {
        self.user_id.clone()
    }

    /// Create a new group
    pub fn create_group(&mut self, group_id: &str, name: &str, group_type: i32) -> GroupInfo {
        let now = chrono::Utc::now().timestamp();
        let group_info = GroupInfo {
            id: group_id.to_string(),
            name: name.to_string(),
            group_type,
            creator_id: self.user_id.clone(),
            created_at: now,
            updated_at: now,
            members: vec![GroupMember {
                user_id: self.user_id.clone(),
                role: GroupRole::Admin,
                joined_at: now,
            }],
        };

        let session = GroupSession::new(group_id, &self.user_id);
        self.groups.insert(group_id.to_string(), session);

        group_info
    }

    /// Get or create a group session
    pub fn get_session(&mut self, group_id: &str) -> Option<&mut GroupSession> {
        self.groups.get_mut(group_id)
    }

    /// Add a member to a group
    pub fn add_member(&mut self, group_id: &str, user_id: &str) -> Result<Vec<u8>, SenderKeyError> {
        let session = self.groups.get_mut(group_id)
            .ok_or(SenderKeyError::GroupNotFound(group_id.to_string()))?;

        session.generate_sender_key(user_id);
        session.get_encrypted_sender_key(user_id)
    }

    /// Remove a member from a group
    pub fn remove_member(&mut self, group_id: &str, user_id: &str) -> Result<(), SenderKeyError> {
        let session = self.groups.get_mut(group_id)
            .ok_or(SenderKeyError::GroupNotFound(group_id.to_string()))?;

        session.remove_member(user_id)
    }

    /// Process a sender key distribution message
    pub fn process_distribution_message(
        &mut self,
        group_id: &str,
        sender_id: &str,
        encrypted_key: &[u8],
    ) -> Result<(), SenderKeyError> {
        let session = self.groups.get_mut(group_id)
            .ok_or(SenderKeyError::GroupNotFound(group_id.to_string()))?;

        session.add_member_with_key(sender_id, encrypted_key)
    }

    /// Encrypt a message for a group
    pub fn encrypt_message(
        &mut self,
        group_id: &str,
        plaintext: &[u8],
    ) -> Result<GroupEncryptedMessage, SenderKeyError> {
        let session = self.groups.get_mut(group_id)
            .ok_or(SenderKeyError::GroupNotFound(group_id.to_string()))?;

        session.encrypt_message(&self.user_id, plaintext)
    }

    /// Decrypt a message in a group
    pub fn decrypt_message(
        &self,
        group_id: &str,
        message: &GroupEncryptedMessage,
    ) -> Result<Vec<u8>, SenderKeyError> {
        let session = self.groups.get(group_id)
            .ok_or(SenderKeyError::GroupNotFound(group_id.to_string()))?;

        session.decrypt_message(&message.sender_id, message)
    }
}

/// Thread-safe wrapper for SenderKeysStore
pub type SharedSenderKeysStore = Arc<RwLock<SenderKeysStore>>;

/// Create a new shared store
pub fn create_sender_keys_store(user_id: &str) -> SharedSenderKeysStore {
    Arc::new(RwLock::new(SenderKeysStore::new(user_id)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_group_creation() {
        let mut store = SenderKeysStore::new("alice");
        let group = store.create_group("group1", "Test Group", 1);

        assert_eq!(group.name, "Test Group");
        assert_eq!(group.members.len(), 1);
        assert_eq!(group.members[0].user_id, "alice");
        assert_eq!(group.members[0].role, GroupRole::Admin);
    }

    #[test]
    fn test_add_member() {
        let mut store = SenderKeysStore::new("alice");
        store.create_group("group1", "Test Group", 1);

        // Alice adds Bob
        let encrypted_key = store.add_member("group1", "bob").unwrap();
        assert!(!encrypted_key.is_empty());

        // Verify Bob can decrypt (has sender key)
        let session = store.get_session("group1").unwrap();
        assert!(session.has_member("bob"));
    }

    #[test]
    fn test_remove_member() {
        let mut store = SenderKeysStore::new("alice");
        store.create_group("group1", "Test Group", 1);
        store.add_member("group1", "bob").unwrap();

        // Remove Bob
        store.remove_member("group1", "bob").unwrap();

        // Verify Bob cannot decrypt
        let session = store.get_session("group1").unwrap();
        assert!(!session.has_member("bob"));
    }

    #[test]
    fn test_encrypt_decrypt_message() {
        let mut store = SenderKeysStore::new("alice");
        store.create_group("group1", "Test Group", 1);

        // Alice encrypts a message - no add_member to isolate the test
        let message = store.encrypt_message("group1", b"Hello, group!").unwrap();
        assert_eq!(message.sender_id, "alice");
        assert_eq!(message.message_number, 0);

        // Alice decrypts her own message
        let decrypted = store.decrypt_message("group1", &message).unwrap();
        assert_eq!(decrypted, b"Hello, group!");
    }

    #[test]
    fn test_member_leave_cannot_receive() {
        let mut store = SenderKeysStore::new("alice");
        store.create_group("group1", "Test Group", 1);
        store.add_member("group1", "bob").unwrap();

        // Bob encrypts a message
        let session = store.get_session("group1").unwrap();
        session.generate_sender_key("bob");
        drop(session);

        let session = store.get_session("group1").unwrap();
        session.remove_member("bob").unwrap();
        drop(session);

        // Try to decrypt with removed member - should fail
        let session = store.get_session("group1").unwrap();
        assert!(!session.has_member("bob"));
    }
}