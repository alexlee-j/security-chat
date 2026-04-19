# desktop-product-surface-closure Implementation Notes

## Phase 1 Baseline

- Implementation branch verified: `feature/desktop-product-surface-closure`
- Baseline rule: this change must stay scoped to the desktop product surface closure on top of `main`
- Hard exclusion: audio/video calling stays out of scope for this change

## Design Coverage Matrix

| Area | Source design docs | Scope decision | Current baseline |
| --- | --- | --- | --- |
| Global navigation, profile, settings, about, logout | `2026-04-07-master-design.md` navigation drawer flow and page routing; `2026-04-07-ui-redesign.md` shell and menu patterns | In scope | Shell exists; routing/state wiring still needs product closure work |
| Theme and layout consistency | `2026-04-07-master-design.md` color tokens and layout rules; `2026-04-07-ui-redesign.md` theme variables and responsive shells | In scope | Theme hook and CSS tokens exist; needs surface-level consistency verification |
| Conversation list surface | `2026-04-07-ui-redesign.md` sidebar, search, conversation card, FAB menu sections | In scope | Conversation sidebar, context menus, and FAB are present but not yet fully normalized to design intent |
| Chat thread interactions | `2026-04-07-ui-redesign.md` chat header, message menu, quote/forward/delete/search flows | In scope | Top bar, chat menu, message menu, and panel flows exist; rules and visuals still need final closure |
| Input surface completion | `2026-04-07-ui-redesign.md` input area, emoji picker, attachments, recording, reply bar | In scope | Emoji picker and parts of the composer exist; attachment/recording behavior still needs closure decisions |
| Group product surface | `2026-04-07-master-design.md` group entry surfaces; `2026-04-07-ui-redesign.md` group interaction flows | In scope | Group creation / management scaffolding exists; permission-driven closure still needs validation |
| Settings and notification surface | `2026-04-07-master-design.md` settings routing; existing notification settings sheet | In scope | Notification settings sheet exists; effective-value consistency still needs gate verification |
| Call/video controls | `2026-04-07-ui-redesign.md` calling chapters and call-state flows | Out of scope | Must remain hidden, disabled, or explicitly unavailable for this change |

## GPT / MiniMax Ownership

### GPT owns

- State semantics for conversations, messages, groups, logout, and notification policy
- Cross-layer contract decisions that may affect API, local state, or cryptographic behavior
- Rule matrices for unsupported or ambiguous actions
- Final verification gates and merge readiness conclusions

### MiniMax owns

- Low-risk desktop UI composition and layout fidelity
- Navigation drawer, profile/about/settings shells, menu surfaces, and other design-first surfaces
- Reuse-driven implementation using existing shadcn/Radix primitives
- Docs and smoke validation records that do not alter state semantics

### Escalation rule

- If a UI task needs new persistence semantics, new API shape, or a state-source change, stop and escalate to GPT before implementation continues

## Existing Desktop Components Audit

| Component | Classification | Rationale |
| --- | --- | --- |
| `apps/desktop/src/App.tsx` | Refactor | Already hosts workspace switching, nav drawer, and settings sheet; needs product-surface orchestration cleanup rather than replacement |
| `apps/desktop/src/features/chat/conversation-sidebar.tsx` | Refactor | Core list behavior exists; needs design normalization and stronger reusable primitive alignment |
| `apps/desktop/src/features/chat/chat-panel.tsx` | Refactor | Contains the main chat surface and most interaction wiring; keep and close gaps rather than rewrite wholesale |
| `apps/desktop/src/features/chat/top-bar.tsx` | Refactor | Header is already present but call buttons and menu semantics must be normalized to the phase rules |
| `apps/desktop/src/features/chat/chat-more-menu.tsx` | Replace | Uses custom buttons for menu behavior; should be replaced or re-composed with shared dropdown primitives |
| `apps/desktop/src/features/chat/message-context-menu.tsx` | Replace | Custom ad-hoc menu should be rebuilt on shared `ContextMenu` primitives to keep behavior consistent |
| `apps/desktop/src/features/chat/conversation-context-menu.tsx` | Replace | Same pattern as message menu; should move to shared context-menu primitives |
| `apps/desktop/src/features/chat/fab-menu.tsx` | Refactor | Behavior is correct in spirit, but it should be re-composed with shared popover/dropdown primitives |
| `apps/desktop/src/features/chat/group-create-modal.tsx` | Refactor | Existing group surface is useful but mixes create/manage behavior and should be split or tightened |
| `apps/desktop/src/features/chat/emoji-picker.tsx` | Reuse | External emoji picker wrapper is already present and should be preserved unless a rule-level reason emerges |
| `apps/desktop/src/features/settings/notification-settings-sheet.tsx` | Reuse | Settings sheet already matches the intended surface and can be extended rather than replaced |
| `apps/desktop/src/features/friend/friend-panel.tsx` | Refactor | Existing friend panel provides useful nav and surface patterns, but it is not yet a finished product surface |
| `apps/desktop/src/components/ui/*` | Reuse | Existing shadcn/Radix primitives are the primary implementation base for this change |
| `apps/desktop/src/core/use-theme.ts` | Reuse | Theme state source already exists and should remain the single source of truth for theme toggling |
| `apps/desktop/src/core/api.ts` | Reuse | API layer already exposes auth, conversation, message, group, and notification operations |
| `apps/desktop/src/styles.css` | Refactor | Design tokens already exist, but surface-specific token usage still needs normalization and cleanup |

