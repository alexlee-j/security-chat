## Context

The current codebase has already achieved a meaningful desktop direct-message baseline: device-bound JWT auth, Rust-backed Signal primitives, per-device envelope storage, `send-v2` fan-out for desktop direct chat, and verified real-account smoke coverage for register/login/friend request/direct messaging/re-login replay. The remaining problem is structural incompleteness rather than basic failure.

Three gaps define the distance between the current state and a globally complete product state:

1. Transport convergence is incomplete. Legacy WebSocket `message.send` and older compatibility branches still coexist with the device-bound `send-v2` model.
2. Group messaging does not yet have the same Rust-first assurance as direct messaging. Sender Key support exists in parts of the backend/Rust surface, but not as a fully validated product path with membership, key rotation, and regression guarantees.
3. Product-level readiness controls are weaker than protocol complexity now requires. Notification policy, regression gates, documentation accuracy, and cross-role execution ownership are not yet unified.

Stakeholders for this change are:
- GPT: owns protocol-critical and transport-critical work, including the hardest backend/Rust/frontend convergence tasks.
- MiniMax: owns supporting implementation, integration cleanup, UI/settings wiring, documentation alignment, and lower-risk regression follow-up.

Implementation for this initiative will occur on a new dedicated development branch so this line of work can move independently of unrelated maintenance. The branch name for implementation is `feature/global-completion`, created from `main` after proposal approval. This proposal work itself is isolated on a separate planning branch.

## Goals / Non-Goals

**Goals:**
- Make device-bound transport the only active direct-message path for supported clients.
- Define and complete the Rust-first group messaging path with explicit Sender Key lifecycle and fallback boundaries.
- Introduce user-respected notification delivery controls so notification generation is policy-aware.
- Establish a repeatable release map covering backend, Rust, frontend, and real-account regression gates.
- Split execution clearly between GPT and MiniMax so protocol-critical work is not diluted across owners.

**Non-Goals:**
- Rewriting the entire product UI or changing the visual design system.
- Shipping mobile parity in this change; the current repository does not contain an `apps/mobile` implementation despite workspace scripts still referencing it.
- Replacing Tauri, NestJS, PostgreSQL, or Redis.
- Solving every future observability and analytics concern beyond the regression and release gates needed for this initiative.

## Decisions

### 1. Converge all direct-message transport onto device-bound `send-v2`

The system will treat `messages` as logical records and `message_device_envelopes` as the source of per-device ciphertext. All active direct-message sends from supported clients must flow through `send-v2`, and read paths must resolve ciphertext through the authenticated device context.

Rationale:
- This matches the current backend schema and desktop implementation direction.
- It eliminates ambiguity from mixed old/new paths.
- It prevents future regressions where one transport path silently bypasses multi-device guarantees.

Alternatives considered:
- Keep dual-path support indefinitely. Rejected because it preserves silent divergence and test complexity.
- Move all payload storage back into `messages.encrypted_payload`. Rejected because it breaks multi-device correctness.

### 2. Treat legacy WebSocket send behavior as a deprecation target, not a coexistence target

The old `message.send` WebSocket path remains only as a migration liability to be removed or explicitly blocked for direct-message sending once supported clients have converged.

Rationale:
- It currently bypasses the core guarantees of `send-v2`.
- Keeping it active invites accidental use in tests and future clients.

Alternatives considered:
- Rewrite the legacy event to proxy internally to `send-v2`. Rejected as the first step because it hides migration state and may retain incorrect payload assumptions at the socket contract layer.
- Leave it untouched. Rejected due to protocol inconsistency.

### 3. Complete group chat on a dedicated Rust-first Sender Key track

Group messaging will not be treated as an extension of direct chat fan-out. It will use Sender Key semantics with explicit handling for:
- group creation and membership changes,
- sender key provisioning/rotation,
- late joiners and removed members,
- replay/rejoin rules,
- desktop decrypt/render behavior.

Rationale:
- Group cryptography has different invariants than direct-message per-device fan-out.
- The current code already separates group concerns structurally; the missing piece is product-complete validation and integration.

Alternatives considered:
- Reuse direct-message envelope fan-out for group chat. Rejected because it scales poorly and does not match the intended Sender Key model.
- Delay group work entirely. Rejected because “global completion” would remain false.

### 4. Add notification policy at the generation layer, not only the UI layer

