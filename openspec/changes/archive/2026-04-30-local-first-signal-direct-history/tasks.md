## 1. Baseline and Safety Gates

- [x] 1.1 Confirm the worktree is clean before implementation with `git status --short --branch`; expected result is only the current branch line and no modified application files.
- [x] 1.2 Run the current backend message test baseline with `pnpm --filter backend test -- message`; record the failing tests, if any, before changing behavior.
- [x] 1.3 Run the current desktop Rust DB/signal baseline with `cd apps/desktop/src-tauri && cargo test db:: signal::`; record the failing tests, if any, before changing behavior.
- [x] 1.4 Run the current desktop TypeScript targeted baseline with `pnpm --filter desktop test -- --run tests/e2e-signal-test.spec.ts tests/e2e-multiaccount-messaging.spec.ts`; record the failing tests, if any, before changing behavior.
- [x] 1.5 Add a temporary implementation note in the development log or PR notes that this change intentionally changes direct-message history semantics: old direct history is local-only, pending delivery remains server-mediated, and newly linked devices do not recover old direct history from the backend.

## 2. Backend Pending-Envelope Contract

- [x] 2.1 Add backend DTOs in `apps/backend/src/modules/message/dto/` for pending direct-envelope listing and persisted acknowledgement: `query-pending-envelopes.dto.ts` with `conversationId`, optional `afterIndex`, optional `limit`; `ack-persisted.dto.ts` with `conversationId`, `messageIds`, and optional `maxMessageIndex`.
- [x] 2.2 Add backend response types in `apps/backend/src/modules/message/message.service.ts` for pending envelope rows containing `messageId`, `conversationId`, `senderId`, `sourceDeviceId`, `messageType`, `encryptedPayload`, `nonce`, `mediaAssetId`, `messageIndex`, `isBurn`, `burnDuration`, `deliveredAt`, `readAt`, and `createdAt`.
- [x] 2.3 Add a failing backend unit test in `apps/backend/test/message/message.local-first-direct-history.spec.ts` proving pending envelope listing returns only envelopes where `targetDeviceId` equals the authenticated `deviceId`.
- [x] 2.4 Add a failing backend unit test proving pending envelope listing rejects requests when the authenticated token has no `deviceId`.
- [x] 2.5 Add a failing backend unit test proving persisted acknowledgement deletes only the authenticated device's envelope rows and does not delete envelopes for another device.
- [x] 2.6 Add a failing backend unit test proving persisted acknowledgement is idempotent when the same `messageIds` are acknowledged twice.
- [x] 2.7 Implement `MessageService.queryPendingDirectEnvelopes(userId, deviceId, query)` in `apps/backend/src/modules/message/message.service.ts`, joining `messages` to `message_device_envelopes`, filtering by membership, `targetDeviceId`, optional `conversationId`, optional `afterIndex`, and `isRevoked = false`, ordered by ascending `messageIndex`, capped at 100.
- [x] 2.8 Implement `MessageService.ackDirectEnvelopesPersisted(userId, deviceId, dto)` in `apps/backend/src/modules/message/message.service.ts`, verifying conversation membership and deleting `message_device_envelopes` rows by `targetDeviceId`, `conversationId`, and `messageIds`.
- [x] 2.9 Add controller routes in `apps/backend/src/modules/message/message.controller.ts`: `GET /message/direct/pending` for pending envelopes and `POST /message/direct/ack-persisted` for persisted acknowledgement.
- [x] 2.10 Ensure `MessageGateway.emitMessageSent` and `emitConversationUpdated` continue sending metadata-only events and do not include direct encrypted payloads in WebSocket event bodies.
- [x] 2.11 Run `pnpm --filter backend test -- message.local-first-direct-history`; expected result is all new pending-envelope tests pass.

## 3. Backend Direct-History Guardrails

- [x] 3.1 Add a failing backend test proving supported direct conversation calls to `GET /message/list` no longer return durable direct-message historical envelopes after those envelopes were acknowledged as persisted.
- [x] 3.2 Add a failing backend test proving `GET /message/list` still works for unsupported or unchanged conversation types that remain outside this change, especially group history if existing tests cover it.
- [x] 3.3 Update `MessageService.queryMessages` so direct conversations no longer behave as the supported permanent history path after local-first sync is enabled; use an explicit branch that keeps group behavior unchanged and directs direct clients to pending-envelope sync.
- [x] 3.4 Add clear backend errors for direct `/message/list` misuse when needed, using an error message that tells clients to use pending-envelope sync instead of historical direct replay.
- [x] 3.5 Verify existing backend message tests with `pnpm --filter backend test -- message`; expected result is no regression outside direct history behavior intentionally changed by this OpenSpec.

## 4. Desktop Local Store Encryption

