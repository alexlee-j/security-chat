// apps/desktop/src-tauri/signal/src/x3dh.rs

use super::{EncryptedMessage, IdentityKeyPair, PrekeyBundle, PrekeyStore, PreKeyMessage, SessionState};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum X3DHError {
    #[error("Missing identity key")]
    MissingIdentityKey,
    #[error("Invalid prekey bundle")]
    InvalidPrekeyBundle,
    #[error("Missing signed prekey")]
    MissingSignedPrekey,
    #[error("Missing one-time prekey")]
    MissingOneTimePrekey,
    #[error("Invalid public key")]
    InvalidPublicKey,
}

/// X3DH 发起方结果
pub struct X3DHResult {
    pub pre_key_message: PreKeyMessage,
    pub session_state: SessionState,
}

pub fn initiate_session(
    local_identity: &Option<IdentityKeyPair>,
    bundle: &PrekeyBundle,
) -> Result<X3DHResult, X3DHError> {
    let local_identity = local_identity.as_ref().ok_or(X3DHError::MissingIdentityKey)?;

    use x25519_dalek::{PublicKey, StaticSecret};

    // 生成临时密钥对 (Ephemeral Key)
    let ephemeral_private = StaticSecret::random_from_rng(rand::thread_rng());
    let ephemeral_public = PublicKey::from(&ephemeral_private);

    // 从 Bundle 获取接收方公钥
    let identity_key_array: [u8; 32] = bundle.identity_key.clone().try_into()
        .map_err(|_| X3DHError::InvalidPrekeyBundle)?;
    let recipient_identity_public = PublicKey::from(identity_key_array);

    let spk_array: [u8; 32] = bundle.signed_prekey.public_key.clone().try_into()
        .map_err(|_| X3DHError::InvalidPrekeyBundle)?;
    let recipient_signed_prekey_public = PublicKey::from(spk_array);

    // 计算 DH1 = DH(IK_A, SPK_B)
    let dh1 = ephemeral_private.diffie_hellman(&recipient_signed_prekey_public);

    // 计算 DH2 = DH(EK_A, IK_B)
    let dh2 = ephemeral_private.diffie_hellman(&recipient_identity_public);

    // 计算 DH3 = DH(EK_A, SPK_B)
    let dh3 = ephemeral_private.diffie_hellman(&recipient_signed_prekey_public);

    // 如果有一时预密钥，计算 DH4 = DH(EK_A, OPK_B)
    let (dh4, opk_id) = if let Some(ref opk) = bundle.one_time_prekey {
        let opk_array: [u8; 32] = opk.public_key.clone().try_into()
            .map_err(|_| X3DHError::InvalidPrekeyBundle)?;
        let opk_public = PublicKey::from(opk_array);
        (Some(ephemeral_private.diffie_hellman(&opk_public)), Some(opk.key_id))
    } else {
        (None, None)
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

    // 创建 PreKeyMessage（发送第一条消息时使用）
    let pre_key_message = PreKeyMessage {
        identity_key: local_identity.public_key.clone(),
        ephemeral_key: ephemeral_public.to_bytes().to_vec(),
        signed_prekey_id: bundle.signed_prekey.key_id,
        one_time_prekey_id: opk_id,
    };

    let session_state = SessionState {
        session_id: format!("{:x}", rand::random::<u128>()),
        remote_user_id: String::new(),
        remote_device_id: String::new(),
        sending_chain_key: chain_key.clone(),
        receiving_chain_key: chain_key,
        sending_ratchet_key: ephemeral_public.to_bytes().to_vec(),
        receiving_ratchet_key: recipient_signed_prekey_public.to_bytes().to_vec(),
        sending_index: 0,
        receiving_index: 0,
        previous_sending_index: 0,
        root_key,
        remote_identity_key: bundle.identity_key.clone(),
    };

    Ok(X3DHResult {
        pre_key_message,
        session_state,
    })
}

/// 接收方 X3DH 实现
///
/// 当接收方（Bob）收到发送方（Alice）的 PreKeySignalMessage 时：
/// 1. 从消息中提取 Alice 的公钥（identity_key, base_key）
/// 2. 使用 Bob 的私钥（identity, signed_prekey, one_time_prekey）和 Alice 的公钥计算 DH
/// 3. 合并 DH 输出，通过 HKDF 生成根密钥和链密钥
pub fn accept_session(
    local_identity: &Option<IdentityKeyPair>,
    prekey_store: &PrekeyStore,
    prekey_message: &EncryptedMessage,
) -> Result<SessionState, X3DHError> {
    use x25519_dalek::{PublicKey, StaticSecret};

    // 1. 获取本地身份密钥
    let local_identity = local_identity.as_ref().ok_or(X3DHError::MissingIdentityKey)?;

    // 2. 从消息中提取发送方的公钥
    let sender_identity_key = prekey_message.identity_key.as_ref()
        .ok_or(X3DHError::InvalidPrekeyBundle)?;
    let sender_ephemeral_key = prekey_message.base_key.as_ref()
        .ok_or(X3DHError::InvalidPrekeyBundle)?;

    let sender_identity_public = PublicKey::from(
        <[u8; 32]>::try_from(sender_identity_key.as_slice())
            .map_err(|_| X3DHError::InvalidPublicKey)?
    );
    let sender_ephemeral_public = PublicKey::from(
        <[u8; 32]>::try_from(sender_ephemeral_key.as_slice())
            .map_err(|_| X3DHError::InvalidPublicKey)?
    );

    // 3. 获取本地签名预密钥私钥
    let signed_prekey = prekey_store.signed_prekey.as_ref()
        .ok_or(X3DHError::MissingSignedPrekey)?;
    let spk_private = StaticSecret::from(
        <[u8; 32]>::try_from(signed_prekey.private_key.as_slice())
            .map_err(|_| X3DHError::InvalidPublicKey)?
    );
    // 同时获取签名预密钥的公钥（用于接收方 ratchet）
    let spk_public = PublicKey::from(
        <[u8; 32]>::try_from(signed_prekey.public_key.as_slice())
            .map_err(|_| X3DHError::InvalidPublicKey)?
    );

    // 4. 获取本地身份私钥
    let ik_private = StaticSecret::from(
        <[u8; 32]>::try_from(local_identity.private_key.as_slice())
            .map_err(|_| X3DHError::InvalidPublicKey)?
    );

    // 5. 计算 DH
    // DH1 = DH(SPK_B_private, EK_A_public)
    let dh1 = spk_private.diffie_hellman(&sender_ephemeral_public);
    // DH2 = DH(IK_B_private, EK_A_public)
    let dh2 = ik_private.diffie_hellman(&sender_ephemeral_public);
    // DH3 = DH(SPK_B_private, IK_A_public) - 用于接收链
    let dh3 = spk_private.diffie_hellman(&sender_identity_public);

    // 6. 如果使用了一次性预密钥，计算 DH4
    let dh4 = if let Some(opk_id) = prekey_message.pre_key_id {
        let opk = prekey_store.one_time_prekeys.iter()
            .find(|opk| opk.key_id == opk_id)
            .ok_or(X3DHError::MissingOneTimePrekey)?;
        let opk_private = StaticSecret::from(
            <[u8; 32]>::try_from(opk.private_key.as_slice())
                .map_err(|_| X3DHError::InvalidPublicKey)?
        );
        Some(opk_private.diffie_hellman(&sender_ephemeral_public))
    } else {
        None
    };

    // 7. 合并 DH 输出
    let mut combined = Vec::new();
    combined.extend_from_slice(dh1.as_bytes());
    combined.extend_from_slice(dh2.as_bytes());
    combined.extend_from_slice(dh3.as_bytes());
    if let Some(dh4_val) = dh4 {
        combined.extend_from_slice(dh4_val.as_bytes());
    }

    // 8. KDF 生成根密钥和链密钥
    let (root_key, chain_key) = hkdf_sha256(&combined, b"X3DH");

    Ok(SessionState {
        session_id: format!("{:x}", rand::random::<u128>()),
        remote_user_id: String::new(),
        remote_device_id: String::new(),
        // 接收方发送链密钥与 X3DH 输出相同（用于初始化 Double Ratchet）
        sending_chain_key: chain_key.clone(),
        receiving_chain_key: chain_key,
        // 接收方使用签名预密钥作为初始 ratchet 公钥
        sending_ratchet_key: spk_public.to_bytes().to_vec(),
        receiving_ratchet_key: sender_ephemeral_key.clone(),
        sending_index: 0,
        receiving_index: 0,
        previous_sending_index: 0,
        root_key,
        remote_identity_key: sender_identity_key.clone(),
    })
}

fn hkdf_sha256(ikm: &[u8], info: &[u8]) -> (Vec<u8>, Vec<u8>) {
    use hkdf::Hkdf;
    use sha2::Sha256;

    // HKDF RFC 5869: Hkdf(salt, ikm) -> expand(info, output)
    // 正确的调用：Hkdf::new(salt, ikm) 然后 expand(info, output)
    let hk = Hkdf::<Sha256>::new(None, ikm);
    let mut okm = vec![0u8; 64];
    hk.expand(info, &mut okm).unwrap();

    // 前 32 字节作为根密钥，后 32 字节作为链密钥
    (okm[..32].to_vec(), okm[32..].to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hkdf_sha256_output_length() {
        // 给定输入，应该输出 64 字节（32 字节根密钥 + 32 字节链密钥）
        let ikm = vec![0u8; 32];
        let info = b"X3DH";
        let (root_key, chain_key) = hkdf_sha256(&ikm, info);

        assert_eq!(root_key.len(), 32, "Root key should be 32 bytes");
        assert_eq!(chain_key.len(), 32, "Chain key should be 32 bytes");
    }

    #[test]
    fn test_hkdf_sha256_deterministic() {
        // 相同输入应该产生相同输出
        let ikm = vec![0u8; 32];
        let info = b"X3DH";

        let (root1, chain1) = hkdf_sha256(&ikm, info);
        let (root2, chain2) = hkdf_sha256(&ikm, info);

        assert_eq!(root1, root2, "HKDF should be deterministic");
        assert_eq!(chain1, chain2, "HKDF should be deterministic");
    }

    #[test]
    fn test_hkdf_sha256_different_info_produces_different_keys() {
        // 不同的 info 应该产生不同的密钥
        let ikm = vec![0u8; 32];

        let (root1, chain1) = hkdf_sha256(&ikm, b"X3DH");
        let (root2, chain2) = hkdf_sha256(&ikm, b"X3DH-v2");

        // 不同的 info 应该产生不同的输出（高概率）
        assert_ne!(root1, root2, "Different info should produce different root key");
        assert_ne!(chain1, chain2, "Different info should produce different chain key");
    }
}
