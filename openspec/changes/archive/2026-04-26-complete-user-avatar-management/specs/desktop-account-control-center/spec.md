## MODIFIED Requirements

### Requirement: Personal center SHALL show account identity and current device status
The personal center content SHALL present account identity, a supported avatar change flow, current device/security state, and account actions using product-facing copy.

#### Scenario: User views account identity
- **WHEN** the user opens personal center
- **THEN** the desktop app SHALL show the user's avatar area, username, login/online state, user ID, and a copy user ID action

#### Scenario: User changes avatar from personal center
- **WHEN** the user activates the avatar upload/change affordance in personal center and selects a supported image
- **THEN** the desktop app SHALL compress the selected image before upload
- **AND** the desktop app SHALL submit the compressed avatar through the supported profile avatar update API
- **AND** the personal center SHALL show loading, success, and failure states for the avatar update flow

#### Scenario: User views device and security status
- **WHEN** the user opens personal center
- **THEN** the desktop app SHALL show current session/device status and encryption/security status using available client state
