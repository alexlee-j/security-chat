## Context

The current media flow uploads the selected `File` directly through `apps/desktop/src/core/api.ts` to `POST /media/upload`. The backend stores the uploaded bytes under `MEDIA_ROOT`, records plaintext metadata in `media_assets`, and later streams the same bytes from `GET /media/:mediaAssetId/download`. Message payloads are encrypted by Rust Signal envelopes, but the image/audio/file bytes are not.

This change must be implemented on the current branch, `codex/security-chat-v2-closed-loop-integration`, unless the user explicitly changes the branch plan before implementation.

The target product behavior is: media bytes are encrypted on the sender device before upload, media decryption material is delivered only inside the Rust Signal encrypted message payload, and the backend never receives enough material to reconstruct attachment plaintext.

Role assignment:

- GPT-5.4 owns security architecture, payload schema, Rust crypto command design, backend storage contract, final review, and high-risk integration.
- GPT-5.4-Mini may implement bounded frontend adapters, typed helpers, smoke tests, and small UI/error handling tasks after GPT-5.4 defines interfaces.
- MiniMax-2.7 may implement documentation updates, low-risk UI copy, loading/error states, and straightforward test scaffolding. MiniMax-2.7 must not change crypto primitives, key serialization, backend authorization, compatibility decisions, or message schema without GPT-5.4 review.

## Goals / Non-Goals

**Goals:**

- Encrypt image, audio, and file bytes before upload.
- Decrypt media bytes locally before preview, playback, opening, or saving.
- Store only ciphertext and ciphertext metadata on the backend.
- Carry media decryption material inside the Signal-encrypted message payload.
- Keep direct and group message behavior aligned with the existing Rust Signal payload flow.
- Preserve legacy plaintext media readability behind a clearly marked compatibility path.
- Add tests that prove backend storage does not contain plaintext and that client decrypt/display/download works.

**Non-Goals:**

- Full historical media migration.
- Streamed encryption/decryption for very large files in the first implementation.
- Attachment padding, CDN support, resumable uploads, thumbnail-specific encryption, or deduplicated ciphertext storage.
- Mobile implementation unless explicitly requested later.
- Changing the Signal message protocol itself beyond carrying encrypted media metadata in the plaintext that is already encrypted by Rust Signal.

## Decisions

### Decision: Use client-side envelope metadata plus encrypted file bytes

Media messages SHALL continue to use `messageType` values 2, 3, and 4. The message plaintext JSON encrypted by Rust Signal SHALL carry a `media` object:

```json
{
  "type": 2,
  "media": {
    "version": 1,
    "assetId": "uuid",
    "algorithm": "aes-256-gcm",
    "key": "base64url",
    "nonce": "base64url",
    "ciphertextDigest": "base64url",
    "ciphertextSize": 123456,
    "plainDigest": "base64url",
    "plainSize": 120000,
    "fileName": "photo.png",
    "mimeType": "image/png"
  },
  "replyTo": {}
}
```

Rationale: this matches the mature messenger model where the server stores encrypted blobs while the message envelope grants recipients the decryption material.

Alternative considered: encrypting the file with the same Signal message ciphertext. Rejected because attachments can be large, need upload/download lifecycle management, and should not be embedded into per-device message envelopes.

### Decision: Use Rust-owned AES-256-GCM for media crypto

The desktop app SHALL expose Tauri Rust commands for media encryption/decryption using the existing `aes-gcm` dependency. The v1 payload algorithm string is `aes-256-gcm`. Keys, nonces, and SHA-256 digests are serialized as base64url strings in the Signal-encrypted media payload.

Rationale: the project already moved Signal protocol operations into Rust, and media encryption is high-risk enough to keep cryptographic operations in the same trust boundary.

Alternative considered: WebCrypto AES-GCM in TypeScript. This is viable and easier to implement, but it spreads cryptographic responsibility into UI code and weakens the stated "Rust Signal/crypto" direction.

Alternative considered: XChaCha20-Poly1305. Rejected for v1 because the repository already has AES-GCM available and no existing XChaCha dependency; adding another crypto primitive is unnecessary for this scoped desktop implementation.

### Decision: Backend stores ciphertext as opaque media

`MediaService.upload` SHALL accept encrypted bytes as the canonical new format. It SHALL record ciphertext size and ciphertext digest. Backend MIME validation MUST not require plaintext magic bytes for encrypted uploads because the backend cannot inspect plaintext.

Rationale: magic byte validation is incompatible with true E2EE media storage. Authorization, file size limits, and content-disposition safety remain backend responsibilities.

Alternative considered: keep plaintext MIME validation before encryption by uploading both plaintext metadata and ciphertext. Rejected because it tempts backend plaintext visibility and does not improve server trust.

### Decision: Add explicit media encryption versioning

`media_assets` metadata or API responses SHOULD distinguish `encryptionVersion=1` from legacy plaintext assets. Legacy assets remain readable, but new uploads MUST be encrypted. Message rendering MUST prefer `payload.media` when present and only fall back to legacy `mediaUrl/fileName/mediaAssetId` for old messages.

Rationale: this avoids breaking existing conversations while making new behavior enforceable.

Alternative considered: immediate migration/removal of legacy media. Rejected due to data loss and insufficient scope.

### Decision: Forwarding re-encrypts metadata, not necessarily ciphertext

For forwarded encrypted media, the client MAY reuse the stored ciphertext by copying the media asset if the same media key is intentionally shared with the new recipients inside the new Signal-encrypted payload. A stricter future version can re-encrypt bytes with a new key per forward.

Rationale: this preserves existing copy semantics and avoids expensive downloads/reuploads during forwarding while keeping the backend unable to decrypt.

Alternative considered: always download, decrypt, re-encrypt, and upload on forward. More private, but higher risk and more expensive for the first implementation.

## Risks / Trade-offs

- [Risk] Decryption key leakage through logs or backend DTOs -> Mitigation: never send media key/nonce outside Signal-encrypted payload; add tests and avoid logging decoded payloads.
- [Risk] Legacy and encrypted media paths become ambiguous -> Mitigation: version `payload.media` and asset metadata; keep explicit fallback names.
- [Risk] Large files create memory pressure -> Mitigation: first version keeps existing max-size guard; document streaming encryption as a future task.
- [Risk] Browser previews may leak decrypted blob URLs longer than needed -> Mitigation: revoke object URLs after use and keep decrypted blobs in memory only.
- [Risk] Forwarding reused ciphertext shares the same media key with a new audience -> Mitigation: make this explicit in code and docs; treat re-encrypt-on-forward as a future hardening option.
- [Risk] MiniMax-2.7 edits high-risk areas incorrectly -> Mitigation: task assignment forbids MiniMax-2.7 from crypto/key/backend authorization changes.

## Migration Plan

1. Add media encryption helpers and tests without switching send flow.
2. Add backend encrypted media metadata support while keeping legacy media reads.
3. Switch new desktop uploads to encrypt-before-upload.
4. Switch preview/playback/download to decrypt-after-download when `payload.media.version === 1`.
5. Keep legacy fallback for messages with no `payload.media`.
6. Verify build, Rust tests, backend tests, and desktop media smoke.

Rollback strategy: keep backend support for encrypted media additive. If desktop encryption is rolled back before release, legacy plaintext upload path can still operate; encrypted messages already sent remain readable by clients with the decrypt path.

## Open Questions

- Whether `plainDigest` remains required after v1 or whether AEAD authentication plus ciphertext digest is enough.
- Whether forwarded media after v1 should reuse ciphertext or force re-encryption for stricter recipient isolation.
