# notification-delivery-controls Specification

## Purpose
TBD - created by archiving change advance-to-global-completion. Update Purpose after archive.
## Requirements
### Requirement: Notification generation SHALL respect effective user notification settings
The system SHALL evaluate user notification settings before creating or emitting message, friend-request, burn, group-governance, account-recovery, security-event, or related notifications so disabled notification classes do not create unread noise or inconsistent summaries.

#### Scenario: Disabled notification type is not created
- **WHEN** a notification-producing event occurs for a user who has disabled that notification type
- **THEN** the backend SHALL NOT persist a notification record for that event

#### Scenario: Enabled notification type remains visible and countable
- **WHEN** a notification-producing event occurs for a user who has that notification type enabled
- **THEN** the backend SHALL create the notification and include it in unread counts and summaries

### Requirement: Notification settings SHALL be user-configurable through supported APIs and UI
The system SHALL expose notification settings through backend APIs and the redesigned desktop account control center so users can inspect and update their effective notification policy, and the desktop settings surface SHALL show all notification categories supported by the backend.

#### Scenario: User reads current notification settings
- **WHEN** an authenticated user requests notification settings
- **THEN** the system SHALL return the effective setting values used by notification generation

#### Scenario: User updates notification settings
- **WHEN** an authenticated user changes notification settings through the supported UI or API
- **THEN** the new values SHALL be persisted and applied to subsequent notification events

#### Scenario: Desktop settings reflect backend effective values
- **WHEN** the desktop user opens notification settings from the account control center
- **THEN** the desktop app SHALL display the effective backend values for message, friend request, burn, group, account recovery, and security-event notification categories that are supported in this release

### Requirement: Sensitive account and group lifecycle events SHALL have explicit notification semantics
The system SHALL define whether password reset, login recovery, group invite, group removal, and comparable lifecycle events create notifications, and SHALL apply those rules consistently across backend and supported clients.

#### Scenario: Password recovery event follows declared notification policy
- **WHEN** a password recovery or password-reset-complete event occurs
- **THEN** the system SHALL either create or suppress the notification according to the configured security-event policy rather than using an implicit default

#### Scenario: Group lifecycle event follows declared notification policy
- **WHEN** a group invite, removal, leave, or rejoin event occurs for an affected user
- **THEN** the system SHALL evaluate the relevant notification setting before creating unread state for that lifecycle event

