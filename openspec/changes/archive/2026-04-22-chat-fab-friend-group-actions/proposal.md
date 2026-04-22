## Why

The desktop app already has the data and backend actions for friend search and friend requests, but the current UI forces users to leave the chat workspace to start adding friends and leaves friend management incomplete in the friend center. The FAB also advertises "新建群聊" without a fully wired, in-place creation flow, so the desktop surface still has dead-end or split-path interactions.

## What Changes

- Keep "添加好友" on the current chat page by opening a lightweight dialog from the FAB instead of switching to the friend workspace.
- Expose the same add-friend flow from the friend center so users can request a friend without leaving the current page.
- Add friend removal as an explicit "解除关系" action that preserves existing chat history.
- Wire the FAB "新建群聊" action to the existing group creation flow so users can create a group from the current page.
- Standardize these actions on shared shadcn dialog primitives and reuse existing desktop UI patterns where possible.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `desktop-friend-center-surface`: the friend center now needs an in-page add-friend entry point and a relationship removal action, both surfaced in the current desktop page without requiring a workspace change.
- `desktop-conversation-list-surface`: the conversation list/FAB surface now needs to support quick actions for add-friend and new-group creation in-place instead of relying on navigation into another workspace.

## Impact

- Desktop App: chat workspace FAB behavior, friend center actions, and modal/dialog state handling in the main shell.
- Desktop UI: reuse of shared shadcn dialog primitives for add-friend and confirm-remove flows.
- Backend Friend module: a new unfriend/removal contract is required to remove the relationship while retaining conversation history.
- Group creation surface: the existing group creation flow must be mounted and opened from the FAB entry point.
