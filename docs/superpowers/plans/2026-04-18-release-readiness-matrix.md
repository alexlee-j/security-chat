# Release Readiness Matrix

## Scope

Change: `advance-to-global-completion`  
Integration branch: `feature/global-completion`

This document closes OpenSpec tasks `6.1` through `6.5` by defining:
- backend regression matrix,
- Rust regression matrix,
- desktop regression matrix,
- required real-account smoke plan,
- merge gate and rollback policy.

## 6.1 Backend Regression Matrix

Required command set:

```bash
pnpm -C apps/backend build
pnpm -C apps/backend test -- test/message/message.gateway.spec.ts test/message/message.multi-device.spec.ts
pnpm -C apps/backend test -- test/conversation/conversation.sender-key-rotation.spec.ts
pnpm -C apps/backend test -- test/notification/notification-settings.spec.ts
pnpm -C apps/backend test -- test/media/media.copy.spec.ts
```

Coverage map:

| Area | Command / Spec | Purpose | Status |
| --- | --- | --- | --- |
| Auth device binding | existing auth device-bound login/register flow | verifies authenticated `deviceId` contract is preserved | covered indirectly by current transport/auth flow, manual smoke required |
| Message multi-device | `test/message/message.multi-device.spec.ts` | verifies `send-v2`, device envelope reads, direct-message constraints, group rust payload validation | passed |
| Legacy socket deprecation | `test/message/message.gateway.spec.ts` | verifies `message.send` cannot bypass supported direct path | passed |
| Group lifecycle | `test/conversation/conversation.sender-key-rotation.spec.ts` | verifies sender key rotation trigger on member add/remove | passed |
| Notification policy | `test/notification/notification-settings.spec.ts` | verifies effective notification settings and enable/disable behavior | passed |
| Media copy | `test/media/media.copy.spec.ts` | verifies forwarded/copy media behavior under current backend rules | not run in this session, included as required gate |

Evidence captured in this session:

- `pnpm -C apps/backend build` passed
- `pnpm -C apps/backend test -- test/conversation/conversation.sender-key-rotation.spec.ts test/message/message.gateway.spec.ts test/message/message.multi-device.spec.ts test/notification/notification-settings.spec.ts` passed

## 6.2 Rust Regression Matrix

Required command set:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml establish_session_with_remote_bundle_and_roundtrip_message
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml sender_keys
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Coverage map:

| Area | Command / Test | Purpose | Status |
| --- | --- | --- | --- |
| Session establishment | `establish_session_with_remote_bundle_and_roundtrip_message` | validates X3DH/session bootstrap and direct-message roundtrip | passed |
| Direct chat encryption/decryption | same roundtrip test + `cargo check` | validates Rust-first direct path still compiles and functions | passed |
| Sender Key send/receive | `sender_keys` suite | validates group encrypt/decrypt baseline | passed |
| Membership change rotation | `sender_keys::test_member_leave_cannot_receive` and related lifecycle tests | validates removal semantics | passed |
| History replay under ratchet progress | `sender_keys::test_history_messages_remain_decryptable_after_ratchet_progress` | validates historical decryptability after later messages advance state | passed |

Evidence captured in this session:

- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` passed
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml establish_session_with_remote_bundle_and_roundtrip_message` passed
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml sender_keys` passed

Known non-blocking note:

- Current Rust runs emit deprecation and dead-code warnings. These are not release blockers for this change because compile/test is green and no warning indicates protocol breakage.

## 6.3 Desktop Regression Matrix

Required command set:

```bash
pnpm -C apps/desktop build
pnpm -C apps/desktop exec playwright test tests/e2e-group-rust-regression.spec.ts --list
pnpm -C apps/desktop exec playwright test tests/e2e-multiaccount-messaging.spec.ts --list
```

Coverage map:

| Area | Command / Scenario | Purpose | Status |
| --- | --- | --- | --- |
| Desktop production build | `pnpm -C apps/desktop build` | validates current frontend compiles and bundles | passed |
| Group UI regression discovery | `playwright ... e2e-group-rust-regression.spec.ts --list` | verifies group regression suite is wired into Playwright discovery | passed |
| Direct multi-account regression discovery | `playwright ... e2e-multiaccount-messaging.spec.ts --list` | verifies existing direct-message smoke suite remains discoverable | passed |
| Group UI render | `3.5-UI` | validates self bubble rendering in group conversation | listed, manual execution required |
| Group send failure UX | `3.5-Error` | validates user-facing error when `/message/send` fails | listed, manual execution required |
| Group re-login replay | `3.5-Replay` | validates message remains visible after re-login | listed, manual execution required |

Evidence captured in this session:

- `pnpm -C apps/desktop build` passed
- group regression suite discovered 3 tests
- multi-account suite discovered 2 tests

## 6.4 Real Verification Plan

Required real-account smoke runs before merge:

### A. Two-account direct + multi-device

1. Register or prepare two accounts: `A`, `B`
2. Login account `A` on desktop device `A1`
3. Login account `B` on desktop device `B1`
4. Add friend: `A -> B`, then accept on `B`
5. Create direct conversation
6. Send messages both ways
7. Re-login one side and verify history replay
8. If a second device is available for `A` or `B`, verify self-sync / target-device envelope behavior

Expected result:
- no transport or Signal errors in console
- sender sees own message
- recipient sees message
- re-login history is readable

### B. Three-account group

1. Prepare accounts: `A`, `B`, `C`
2. `A` creates group conversation with `B` and `C`
3. `A` sends first group message
4. `B` replies
5. Remove `C` or let `C` leave
6. `A` or `B` sends another group message
7. Re-login `A` and `B`, verify group history replay

Expected result:
- initial group traffic is readable by active members
- post-removal traffic remains readable by remaining members
- removed member cannot continue on future traffic after rotation point
- re-login replay works for remaining members

### C. Notification policy

1. Disable message notifications for account `B`
2. Send direct message `A -> B`
3. Verify `B` notification unread summary does not increment for message type
4. Re-enable message notifications
5. Disable friend-request notifications for account `C`
6. Send friend request to `C`
7. Verify `C` notification unread summary does not increment for friend-request type

Expected result:
- disabled notification classes do not create unread noise
- re-enabled classes resume normal behavior

Manual execution prerequisites:

- backend running at configured API URL
- desktop app running with valid environment
- test accounts or disposable accounts available
- for Playwright-driven desktop runs, set the required env vars for account credentials and target conversation/group

## 6.5 Merge Gate And Rollback Policy

Merge is allowed only when all conditions below are true:

1. Backend:
   `pnpm -C apps/backend build` is green
   and backend regression matrix is green
2. Rust:
   `cargo check` is green
   and required Rust tests are green
3. Frontend:
   `pnpm -C apps/desktop build` is green
   and Playwright regression suites are at least discoverable
4. Real smoke:
   direct two-account flow has been executed and passed
   and group three-account flow has been executed and passed
   and notification policy smoke has been executed and passed
5. Documentation:
   this matrix remains current with actual executed commands and outcomes

If any one of the above is false, this branch is not merge-ready.

Rollback policy:

- Roll back by milestone, not by ad hoc file reversion.
- Preferred rollback checkpoints:
  - group Sender Key closure
  - notification delivery controls
  - transport convergence
- If a regression is isolated to group Rust messaging, revert the group closure milestone while preserving direct-message convergence.
- If a regression is isolated to notification controls, revert notification settings generation checks without touching transport or Signal protocol changes.
- If direct-message transport regresses, restore the last commit where `send-v2` direct flow and message envelope reads were green.
- Never merge with a known failing real-account smoke run under the assumption that follow-up will clean it up.

## Current Readiness Snapshot

As of this document update:

- backend build: green
- backend targeted regressions: green for message gateway, multi-device, notification settings, conversation sender-key rotation
- Rust compile/tests: green for session establishment and sender key suites
- desktop build: green
- Playwright group/direct suites: discoverable
- real-account smoke: not executed in this session; still required before merge

Conclusion:

The branch is technically closer to merge-ready, but not fully merge-ready until the real-account smoke plan above is executed and recorded.
