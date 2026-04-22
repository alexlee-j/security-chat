# desktop-friend-center-surface Specification

## Purpose
TBD - created by archiving change desktop-auth-friend-center-refactor. Update Purpose after archive.
## Requirements
### Requirement: Friend center SHALL share the global desktop shell
The friend center SHALL use the same global navigation trigger, shell layout, and drawer behavior as the chat workspace so users do not encounter a second, inconsistent application shell.

#### Scenario: User opens friend center
- **WHEN** the user enters the friend center workspace
- **THEN** the friend center SHALL present the same top-level navigation entry point used by the chat workspace

#### Scenario: Navigation drawer opens from friend center
- **WHEN** the user activates the hamburger menu in the friend center
- **THEN** the desktop app SHALL open the same global navigation drawer used by the chat workspace

### Requirement: Friend center SHALL present friend management in a consistent surface
The friend center SHALL present friend discovery, incoming requests, blocked users, and direct message actions in a layout aligned with the current desktop page design.

#### Scenario: User inspects friend records
- **WHEN** the user opens a friend entry
- **THEN** the friend center SHALL show the selected friend's identity, state, and supported actions in a structured detail surface

#### Scenario: User manages friend state
- **WHEN** the user requests friend search, accept/reject, block/unblock, or direct conversation actions
- **THEN** the friend center SHALL present those actions in the same visual and interaction language used by the rest of the desktop page

#### Scenario: Friend center remains usable at common window sizes
- **WHEN** the desktop window is resized within the supported desktop range
- **THEN** the friend center SHALL keep the list and detail panes readable without hiding primary actions behind unsupported gestures

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