- [x] 4.1 Add Rust local-store tests in `apps/desktop/src-tauri/src/db/local_store.rs` proving saved direct-message readable content is not stored as plaintext in the SQLite `messages.content` column.
- [x] 4.2 Add Rust local-store tests proving an encrypted local message can be read back as the original readable payload through the Tauri-facing `get_messages` path.
- [x] 4.3 Add Rust local-store tests proving duplicate saves for the same `messageId` update the existing row rather than inserting duplicates.
- [x] 4.4 Add or reuse a local message encryption helper in `apps/desktop/src-tauri/src/crypto/` that uses an AES-GCM key loaded from OS Keychain where available and a deterministic app-local key name such as `local_message_store_key`.
- [x] 4.5 Modify `apps/desktop/src-tauri/src/db/local_store.rs` so message `content` is encrypted before insert/update and decrypted before returning `Message` rows to the frontend.
- [x] 4.6 Add a migration path in `apps/desktop/src-tauri/src/db/local_store.rs` for existing plaintext rows: detect unversioned plaintext content, encrypt it in place, and mark the local schema version so migration is idempotent.
- [x] 4.7 Update `apps/desktop/src-tauri/src/db/commands.rs` only if command signatures need to expose migration errors or initialization state to the frontend.
- [x] 4.8 Run `cd apps/desktop/src-tauri && cargo test db::local_store`; expected result is local encryption, migration, and idempotency tests pass.

## 5. Desktop API Surface for Pending Sync

- [x] 5.1 Add TypeScript types in `apps/desktop/src/core/types.ts` for `PendingDirectEnvelopeItem` and `AckPersistedDirectEnvelopeInput`, matching the backend pending-envelope response and ack DTO.
- [x] 5.2 Add API functions in `apps/desktop/src/core/api.ts`: `getPendingDirectEnvelopes(conversationId, afterIndex, limit)` calling `GET /message/direct/pending`, and `ackDirectEnvelopesPersisted(conversationId, messageIds, maxMessageIndex)` calling `POST /message/direct/ack-persisted`.
- [x] 5.3 Keep the existing `getMessages` API available for group and transitional code paths, but add comments or naming boundaries so supported direct-chat history code does not call it.
- [x] 5.4 Add desktop API unit or contract tests proving the pending-envelope request sends `conversationId`, `afterIndex`, and `limit`, and proving ack sends `conversationId`, `messageIds`, and `maxMessageIndex`.

## 6. Desktop Local-First Direct Replay

- [x] 6.1 Add a focused test around `use-chat-client` or extracted chat sync helpers proving `loadMessages` for a direct conversation reads local DB rows before any remote history request.
- [x] 6.2 Extract direct history mapping helpers in `apps/desktop/src/core/use-chat-client.ts` if needed: `localMessageToMessageItem`, `pendingEnvelopeToMessageItem`, and `persistDecodedMessageItem`, keeping group behavior separate.
- [x] 6.3 Change direct conversation opening in `apps/desktop/src/core/use-chat-client.ts` so it calls `localDb.getMessages(conversationId, 100)` first, maps local rows into `MessageItem[]`, sets `messages`, and sets `hasMoreHistory` based on local rows rather than backend row count.
- [x] 6.4 Ensure local direct replay works when the backend is unavailable: catch remote pending-sync errors without replacing existing local direct messages with an error state.
- [x] 6.5 Preserve group and unchanged conversation behavior by keeping the existing remote `getMessages` path for group conversations until a separate group-history change replaces it.
- [x] 6.6 Run the new desktop local-first replay test; expected result is the direct conversation renders local rows and no direct historical `/message/list` call is observed.

## 7. Desktop Pending-Envelope Processing

- [x] 7.1 Add tests proving `syncMessagesDelta` or its replacement fetches pending direct envelopes for the active direct conversation after local replay.
- [x] 7.2 Add tests proving a pending direct envelope is acknowledged only after successful decrypt and `localDb.saveMessage`.
- [x] 7.3 Add tests proving decrypt failure does not call persisted acknowledgement and leaves the pending envelope eligible for retry.
- [x] 7.4 Implement a direct pending-sync function in `apps/desktop/src/core/use-chat-client.ts` that calls `getPendingDirectEnvelopes`, decrypts each envelope with `decodePayload`, saves each decoded message locally, merges saved rows into UI state, updates the conversation cursor, and then calls `ackDirectEnvelopesPersisted`.
- [x] 7.5 Update WebSocket handlers in `apps/desktop/src/core/use-chat-client.ts` so `message.sent` and `conversation.updated` trigger pending-envelope sync for direct conversations rather than historical `getMessages` delta fetch.
- [x] 7.6 Update fallback polling in `apps/desktop/src/core/use-chat-client.ts` so direct conversations use pending-envelope sync and group conversations keep the existing behavior.
- [x] 7.7 Run the pending-envelope desktop tests; expected result is ack happens only after local persistence and duplicate pending envelopes do not create duplicate local rows.

## 8. Send, Self-Sync, and Retry Semantics

