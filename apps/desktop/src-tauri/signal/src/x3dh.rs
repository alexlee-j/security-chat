// apps/desktop/src-tauri/signal/src/x3dh.rs

use super::{EncryptedMessage, IdentityKeyPair, PrekeyBundle, PrekeyStore, PreKeyMessage, SessionState, X3DHResult};
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

pub fn initiate_session(
    local_identity: &Option<IdentityKeyPair>,
    bundle: &PrekeyBundle,
) -> Result<X3DHResult, X3DHError> {
    use x25519_dalek::{PublicKey, StaticSecret};

    let local_identity = local_identity.as_ref().ok_or(X3DHError::MissingIdentityKey)?;

    // Alice 的身份私钥
    let alice_identity_private = StaticSecret::from(
        <[u8; 32]>::try_from(local_identity.private_key.as_slice())
            .map_err(|_| X3DHError::InvalidPublicKey)?
    );

    // 生成临时密钥对 (Ephemeral Key)
    let ephemeral_private = StaticSecret::random_from_rng(rand::thread_rng());
    let ephemeral_public = PublicKey::from(&ephemeral_private);

    // 从 Bundle 获取接收方公钥
    let recipient_identity_public = PublicKey::from(
        <[u8; 32]>::try_from(bundle.identity_key.as_slice())
            .map_err(|_| X3DHError::InvalidPrekeyBundle)?
    );

    let recipient_signed_prekey_public = PublicKey::from(
        <[u8; 32]>::try_from(bundle.signed_prekey.public_key.as_slice())
            .map_err(|_| X3DHError::InvalidPrekeyBundle)?
    );

    // 计算 DH1 = DH(IK_A, SPK_B) - Alice 身份私钥与 Bob 签名公钥
    let dh1 = alice_identity_private.diffie_hellman(&recipient_signed_prekey_public);

    // 计算 DH2 = DH(EK_A, IK_B) - Alice 临时私钥与 Bob 身份公钥
    let dh2 = ephemeral_private.diffie_hellman(&recipient_identity_public);

    // 计算 DH3 = DH(EK_A, SPK_B) - Alice 临时私钥与 Bob 签名公钥
    let dh3 = ephemeral_private.diffie_hellman(&recipient_signed_prekey_public);

    // 如果有一时预密钥，计算 DH4 = DH(EK_A, OPK_B)
    let (dh4, opk_id) = if let Some(ref opk) = bundle.one_time_prekey {
        let opk_public = PublicKey::from(
            <[u8; 32]>::try_from(opk.public_key.as_slice())
                .map_err(|_| X3DHError::InvalidPrekeyBundle)?
        );
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

    // 5. 计算 DH（注意顺序要与 Alice 对应）
    // Alice: DH1=DH(IK_A, SPK_B), DH2=DH(EK_A, IK_B), DH3=DH(EK_A, SPK_B)
    // Bob: DH(SPK_B, IK_A)=Alice的DH1, DH(EK_A, IK_B)=Alice的DH2, DH(SPK_B, EK_A)=Alice的DH3
    let dh_a1 = spk_private.diffie_hellman(&sender_identity_public);     // = DH(IK_A, SPK_B) = Alice DH1
    let dh_a2 = ik_private.diffie_hellman(&sender_ephemeral_public);      // = DH(EK_A, IK_B) = Alice DH2
    let dh_a3 = spk_private.diffie_hellman(&sender_ephemeral_public);    // = DH(EK_A, SPK_B) = Alice DH3

    // 6. 如果使用了一次性预密钥，计算 DH4
    // Alice: DH4 = DH(EK_A, OPK_B)
    // Bob: DH(OPK_B, EK_A) = Alice DH4
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

    // 7. 合并 DH 输出（顺序与 Alice 一致：DH1, DH2, DH3, DH4）
    let mut combined = Vec::new();
    combined.extend_from_slice(dh_a1.as_bytes());
    combined.extend_from_slice(dh_a2.as_bytes());
    combined.extend_from_slice(dh_a3.as_bytes());
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
    use crate::{SignedPrekey, OneTimePrekey, PrekeyStore};

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

    #[test]
    fn test_x3dh_initiate_and_accept_without_one_time_prekey() {
        // 测试 X3DH 发起方和接收方在没有一次性预密钥时能正确建立会话
        use x25519_dalek::{PublicKey, StaticSecret};

        // 1. 生成 Alice（发起方）的身份密钥
        let alice_identity_private = StaticSecret::random_from_rng(rand::thread_rng());
        let alice_identity_public = PublicKey::from(&alice_identity_private);
        let alice_identity = IdentityKeyPair {
            public_key: alice_identity_public.to_bytes().to_vec(),
            private_key: alice_identity_private.to_bytes().to_vec(),
        };

        // 2. 生成 Bob（接收方）的身份密钥
        let bob_identity_private = StaticSecret::random_from_rng(rand::thread_rng());
        let bob_identity_public = PublicKey::from(&bob_identity_private);
        let bob_identity = IdentityKeyPair {
            public_key: bob_identity_public.to_bytes().to_vec(),
            private_key: bob_identity_private.to_bytes().to_vec(),
        };

        // 3. 生成 Bob 的签名预密钥
        let bob_spk_private = StaticSecret::random_from_rng(rand::thread_rng());
        let bob_spk_public = PublicKey::from(&bob_spk_private);
        let bob_signed_prekey = SignedPrekey {
            key_id: 1,
            public_key: bob_spk_public.to_bytes().to_vec(),
            private_key: bob_spk_private.to_bytes().to_vec(),
            signature: vec![], // 签名在测试中不重要
        };

        // 4. 构建 Bob 的 PrekeyBundle
        let bob_bundle = PrekeyBundle {
            registration_id: 1,
            identity_key: bob_identity.public_key.clone(),
            signed_prekey: bob_signed_prekey,
            one_time_prekey: None,
        };

        // 5. Alice 发起 X3DH
        let alice_result = initiate_session(&Some(alice_identity), &bob_bundle)
            .expect("Alice should initiate session successfully");

        // 6. Alice 发送第一条消息（嵌入 X3DH 数据）
        let alice_ephemeral_key = alice_result.pre_key_message.ephemeral_key.clone();
        let alice_message_for_bob = EncryptedMessage {
            identity_key: Some(alice_result.pre_key_message.identity_key.clone()),
            base_key: Some(alice_ephemeral_key),
            signed_prekey_id: Some(alice_result.pre_key_message.signed_prekey_id),
            pre_key_id: alice_result.pre_key_message.one_time_prekey_id,
            message_number: 0,
            previous_sending_index: None,
            ciphertext: vec![], // 加密内容在测试中不重要
            dh_public_key: None,
        };

        // 7. Bob 接受 X3DH
        let bob_prekey_store = PrekeyStore {
            signed_prekey: Some(SignedPrekey {
                key_id: 1,
                public_key: bob_spk_public.to_bytes().to_vec(),
                private_key: bob_spk_private.to_bytes().to_vec(),
                signature: vec![],
            }),
            one_time_prekeys: vec![],
        };

        let bob_session = accept_session(&Some(bob_identity), &bob_prekey_store, &alice_message_for_bob)
            .expect("Bob should accept session successfully");

        // 8. 验证双方得到的根密钥相同
        assert_eq!(
            alice_result.session_state.root_key, bob_session.root_key,
            "Both parties should have the same root key"
        );

        // 9. 验证双方得到的链密钥相同
        assert_eq!(
            alice_result.session_state.sending_chain_key, bob_session.receiving_chain_key,
            "Alice's sending chain key should equal Bob's receiving chain key"
        );
    }

    #[test]
    fn test_x3dh_initiate_and_accept_with_one_time_prekey() {
        // 测试 X3DH 发起方和接收方在有一次性预密钥时能正确建立会话
        use x25519_dalek::{PublicKey, StaticSecret};

        // 1. 生成 Alice（发起方）的身份密钥
        let alice_identity_private = StaticSecret::random_from_rng(rand::thread_rng());
        let alice_identity_public = PublicKey::from(&alice_identity_private);
        let alice_identity = IdentityKeyPair {
            public_key: alice_identity_public.to_bytes().to_vec(),
            private_key: alice_identity_private.to_bytes().to_vec(),
        };

        // 2. 生成 Bob（接收方）的身份密钥
        let bob_identity_private = StaticSecret::random_from_rng(rand::thread_rng());
        let bob_identity_public = PublicKey::from(&bob_identity_private);
        let bob_identity = IdentityKeyPair {
            public_key: bob_identity_public.to_bytes().to_vec(),
            private_key: bob_identity_private.to_bytes().to_vec(),
        };

        // 3. 生成 Bob 的签名预密钥
        let bob_spk_private = StaticSecret::random_from_rng(rand::thread_rng());
        let bob_spk_public = PublicKey::from(&bob_spk_private);

        // 4. 生成 Bob 的一次性预密钥
        let bob_opk_private = StaticSecret::random_from_rng(rand::thread_rng());
        let bob_opk_public = PublicKey::from(&bob_opk_private);
        let bob_one_time_prekey = OneTimePrekey {
            key_id: 42,
            public_key: bob_opk_public.to_bytes().to_vec(),
            private_key: bob_opk_private.to_bytes().to_vec(),
        };

        // 5. 构建 Bob 的 PrekeyBundle（包含一次性预密钥）
        let bob_bundle = PrekeyBundle {
            registration_id: 1,
            identity_key: bob_identity.public_key.clone(),
            signed_prekey: SignedPrekey {
                key_id: 1,
                public_key: bob_spk_public.to_bytes().to_vec(),
                private_key: bob_spk_private.to_bytes().to_vec(),
                signature: vec![],
            },
            one_time_prekey: Some(bob_one_time_prekey),
        };

        // 6. Alice 发起 X3DH
        let alice_result = initiate_session(&Some(alice_identity), &bob_bundle)
            .expect("Alice should initiate session successfully");

        // 验证 Alice 正确获取了一次性预密钥 ID
        assert_eq!(alice_result.pre_key_message.one_time_prekey_id, Some(42));

        // 7. Alice 发送第一条消息
        let alice_ephemeral_key = alice_result.pre_key_message.ephemeral_key.clone();
        let alice_message_for_bob = EncryptedMessage {
            identity_key: Some(alice_result.pre_key_message.identity_key.clone()),
            base_key: Some(alice_ephemeral_key),
            signed_prekey_id: Some(alice_result.pre_key_message.signed_prekey_id),
            pre_key_id: alice_result.pre_key_message.one_time_prekey_id,
            message_number: 0,
            previous_sending_index: None,
            ciphertext: vec![],
            dh_public_key: None,
        };

        // 8. Bob 接受 X3DH
        let bob_prekey_store = PrekeyStore {
            signed_prekey: Some(SignedPrekey {
                key_id: 1,
                public_key: bob_spk_public.to_bytes().to_vec(),
                private_key: bob_spk_private.to_bytes().to_vec(),
                signature: vec![],
            }),
            one_time_prekeys: vec![OneTimePrekey {
                key_id: 42,
                public_key: bob_opk_public.to_bytes().to_vec(),
                private_key: bob_opk_private.to_bytes().to_vec(),
            }],
        };

        let bob_session = accept_session(&Some(bob_identity), &bob_prekey_store, &alice_message_for_bob)
            .expect("Bob should accept session successfully");

        // 9. 验证双方得到的根密钥相同
        assert_eq!(
            alice_result.session_state.root_key, bob_session.root_key,
            "Both parties should have the same root key with OPK"
        );

        // 10. 验证双方得到的链密钥相同
        assert_eq!(
            alice_result.session_state.sending_chain_key, bob_session.receiving_chain_key,
            "Alice's sending chain key should equal Bob's receiving chain key with OPK"
        );
    }

    #[test]
    fn test_dh_symmetry() {
        // 验证 DH 交换是对称的：DH(A私有, B公有) == DH(B私有, A公有)
        use x25519_dalek::{PublicKey, StaticSecret};

        let a_private = StaticSecret::random_from_rng(rand::thread_rng());
        let b_private = StaticSecret::random_from_rng(rand::thread_rng());

        let a_public = PublicKey::from(&a_private);
        let b_public = PublicKey::from(&b_private);

        // DH(a_private, b_public) == DH(b_private, a_public)
        let dh_ab = a_private.diffie_hellman(&b_public);
        let dh_ba = b_private.diffie_hellman(&a_public);

        assert_eq!(dh_ab.as_bytes(), dh_ba.as_bytes(), "DH should be symmetric");
    }
}
