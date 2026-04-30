## Baseline Notes

- Branch/worktree: `codex/local-first-signal-direct-history` in isolated worktree `~/.config/superpowers/worktrees/security-chat/local-first-signal-direct-history`.
- `pnpm --filter backend test -- message`: passed, 2 suites, 17 tests.
- Initial `cargo test db:: signal::` command in the task plan is not valid Cargo syntax because Cargo accepts one test filter. The checks were run as `cargo test db::` and `cargo test signal::`.
- Rust tests initially failed because Tauri required `apps/desktop/dist`; running `pnpm --filter desktop build` generated the required dist.
- `cargo test db::`: passed, 5 tests.
- `cargo test signal::`: passed, 14 tests.
- `pnpm --filter desktop test -- --run tests/e2e-signal-test.spec.ts tests/e2e-multiaccount-messaging.spec.ts`: no desktop `test` script exists in `apps/desktop/package.json`, so no targeted desktop TypeScript baseline was available from that command.

## Behavior Intent

This change intentionally changes direct-message history semantics:

- Old direct-message readable history is local-only after successful device persistence.
- The backend remains responsible for pending per-device encrypted delivery envelopes.
- Acknowledged direct-message envelopes are retired from backend storage for that target device.
- Newly linked devices do not recover old direct-message history from the backend; old history requires a future encrypted backup or explicit device-to-device sync capability.

## Apply Verification Notes

- `pnpm --filter backend test -- message`: passed, 3 suites / 23 tests.
- `pnpm --filter backend build`: passed.
- `pnpm --filter desktop exec tsx tests/direct-pending-api.contract.test.ts`: passed.
- `pnpm --filter desktop exec tsx tests/direct-history.contract.test.ts`: passed.
- `pnpm --filter desktop build`: passed.
- `cd apps/desktop/src-tauri && cargo test db::local_store`: passed, 8 tests.
- `cd apps/desktop/src-tauri && cargo test signal::`: passed, 14 tests.
- `cd apps/desktop/src-tauri && cargo test`: initially blocked by `crypto::keychain::tests::test_encrypt_decrypt`, then passed on the final closure run with 38 tests.
- `pnpm --filter desktop test -- --run tests/e2e-signal-test.spec.ts tests/e2e-multiaccount-messaging.spec.ts`: still unavailable because `apps/desktop/package.json` has no `test` script. These Playwright specs also require running frontend/backend services.

## Signal Key-Chain Persistence Notes

- The active desktop Signal runtime now uses a local SQLite database at `security-chat-signal.db` under the Tauri app data directory instead of keeping direct-session ratchet state only in `InMemSignalProtocolStore`.
- Sensitive Signal store fields are encrypted before SQLite persistence: identity private key, one-time prekey private keys, signed prekey private keys, Kyber secret keys, and serialized session records.
- On macOS, the Signal store encryption key is loaded from Keychain using `signal_protocol_store_key`; Rust tests use a deterministic test-only key so encrypted-at-rest assertions are repeatable.
- One-time prekey top-up uses ids above the current local maximum so a prekey removed after use is not recreated with the same id on restart.
- The backend remains limited to public prekey upload material and pending encrypted envelopes. It still does not store private Signal keys or client-side ratchet/session state.

## Signal Key-Chain Verification Notes

- `cd apps/desktop/src-tauri && cargo test db::sqlite_store`: passed, 4 tests.
- `cd apps/desktop/src-tauri && cargo test persistent_store_establishes_session`: passed, 1 test.
- `cd apps/desktop/src-tauri && cargo test prekey_top_up_does_not_reuse_removed_one_time_prekey_id`: passed, 1 test.
- `cd apps/desktop/src-tauri && cargo test signal::`: passed, 14 tests.
- `pnpm --filter backend test -- message`: passed, 3 suites / 23 tests.
- `pnpm --filter backend build`: passed.
- `pnpm --filter desktop build`: passed.
- `git diff --check`: passed.

## Desktop Local-First Finalization Notes

- Direct conversation opening now goes through an extracted local-first replay helper: local SQLite rows are rendered before pending direct envelopes are fetched.
- Direct conversation previews are overlaid from the latest local readable message when local history exists, while server conversation rows still provide ordering and unread metadata.
- Failed direct-send retry remains device-bound by selecting `send-v2` for `direct_v2` retry records.
- Direct burn/revoke handling deletes the local SQLite message row and updates active UI without using backend direct historical replay; read receipts also mark matching local direct rows as read.
- `VITE_DIRECT_LOCAL_FIRST_HISTORY=false` disables the desktop local-first direct-history path during validation and falls back to the previous remote history behavior.
- Additional checks run after this finalization:
  - `pnpm --filter desktop exec tsx tests/direct-history.contract.test.ts`: passed.
  - `pnpm --filter desktop exec tsx tests/direct-pending-api.contract.test.ts`: passed.
  - `pnpm --filter desktop build`: passed.
  - `cd apps/desktop/src-tauri && cargo test db::local_store`: passed, 8 tests.

## Final Closure Notes

- The user confirmed the desktop E2E/integration checks passed for the local-first direct-history flow.
- `BASE_URL=http://127.0.0.1:3001/api/v1 WS_BASE=http://127.0.0.1:3001/ws pnpm verify:backend:v1`: passed.
- `cd apps/desktop/src-tauri && cargo test`: passed, 38 tests.
- `pnpm --filter desktop exec tsx tests/direct-history.contract.test.ts`: passed.
- `pnpm --filter desktop exec tsx tests/direct-pending-api.contract.test.ts`: passed.
- `pnpm --filter desktop build`: passed.
- Playwright discovery was narrowed to browser specs and Signal Playwright tests so non-Playwright contract scripts are not loaded as browser tests.
- `pnpm -C apps/desktop exec playwright test --list`: passed, 68 tests discovered in 18 files.
- `pnpm -C apps/desktop exec playwright test tests/e2e-signal-test.spec.ts tests/e2e-multiaccount-messaging.spec.ts --list`: passed, 3 targeted Signal/direct E2E tests discovered in 2 files.
- Normal direct-message history no longer uses backend `/message/list`: desktop direct conversation open, delta sync, pending replay, and load-more use local SQLite plus `/message/direct/pending`; remaining `getMessages` calls are for group/unsupported history paths or documented compatibility behavior.
