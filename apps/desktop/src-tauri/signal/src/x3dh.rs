// apps/desktop/src-tauri/signal/src/x3dh.rs

use super::{IdentityKeyPair, PrekeyBundle, SessionState};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum X3DHError {
    #[error("Missing identity key")]
    MissingIdentityKey,
    #[error("Invalid prekey bundle")]
    InvalidPrekeyBundle,
    #[error("DH failure")]
    DhFailure,
}

pub fn initiate_session(
    local_identity: &Option<IdentityKeyPair>,
    bundle: &PrekeyBundle,
) -> Result<SessionState, X3DHError> {
    let local_identity = local_identity.as_ref().ok_or(X3DHError::MissingIdentityKey)?;

    use x25519_dalek::{PublicKey, StaticSecret};

    // 生成临时密钥对 (Ephemeral Key)
    let ephemeral_private = StaticSecret::new(rand::thread_rng());
    let ephemeral_public = PublicKey::from(&ephemeral_private);

    // 从 Bundle 获取接收方公钥
    let recipient_identity_public = PublicKey::from(
        PublicKey::from(bundle.identity_key.as_slice()).0
    );
    let recipient_signed_prekey_public = PublicKey::from(
        bundle.signed_prekey.public_key.as_slice()
    );

    // 计算 DH1 = DH(IK_A, SPK_B)
    let dh1 = ephemeral_private.diffie_hellman(&recipient_signed_prekey_public);

    // 计算 DH2 = DH(EK_A, IK_B)
    let dh2 = ephemeral_private.diffie_hellman(&recipient_identity_public);

    // 计算 DH3 = DH(EK_A, SPK_B)
    let dh3 = ephemeral_private.diffie_hellman(&recipient_signed_prekey_public);

    // 如果有一时预密钥，计算 DH4 = DH(EK_A, OPK_B)
    let dh4 = if let Some(ref opk) = bundle.one_time_prekey {
        let opk_public = PublicKey::from(opk.public_key.as_slice());
        Some(ephemeral_private.diffie_hellman(&opk_public))
    } else {
        None
    };

    // 合并 DH 输出
    let mut combined = Vec::new();
    combined.extend_from_slice(dh1.as_bytes());
    combined.extend_from_slice(dh2.as_bytes());
    combined.extend_from_slice(dh3.as_bytes());
    if let Some(dh4_val) = dh4 {
        combined.extend_from_slice(dh4_val.as_bytes());
    }

    // KDF 生成根密钥和链密钥
    let (root_key, chain_key) = hkdf_sha256(&combined, b"X3DH");

    Ok(SessionState {
        session_id: format!("{:x}", rand::random::<u128>()),
        remote_user_id: String::new(),
        remote_device_id: String::new(),
        sending_chain_key: chain_key,
        receiving_chain_key: vec![],
        sending_ratchet_key: ephemeral_public.to_bytes().to_vec(),
        receiving_ratchet_key: recipient_signed_prekey_public.to_bytes().to_vec(),
        sending_index: 0,
        receiving_index: 0,
        previous_sending_index: 0,
        root_key,
        remote_identity_key: bundle.identity_key.clone(),
    })
}

pub fn accept_session(
    _local_identity: &Option<IdentityKeyPair>,
    _prekey_message: &super::EncryptedMessage,
) -> Result<SessionState, X3DHError> {
    // 接收方 X3DH 实现
    // 与 initiate_session 类似但使用接收方的密钥
    Err(X3DHError::InvalidPrekeyBundle)
}

fn hkdf_sha256(ikm: &[u8], info: &[u8]) -> (Vec<u8>, Vec<u8>) {
    use hkdf::Hkdf;
    use sha2::Sha256;

    let hk = Hkdf::<Sha256>::new(Some(ikm), info);
    let mut okm = vec![0u8; 64];
    hk.expand(&[0, 1], &mut okm).unwrap();

    // 前 32 字节作为根密钥，后 32 字节作为链密钥
    (okm[..32].to_vec(), okm[32..].to_vec())
}