## MiniMax Execution Checklist

Before MiniMax starts a UI task, the implementation note for that task must include:

1. The existing shadcn/Radix primitives to reuse
2. The hooks or API functions that provide the state source
3. The CSS tokens or theme variables that the surface must respect
4. The explicit unsupported states that must be hidden, disabled, or explained
5. The verification method that will be used after the change
6. The escalation point if a state, permission, or persistence decision is required

## Reusable Primitives, Hooks, APIs, and Tokens

### Primitives already available

- `Button`
- `Input`
- `Dialog`
- `Sheet`
- `DropdownMenu`
- `ContextMenu`
- `Popover`
- `Tooltip`
- `ScrollArea`
- `Switch`
- `Checkbox`
- `Avatar`
- `Badge`
- `Card`
- `Separator`
- `Label`

### Hooks already available

- `useTheme`
- `useChatClient`
- `useApiCache`
- `useLocalDb`
- `useKeychain`

### API functions already available

- `setAuthToken`
- `logout`
- `login`
- `sendLoginCode`
- `loginWithCode`
- `register`
- `sendForgotPasswordCode`
- `resetPasswordWithCode`
- `getConversations`
- `createDirectConversation`
- `getConversationMembers`
- `getConversationBurnDefault`
- `updateConversationBurnDefault`
- `deleteConversation`
- `getMessages`
- `getMessageById`
- `sendMessage`
- `forwardMessage`
- `searchUsers`
- `createGroup`
- `getGroup`
- `getGroupMembers`
- `updateGroupProfile`
- `addGroupMember`
- `removeGroupMember`
- `getNotificationSettings`
- `updateNotificationSettings`
- `decodePayload`

### CSS tokens and layout variables to preserve

- `--background`
- `--foreground`
- `--card`
- `--popover`
- `--primary`
- `--secondary`
- `--muted`
- `--accent`
- `--destructive`
- `--border`
- `--input`
- `--ring`
- `--sidebar-background`
- `--chat-background`
- `--search-bg`
- `--msg-in`
- `--msg-out`
- `--msg-reply-bar`
- `--success`
- `--burn`
- `--radius`
- `--avatar-gradient-1` through `--avatar-gradient-5`
- `--chat-bg`
- `--sidebar-bg`
- `--topbar-bg`
- `--input-bg`
- `--input-border`
- `--composer-bg`
- `--composer-input-bg`

## Task 1.1-1.6 Completion Gate

The following phase 1 outputs are now captured in this note:

- Branch verification for `feature/desktop-product-surface-closure`
- Design coverage matrix with call/video excluded
- GPT / MiniMax ownership split
- Desktop component audit
- MiniMax execution checklist
- Reusable primitive / hook / API / token inventory

No behavior code is changed in this phase 1 pass.

## Logout State Semantics Verification

Verified in `apps/desktop/src/core/use-chat-client.ts` and `apps/desktop/src/core/auth-storage.ts`:

- `onLogout()` calls the backend logout endpoint when possible and always continues with local cleanup
- authentication token is cleared via `setAuthToken(null)`
- auth state is cleared via `setAuth(null)` and input/auth UI state is reset
- local search/chat metadata, conversation state, drafts, and unread/pinned/muted preferences are cleared
- `clearAllAuthData()` removes remembered credentials, auto-login config, and last-login metadata
- `localStorage.clear()` is followed by restoring only Signal keys, so device/session state needed by Signal remains intact

This satisfies the logout state-clear semantics gate for the current change.

## Theme And Layout Verification

Verified against the current desktop shell:

- `useTheme()` already drives `light`, `dark`, and `auto` classes on the document root
- `apps/desktop/src/styles.css` already defines the design tokens used by the chat, sidebar, input, and card surfaces
- the Tauri window configuration already constrains the desktop shell to a minimum `800x600` viewport
- the new profile/about/settings surfaces reuse the same card, sheet, avatar, badge, button, separator, and switch primitives, so they inherit the theme tokens rather than hard-coded colors

