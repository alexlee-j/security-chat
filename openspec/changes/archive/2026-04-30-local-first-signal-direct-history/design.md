## Context

The current direct-message implementation already uses `send-v2` for device-bound fan-out: the desktop client creates one encrypted envelope per recipient device and one encrypted envelope per sender device, and the backend resolves ciphertext by authenticated `deviceId`. However, direct-chat history replay remains remote-first. Opening a conversation calls `/message/list`, the backend pages through `messages`, resolves historical envelopes from `message_device_envelopes`, and the desktop client decrypts then writes plaintext into local SQLite as a cache.

That model preserves end-to-end encryption against server plaintext access, but it still treats the backend as a durable encrypted history store. Signal-style direct messaging normally separates short-lived server delivery from readable history: the server can queue encrypted messages for offline devices, but a device's readable history is reconstructed from its own local encrypted store, secure device-to-device sync, or encrypted backup.

This change affects backend message persistence, desktop sync, local storage, and tests. It must preserve the existing product expectation that a previously used desktop device can re-open a conversation and see its own prior readable history, while making explicit that newly linked devices do not receive old direct-message history from the server.

## Goals / Non-Goals

**Goals:**
- Make direct-chat thread opening local-first: local encrypted database is the first source of readable history.
- Convert server-side direct-message envelopes into pending delivery records that are deleted after device-local persistence acknowledgement.
- Keep device-bound fan-out and authenticated envelope resolution for pending offline delivery.
- Provide deterministic reconnect/re-login catch-up for envelopes that were not yet persisted by this device.
- Protect desktop local message history at rest with a device-local encryption key.
- Keep legacy/group behavior isolated so this change does not accidentally rewrite group Sender Key flows.
- Produce explicit tests that prove the server no longer acts as a permanent direct-message history API.

**Non-Goals:**
- Implement full encrypted cloud backup.
- Implement complete historical device-to-device migration for newly linked devices.
- Redesign group-message history or Sender Key behavior.
- Remove conversation metadata, unread counters, read receipts, revoke events, or burn-event coordination from the backend.
- Guarantee recovery after the user deletes the local database and has no backup.

## Decisions

### Decision 1: Model `message_device_envelopes` as a delivery queue

Direct `send-v2` will continue creating a logical message row and per-target-device envelopes, but envelopes represent pending delivery, not permanent history. A device can fetch only envelopes addressed to its authenticated device. After the client decrypts and writes an envelope to its local encrypted database, it calls a persisted-ack endpoint. The backend deletes those acknowledged envelope rows for that device.

Alternative considered: keep `/message/list` as historical encrypted replay. This preserves current behavior but fails the local-first requirement and keeps the backend as a durable ciphertext history source.

### Decision 2: Split direct history replay from pending delivery sync

Desktop direct-chat opening will load local rows through the Tauri local DB command and render immediately. A separate background sync will fetch pending remote envelopes after the local cursor/persisted-delivery watermark. The UI must not block historical rendering on the network.

Alternative considered: keep one `loadMessages()` function that merges local and remote in one path. This is harder to reason about and risks reintroducing remote-first history behavior.

### Decision 3: Keep server message metadata, but not durable direct ciphertext

The backend may keep logical message metadata such as `messageId`, `conversationId`, `senderId`, `sourceDeviceId`, `messageType`, `messageIndex`, timestamps, burn/revoke/read metadata, and media references. It must not retain a direct-message device envelope after that target device has acknowledged local persistence.

Alternative considered: delete logical message rows after all device envelopes are acknowledged. That would complicate read receipts, revoke, burn, conversation ordering, and audit of delivery state. Metadata without decryptable payload is acceptable for this change.

### Decision 4: Encrypt local desktop message history before relying on it as source of truth

Local message content will no longer be stored as plaintext `content TEXT` in ordinary SQLite. The desktop storage layer will use a device-local database encryption key stored in OS Keychain where available. The implementation may either encrypt the message content columns before writing them or move to a SQLCipher-style encrypted database if dependency and build constraints are acceptable. The first implementation should prefer field-level encryption because the existing Rust `rusqlite` layer is already in place and can be migrated incrementally.

