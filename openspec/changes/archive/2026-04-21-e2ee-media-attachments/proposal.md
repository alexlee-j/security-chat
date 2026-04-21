## Why

Current desktop media messages encrypt the Signal message payload but upload image, audio, and document bytes to the backend in plaintext. This leaves the largest and most sensitive part of non-text messages outside the end-to-end encryption boundary, which is inconsistent with the product goal and with mature encrypted messengers such as Signal and WhatsApp.

This change brings media attachments into the same end-to-end trust model as text messages: clients encrypt attachment bytes before upload, servers store only ciphertext, and recipients receive the decryption material only inside the Rust Signal encrypted payload.

## What Changes

- Add client-side attachment encryption before `/media/upload` for images, audio, and files.
- Add client-side attachment decryption after `/media/:id/download` before preview, playback, opening, or saving.
- Change media message payloads to carry encrypted media metadata, including asset id, content encryption algorithm, key, nonce, ciphertext digest, original filename, MIME type, and size fields.
- Update backend media storage semantics so uploaded media is treated as ciphertext and backend metadata uses ciphertext hash/size rather than plaintext hash/size.
- Preserve authorization, conversation binding, forwarding, burn cleanup, and download controls while removing backend dependence on plaintext file contents.
- Add regression tests that prove plaintext attachment bytes are not stored by the backend and that encrypted attachments can be sent, displayed, downloaded, forwarded, and cleaned up.
- **BREAKING**: New media messages use encrypted attachment metadata and encrypted file bytes. Existing plaintext media assets remain readable through a compatibility path until migration/removal is explicitly planned.

## Capabilities

### New Capabilities

- `e2ee-media-attachments`: Defines end-to-end encrypted media attachment behavior for images, audio, and files, including client encryption/decryption, encrypted metadata payloads, backend ciphertext storage, compatibility handling, and regression requirements.

### Modified Capabilities

- None.

## Impact

- Development branch: this change must be implemented on the current branch, `codex/security-chat-v2-closed-loop-integration`, unless the user explicitly instructs otherwise before implementation starts.
- Desktop app: `apps/desktop/src/core/use-chat-client.ts`, `apps/desktop/src/core/api.ts`, chat rendering/downloading paths, media preview/playback, forwarding, local payload decoding, and any Rust/Tauri crypto bridge needed for attachment encryption.
- Tauri/Rust: add or extend media crypto commands if the final implementation chooses Rust-owned AEAD for attachment encryption.
- Backend: `apps/backend/src/modules/media/*`, `apps/backend/src/modules/message/*`, media asset metadata, validation semantics, tests, and cleanup paths.
- Database: media asset metadata may need additive columns or clearly versioned metadata fields for encrypted-vs-legacy assets.
- Tests: backend media/message tests, desktop build, Rust crypto tests if Rust commands are added, and at least one desktop smoke covering encrypted media send/read/download.
- Role assignment:
  - GPT-5.4 owns architecture, crypto contract, backend/Rust boundary decisions, security review, final integration, and high-risk tests.
  - GPT-5.4-Mini may implement bounded, well-specified frontend wiring or tests after GPT-5.4 defines interfaces and expected payload schemas.
  - MiniMax-2.7 may handle low-risk UI copy, loading/error states, documentation updates, and straightforward smoke-test additions, but must not own crypto design, key handling, backend authorization, or migration decisions.