This is sufficient to close the phase 3.1-3.3 verification gate for the desktop product surface baseline.

## Conversation List Baseline

- Search input now has an explicit clear action
- Empty state distinguishes between no conversations and a filtered-empty search result
- Active selection, pin, mute, unread badges, and draft hints remain on the existing conversation list row

This closes the 4.1 surface increment without changing conversation persistence semantics.

## Conversation Context Action Contract

Verified against `apps/backend/src/modules/conversation/conversation.controller.ts`, `apps/backend/src/modules/conversation/conversation.service.ts`, `apps/desktop/src/core/api.ts`, and `apps/desktop/src/core/use-chat-client.ts`.

| Action | Persistence source | Allowed UI behavior | Disallowed behavior |
| --- | --- | --- | --- |
| Pin conversation | Backend-supported via `PATCH /conversation/:conversationId/settings` and `conversation_members.is_pinned`; current desktop also has local preference snapshots | UI may show optimistic local state only if it reconciles to server or explicitly labels the state as local-only | Do not present pin as cross-device/server-persisted unless wired through `updateSettings` |
| Mute conversation | Backend-supported via `PATCH /conversation/:conversationId/settings` and `conversation_members.is_muted`; current desktop also has local preference snapshots | UI may suppress desktop notification behavior using local state while backend wiring is pending | Do not claim mute affects backend notification policy unless the setting endpoint is called and refreshed |
| Delete conversation | Backend-supported via `DELETE /conversation/:conversationId` | UI may remove the row only after API success; on failure leave row visible and show an error | Do not fake deletion by filtering the row locally after a failed API call |
| Copy conversation ID | Clipboard-only | UI may copy `conversationId` and show a transient success/failure state | Must not mutate conversation ordering, preview, unread, pin, or mute state |

Consistency requirements for MiniMax task 4.2:

- Reuse shared `ContextMenu` primitives; do not keep ad-hoc absolute-position button lists as the final implementation.
- Pin/mute menu labels must reflect the current effective state.
- Delete must be destructive-styled and confirmed if the UI can permanently remove the conversation.
- If pin/mute remain local-only in this desktop iteration, the menu copy or tooltip must avoid implying account-wide persistence.

## Conversation Preview And Unread Consistency

The conversation list preview and unread counters are server/sync-derived display state. Context actions must preserve this model:

- Pin and mute may reorder or decorate rows, but must not change `lastMessage`, `unreadCount`, `messageIndex`, or decoded preview text.
- Copy ID must not change any conversation data.
- Delete may remove a row only after `DELETE /conversation/:conversationId` succeeds; if the active conversation is deleted, the active selection must be cleared or moved to a valid remaining conversation.
- WebSocket `conversation.updated` or explicit `loadConversations()` replay is the source of truth after message, revoke, read, delete, and group lifecycle updates.
- If a local optimistic action conflicts with replayed server state, server state wins except for explicitly local-only UI preferences.

This closes the GPT contract and preview/unread verification gates for tasks 4.3 and 4.4.

## Message Action Rule Matrix

Verified against `apps/backend/src/modules/message/message.service.ts`, `apps/desktop/src/core/api.ts`, `apps/desktop/src/core/use-chat-client.ts`, and `apps/desktop/src/features/chat/chat-panel.tsx`.

Message types:

- `1`: text
- `2`: image
- `3`: audio
- `4`: file

| Action | Text | Image | Audio | File | Ownership / state rules | Direct / group cryptographic rule |
| --- | --- | --- | --- | --- | --- | --- |
| Copy | Enabled when decrypted plaintext exists and message is not revoked | Copy textual caption/metadata only if present | Copy textual caption/metadata only if present | Copy filename/metadata only if present | Disabled for revoked, failed encrypted decode, and placeholder-only messages | Must read only client-decrypted plaintext; never request server plaintext |
| Quote | Enabled for visible, non-revoked messages | Enabled for visible, non-revoked messages with stable media label | Enabled for visible, non-revoked messages with stable audio label | Enabled for visible, non-revoked messages with stable file label | Quote state must preserve original message id/type/snippet and be cancelable | Quote metadata is part of the newly encrypted payload; no backend plaintext shortcut |
| Forward | Enabled only when source content can be decrypted locally | Enabled only after media asset can be copied to the target conversation | Enabled only after media asset can be copied to the target conversation | Enabled only after media asset can be copied to the target conversation | Disabled for revoked, undecryptable, failed-local-only, or missing media asset messages | v2 messages must be client-decrypted and re-encrypted to target devices or group Sender Key; legacy server forward is only for legacy direct messages and rejects v2 payloads |
| Delete / revoke | Sender-owned messages only | Sender-owned messages only | Sender-owned messages only | Sender-owned messages only | Backend allows sender revoke within the configured revoke window; non-owner delete is not supported as remote deletion | Revoke marks metadata state and emits events; it must not require decrypting or rewriting encrypted payloads |
| Download | Not applicable | Enabled if `mediaAssetId` or valid media URL resolves | Optional only when audio download UX is supported | Enabled if `mediaAssetId` or valid media URL resolves | Disabled for revoked, missing media, failed download, or unsupported local blob state | Download uses authenticated media API; it does not expose message plaintext beyond the user's decrypted local context |

