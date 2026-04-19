## MODIFIED Requirements

### Requirement: Notification generation SHALL respect effective user notification settings
The system SHALL evaluate user notification settings before creating or emitting message, friend-request, burn, group-governance, account-recovery, security-event, or related notifications so disabled notification classes do not create unread noise or inconsistent summaries.

#### Scenario: Disabled notification type is not created
- **WHEN** a notification-producing event occurs for a user who has disabled that notification type
- **THEN** the backend SHALL NOT persist a notification record for that event

#### Scenario: Enabled notification type remains visible and countable
- **WHEN** a notification-producing event occurs for a user who has that notification type enabled
- **THEN** the backend SHALL create the notification and include it in unread counts and summaries

## ADDED Requirements

### Requirement: Sensitive account and group lifecycle events SHALL have explicit notification semantics
The system SHALL define whether password reset, login recovery, group invite, group removal, and comparable lifecycle events create notifications, and SHALL apply those rules consistently across backend and supported clients.

#### Scenario: Password recovery event follows declared notification policy
- **WHEN** a password recovery or password-reset-complete event occurs
- **THEN** the system SHALL either create or suppress the notification according to the configured security-event policy rather than using an implicit default

#### Scenario: Group lifecycle event follows declared notification policy
- **WHEN** a group invite, removal, leave, or rejoin event occurs for an affected user
- **THEN** the system SHALL evaluate the relevant notification setting before creating unread state for that lifecycle event
