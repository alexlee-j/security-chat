## ADDED Requirements

### Requirement: Desktop chat thread header SHALL render stored avatars
The desktop chat thread header SHALL render the active direct peer or group avatar when available and SHALL preserve fallback behavior when no image is configured.

#### Scenario: Direct chat header has peer avatar
- **WHEN** the user opens a direct conversation whose peer identity includes `avatarUrl`
- **THEN** the chat header SHALL render the peer's stored avatar image
- **AND** the online status indicator SHALL remain visible when applicable

#### Scenario: Chat header has no avatar image
- **WHEN** the active conversation identity has no renderable avatar image
- **THEN** the chat header SHALL render the existing initials fallback without changing header layout
