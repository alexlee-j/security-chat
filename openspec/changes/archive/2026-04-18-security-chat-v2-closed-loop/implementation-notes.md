# Security Chat 2.0 Implementation Notes

## Integration Branch (Single Entry)

- Change: `security-chat-v2-closed-loop`
- Dedicated integration branch: `codex/security-chat-v2-closed-loop-integration`
- Baseline branch: `main`
- Rule: this change is the only integration entry for current 2.0 closure work.
- Override rule: switch with `/opsx:apply <other-change>` only when explicitly changing change scope.

## Frozen 2.0 Real Flows

The following real flows are frozen and cannot be reduced:

1. Register -> login -> forgot-password/reset-password -> re-login
2. Two-account direct message both ways -> logout/login replay
3. Three-account group: create -> add -> send/receive -> remove/leave -> post-change visibility
4. Notification policy: disable/enable key notification classes and verify unread behavior
5. Reconnect/re-login history catch-up for direct and group conversations

## GPT / MiniMax Ownership

- GPT (high-risk cross-layer closure):
  - account recovery and auth-hardening contract/behavior
  - group governance + Sender Key lifecycle convergence
  - sync reliability state machine and replay/retry consistency
  - release gates, rollback, and merge-readiness governance
- MiniMax (lower-risk support):
  - UI integration and surface completion
  - docs collation and supporting validation records
  - routine harness and low-risk integration glue

## Next-Phase Governance Rule

- The next phase "desktop product-surface closure" MUST be a separate OpenSpec change.
- It MUST start only after this change is merged into `main`.
- New work MUST branch from latest `main`, not from an unmerged 2.0 branch.

## 2.0 Regression Matrix (Required)

Backend:

- `pnpm -C apps/backend build`
- `pnpm -C apps/backend test -- test/message/message.gateway.spec.ts test/message/message.multi-device.spec.ts`
- `pnpm -C apps/backend test -- test/conversation/conversation.sender-key-rotation.spec.ts`
- `pnpm -C apps/backend test -- test/notification/notification-settings.spec.ts`

Rust/Tauri:

- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml establish_session_with_remote_bundle_and_roundtrip_message`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml sender_keys`

Desktop:

- `pnpm -C apps/desktop build`
- `pnpm -C apps/desktop exec playwright test tests/e2e-group-rust-regression.spec.ts --list`
- `pnpm -C apps/desktop exec playwright test tests/e2e-multiaccount-messaging.spec.ts --list`

Real flow smoke (required before merge):

- two-account direct + replay
- three-account group lifecycle
- password recovery and re-login
- notification policy verification
- reconnect recovery

## Rollback Strategy

- Roll back by milestone, not ad hoc file revert.
- Suggested rollback checkpoints:
  - account recovery hardening
  - group governance + Sender Key lifecycle
  - sync reliability closure
  - notification delivery controls
- Any unresolved red gate blocks merge readiness.

