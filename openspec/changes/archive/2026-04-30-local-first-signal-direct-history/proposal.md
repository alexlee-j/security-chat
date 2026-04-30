## Why

Current direct-chat history replay is remote-first: the desktop client opens a conversation by calling `/message/list`, the backend returns historical device envelopes, and the client decrypts and caches them locally. This keeps the server in the role of a durable encrypted history store, which is not aligned with the usual Signal-style model where readable history is local-first and server-side message material is only a short-lived delivery queue.

This change moves supported direct-message history replay to a local-first model while preserving device-bound end-to-end encryption, offline delivery, and deterministic sender self-sync for authorized devices.

## What Changes

- Direct-chat thread opening will read message history from the local desktop database first, without requiring `/message/list` for normal historical replay.
- The backend direct-message envelope store will become a per-device delivery queue rather than a permanent history source.
- Devices will acknowledge envelopes only after successful local persistence; the backend will then delete the acknowledged device envelopes.
- WebSocket conversation events will trigger pending-envelope sync instead of historical backfill.
- Local desktop message storage will be upgraded so persisted message history is protected with a device-local encryption key.
- Conversation previews and unread state will converge from local history plus lightweight server metadata, not from server-returned historical ciphertext.
- **BREAKING**: Supported direct-message clients must not rely on `/message/list` as a permanent direct-message history API after this change is applied.
- **BREAKING**: A newly linked or newly installed device will not automatically receive old direct-message history from the server; history restore must come from local storage, encrypted backup, or explicit secure device-to-device sync.

## Capabilities

### New Capabilities
- `local-first-direct-history`: Local-first direct-message history replay, encrypted local persistence, pending-envelope sync, and server-side envelope retirement.

### Modified Capabilities
- `conversation-sync-and-reliability`: Reframe direct-message recovery so reconnect/re-login restores readable history from local storage and only uses server sync for pending delivery envelopes.
- `device-bound-transport-convergence`: Change device-bound direct messaging from durable remote history lookup to short-lived per-device envelope delivery with persisted acknowledgement and deletion.

## Impact

- Backend message APIs and services:
  - `apps/backend/src/modules/message/message.controller.ts`
  - `apps/backend/src/modules/message/message.service.ts`
  - `apps/backend/src/modules/message/gateways/message.gateway.ts`
  - message DTOs/entities/migrations around `messages` and `message_device_envelopes`
- Desktop chat and sync flow:
  - `apps/desktop/src/core/use-chat-client.ts`
  - `apps/desktop/src/core/api.ts`
  - `apps/desktop/src/core/types.ts`
  - `apps/desktop/src/core/use-local-db.ts`
- Desktop local storage:
  - `apps/desktop/src-tauri/src/db/local_store.rs`
  - `apps/desktop/src-tauri/src/db/commands.rs`
  - `apps/desktop/src-tauri/src/crypto/keychain.rs`
  - possible migration logic for existing local plaintext cache rows
- Tests:
  - backend message delivery and acknowledgement tests
  - desktop local DB tests
  - desktop direct-message sync/re-login tests
  - integration/e2e tests covering offline delivery and history non-recovery on new devices
