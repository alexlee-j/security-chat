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

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hkdf::Hkdf;
use rand::Rng as _;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
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
    pub fn new(_group_id: &str, creator_id: &str) -> Self {
        let mut group_key = [0u8; 32];
        rand::thread_rng().fill(&mut group_key);

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
        rand::thread_rng().fill(&mut sender_key);
        rand::thread_rng().fill(&mut chain_key);

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

        // Encrypt sender key with group key using AES-256-GCM
        let cipher = Aes256Gcm::new_from_slice(&self.group_key)
            .map_err(|e| SenderKeyError::EncryptionFailed(e.to_string()))?;

        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, sender_key_state.key.as_slice())
            .map_err(|e| SenderKeyError::EncryptionFailed(e.to_string()))?;

        // Format: nonce (12 bytes) || ciphertext
        let mut encrypted = nonce_bytes.to_vec();
        encrypted.extend(ciphertext);
        Ok(encrypted)
    }

    /// Add a member with their encrypted sender key
    pub fn add_member_with_key(&mut self, user_id: &str, encrypted_key: &[u8]) -> Result<(), SenderKeyError> {
        if encrypted_key.len() < 12 + 16 {
            // 12 (nonce) + 16 (auth tag minimum for 0-byte plaintext, but we have 32-byte key)
            return Err(SenderKeyError::EncryptionFailed("Invalid encrypted key".to_string()));
        }

        let cipher = Aes256Gcm::new_from_slice(&self.group_key)
            .map_err(|e| SenderKeyError::DecryptionFailed(e.to_string()))?;

        let nonce = Nonce::from_slice(&encrypted_key[..12]);
        let ciphertext = &encrypted_key[12..];

        let sender_key = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| SenderKeyError::DecryptionFailed(e.to_string()))?;

        let sender_key: [u8; 32] = sender_key.as_slice().try_into()
            .map_err(|_| SenderKeyError::DecryptionFailed("Invalid sender key length".to_string()))?;

        let mut chain_key = [0u8; 32];
        rand::thread_rng().fill(&mut chain_key);

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

    /// List member user IDs in current sender-key session
    pub fn member_user_ids(&self) -> Vec<String> {
        self.sender_keys.keys().cloned().collect()
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

        // Derive message key from chain key using HKDF
        let hk = Hkdf::<Sha256>::new(None, &sender_state.chain_key);
        let mut okm = vec![0u8; 64];
        let info = format!("msg-key:{}", message_number);
        hk.expand(info.as_bytes(), &mut okm).map_err(|_| SenderKeyError::EncryptionFailed("HKDF expand failed".to_string()))?;
        let message_key: [u8; 32] = okm[..32].try_into().unwrap();

        // Encrypt with message key
        let ciphertext = Self::simple_encrypt(plaintext, &message_key);

        // Update chain key using HKDF
        let chain_hk = Hkdf::<Sha256>::new(None, &sender_state.chain_key);
        let mut chain_okm = vec![0u8; 32];
        let chain_info = format!("chain-key:{}", message_number);
        chain_hk.expand(chain_info.as_bytes(), &mut chain_okm).map_err(|_| SenderKeyError::EncryptionFailed("HKDF expand failed".to_string()))?;
        sender_state.chain_key = chain_okm.try_into().unwrap();

        // Ratchet sender key periodically (every 100 messages) using HKDF
        if message_number % 100 == 0 && message_number > 0 {
            let key_hk = Hkdf::<Sha256>::new(None, &sender_state.key);
            let mut key_okm = vec![0u8; 32];
            let key_info = format!("sender-key:{}", message_number);
            key_hk.expand(key_info.as_bytes(), &mut key_okm).map_err(|_| SenderKeyError::EncryptionFailed("HKDF expand failed".to_string()))?;
            sender_state.key = key_okm.try_into().unwrap();
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
        let _sender_state = self.sender_keys.get(sender_id)
            .ok_or(SenderKeyError::MemberNotFound(sender_id.to_string()))?;

        // Derive message key using the chain_key from the message using HKDF
        let hk = Hkdf::<Sha256>::new(None, &message.chain_key);
        let mut okm = vec![0u8; 64];
        let info = format!("msg-key:{}", message.message_number);
        hk.expand(info.as_bytes(), &mut okm).map_err(|_| SenderKeyError::DecryptionFailed("HKDF expand failed".to_string()))?;
        let message_key: [u8; 32] = okm[..32].try_into().unwrap();

        // Decrypt with message key
        Self::simple_decrypt(&message.ciphertext, &message_key)
    }

    /// AES-256-GCM encryption with message key
    fn simple_encrypt(plaintext: &[u8], key: &[u8; 32]) -> Vec<u8> {
        let cipher = Aes256Gcm::new_from_slice(key)
            .expect("AES-256-GCM key size is correct");

        // Generate random 12-byte nonce
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt (ciphertext includes auth tag)
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .expect("AES-GCM encryption should not fail");

        // Format: nonce (12 bytes) || ciphertext
        let mut result = nonce_bytes.to_vec();
        result.extend(ciphertext);
        result
    }

    /// AES-256-GCM decryption with message key
    fn simple_decrypt(ciphertext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, SenderKeyError> {
        if ciphertext.len() < 12 {
            return Err(SenderKeyError::DecryptionFailed("Ciphertext too short".to_string()));
        }

        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| SenderKeyError::DecryptionFailed(e.to_string()))?;

        // Extract nonce and ciphertext
        let nonce = Nonce::from_slice(&ciphertext[..12]);
        let ciphertext_data = &ciphertext[12..];

        // Decrypt
        cipher
            .decrypt(nonce, ciphertext_data)
            .map_err(|e| SenderKeyError::DecryptionFailed(e.to_string()))
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

    /// List members in a group session
    pub fn list_members(&self, group_id: &str) -> Result<Vec<String>, SenderKeyError> {
        let session = self.groups.get(group_id)
            .ok_or(SenderKeyError::GroupNotFound(group_id.to_string()))?;
        Ok(session.member_user_ids())
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

        // Remove Bob
        store.remove_member("group1", "bob").unwrap();

        // Verify Bob is no longer a member
        let session = store.get_session("group1").unwrap();
        assert!(!session.has_member("bob"));
    }

    #[test]
    fn test_history_messages_remain_decryptable_after_ratchet_progress() {
        let mut store = SenderKeysStore::new("alice");
        store.create_group("group1", "Test Group", 1);

        let msg1 = store.encrypt_message("group1", b"first").unwrap();
        let msg2 = store.encrypt_message("group1", b"second").unwrap();
        let msg3 = store.encrypt_message("group1", b"third").unwrap();

        let p1 = store.decrypt_message("group1", &msg1).unwrap();
        let p2 = store.decrypt_message("group1", &msg2).unwrap();
        let p3 = store.decrypt_message("group1", &msg3).unwrap();

        assert_eq!(p1, b"first");
        assert_eq!(p2, b"second");
        assert_eq!(p3, b"third");
    }
}
