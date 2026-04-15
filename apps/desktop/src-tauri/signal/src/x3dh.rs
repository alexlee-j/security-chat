// apps/desktop/src-tauri/signal/src/x3dh.rs

use super::{IdentityKeyPair, PrekeyBundle, SessionState};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum X3DHError {
    #[error("Missing identity key")]
    MissingIdentityKey,
    #[error("Invalid prekey bundle")]
    InvalidPrekeyBundle,
}

pub fn initiate_session(
    local_identity: &Option<IdentityKeyPair>,
    bundle: &PrekeyBundle,
) -> Result<SessionState, X3DHError> {
    let _local_identity = local_identity.as_ref().ok_or(X3DHError::MissingIdentityKey)?;

    use x25519_dalek::{PublicKey, StaticSecret};

    // 生成临时密钥对 (Ephemeral Key)
    let ephemeral_private = StaticSecret::random_from_rng(rand::thread_rng());
    let ephemeral_public = PublicKey::from(&ephemeral_private);

    // 从 Bundle 获取接收方公钥
    // identity_key 是 [u8; 32]
    let identity_key_array: [u8; 32] = bundle.identity_key.clone().try_into()
        .map_err(|_| X3DHError::InvalidPrekeyBundle)?;
    let recipient_identity_public = PublicKey::from(identity_key_array);

    // signed_prekey public_key 也是 [u8; 32]
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
    let dh4 = if let Some(ref opk) = bundle.one_time_prekey {
        let opk_array: [u8; 32] = opk.public_key.clone().try_into()
            .map_err(|_| X3DHError::InvalidPrekeyBundle)?;
        let opk_public = PublicKey::from(opk_array);
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

/// 接收方 X3DH 实现
///
/// # 设计说明
///
/// 完整的接收方 X3DH 需要访问本地签名预密钥的私钥，但当前数据结构设计
/// 无法支持这一点。正确的实现需要：
/// 1. 存储结构包含本地签名预密钥的私钥
/// 2. 消息格式需要包含接收方公钥信息
///
/// 当前 `EncryptedMessage` 包含发送方的公钥，但缺少接收方使用的公钥信息。
/// 接收方需要这些公钥来重新计算 DH。
///
/// # 解决方案
///
/// 有两种方式修复：
/// 1. **修改消息格式**：在 PreKeyMessage 中包含接收方使用的公钥
/// 2. **使用密钥仓库**：存储本地私钥，通过 prekey_id 查找
///
/// 当前实现返回错误直到完成完整设计。
pub fn accept_session(
    _local_identity: &Option<IdentityKeyPair>,
    _prekey_message: &super::EncryptedMessage,
) -> Result<SessionState, X3DHError> {
    // TODO: 实现完整的接收方 X3DH
    //
    // 需要：
    // 1. 从 prekey_message 提取发送方公钥 (identity_key, base_key)
    // 2. 查找本地签名预密钥私钥（通过 prekey_id）
    // 3. 执行 DH 计算：
    //    - DH1 = DH(SPK_B_private, EK_A_public)  // 接收方签名预密钥私钥 × 发送方临时公钥
    //    - DH2 = DH(IK_B_private, EK_A_public)   // 接收方身份私钥 × 发送方临时公钥
    //    - DH3 = DH(SPK_B_private, EK_A_public)  // 同 DH1
    //    - DH4 = DH(OPK_B_private, EK_A_public)  // 如果使用一次性预密钥
    // 4. 合并 DH 输出并通过 HKDF 生成根密钥和链密钥
    //
    // 当前数据结构不支持步骤 2，需要重构 IdentityKeyPair 或存储结构

    Err(X3DHError::InvalidPrekeyBundle)
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