- [x] 8.1 Add or update desktop tests proving direct send still creates one envelope for each recipient device and one envelope for each sender device used for self-sync.
- [x] 8.2 Add or update desktop tests proving retry of a failed direct send still uses `send-v2` with device-bound envelopes and never falls back to legacy single-ciphertext direct send.
- [x] 8.3 Confirm `apps/desktop/src/core/use-chat-client.ts` caches the sender's own plaintext only as transient render/cache state and persists final readable history through the encrypted local DB after send success.
- [x] 8.4 After successful direct send, replace the current remote `loadMessages(activeConversationId)` refresh with local persistence of the sent message plus pending sync for any server-assigned metadata that must be merged.
- [x] 8.5 Run `pnpm --filter desktop test -- --run tests/e2e-multiaccount-messaging.spec.ts`; expected result is direct send, retry, and self-sync behavior still passes under local-first history.

## 9. Conversation Preview, Read State, Burn, and Revoke Metadata

- [x] 9.1 Add tests proving direct conversation previews derive from the latest local readable direct message when available.
- [x] 9.2 Add tests proving server metadata events for read receipts, revokes, and burn events update local rows and active UI without requiring backend historical ciphertext.
- [x] 9.3 Update `apps/desktop/src/core/use-chat-client.ts` preview update logic so direct previews use local encrypted history after decrypt/read, while server conversation list metadata remains the ordering and unread-count source.
- [x] 9.4 Update burn handling so expired direct messages are removed from the local store and active state without attempting to reload historical direct ciphertext from the backend.
- [x] 9.5 Update revoke handling so revoked direct messages are removed or marked locally, then conversation preview is recomputed from local history.
- [x] 9.6 Run targeted desktop chat interaction tests; expected result is previews, revoke, burn, and read receipt states converge from local state plus metadata events.

## 10. End-to-End Regression Coverage

- [x] 10.1 Add an integration test where Alice sends Bob a direct message while Bob is offline, Bob later logs in, fetches a pending envelope, decrypts it, persists it locally, acknowledges it, and then the backend no longer returns that envelope as pending.
- [x] 10.2 Add an integration test where Bob restarts or logs back in on the same desktop after acknowledgement and sees the direct message from local storage while the backend has no envelope for that message/device.
- [x] 10.3 Add an integration test where Bob logs in from a newly linked device with no local store and does not receive old acknowledged direct history from `/message/list`.
- [x] 10.4 Add an integration test where Alice has two devices, sends a direct message from one device, and the second Alice device receives its self-sync pending envelope, persists it locally, and acknowledges it.
- [x] 10.5 Run backend e2e tests with `pnpm verify:backend:v1`; expected result is all backend v1 checks pass or only documented direct-history expectation changes are updated.
- [x] 10.6 Run desktop Signal regression tests with `pnpm --filter desktop test -- --run tests/e2e-signal-test.spec.ts tests/e2e-multiaccount-messaging.spec.ts`; expected result is all direct Signal tests pass.
- [x] 10.7 Run Rust tests with `cd apps/desktop/src-tauri && cargo test`; expected result is all local DB, crypto, and Signal tests pass.

## 11. Migration, Rollout, and Cleanup

- [x] 11.1 Add a feature flag or configuration gate for the desktop local-first direct-history path so rollback can temporarily restore the old direct `/message/list` behavior during validation.
- [x] 11.2 Add backend logs or metrics around pending direct envelope count, ack count, ack deletion count, and pending-envelope query failures by device.
- [x] 11.3 Add release notes or developer documentation explaining that direct history is local-first and newly linked devices require encrypted backup or explicit device sync for old messages.
- [x] 11.4 Remove obsolete direct-history calls from desktop code after the local-first path is validated and tests prove group behavior remains isolated.
- [x] 11.5 Search for remaining direct-message historical `getMessages` usage with `rg -n "getMessages\\(|/message/list|syncMessagesDelta" apps/desktop/src apps/backend/src` and verify any remaining usage is group-only, compatibility-only, or explicitly documented.
- [x] 11.6 Run final full verification: `pnpm verify:backend:v1`, desktop targeted/E2E verification, and `cd apps/desktop/src-tauri && cargo test`; expected result is all required suites pass.
- [x] 11.7 Confirm final working tree contains only intentional implementation changes with `git status --short`.

## 12. Desktop Signal Key-Chain Persistence

- [x] 12.1 Enable the SQLite-backed Signal store in the desktop Rust module graph and use it for the active Tauri `AppState` instead of the previous in-memory store.
- [x] 12.2 Add local SQLite schema initialization for Signal identity keys, prekeys, signed prekeys, Kyber prekeys, and per-recipient sessions.
- [x] 12.3 Encrypt private Signal identity material, private prekeys, Kyber secret keys, and serialized session ratchet records before writing them to SQLite.
- [x] 12.4 Load the Signal store encryption key from macOS Keychain under a deterministic key name and keep a test-only deterministic key for repeatable Rust tests.
- [x] 12.5 Update direct Signal commands so initialization, prekey export, session establishment, message encryption, and message decryption all use the persistent local Signal store.
- [x] 12.6 Add Rust tests proving Signal private key/session rows are not stored as plaintext and proving the identity key pair survives closing and reopening the SQLite store.
- [x] 12.7 Add a Rust roundtrip test proving the persistent store can establish a direct session and encrypt/decrypt a direct message.
- [x] 12.8 Ensure one-time prekey top-up does not recreate locally removed/consumed prekey ids.