MiniMax task 5.3 must implement this matrix exactly. If a menu item is unavailable, hide it or show a disabled item with an explicit reason; do not show clickable actions that will reliably fail.

## Encrypted Action Contract Verification

Current backend and desktop constraints:

- Backend `forwardMessage()` rejects v2 messages whose `encryptedPayload` is `null`, forcing supported clients to re-encrypt on the client side.
- Desktop `onForwardMessage()` has a v2 client re-encryption path and copies media assets before calling `send-v2`.
- Backend `revokeMessage()` checks membership, ownership, and the revoke time window before marking `isRevoked`.
- Desktop download resolves media through the authenticated media API when `mediaAssetId` exists.

Rules that must remain true after MiniMax UI work:

- Quote/forward/delete/download UI must call the existing action handlers rather than adding new server plaintext endpoints.
- Forwarding direct v2 messages must continue to fan out per-device envelopes, including sender self-sync envelopes.
- Forwarding group messages must use the group encrypted payload path and must not fall back to direct-message envelope assumptions.
- Media forwarding must copy or bind a target-conversation media asset; it must not reuse a source asset that the target conversation cannot read.
- Revoked messages must render as revoked and must not offer copy, quote, forward, or download actions.

This closes GPT tasks 5.2 and 5.4 at the contract level. Final UI verification remains under task 9.4 after MiniMax completes the menu surfaces.

## Attachment Send Flow Contract

Verified against `apps/desktop/src/core/use-chat-client.ts`, `apps/desktop/src/core/api.ts`, `apps/backend/src/modules/media/media.service.ts`, and `apps/backend/src/modules/message/message.service.ts`.

Required flow:

1. User selects a file.
2. Desktop derives message type: image `2`, audio `3`, other file `4`.
3. Desktop uploads media and stores `pendingMediaAssetIdRef`.
4. Send uses the pending media asset id with the encrypted message payload.
5. Backend validates message type and media type, binds the asset to the conversation, and rejects invalid media/message combinations.
6. On successful send, desktop clears pending media state and reloads/syncs message state.
7. On upload or send failure, desktop keeps the failure visible and does not create a fake successful message.

Retry semantics:

- Retrying an already-uploaded media message should reuse the stable `mediaAssetId` when it is still valid for the same conversation.
- If the backend rejects the asset because it is missing, mismatched, already bound elsewhere, or unreadable, the UI must require re-selection/re-upload.
- File messages remain incompatible with burn-after-reading in the existing desktop guard and must not bypass that guard.

This closes task 6.3. MiniMax task 6.2 must preserve this flow while adding preview UI.

## Recording Support Decision

Audio/video calling is out of scope for this change, and full microphone recording is not part of the validated 2.0 desktop closure.

Decision for this release:

- The microphone entry must be hidden, disabled, or explicitly labeled as unavailable unless a fully working recording pipeline exists.
- A disabled microphone button must not request microphone permission.
- A hidden microphone action is acceptable if file upload already supports sending existing audio files as message type `3`.
- If MiniMax chooses an explanatory affordance, it should use a tooltip or disabled button text such as `语音录制暂未开放，可发送音频文件`.

This closes task 6.5 and prevents the UI from advertising unsupported recording behavior.

## Group Governance And Sender Key Contract

Verified against `apps/backend/src/modules/conversation/conversation.service.ts`, `apps/backend/src/modules/group/group.service.ts`, `apps/desktop/src/core/api.ts`, and `apps/desktop/src/core/signal/message-encryption.ts`.

Permission model:

