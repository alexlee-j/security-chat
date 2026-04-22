## ADDED Requirements

### Requirement: FAB new-group action SHALL complete on-page dialog flow
The desktop conversation list FAB SHALL open a group-creation dialog on the current page and SHALL allow users to finish create-or-cancel actions without workspace hopping, layout breakage, or dead-end UI states.

#### Scenario: User opens group creation from FAB
- **WHEN** the user selects "新建群聊" from the FAB menu in the chat workspace
- **THEN** the desktop app SHALL open the group-creation dialog in the current page context
- **AND** the current workspace SHALL remain chat while the dialog is open

#### Scenario: User completes create flow
- **WHEN** the user submits a valid group create action from the dialog
- **THEN** the desktop app SHALL close the dialog and return to the chat context without requiring a manual workspace switch

#### Scenario: User cancels create flow
- **WHEN** the user dismisses the group-creation dialog
- **THEN** the desktop app SHALL close the dialog cleanly and SHALL NOT leave the UI in a partially blocked interaction state
