//! Signal encrypted message DTO shared between Tauri IPC and persistent Signal commands.

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EncryptedMessage {
    pub message_type: u32,
    pub body: Vec<u8>,
}
