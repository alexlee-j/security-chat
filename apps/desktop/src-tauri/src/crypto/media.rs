use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use rand::rngs::OsRng;
use rand::{Rng as _, TryRngCore as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const MEDIA_ALGORITHM: &str = "aes-256-gcm";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedMediaDto {
    pub algorithm: String,
    pub key: Vec<u8>,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
    pub ciphertext_digest: Vec<u8>,
    pub ciphertext_size: u64,
    pub plain_digest: Vec<u8>,
    pub plain_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptMediaInputDto {
    pub algorithm: String,
    pub key: Vec<u8>,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
    pub ciphertext_digest: Vec<u8>,
    pub plain_digest: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptedMediaDto {
    pub plaintext: Vec<u8>,
    pub plain_digest: Vec<u8>,
    pub plain_size: u64,
}

fn sha256(bytes: &[u8]) -> Vec<u8> {
    Sha256::digest(bytes).to_vec()
}

pub fn encrypt_media_bytes(plaintext: &[u8]) -> Result<EncryptedMediaDto, String> {
    let mut key = [0u8; 32];
    let mut nonce_bytes = [0u8; 12];
    let mut rng = OsRng.unwrap_err();
    rng.fill(&mut key);
    rng.fill(&mut nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|error| error.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|error| format!("media encryption failed: {error}"))?;

    Ok(EncryptedMediaDto {
        algorithm: MEDIA_ALGORITHM.to_string(),
        key: key.to_vec(),
        nonce: nonce_bytes.to_vec(),
        ciphertext_digest: sha256(&ciphertext),
        ciphertext_size: ciphertext.len() as u64,
        plain_digest: sha256(plaintext),
        plain_size: plaintext.len() as u64,
        ciphertext,
    })
}

pub fn decrypt_media_bytes(input: DecryptMediaInputDto) -> Result<DecryptedMediaDto, String> {
    if input.algorithm != MEDIA_ALGORITHM {
        return Err(format!("unsupported media algorithm: {}", input.algorithm));
    }
    if input.key.len() != 32 {
        return Err("invalid media key length".to_string());
    }
    if input.nonce.len() != 12 {
        return Err("invalid media nonce length".to_string());
    }
    let actual_ciphertext_digest = sha256(&input.ciphertext);
    if actual_ciphertext_digest != input.ciphertext_digest {
        return Err("media ciphertext digest mismatch".to_string());
    }

    let cipher = Aes256Gcm::new_from_slice(&input.key).map_err(|error| error.to_string())?;
    let nonce = Nonce::from_slice(&input.nonce);
    let plaintext = cipher
        .decrypt(nonce, input.ciphertext.as_slice())
        .map_err(|error| format!("media decryption failed: {error}"))?;
    let actual_plain_digest = sha256(&plaintext);
    if let Some(expected_plain_digest) = input.plain_digest {
        if actual_plain_digest != expected_plain_digest {
            return Err("media plaintext digest mismatch".to_string());
        }
    }

    Ok(DecryptedMediaDto {
        plain_size: plaintext.len() as u64,
        plain_digest: actual_plain_digest,
        plaintext,
    })
}

#[tauri::command]
pub async fn encrypt_media_command(plaintext: Vec<u8>) -> Result<EncryptedMediaDto, String> {
    tokio::task::spawn_blocking(move || encrypt_media_bytes(&plaintext))
        .await
        .map_err(|_| "media encryption task failed".to_string())?
}

#[tauri::command]
pub async fn decrypt_media_command(
    input: DecryptMediaInputDto,
) -> Result<DecryptedMediaDto, String> {
    tokio::task::spawn_blocking(move || decrypt_media_bytes(input))
        .await
        .map_err(|_| "media decryption task failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_encrypt_decrypt_round_trip() {
        let plaintext = b"hello encrypted media";
        let encrypted = encrypt_media_bytes(plaintext).expect("encrypt");
        assert_ne!(encrypted.ciphertext, plaintext);

        let decrypted = decrypt_media_bytes(DecryptMediaInputDto {
            algorithm: encrypted.algorithm,
            key: encrypted.key,
            nonce: encrypted.nonce,
            ciphertext: encrypted.ciphertext,
            ciphertext_digest: encrypted.ciphertext_digest,
            plain_digest: Some(encrypted.plain_digest),
        })
        .expect("decrypt");

        assert_eq!(decrypted.plaintext, plaintext);
    }

    #[test]
    fn media_decrypt_rejects_wrong_key() {
        let plaintext = b"hello encrypted media";
        let encrypted = encrypt_media_bytes(plaintext).expect("encrypt");
        let mut wrong_key = encrypted.key.clone();
        wrong_key[0] ^= 0x01;

        let result = decrypt_media_bytes(DecryptMediaInputDto {
            algorithm: encrypted.algorithm,
            key: wrong_key,
            nonce: encrypted.nonce,
            ciphertext: encrypted.ciphertext,
            ciphertext_digest: encrypted.ciphertext_digest,
            plain_digest: Some(encrypted.plain_digest),
        });

        assert!(result.is_err());
    }

    #[test]
    fn media_decrypt_rejects_tampered_ciphertext() {
        let plaintext = b"hello encrypted media";
        let mut encrypted = encrypt_media_bytes(plaintext).expect("encrypt");
        encrypted.ciphertext[0] ^= 0x01;

        let result = decrypt_media_bytes(DecryptMediaInputDto {
            algorithm: encrypted.algorithm,
            key: encrypted.key,
            nonce: encrypted.nonce,
            ciphertext: encrypted.ciphertext,
            ciphertext_digest: encrypted.ciphertext_digest,
            plain_digest: Some(encrypted.plain_digest),
        });

        assert!(result.is_err());
    }

    #[test]
    fn media_decrypt_rejects_wrong_digest() {
        let plaintext = b"hello encrypted media";
        let mut encrypted = encrypt_media_bytes(plaintext).expect("encrypt");
        encrypted.ciphertext_digest[0] ^= 0x01;

        let result = decrypt_media_bytes(DecryptMediaInputDto {
            algorithm: encrypted.algorithm,
            key: encrypted.key,
            nonce: encrypted.nonce,
            ciphertext: encrypted.ciphertext,
            ciphertext_digest: encrypted.ciphertext_digest,
            plain_digest: Some(encrypted.plain_digest),
        });

        assert!(result.is_err());
    }
}
