## MODIFIED Requirements

### Requirement: Friend center SHALL present friend management in a consistent surface
The friend center SHALL present friend discovery, incoming requests, blocked users, direct message actions, and stored avatar images in a layout aligned with the current desktop page design.

#### Scenario: User inspects friend records
- **WHEN** the user opens a friend entry
- **THEN** the friend center SHALL show the selected friend's identity, stored avatar when available, state, and supported actions in a structured detail surface

#### Scenario: User manages friend state
- **WHEN** the user requests friend search, accept/reject, block/unblock, or direct conversation actions
- **THEN** the friend center SHALL present those actions in the same visual and interaction language used by the rest of the desktop page

#### Scenario: Friend center remains usable at common window sizes
- **WHEN** the desktop window is resized within the supported desktop range
- **THEN** the friend center SHALL keep the list and detail panes readable without hiding primary actions behind unsupported gestures

### Requirement: Friend center SHALL render stored avatars across friend-related surfaces
The friend center and related dialogs SHALL render stored user avatars returned by friend APIs before falling back to initials.

#### Scenario: Friend list includes avatar URLs
- **WHEN** friend list, incoming request, blocked user, or search result rows include `avatarUrl`
- **THEN** the friend center SHALL render each stored avatar image in both list and detail contexts
- **AND** it SHALL keep the initials/gradient fallback when no avatar is configured

#### Scenario: Add-friend dialog displays search results
- **WHEN** add-friend search results include `avatarUrl`
- **THEN** the add-friend dialog SHALL render each stored avatar image before falling back to initials

#### Scenario: Remove-friend dialog opens
- **WHEN** the remove-friend confirmation dialog opens for a friend with `avatarUrl`
- **THEN** the dialog SHALL render the friend's stored avatar image before falling back to initials

#### Scenario: Group member picker displays friends
- **WHEN** group create or group manage member lists include user `avatarUrl`
- **THEN** member picker rows SHALL render stored avatar images before falling back to initials or generated colors
