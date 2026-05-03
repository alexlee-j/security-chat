use thiserror::Error;

const KEY_LEN: usize = 32;
#[cfg(all(any(target_os = "windows", target_os = "linux"), not(test)))]
const SERVICE_NAME: &str = "com.security-chat.secure-storage";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecureKeySlot {
    SignalStore,
    LocalMessageStore,
}

impl SecureKeySlot {
    pub fn account_name(self) -> &'static str {
        match self {
            Self::SignalStore => "signal_protocol_store_key",
            Self::LocalMessageStore => "local_message_store_key",
        }
    }
}

#[derive(Debug, Error)]
pub enum SecureKeyError {
    #[error("secure storage unavailable: {0}")]
    StorageUnavailable(String),
    #[error("stored key '{account}' has invalid length {actual_len}, expected 32")]
    MalformedStoredKey { account: String, actual_len: usize },
}

pub trait SecureKeyBackend {
    fn get_secret(&self, account: &str) -> Result<Option<Vec<u8>>, SecureKeyError>;
    fn set_secret(&self, account: &str, secret: &[u8]) -> Result<(), SecureKeyError>;
}

#[cfg(not(test))]
pub fn load_or_create_key(slot: SecureKeySlot) -> Result<[u8; KEY_LEN], SecureKeyError> {
    let backend = PlatformSecureKeyBackend;
    load_or_create_key_with_backend(&backend, slot)
}

fn load_or_create_key_with_backend<B: SecureKeyBackend>(
    backend: &B,
    slot: SecureKeySlot,
) -> Result<[u8; KEY_LEN], SecureKeyError> {
    let account = slot.account_name();
    if let Some(existing) = backend.get_secret(account)? {
        return existing
            .try_into()
            .map_err(|value: Vec<u8>| SecureKeyError::MalformedStoredKey {
                account: account.to_string(),
                actual_len: value.len(),
            });
    }

    let key = rand::random::<[u8; KEY_LEN]>();
    backend.set_secret(account, &key)?;
    Ok(key)
}

#[cfg(not(test))]
struct PlatformSecureKeyBackend;

#[cfg(all(target_os = "macos", not(test)))]
impl SecureKeyBackend for PlatformSecureKeyBackend {
    fn get_secret(&self, account: &str) -> Result<Option<Vec<u8>>, SecureKeyError> {
        match crate::crypto::mac_keychain::MacKeychain::retrieve(account) {
            Ok(value) => Ok(Some(value)),
            Err(crate::crypto::mac_keychain::KeychainError::NotFound(_)) => Ok(None),
            Err(error) => Err(SecureKeyError::StorageUnavailable(error.to_string())),
        }
    }

    fn set_secret(&self, account: &str, secret: &[u8]) -> Result<(), SecureKeyError> {
        crate::crypto::mac_keychain::MacKeychain::store(account, secret)
            .map_err(|error| SecureKeyError::StorageUnavailable(error.to_string()))
    }
}

#[cfg(all(any(target_os = "windows", target_os = "linux"), not(test)))]
impl SecureKeyBackend for PlatformSecureKeyBackend {
    fn get_secret(&self, account: &str) -> Result<Option<Vec<u8>>, SecureKeyError> {
        let entry = keyring::Entry::new(SERVICE_NAME, account)
            .map_err(|error| SecureKeyError::StorageUnavailable(error.to_string()))?;
        match entry.get_secret() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(SecureKeyError::StorageUnavailable(error.to_string())),
        }
    }

    fn set_secret(&self, account: &str, secret: &[u8]) -> Result<(), SecureKeyError> {
        let entry = keyring::Entry::new(SERVICE_NAME, account)
            .map_err(|error| SecureKeyError::StorageUnavailable(error.to_string()))?;
        entry
            .set_secret(secret)
            .map_err(|error| SecureKeyError::StorageUnavailable(error.to_string()))
    }
}

#[cfg(all(
    not(any(target_os = "macos", target_os = "windows", target_os = "linux")),
    not(test)
))]
impl SecureKeyBackend for PlatformSecureKeyBackend {
    fn get_secret(&self, _account: &str) -> Result<Option<Vec<u8>>, SecureKeyError> {
        Err(SecureKeyError::StorageUnavailable(
            "platform secure storage is not supported for this target".to_string(),
        ))
    }

    fn set_secret(&self, _account: &str, _secret: &[u8]) -> Result<(), SecureKeyError> {
        Err(SecureKeyError::StorageUnavailable(
            "platform secure storage is not supported for this target".to_string(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;

    #[derive(Default)]
    struct FakeBackend {
        values: RefCell<HashMap<String, Vec<u8>>>,
        fail_store: bool,
    }

    impl FakeBackend {
        fn with_value(account: &str, value: Vec<u8>) -> Self {
            let backend = Self::default();
            backend
                .values
                .borrow_mut()
                .insert(account.to_string(), value);
            backend
        }
    }

    impl SecureKeyBackend for FakeBackend {
        fn get_secret(&self, account: &str) -> Result<Option<Vec<u8>>, SecureKeyError> {
            Ok(self.values.borrow().get(account).cloned())
        }

        fn set_secret(&self, account: &str, secret: &[u8]) -> Result<(), SecureKeyError> {
            if self.fail_store {
                return Err(SecureKeyError::StorageUnavailable(
                    "store failed".to_string(),
                ));
            }
            self.values
                .borrow_mut()
                .insert(account.to_string(), secret.to_vec());
            Ok(())
        }
    }

    #[test]
    fn creates_and_reuses_a_32_byte_key() {
        let backend = FakeBackend::default();

        let first = load_or_create_key_with_backend(&backend, SecureKeySlot::SignalStore)
            .expect("should create key");
        let second = load_or_create_key_with_backend(&backend, SecureKeySlot::SignalStore)
            .expect("should reuse key");

        assert_eq!(first.len(), 32);
        assert_eq!(first, second);
        assert_ne!(first, [0u8; 32]);
    }

    #[test]
    fn keeps_existing_key_names_for_macos_compatibility() {
        assert_eq!(
            SecureKeySlot::SignalStore.account_name(),
            "signal_protocol_store_key"
        );
        assert_eq!(
            SecureKeySlot::LocalMessageStore.account_name(),
            "local_message_store_key"
        );
    }

    #[test]
    fn rejects_malformed_existing_key_without_replacing_it() {
        let backend = FakeBackend::with_value(
            SecureKeySlot::LocalMessageStore.account_name(),
            vec![0x42; 31],
        );

        let result = load_or_create_key_with_backend(&backend, SecureKeySlot::LocalMessageStore);

        assert!(matches!(
            result,
            Err(SecureKeyError::MalformedStoredKey { .. })
        ));
        assert_eq!(
            backend
                .values
                .borrow()
                .get(SecureKeySlot::LocalMessageStore.account_name())
                .expect("original malformed value should remain")
                .len(),
            31,
        );
    }

    #[test]
    fn fails_closed_when_new_key_cannot_be_stored() {
        let backend = FakeBackend {
            fail_store: true,
            ..FakeBackend::default()
        };

        let result = load_or_create_key_with_backend(&backend, SecureKeySlot::SignalStore);

        assert!(matches!(result, Err(SecureKeyError::StorageUnavailable(_))));
        assert!(backend.values.borrow().is_empty());
    }
}
