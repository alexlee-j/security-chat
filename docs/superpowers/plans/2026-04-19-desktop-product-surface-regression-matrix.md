# Desktop Product Surface Regression Matrix

## Scope

Change: `desktop-product-surface-closure`

Implementation branch: `feature/desktop-product-surface-closure`

Goal: close the non-call desktop product surface on top of the completed 2.0 chat core. Audio and video calling remain explicitly out of scope.

## Ownership

| Owner | Responsibility |
| --- | --- |
| GPT | State contracts, permission matrices, cryptographic safety checks, regression gates, merge-readiness conclusion |
| MiniMax | UI composition, design fidelity, shadcn/Radix reuse, docs checklist, smoke scripts for product surfaces |

MiniMax must not introduce new persistence, permission, encryption, or backend contracts without GPT review.

## Required Build Gates

| Gate | Command | Required before merge |
| --- | --- | --- |
| Desktop production build | `pnpm -C apps/desktop build` | Yes |
| Backend contract safety when touched | `pnpm -C apps/backend build` | Yes if backend files change |
| Rust Signal safety when touched | `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | Yes if Signal/Tauri Rust files change |

## Desktop Smoke Matrix

| Area | Scenario | Expected result | Owner |
| --- | --- | --- | --- |
| Navigation drawer | Open profile, settings, about, theme, logout confirmation | Sheets/dialogs render with shared primitives, theme-aware styling, and no stale auth state after logout | MiniMax implements, GPT verifies logout state |
| Theme | Switch light/dark/auto and inspect shell, sidebar, chat, menus, sheets | No clipped controls or hard-coded unreadable colors | MiniMax |
| Conversation list | Search, clear search, empty states, active row, pin/mute/delete/copy menu | Preview/unread stay stable except server-confirmed delete; no fake persistence | MiniMax implements, GPT verifies contract |
| Chat header | More menu and unsupported call/video controls | Supported actions work; call/video hidden, disabled, or explained unavailable | MiniMax implements, GPT verifies unsupported-state handling |
| Message context menu | Text/image/audio/file messages across own/other/revoked/failed states | Actions match the GPT message action matrix | MiniMax implements, GPT verifies matrix |
| Forward/quote/revoke/download | Use direct and group conversations where applicable | No server plaintext shortcut; v2 messages re-encrypt; media assets are copied/bound correctly | GPT |
| Input surface | Emoji insertion, quote cancel, attachment preview, send, failure retry | Existing draft/quote/media state is preserved; failed upload/send is visible | MiniMax implements, GPT verifies attachment semantics |
| Microphone entry | Inspect composer mic control | Hidden, disabled, or explicitly unavailable; no permission request unless recording is fully implemented | GPT defines, MiniMax implements |
| Group management | View members, add/remove/leave/edit metadata according to role | Backend permissions are respected; Sender Key lifecycle is not bypassed | MiniMax implements, GPT verifies |
| Group lifecycle display | Rename/invite/leave/remove/rejoin visible state | User can understand membership changes and removed/rejoined semantics | MiniMax |
| Notification settings | Load, change, save, refresh all backend-supported categories | UI values match backend fields and returned effective values | MiniMax implements, GPT verifies |

## Required Manual E2E Smoke

Use two disposable accounts and one group-capable scenario before merge:

1. Login account A and account B.
2. Add friend and open a direct conversation.
3. Send text and media both directions.
4. Use quote, forward, revoke, download where applicable.
5. Logout and re-login each account; verify history replay and sender/receiver sides.
6. Create a group with at least three accounts or users.
7. Add/remove/leave a member and verify post-change send behavior.
8. Toggle notification settings and verify returned effective values after save.

## Deferral Policy

The branch may merge with documented deferrals only when:

- the deferral is not part of the 2.0 chat core,
- the UI is hidden, disabled, or explicitly explained,
- no fake persistence or fake permission is shown,
- the regression matrix records the deferral and owner.

Known planned exclusion:

- Audio/video calling.

Potential acceptable deferral if not implemented in this change:

- Native microphone recording capture, provided the microphone entry is hidden/disabled/explained and existing audio-file attachment remains available.

## Merge Readiness Rule

This change is merge-ready only when:

- all OpenSpec tasks are complete,
- MiniMax UI tasks have smoke evidence,
- GPT final gates run after the last UI change,
- `pnpm -C apps/desktop build` passes,
- call/video exclusion and any remaining deferrals are documented.

## Execution Evidence

Executed on 2026-04-19:

| Gate | Result | Notes |
| --- | --- | --- |
| `pnpm -C apps/desktop build` | Passed | Vite emitted non-blocking chunk/import warnings |
| `pnpm -C apps/desktop exec playwright test --list` | Passed | 46 tests discovered in 15 files |
| `pnpm -C apps/desktop exec playwright test tests/auth-login-validation.spec.ts tests/e2e-rightclick-menu.spec.ts --reporter=list` | Passed | 5/5 lightweight smoke tests passed |

Readiness conclusion:

- Merge-ready for the scoped non-call desktop product surface after normal code review.
- Audio/video calls remain excluded.
- Native microphone recording remains deferred unless a later change implements a complete capture pipeline.
- A full authenticated real-account desktop smoke is still recommended before release packaging because the current menu smoke is intentionally lightweight.
