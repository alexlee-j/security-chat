## Context

The current desktop chat FAB already exposes "添加好友" and "新建群聊", but the add-friend path still jumps users into the friend workspace instead of letting them complete the action in place. The friend center already supports search, incoming requests, block/unblock, and direct conversation actions, but it does not expose a clear in-page add-friend entry point or an explicit "解除关系" action.

The existing backend friend module can search users and send friend requests, but it has no supported unfriend/removal operation yet. Conversation history and message storage are already separate from friendship state, so removing a friendship can be designed as a relationship-only change without deleting chat records.

The desktop app already uses shadcn Dialog primitives for confirmation flows, so the safest path is to standardize the new friend and group actions on the same modal pattern rather than keep adding custom overlays.

## Goals / Non-Goals

**Goals:**
- Keep add-friend in the current chat page and also expose it from the friend center.
- Add an explicit friend removal flow that preserves existing chat history.
- Make the FAB "新建群聊" action work from the current page.
- Prefer shared shadcn dialog primitives over feature-specific modal shells.
- Reuse the existing friend search/request and group creation logic as much as possible.

**Non-Goals:**
- Redesign the full friend center layout or conversation list layout.
- Change message storage, message deletion, or conversation history retention rules.
- Introduce new group governance behavior beyond exposing the existing creation surface.
- Rework friend blocking/unblocking semantics.

## Decisions

### 1. Use a shared shadcn Dialog pattern for all three actions
The add-friend flow, remove-friend confirmation, and group creation entry point will all be represented as dialogs rather than inline panels, sheets, or custom overlays.

This fits the interaction density of each action: add-friend needs search, result selection, and feedback; remove-friend needs an explicit confirmation gate; group creation is already a modal workflow. Reusing the existing `Dialog` primitive keeps focus handling, keyboard escape behavior, and styling aligned with the rest of the desktop app.

Alternatives considered:
- `Popover`: too cramped for search results and multi-step confirmation.
- `Sheet`: better for long-running settings surfaces, but heavier than needed here.
- Inline expansion inside the panel: simpler in code, but it fragments the page and makes the actions feel inconsistent.

### 2. Make add-friend a shared in-place dialog opened from both the chat FAB and the friend center
The add-friend flow will be a shared dialog surface, opened from the FAB in chat and from an explicit action in the friend center. The dialog will use the existing user search and friend request actions, and it will keep the user in the current workspace while it is open.

This avoids duplicating the request flow in two places and removes the navigation hop that currently interrupts the chat workflow. The dialog can remain focused on a single keyword search field and a result list that reflects the current relation state.

Alternatives considered:
- Keep add-friend only in the friend workspace: rejected because it preserves the current dead-end routing.
- Build separate add-friend dialogs for chat and friend center: rejected because the interaction and backend action are the same.

### 3. Add an explicit remove-friend API that only removes accepted friendships
Removing a friend will be a relationship-only operation on accepted friendships. The backend will remove the friendship rows for both directions and leave conversations and messages untouched.

This matches the user intent of "解除关系但保留聊天记录" and keeps the operation semantically separate from block/unblock or pending request handling. It also avoids introducing soft-delete state into the friendship model when the rest of the app only needs to know whether a relationship exists.

Alternatives considered:
- Soft delete the friendship rows: rejected because it adds long-term state complexity without a product need.
- Reuse block/unblock as a remove mechanism: rejected because blocking has a different meaning and side effects.

### 4. Keep the existing group creation logic but move its shell to the shared dialog pattern
The current group creation implementation already exists, so this change will focus on mounting it from the App and presenting it through the same shadcn dialog family. The internal create/manage logic stays intact; only the outer shell and open/close wiring change.

This keeps the scope controlled while still satisfying the requirement to prefer shared UI primitives. It also reduces the risk of changing group creation behavior while we are only trying to expose the FAB entry point.

Alternatives considered:
- Leave the custom modal shell in place: rejected because it does not align with the shared primitive goal.
- Rewrite group creation from scratch: rejected because it would add avoidable risk and duplicate existing logic.

### 5. Keep modal state at the App level and pass open handlers down
The main App will own the open/close state for the add-friend dialog, remove-friend confirmation, and group creation dialog. Child surfaces will only trigger those actions.

This keeps the current desktop shell as the single source of truth, prevents the same dialog from being instantiated in multiple places, and makes it easier to keep the friend center and chat workspace behavior consistent.

Alternatives considered:
- Local state inside each feature component: rejected because the same action needs to be reachable from multiple surfaces.
- A global store for modal state: possible, but more machinery than this change needs.

## Risks / Trade-offs

- [Risk] Add-friend dialog state may overlap with the existing friend search state. → Keep the dialog query/result lifecycle isolated and refresh the shared friend data store after successful requests.
- [Risk] The new remove-friend endpoint could accidentally affect pending or blocked relations. → Restrict it to accepted friendships and return a clear error when the target is not currently a friend.
- [Risk] Wrapping group creation in a shared dialog could expand the UI refactor beyond the current scope. → Preserve the existing create/manage logic and only replace the modal shell and open/close wiring.
- [Risk] Some downstream code may implicitly treat friendship state as conversation visibility. → Limit the change to the friendship relationship layer and verify that chat history still renders from conversation data after removal.

## Migration Plan

1. Add the backend remove-friend contract and verify it only changes friendship rows.
2. Introduce the shared add-friend dialog and mount it at the App level.
3. Wire the chat FAB and friend center action to the shared add-friend dialog.
4. Add the remove-friend confirmation dialog to the friend center and connect it to the new backend action.
5. Mount the existing group creation flow from the App and open it from the FAB new-group action.
6. Roll back by restoring the previous FAB workspace hop if the dialog wiring regresses; the remove-friend backend change remains isolated and does not affect existing chat data.

## Open Questions

- None blocking. The remaining copy choices, such as the exact add-friend placeholder text, can be finalized during implementation without changing the design.
