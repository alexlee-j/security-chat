//! 密钥生成与管理 - 暂时禁用未使用的代码

#![allow(dead_code)]

use libsignal_protocol::{
    IdentityKey,
    IdentityKeyPair,
    PrivateKey,
    PublicKey,
    KeyPair,
    SignalProtocolError,
    PreKeyBundle,
    DeviceId,
    kem,
};
use rand::rngs::OsRng;
use rand::TryRngCore as _;
use rand::RngCore as _;

/// 本地身份密钥对
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LocalIdentityKeyPair {
    pub public_key: Vec<u8>,
    #[serde(skip)]
    pub private_key: Vec<u8>,
}

/// 本地预密钥
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LocalPreKey {
    pub key_id: u32,
    pub public_key: Vec<u8>,
    #[serde(skip)]
    pub private_key: Vec<u8>,
}

/// 本地签名预密钥
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LocalSignedPreKey {
    pub key_id: u32,
    pub public_key: Vec<u8>,
    #[serde(skip)]
    pub private_key: Vec<u8>,
    pub signature: Vec<u8>,
}

/// 本地 Kyber 预密钥（后量子密码学）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LocalKyberPreKey {
    pub key_id: u32,
    pub public_key: Vec<u8>,
    #[serde(skip)]
    pub private_key: Vec<u8>,
    pub signature: Vec<u8>,
}

impl LocalIdentityKeyPair {
    pub fn to_signal_keypair(&self) -> Result<IdentityKeyPair, SignalProtocolError> {
        let identity_priv = PrivateKey::deserialize(&self.private_key)?;
        let identity_pub = PublicKey::deserialize(&self.public_key)?;
        Ok(IdentityKeyPair::new(identity_pub.into(), identity_priv))
    }
}

/// 生成身份密钥对
pub fn generate_identity_key_pair() -> Result<LocalIdentityKeyPair, SignalProtocolError> {
    let mut rng = OsRng.unwrap_err();
    let key_pair = IdentityKeyPair::generate(&mut rng);

    Ok(LocalIdentityKeyPair {
        public_key: key_pair.public_key().serialize().to_vec(),
        private_key: key_pair.private_key().serialize().to_vec(),
    })
}

/// 生成预密钥
pub fn generate_pre_key(key_id: u32) -> Result<LocalPreKey, SignalProtocolError> {
    let mut rng = OsRng.unwrap_err();
    let key_pair = KeyPair::generate(&mut rng);

    Ok(LocalPreKey {
        key_id,
        public_key: key_pair.public_key.serialize().to_vec(),
        private_key: key_pair.private_key.serialize().to_vec(),
    })
}

/// 生成签名预密钥
pub fn generate_signed_pre_key(
    identity_key_pair: &LocalIdentityKeyPair,
    key_id: u32,
) -> Result<LocalSignedPreKey, SignalProtocolError> {
    let identity_key_pair_signal = identity_key_pair.to_signal_keypair()?;
    let mut rng = OsRng.unwrap_err();
    let key_pair = KeyPair::generate(&mut rng);
    let signature = identity_key_pair_signal.private_key()
        .calculate_signature(&key_pair.public_key.serialize(), &mut rng)?;

    Ok(LocalSignedPreKey {
        key_id,
        public_key: key_pair.public_key.serialize().to_vec(),
        private_key: key_pair.private_key.serialize().to_vec(),
        signature: signature.to_vec(),
    })
}

/// 生成 Kyber 预密钥（后量子密码学）
pub fn generate_kyber_pre_key(
    identity_key_pair: &LocalIdentityKeyPair,
    key_id: u32,
) -> Result<LocalKyberPreKey, SignalProtocolError> {
    let identity_key_pair_signal = identity_key_pair.to_signal_keypair()?;
    let mut rng = OsRng.unwrap_err();

    let kem_keypair = kem::KeyPair::generate(kem::KeyType::Kyber1024, &mut rng);

    let signature = identity_key_pair_signal.private_key()
        .calculate_signature(&kem_keypair.public_key.serialize(), &mut rng)?;

    Ok(LocalKyberPreKey {
        key_id,
        public_key: kem_keypair.public_key.serialize().to_vec(),
        private_key: kem_keypair.secret_key.serialize().to_vec(),
        signature: signature.to_vec(),
    })
}

/// 生成预密钥包（包含 Kyber 后量子密钥）
pub fn generate_prekey_bundle(
    identity_key_pair: &LocalIdentityKeyPair,
    signed_pre_key: &LocalSignedPreKey,
    pre_key: Option<&LocalPreKey>,
    kyber_pre_key: &LocalKyberPreKey,
    registration_id: u32,
) -> Result<PreKeyBundle, SignalProtocolError> {
    let identity_pub = PublicKey::deserialize(&identity_key_pair.public_key)?;
    let identity_key = IdentityKey::new(identity_pub);

    let signed_prekey_pub = PublicKey::deserialize(&signed_pre_key.public_key)?;
    let kyber_public_key = kem::PublicKey::deserialize(&kyber_pre_key.public_key)?;

    let mut rng = OsRng.unwrap_err();
    let device_id_value: u8 = (rng.next_u32() % 255) as u8;
    let device_id = DeviceId::new(device_id_value)
        .map_err(|_| SignalProtocolError::InvalidArgument("Invalid device ID".to_string()))?;

    let bundle = PreKeyBundle::new(
        registration_id,
        device_id,
        pre_key.and_then(|pk| PublicKey::deserialize(&pk.public_key).ok().map(|pubkey| (pk.key_id.into(), pubkey))),
        signed_pre_key.key_id.into(),
        signed_prekey_pub,
        signed_pre_key.signature.to_vec(),
        kyber_pre_key.key_id.into(),
        kyber_public_key,
        kyber_pre_key.signature.to_vec(),
        identity_key,
    )?;

    Ok(bundle)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_identity_key_pair() {
        let key_pair = generate_identity_key_pair().unwrap();
        assert_eq!(key_pair.public_key.len(), 33);
        assert_eq!(key_pair.private_key.len(), 32);
    }

    #[test]
    fn test_generate_kyber_pre_key() {
        let identity_key_pair = generate_identity_key_pair().unwrap();
        let kyber_pre_key = generate_kyber_pre_key(&identity_key_pair, 1).unwrap();
        assert_eq!(kyber_pre_key.key_id, 1);
        assert!(!kyber_pre_key.public_key.is_empty());
        assert_eq!(kyber_pre_key.signature.len(), 64);
    }
}
