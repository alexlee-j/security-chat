## ADDED Requirements

### Requirement: Desktop conversation list SHALL render stored conversation avatars
The desktop conversation list SHALL render stored avatar images for direct peers and groups when available while preserving existing fallback avatars.

#### Scenario: Direct conversation has peer avatar
- **WHEN** a direct conversation row includes `peerUser.avatarUrl`
- **THEN** the conversation card SHALL render the peer's stored avatar image
- **AND** online status and active selection styling SHALL remain visible and readable

#### Scenario: Group conversation has avatar metadata
- **WHEN** a group conversation row includes group avatar metadata
- **THEN** the conversation card SHALL render the group avatar image
- **AND** it SHALL fall back to the group initials or generated group placeholder when no image is available

#### Scenario: Forward dialog shows conversations
- **WHEN** the user opens the message forwarding dialog
- **THEN** conversation choices SHALL render stored peer or group avatars when available
- **AND** fallback avatars SHALL be used when no image is configured
