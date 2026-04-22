## 1. Backend friend removal contract

- [x] 1.1 Add a friend removal DTO, controller endpoint, and service method that removes an accepted friendship from both sides without touching conversations or messages.
- [x] 1.2 Enforce clear error handling for non-friend, pending, or blocked cases so the remove action only succeeds for accepted relationships.
- [x] 1.3 Add backend coverage for the remove-friend contract, including the preserved-history behavior.

## 2. Shared friend dialogs and App wiring

- [x] 2.1 Build a shared shadcn-based add-friend dialog that can search users and send requests from the current workspace.
- [x] 2.2 Build a shared shadcn-based remove-friend confirmation dialog that clearly states chat history is preserved.
- [x] 2.3 Mount the dialog state in `App.tsx` and wire both the chat FAB and the friend center to open the shared add-friend flow in place.
- [x] 2.4 Update the friend center surface to expose an explicit add-friend entry point and a remove-friend action on friend details.

## 3. Group creation from the FAB

- [x] 3.1 Wrap the existing group creation flow in the shared shadcn dialog shell while preserving the current create/manage behavior.
- [x] 3.2 Mount the group creation dialog in `App.tsx` and connect the FAB "新建群聊" action to open it on the current page.
- [x] 3.3 Verify the post-create handoff still selects or opens the new group conversation as expected.

## 4. Verification

- [x] 4.1 Run the relevant backend and desktop build or smoke checks to confirm add-friend, remove-friend, and new-group flows work without workspace hopping.
