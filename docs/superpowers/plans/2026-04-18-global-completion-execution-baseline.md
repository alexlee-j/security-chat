# Security Chat 2.0 Closed-Loop Execution Baseline (Frozen Scope)

## Branch Rule

- Integration branch for this initiative: `codex/security-chat-v2-closed-loop-integration`
- Baseline branch: `main`
- No direct implementation merge to `main` before all regression gates in this file are green
- This branch is the only integration entry for `security-chat-v2-closed-loop`.

## Role Boundary

- GPT scope (hard parts):
  - Direct-message transport convergence (`send-v2` as only supported active path)
  - Legacy socket send path deprecation/removal
  - Rust/Tauri group Sender Key protocol closure
  - Cross-layer compatibility cleanup for device/session boundaries
- MiniMax scope (supporting parts):
  - Notification settings model/API/UI and follow-up integration
  - Product-surface/UI polish and documentation alignment
  - Lower-risk regression harness expansion and routine cleanup

## Frozen Real Flows

The following flows are mandatory and cannot be reduced during this initiative:

1. Register -> login -> add friend -> direct message both ways -> logout/login replay
2. Direct message with sender self-sync on multi-device context
3. Group chat baseline: create group -> add member -> send/receive -> member change impact
4. Notification policy: disable message/friend-request notification and verify unread behavior
5. Re-login history replay for direct and group conversations

## Group Sender Key Lifecycle (Defined)

1. Group created:
- Creator initializes group sender-key context.
- Initial members receive bootstrap sender-key material before first group message.

2. Member added:
- New member receives current valid sender-key material.
- Existing sender-key state for unaffected members stays valid unless policy requires immediate rotation.

3. Member leaves / removed:
- Sender-key material is rotated.
- Removed member cannot decrypt messages after the rotation point.

4. Member re-joins:
- Re-join treated as fresh join.
- Member receives current sender-key material only; old revoked keys remain invalid.

5. Rotation triggers:
- Mandatory on leave/remove events.
- Optional/manual rotation remains available for incident handling.

## Regression Gates

- Backend:
  - `pnpm -C apps/backend build`
  - Targeted tests: auth device binding, message multi-device, media copy, notification policy, group lifecycle
- Desktop:
  - `pnpm -C apps/desktop build`
  - Key E2E/Playwright scenarios for direct and group paths
- Rust/Tauri:
  - Session establishment and direct message round-trip
  - Sender Key send/receive and membership-change behavior
- Real smoke:
  - Two-account direct-message scenario
  - Three-account group scenario