Alternative considered: leave local plaintext cache unchanged and only change remote sync. That would make the new source-of-truth weaker than the current cache and conflict with secure local storage expectations.

### Decision 5: Use explicit history semantics for newly linked devices

A newly linked device will only fetch pending envelopes addressed to that device from the time it becomes a target device. It will not call the backend to recover old direct messages. Any future old-history migration must be a separate encrypted backup or secure device-to-device sync capability.

Alternative considered: create server-side replay envelopes for newly linked devices. That requires existing devices or the server to manufacture historical ciphertext for the new device and risks recreating server-centered history.

### Decision 6: Preserve `/message/list` only during migration and for unsupported paths

During rollout, `/message/list` may remain for group messages, tests, or compatibility gates, but supported direct-chat history must move to the new local-first and pending-envelope APIs. Once desktop and backend regressions pass, direct `/message/list` should either reject durable direct history access or return only pending delivery material through an explicitly named endpoint.

Alternative considered: silently change `/message/list` semantics. That is risky because existing callers assume it returns paginated history.

## Risks / Trade-offs

- **Risk: Users expect new devices to show old chat history** -> Mitigation: document product behavior in UI copy and specs; support future encrypted backup/device sync as a separate change.
- **Risk: Local DB migration can lose cached history** -> Mitigation: add an idempotent migration that reads existing plaintext rows, encrypts them, verifies decryptability, then marks migration complete.
- **Risk: Envelope deletion before local persistence could lose messages** -> Mitigation: require persisted ack only after decrypt-and-save success; backend deletion is scoped to acknowledged message IDs and authenticated device ID.
- **Risk: Acknowledgement retry races can duplicate local rows** -> Mitigation: make local message writes idempotent by `messageId`; make backend ack idempotent when envelope rows are already gone.
- **Risk: Offline devices can accumulate pending envelopes** -> Mitigation: add indexes, pagination, and retention metrics; do not delete unacknowledged envelopes until retention policy is explicitly introduced.
- **Risk: Burn-after-reading semantics conflict with local-first history** -> Mitigation: preserve local burn expiration checks and propagate burn events as metadata; expired local rows are removed locally and acknowledged state remains metadata-only.
- **Risk: Group message behavior accidentally changes** -> Mitigation: scope new APIs and tests to direct conversations; keep group `/message/list` behavior unchanged in this change.

## Migration Plan

1. Add tests that capture the new direct-history semantics while keeping existing tests green.
2. Introduce encrypted local message persistence and migrate current plaintext local rows on desktop startup.
3. Add backend pending-envelope listing and persisted-ack endpoints for authenticated devices.
4. Change desktop direct-chat opening to render local history first.
5. Change desktop WebSocket/fallback sync to fetch pending envelopes, decrypt, persist locally, then acknowledge.
6. Stop using `/message/list` for supported direct-chat historical replay.
7. Add backend guardrails so direct `/message/list` cannot be used as permanent history once the desktop path is migrated.
8. Run backend, desktop Rust, desktop unit, and direct-message e2e regression suites.

Rollback strategy: keep the existing `/message/list` direct-history path behind a temporary feature flag until local-first sync and encrypted local migration pass regression tests. If rollout fails, disable the local-first desktop flag and keep pending-envelope endpoints inert without deleting unacknowledged envelope rows.

## Open Questions

- Should field-level encryption use the existing `SecureKeychain` AES-GCM helper directly, or should the local DB layer get a narrower message-store encryption helper?
- What UI copy should explain that newly linked devices do not automatically recover old direct-message history?
- Should envelope retention for never-returning devices be indefinite for now, or should a later operability change define retention limits?
- Should media metadata and decrypted media preview cache follow the same local-first encrypted persistence in this change, or remain governed by the existing media-cache specs?
