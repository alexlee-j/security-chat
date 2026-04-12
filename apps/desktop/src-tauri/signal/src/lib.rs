// apps/desktop/src-tauri/signal/src/lib.rs

mod x3dh;
mod double_ratchet;
mod session;
mod prekeys;

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    init_panic_hook();
    Ok(())
}

#[derive(Serialize, Deserialize, Clone)]
pub struct IdentityKeyPair {
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PrekeyBundle {
    pub registration_id: u32,
    pub identity_key: Vec<u8>,
    pub signed_prekey: SignedPrekey,
    pub one_time_prekey: Option<OneTimePrekey>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SignedPrekey {
    pub key_id: u32,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OneTimePrekey {
    pub key_id: u32,
    pub public_key: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionState {
    pub session_id: String,
    pub remote_user_id: String,
    pub remote_device_id: String,
    pub sending_chain_key: Vec<u8>,
    pub receiving_chain_key: Vec<u8>,
    pub sending_ratchet_key: Vec<u8>,
    pub receiving_ratchet_key: Vec<u8>,
    pub sending_index: u32,
    pub receiving_index: u32,
    pub previous_sending_index: u32,
    pub root_key: Vec<u8>,
    pub remote_identity_key: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EncryptedMessage {
    pub pre_key_id: Option<u32>,
    pub base_key: Option<Vec<u8>>,
    pub identity_key: Option<Vec<u8>>,
    pub message_number: u32,
    pub previous_sending_index: Option<u32>,
    pub ciphertext: Vec<u8>,
    pub dh_public_key: Option<Vec<u8>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DecryptedMessage {
    pub plaintext: String,
    pub message_number: u32,
    pub previous_sending_index: Option<u32>,
}

#[wasm_bindgen]
pub struct SignalProtocol {
    identity_key_pair: Option<IdentityKeyPair>,
}

#[wasm_bindgen]
impl SignalProtocol {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { identity_key_pair: None }
    }

    #[wasm_bindgen]
    pub fn generate_identity_key_pair(&mut self) -> Result<JsValue, JsValue> {
        use x25519_dalek::{StaticSecret, PublicKey};

        let private = StaticSecret::random_from_rng(rand::thread_rng());
        let public = PublicKey::from(&private);

        let key_pair = IdentityKeyPair {
            public_key: public.to_bytes().to_vec(),
            private_key: private.to_bytes().to_vec(),
        };

        serde_wasm_bindgen::to_value(&key_pair)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen]
    pub fn set_identity_key_pair(&mut self, key_pair: JsValue) -> Result<(), JsValue> {
        let key_pair: IdentityKeyPair = serde_wasm_bindgen::from_value(key_pair)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        self.identity_key_pair = Some(key_pair);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn initiate_session(&self, prekey_bundle: JsValue) -> Result<JsValue, JsValue> {
        let bundle: PrekeyBundle = serde_wasm_bindgen::from_value(prekey_bundle)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        let session = x3dh::initiate_session(&self.identity_key_pair, &bundle)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        serde_wasm_bindgen::to_value(&session)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen]
    pub fn accept_session(&self, prekey_message: JsValue) -> Result<JsValue, JsValue> {
        let message: EncryptedMessage = serde_wasm_bindgen::from_value(prekey_message)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        let session = x3dh::accept_session(&self.identity_key_pair, &message)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        serde_wasm_bindgen::to_value(&session)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen]
    pub fn encrypt_message(&self, session: JsValue, plaintext: &str) -> Result<JsValue, JsValue> {
        let mut session: SessionState = serde_wasm_bindgen::from_value(session)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        let encrypted = double_ratchet::encrypt(&mut session, plaintext.as_bytes())
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        serde_wasm_bindgen::to_value(&encrypted)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen]
    pub fn decrypt_message(&self, session: JsValue, encrypted: JsValue) -> Result<JsValue, JsValue> {
        let mut session: SessionState = serde_wasm_bindgen::from_value(session)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        let encrypted: EncryptedMessage = serde_wasm_bindgen::from_value(encrypted)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        let decrypted = double_ratchet::decrypt(&mut session, &encrypted)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        serde_wasm_bindgen::to_value(&decrypted)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }
}
