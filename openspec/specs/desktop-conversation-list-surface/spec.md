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
- **THEN** the desktop app SHALL show supported actions such as pin, mute, delete, and copy conversation ID according to current capability support

#### Scenario: User deletes conversation
- **WHEN** the user selects delete conversation and confirms the dialog
- **THEN** the desktop app SHALL remove or hide the conversation according to the supported deletion contract and SHALL not leave the deleted conversation selected
