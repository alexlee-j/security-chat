## 1. Secure Key Provider

- [x] 1.1 Add a Rust secure key provider abstraction for 32-byte desktop local encryption keys with stable service/account names.
- [x] 1.2 Keep macOS Keychain compatibility for the existing Signal store and local message store key names.
- [x] 1.3 Add Windows secure storage support through Credential Manager, DPAPI, or an approved cross-platform keyring adapter.
- [x] 1.4 Add Linux secure storage support through Secret Service/libsecret when Linux remains a supported production package target.
- [x] 1.5 Ensure production builds fail closed when secure storage is unavailable or returns malformed key material.
- [x] 1.6 Keep deterministic key material only under test-only configuration and prevent fixed-key fallbacks from compiling into production paths.

## 2. Local Store Integration

- [x] 2.1 Route `SQLiteStore::signal_store_key` through the secure key provider for production builds.
- [x] 2.2 Route `LocalStore::local_message_store_key` through the secure key provider for production builds.
- [x] 2.3 Verify existing macOS encrypted Signal and local message stores remain decryptable after the provider refactor.
- [x] 2.4 Remove or retire the unused `crypto::keychain::SecureKeychain` path if it is not wired into production storage.
- [x] 2.5 Add Rust tests for key creation, key reuse, malformed stored key handling, and fail-closed provider errors.

## 3. Release Packaging Configuration

- [x] 3.1 Change the Tauri bundle identifier so it no longer ends with `.app`.
- [x] 3.2 Disable webview devtools for production bundles while preserving development debugging behavior.
- [x] 3.3 Remove the Tauri `devtools` Cargo feature from the default release feature set or gate it behind an explicit debug package profile.
- [x] 3.4 Review updater placeholder configuration and document or correct any release packaging warnings it causes.

## 4. Warning Cleanup

- [x] 4.1 Replace deprecated first-party Rust `rand::thread_rng` usage with the supported rand 0.9 API.
- [x] 4.2 Remove stale first-party Rust modules/functions that only produce dead-code warnings and are not part of the active desktop runtime.
- [x] 4.3 Keep any intentional unused Rust code behind a narrow documented exception instead of broad warning suppression.
- [x] 4.4 Normalize desktop frontend imports so modules are not both statically and dynamically imported when the dynamic import cannot split a chunk.
- [x] 4.5 Decide whether the remaining large Vite chunk is accepted for Tauri local loading or split through manual chunks, and encode that decision in config or implementation notes.
- [x] 4.6 Optionally reduce font payload by importing only required font formats/subsets if it does not regress desktop rendering.

## 5. Verification

- [x] 5.1 Run focused Rust tests for secure key provider and local store encryption behavior.
- [x] 5.2 Run `pnpm build:desktop` and confirm remaining frontend warnings are intentional and documented.
- [x] 5.3 Run `pnpm --filter @security-chat/desktop tauri:build` and confirm production package warnings are resolved or explicitly accepted.
- [x] 5.4 Run `openspec validate fix-desktop-secure-storage-and-packaging-warnings --strict`.
- [x] 5.5 Document any platform-specific verification gaps, especially Windows/Linux secure storage checks that cannot be run on the current machine.
