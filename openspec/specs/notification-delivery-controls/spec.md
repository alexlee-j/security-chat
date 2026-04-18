# notification-delivery-controls Specification

## Purpose
TBD - created by archiving change advance-to-global-completion. Update Purpose after archive.
## Requirements
### Requirement: Notification generation SHALL respect effective user notification settings
The system SHALL evaluate user notification settings before creating or emitting message, friend-request, burn, or related notifications so disabled notification classes do not create unread noise or inconsistent summaries.

#### Scenario: Disabled notification type is not created
- **WHEN** a notification-producing event occurs for a user who has disabled that notification type
- **THEN** the backend SHALL NOT persist a notification record for that event

#### Scenario: Enabled notification type remains visible and countable
- **WHEN** a notification-producing event occurs for a user who has that notification type enabled
- **THEN** the backend SHALL create the notification and include it in unread counts and summaries

### Requirement: Notification settings SHALL be user-configurable through supported APIs and UI
The system SHALL expose notification settings through backend APIs and desktop UI so users can inspect and update their effective notification policy.

#### Scenario: User reads current notification settings
- **WHEN** an authenticated user requests notification settings
- **THEN** the system SHALL return the effective setting values used by notification generation

#### Scenario: User updates notification settings
- **WHEN** an authenticated user changes notification settings through the supported UI or API
- **THEN** the new values SHALL be persisted and applied to subsequent notification events

