# account-recovery-and-auth-hardening Specification

## Purpose
TBD - created by archiving change security-chat-v2-closed-loop. Update Purpose after archive.
## Requirements
### Requirement: Registration SHALL enforce an explicit password security policy
The system SHALL reject registrations that do not satisfy the 2.0 password policy and SHALL expose the same validation semantics through backend API and supported clients.

#### Scenario: Weak password is rejected during registration
- **WHEN** a user submits a registration request with a password that violates the configured minimum strength policy
- **THEN** the backend SHALL reject the request with a validation error and the client SHALL surface the rejection without silently downgrading the rule

#### Scenario: Supported client shows password policy before submit
- **WHEN** a user enters a password on a supported registration UI
- **THEN** the client SHALL present the password policy or failing rule state before the registration request is submitted

### Requirement: The system SHALL provide a complete forgot-password and reset-password flow
The system SHALL allow a user to request password recovery, verify the recovery proof, and set a new password through a supported flow.

#### Scenario: User requests password reset
- **WHEN** a registered user requests password recovery with a valid account identifier
- **THEN** the backend SHALL generate and deliver a recovery proof through the configured recovery channel

#### Scenario: User resets password with valid proof
- **WHEN** a user submits a valid recovery proof and a new password that satisfies policy
- **THEN** the system SHALL update the password and mark the recovery proof as consumed

### Requirement: Password reset SHALL trigger explicit session and device recovery behavior
The system SHALL define what happens to active sessions and device-bound authentication state after a password reset so that recovery does not leave stale privileged sessions in an undefined state.

#### Scenario: Refresh tokens are invalidated after password reset
- **WHEN** a password reset succeeds
- **THEN** the system SHALL invalidate outstanding refresh tokens according to the defined recovery policy

#### Scenario: Client is required to re-authenticate after password reset
- **WHEN** a device continues using credentials or tokens that were issued before a password reset and are no longer valid
- **THEN** the system SHALL return an explicit authentication recovery error and the client SHALL redirect the user to re-authenticate

