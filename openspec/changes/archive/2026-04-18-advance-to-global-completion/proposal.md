## Why

The product has crossed the "usable demo" threshold for desktop direct messaging, but it has not yet reached a globally complete state where protocol behavior, delivery semantics, notification policy, and release gates are consistent across the system. The highest remaining risk is not basic functionality failure, but partial completion: old and new message paths coexist, group messaging has not reached the same Rust-only assurance level as direct chat, and regression guarantees are weaker than the product surface now requires.

## What Changes

- Unify message delivery onto the device-bound `send-v2` model and retire legacy single-ciphertext send paths from active product use.
- Complete the Rust-first messaging model for group chat, including Sender Key lifecycle, membership-driven key distribution, and explicit compatibility boundaries.
- Add notification delivery controls so message and friend-request notifications respect user-level settings instead of being emitted unconditionally.
- Establish a release-readiness workflow for this line of work: development happens on a dedicated branch, difficult protocol and transport work is owned by GPT, supporting and lower-risk work is owned by MiniMax, and every milestone is gated by explicit backend, Rust, frontend, and real-account regression checks.
- **BREAKING**: legacy transport and compatibility fallbacks that silently mask device/session mismatches will be removed once migration gates are satisfied.

## Capabilities

### New Capabilities
- `device-bound-transport-convergence`: converges all active direct-message send/read flows on device-bound fan-out delivery and authenticated per-device envelope resolution.
- `group-rust-signal-messaging`: brings group chat onto a Rust-first cryptographic path with Sender Key lifecycle and validated delivery behavior.
- `notification-delivery-controls`: adds user-visible notification preference handling for message, friend-request, and related delivery events.
- `release-regression-governance`: defines the branch strategy, role ownership, and mandatory regression matrix required before this initiative can be considered complete.

### Modified Capabilities

- None.

## Impact

- Backend modules: `auth`, `message`, `message.gateway`, `conversation`, `group`, `notification`, `friend`, `media`.
- Desktop modules: `core/use-chat-client.ts`, `core/use-signal.ts`, Signal Rust bridge, group UI flows, conversation preview rendering, notification settings UI.
- Rust/Tauri modules: Sender Key handling, session establishment, group key distribution, regression coverage for protocol behavior.
- Tests and release flow: backend integration tests, Rust unit/integration tests, desktop Playwright smoke/regression runs, real-account two-user/two-device validation.
- Delivery model and workflow: implementation will proceed on a new dedicated development branch, with GPT owning difficult protocol and transport work, and MiniMax owning supporting integration, cleanup, and lower-risk follow-up items.