| Action | Allowed actor | Backend behavior | Desktop requirement |
| --- | --- | --- | --- |
| View members | Current group/conversation member | Backend requires membership for private/member-only surfaces | UI must fetch and render current members from backend, not cached guesses |
| Add member | Admin/creator according to backend role checks | Backend adds only non-existing valid users and rotates Sender Keys | UI must expose only when current user has admin/creator role or handle `403` as permission-denied |
| Remove another member | Admin/creator according to backend role checks | Backend removes target and rotates Sender Keys | UI must not expose to ordinary members except as disabled/explained unavailable |
| Leave group | Current member | Backend removes current user and rotates Sender Keys | UI must exit/clear the conversation after success |
| Edit metadata | Backend-authorized actor | Backend persists group profile fields | UI must refresh group profile after save |

Sender Key lifecycle rules:

- Member add/remove/leave rotates or clears Sender Key material on the backend side.
- Desktop must call member sync before group encrypt/decrypt when member signatures change.
- Removed members must not be able to send or read future group traffic after the rotation point.
- Existing history readable before removal may remain visible if already authorized and locally decryptable; future messages are the hard boundary.
- Rejoined members are treated as newly added members and must receive current membership/Sender Key state; UI must not assume old removed-session state is still valid.

This closes tasks 7.3 and 7.5 at the governance/cryptographic contract level. MiniMax tasks 7.1, 7.2, and 7.4 must implement visible surfaces against this matrix.

## Notification Settings Contract

Verified against `apps/backend/src/modules/notification/entities/notification-settings.entity.ts`, `apps/backend/src/modules/notification/notification.service.ts`, `apps/backend/src/modules/notification/dto/update-notification-settings.dto.ts`, `apps/desktop/src/core/types.ts`, and `apps/desktop/src/features/settings/notification-settings-sheet.tsx`.

Backend-supported settings:

| Backend field | Notification type controlled | Desktop setting required |
| --- | --- | --- |
| `messageEnabled` | `message` | Message notifications |
| `friendRequestEnabled` | `friend_request` | Friend request notifications |
| `burnEnabled` | `burn` | Burn/read-once notifications |
| `groupEnabled` | `group` | Group notifications |
| `accountRecoveryEnabled` | `account_recovery` | Account recovery notifications |
| `securityEventEnabled` | `security_event` | Security event notifications |
| `groupLifecycleEnabled` | `group_lifecycle` | Group lifecycle notifications |

Rules:

- Desktop settings must load from `getNotificationSettings()`.
- Save must call `updateNotificationSettings()` and then render returned effective values.
- Disabled notification classes must not be represented as locally muted conversations; notification policy and conversation mute are separate concerns.
- If a backend field is not shown in UI, the product surface is incomplete for this change.

This closes task 8.3.

## Final Verification Gate

Executed on 2026-04-19 after MiniMax marked the desktop UI tasks complete.

Commands:

```bash
pnpm -C apps/desktop build
pnpm -C apps/desktop exec playwright test --list
pnpm -C apps/desktop exec vite --host 127.0.0.1 --port 4173
pnpm -C apps/desktop exec playwright test tests/auth-login-validation.spec.ts tests/e2e-rightclick-menu.spec.ts --reporter=list
```

Results:

- `pnpm -C apps/desktop build`: passed.
- `playwright test --list`: passed; 46 tests discovered in 15 files.
- `auth-login-validation.spec.ts` + `e2e-rightclick-menu.spec.ts`: passed, 5/5.
- Vite emitted only non-blocking warnings: deprecated CJS Node API, mixed dynamic/static imports, and large chunk size.
- Right-click smoke is currently a lightweight UI smoke; the test itself still logs that full message-menu and quote-jump validation require a complete conversation flow.

Legacy direct-send finding recheck:

- `POST /api/v1/message/send` remains exposed for group/Rust Sender Key traffic.
- `MessageService.sendMessage()` now rejects non-group conversations with `Direct conversations must use /api/v1/message/send-v2`.
- Supported direct-message desktop traffic remains on `send-v2`; the old review finding is not present as a direct-message bypass in this branch.

This closes task 9.4.

## Merge Readiness Conclusion

Conclusion: merge-ready for the scoped desktop product surface closure after normal human review.

Scope notes:

- Audio/video calls remain explicitly out of scope and are disabled or explained as unavailable.
- Native microphone recording capture remains deferred; existing audio file attachment support is acceptable for this release as long as the mic entry stays hidden, disabled, or explained.
- No backend/Rust files were changed by the desktop product surface work, so backend and Rust protocol gates are inherited from the already merged 2.0 core closure.

Residual risks:

- The current Playwright menu smoke proves app load and basic menu test wiring, but it does not fully exercise authenticated direct/group conversation flows.
- Before release packaging, run a real-account desktop smoke covering login, direct send, media attachment, quote/forward/revoke/download, group member add/remove/leave, notification save, and relogin replay.

This closes task 9.5.
