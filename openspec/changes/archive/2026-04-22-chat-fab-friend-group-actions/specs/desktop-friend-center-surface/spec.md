## ADDED Requirements

### Requirement: Friend center SHALL support in-page friend requests
The friend center SHALL provide a supported add-friend entry point that lets users search for a person and send a friend request without switching to another workspace.

#### Scenario: User opens add-friend dialog
- **WHEN** the user chooses add-friend from the friend center
- **THEN** the desktop app SHALL open an in-page dialog or equivalent focused surface
- **AND** the user SHALL remain in the friend center context while interacting with that surface

#### Scenario: User sends a friend request
- **WHEN** the user selects a search result and confirms the request
- **THEN** the desktop app SHALL submit the friend request
- **AND** the friend-related views SHALL refresh to reflect the updated relationship state

### Requirement: Friend center SHALL support removing an accepted friend relationship
The friend center SHALL provide a confirmation flow to remove an existing friendship while preserving the conversation history and message records associated with that contact.

#### Scenario: User confirms friend removal
- **WHEN** the user confirms the remove-friend action for an accepted friend
- **THEN** the desktop app SHALL remove the friendship relationship from both sides
- **AND** the existing chat history SHALL remain available in the desktop app

#### Scenario: User cancels friend removal
- **WHEN** the user dismisses the remove-friend confirmation dialog
- **THEN** the desktop app SHALL keep the existing friendship relationship unchanged
