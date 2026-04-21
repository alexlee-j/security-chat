## 1. Contract And Branch Guardrails

- [x] 1.1 Confirm implementation remains on branch `codex/security-chat-v2-closed-loop-integration` before code changes. Owner: GPT-5.4.
- [x] 1.2 Define the encrypted media payload TypeScript types and backend DTO expectations for `payload.media.version === 1`. Owner: GPT-5.4.
- [x] 1.3 Decide and document the final AEAD algorithm string and key/nonce encoding after checking current Rust dependencies. Owner: GPT-5.4.

## 2. Rust Media Crypto

- [x] 2.1 Add Rust/Tauri media encryption command that accepts plaintext bytes and metadata and returns ciphertext, key, nonce, digest, and size metadata. Owner: GPT-5.4.
- [x] 2.2 Add Rust/Tauri media decryption command that verifies digest/AEAD tag and returns plaintext bytes for preview/download. Owner: GPT-5.4.
- [x] 2.3 Add Rust unit tests for successful decrypt, wrong key failure, tampered ciphertext failure, and wrong digest failure. Owner: GPT-5.4.

## 3. Backend Ciphertext Media Storage

- [x] 3.1 Extend media asset model/API metadata to distinguish encrypted v1 assets from legacy plaintext assets. Owner: GPT-5.4.
- [x] 3.2 Update media upload handling so encrypted uploads are stored as opaque ciphertext without plaintext magic-byte validation. Owner: GPT-5.4.
- [x] 3.3 Preserve authorization, conversation binding, copy, download, and burn cleanup semantics for encrypted media assets. Owner: GPT-5.4.
- [x] 3.4 Add backend tests proving encrypted uploads persist ciphertext metadata and reject unauthorized downloads. Owner: GPT-5.4 or GPT-5.4-Mini after interface freeze.

## 4. Desktop Send Flow

- [x] 4.1 Update attachment selection flow to encrypt file bytes before upload and keep upload cancellation behavior intact. Owner: GPT-5.4.
- [x] 4.2 Build media message payloads using `media` metadata instead of legacy plaintext `mediaUrl/fileName` for new media messages. Owner: GPT-5.4.
- [x] 4.3 Ensure direct fan-out and group encrypted payloads carry the same media metadata contract. Owner: GPT-5.4.
- [x] 4.4 Keep legacy media send/read compatibility isolated behind explicit fallback helpers. Owner: GPT-5.4-Mini after GPT-5.4 defines helper names.

## 5. Desktop Read, Preview, Playback, And Download

- [x] 5.1 Update image preview to download ciphertext, decrypt locally, and render a plaintext object URL with cleanup. Owner: GPT-5.4-Mini after Rust command is available.
- [x] 5.2 Update audio playback to download ciphertext, decrypt locally, and play the plaintext blob. Owner: GPT-5.4-Mini after Rust command is available.
- [x] 5.3 Update file download to decrypt locally and save using encrypted payload filename/MIME metadata. Owner: GPT-5.4-Mini after Rust command is available.
- [x] 5.4 Add clear UI error states for decrypt failure, missing media metadata, and legacy asset fallback failure. Owner: MiniMax-2.7.

## 6. Forwarding, Burn, And Compatibility

- [x] 6.1 Update encrypted media forwarding so recipients receive valid Signal-encrypted media metadata and backend still stores ciphertext only. Owner: GPT-5.4.
- [x] 6.2 Verify burn-after-reading cleanup removes encrypted ciphertext assets and does not require plaintext keys. Owner: GPT-5.4.
- [x] 6.3 Document legacy plaintext media compatibility behavior and future migration/removal options. Owner: MiniMax-2.7.

## 7. Verification

- [x] 7.1 Run Rust crypto tests for media encryption/decryption. Owner: GPT-5.4.
- [x] 7.2 Run backend media/message tests covering encrypted upload, bind, download, copy, and burn cleanup. Owner: GPT-5.4.
- [x] 7.3 Run desktop build and targeted media attachment smoke tests for image, audio, and file. Owner: GPT-5.4.
- [x] 7.4 Add or update regression documentation with exact commands and known legacy limitations. Owner: MiniMax-2.7.
