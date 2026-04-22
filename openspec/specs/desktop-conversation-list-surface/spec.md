# desktop-conversation-list-surface Specification

## Purpose
Define the desktop conversation list behavior required for stable selection, discovery, and supported conversation-level actions.
## Requirements
### Requirement: Desktop conversation list SHALL support search and stable selection
The desktop app SHALL let users search conversations and switch selected conversations without losing visible state consistency.

#### Scenario: User searches conversation list
- **WHEN** the user enters a search keyword in the conversation list search field
- **THEN** the desktop app SHALL filter visible conversations by supported conversation name or preview fields and SHALL restore the full list when the keyword is cleared

#### Scenario: User selects conversation
- **WHEN** the user selects a conversation from the list
- **THEN** the desktop app SHALL mark that conversation active and render its corresponding chat thread

### Requirement: Desktop conversation cards SHALL expose supported context actions
The desktop app SHALL provide conversation context actions for supported state changes and SHALL keep the UI consistent with the resulting conversation state.

#### Scenario: User opens conversation context menu
- **WHEN** the user right-clicks or otherwise invokes the context menu for a conversation card
- **THEN** the desktop app SHALL show supported actions such as pin, mute, delete, and copy conversation ID according to current capability support, and SHALL hide or disable actions that are not currently available

#### Scenario: User deletes conversation
- **WHEN** the user selects delete conversation and confirms the dialog
- **THEN** the desktop app SHALL remove or hide the conversation according to the supported deletion contract and SHALL not leave the deleted conversation selected

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

### Requirement: Desktop conversation list SHALL expose in-place FAB quick actions
The desktop app SHALL provide FAB quick actions for add-friend and new-group creation on the chat workspace without forcing a workspace switch before the action opens.

#### Scenario: User chooses add friend from FAB
- **WHEN** the user selects add-friend from the FAB menu while on the chat workspace
- **THEN** the desktop app SHALL open the add-friend dialog on the current page
- **AND** the user SHALL remain in the chat workspace

#### Scenario: User chooses new group from FAB
- **WHEN** the user selects new-group from the FAB menu while on the chat workspace
- **THEN** the desktop app SHALL open the group creation dialog on the current page
- **AND** the user SHALL remain in the chat workspace

