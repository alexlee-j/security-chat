## MODIFIED Requirements

### Requirement: Notification settings SHALL be user-configurable through supported APIs and UI
The system SHALL expose notification settings through backend APIs and desktop UI so users can inspect and update their effective notification policy, and the desktop settings surface SHALL show all notification categories supported by the backend.

#### Scenario: User reads current notification settings
- **WHEN** an authenticated user requests notification settings
- **THEN** the system SHALL return the effective setting values used by notification generation

#### Scenario: User updates notification settings
- **WHEN** an authenticated user changes notification settings through the supported UI or API
- **THEN** the new values SHALL be persisted and applied to subsequent notification events

#### Scenario: Desktop settings reflect backend effective values
- **WHEN** the desktop user opens notification settings
- **THEN** the desktop app SHALL display the effective backend values for message, friend request, burn, group, account recovery, and security-event notification categories that are supported in this release