Notification settings must be evaluated where notifications are created, not just where they are displayed. Backend services that generate `message`, `friend_request`, `burn`, or related notifications must consult effective user preferences before persisting or emitting them.

Rationale:
- Prevents storing or sending notifications the user has already opted out of.
- Keeps WebSocket/API behavior and unread counts aligned.

Alternatives considered:
- Filter notifications only in frontend UI. Rejected because unread counts and server state remain incorrect.
- Create everything and suppress only push delivery. Rejected because it does not solve in-app noise or summary accuracy.

### 5. Use branch and ownership governance as a first-class delivery mechanism

This initiative will be executed on `feature/global-completion` with explicit ownership:
- GPT owns high-risk backend/Rust/frontend work:
  - direct transport convergence and removal of unsafe legacy paths,
  - Rust Sender Key architecture and group cryptographic closure,
  - device/session compatibility cleanup,
  - cross-layer migration decisions.
- MiniMax owns supporting and lower-risk work:
  - notification settings entity/API/UI follow-through,
  - README/documentation alignment,
  - regression harness cleanup and non-critical test backfill,
  - UI wiring and product-surface consistency work that does not alter protocol invariants.

Rationale:
- The hardest work crosses backend, Rust, and frontend simultaneously.
- Ownership must align with technical risk, not just file location.

Alternatives considered:
- Divide by layer only. Rejected because protocol-critical work spans layers.
- Shared ownership on all tasks. Rejected because it weakens accountability.

### 6. Make regression closure a release gate, not a post-hoc validation step

The initiative is only complete when all of the following are true:
- backend build and targeted message/auth/media tests pass,
- desktop build passes,
- Rust session/group protocol tests pass,
- real-account smoke runs pass for direct chat,
- group-chat smoke/regression passes on the new Rust-first path,
- README and operational docs reflect the actual transport and protocol model.

Rationale:
- Current complexity is high enough that “code merged” is no longer a valid definition of done.

Alternatives considered:
- Keep manual smoke only. Rejected because protocol regressions can hide behind happy-path UI success.

## Risks / Trade-offs

- [Transport convergence may break older client assumptions] -> Mitigate by documenting cutoff behavior, using one dedicated branch, and sequencing rollout from direct-message path cleanup to gateway deprecation.
- [Group Sender Key work may expose hidden assumptions in desktop state or backend membership logic] -> Mitigate by isolating group milestones and requiring Rust/backend tests before UI integration.
- [Notification settings can create silent delivery gaps if defaults are wrong] -> Mitigate by shipping explicit defaults, migration-safe DB changes, and unread-count regression tests.
- [Role split can fail if ownership boundaries are vague] -> Mitigate by assigning GPT to protocol-critical milestones and MiniMax to supporting tasks in `tasks.md`.
- [Docs and scripts currently overstate repository completeness, especially around mobile] -> Mitigate by explicitly correcting docs as part of the release-readiness milestone rather than treating them as optional cleanup.

## Migration Plan

1. Create `feature/global-completion` from `main` and use it as the sole integration branch for implementation.
2. Converge direct transport first:
   - validate `send-v2` is the only active direct-message path for supported clients,
   - deprecate or block the unsafe socket send path,
   - remove unsafe compatibility fallbacks only after regression coverage is green.
3. Complete group Rust/Sender Key closure in isolated milestones:
   - define key lifecycle and membership rules,
   - add backend/Rust tests,
   - wire frontend group flows after protocol correctness is proven.
4. Add notification settings and policy-aware generation.
5. Refresh docs and release gates last, but before merge.

Rollback strategy:
- Roll back by milestone, not by individual file, using branch history on `feature/global-completion`.
- If direct-message convergence regresses real chat, restore the last known-good branch point before socket/send-path removal.
- If group Rust closure is unstable, keep group messaging behind the existing restricted behavior while allowing direct-message improvements to proceed.

## Open Questions

- Should legacy WebSocket `message.send` be hard-disabled immediately for direct chat, or temporarily rewritten to emit a loud deprecation error first?
- For conversation preview in v2/group paths, should product behavior prefer decryptable cached summary, metadata-derived placeholder, or an explicit “encrypted message” label?
- What is the minimum supported scope for notification settings in this initiative: global switches only, or per-type/per-conversation overrides?
- Should group membership changes force Sender Key rotation on every join/leave event, or only on leave/removal paths?
