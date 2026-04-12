// apps/desktop/src-tauri/signal/src/double_ratchet.rs

use super::{EncryptedMessage, DecryptedMessage, SessionState};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RatchetError {
    #[error("Invalid message key")]
    InvalidMessageKey,
    #[error("Skipped message key")]
    SkippedMessageKey,
    #[error("Decryption failed")]
    DecryptionFailed,
}

const MESSAGE_KEY_SIZE: usize = 32;
const CHAIN_KEY_SIZE: usize = 32;

pub fn encrypt(session: &mut SessionState, plaintext: &[u8]) -> Result<EncryptedMessage, RatchetError> {
    use aes::Aes256Gcm;
    use aes_gcm::{AesGcm, KeyInit};
    use rand::RngCore;

    // 1. 生成消息密钥
    let (message_key, next_chain_key) = derive_message_key(&session.sending_chain_key)?;

    // 2. 更新链密钥
    session.sending_chain_key = next_chain_key;

    // 3. 加密消息
    let cipher = AesGcm::<Aes256Gcm>::new_from_slice(&message_key)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);

    let ciphertext = cipher
        .encrypt(nonce.as_ref().into(), plaintext)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    let mut result = nonce.to_vec();
    result.extend(ciphertext);

    let message = EncryptedMessage {
        pre_key_id: None,
        base_key: None,
        identity_key: None,
        message_number: session.sending_index,
        previous_sending_index: Some(session.previous_sending_index),
        ciphertext: result,
        dh_public_key: None,
    };

    // 4. 推进 ratchet
    session.previous_sending_index = session.sending_index;
    session.sending_index += 1;

    Ok(message)
}

pub fn decrypt(session: &mut SessionState, encrypted: &EncryptedMessage) -> Result<DecryptedMessage, RatchetError> {
    use aes::Aes256Gcm;
    use aes_gcm::{AesGcm, KeyInit};

    // 1. 推进链（如果需要）
    while session.receiving_index < encrypted.message_number {
        let (skipped_key, next_chain) = derive_message_key(&session.receiving_chain_key)
            .map_err(|_| RatchetError::SkippedMessageKey)?;
        session.receiving_chain_key = next_chain;
        session.receiving_index += 1;
    }

    // 2. 生成当前消息密钥
    let (message_key, next_chain_key) = derive_message_key(&session.receiving_chain_key)
        .map_err(|_| RatchetError::InvalidMessageKey)?;

    // 3. 解密
    let cipher = AesGcm::<Aes256Gcm>::new_from_slice(&message_key)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    if encrypted.ciphertext.len() < 12 {
        return Err(RatchetError::DecryptionFailed);
    }

    let nonce = &encrypted.ciphertext[..12];
    let ciphertext = &encrypted.ciphertext[12..];

    let plaintext = cipher
        .decrypt(nonce.into(), ciphertext)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    // 4. 更新链密钥
    session.receiving_chain_key = next_chain_key;
    session.receiving_index += 1;

    Ok(DecryptedMessage {
        plaintext: String::from_utf8_lossy(&plaintext).to_string(),
        message_number: encrypted.message_number,
        previous_sending_index: encrypted.previous_sending_index,
    })
}

fn derive_message_key(chain_key: &[u8]) -> Result<(Vec<u8>, Vec<u8>), RatchetError> {
    use hkdf::Hkdf;
    use sha2::Sha256;

    let hk = Hkdf::<Sha256>::new(Some(chain_key), &[]);

    let mut message_key = vec![0u8; MESSAGE_KEY_SIZE];
    hk.expand(b"\x01", &mut message_key)
        .map_err(|_| RatchetError::InvalidMessageKey)?;

    let mut next_chain_key = vec![0u8; CHAIN_KEY_SIZE];
    hk.expand(b"\x02", &mut next_chain_key)
        .map_err(|_| RatchetError::InvalidMessageKey)?;

    Ok((message_key, next_chain_key))
}
