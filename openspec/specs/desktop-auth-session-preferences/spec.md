# desktop-auth-session-preferences Specification

## Purpose
TBD - created by archiving change desktop-auth-friend-center-refactor. Update Purpose after archive.
## Requirements
### Requirement: Login preference state SHALL remain synchronized
The desktop login form SHALL keep remember-password and auto-login preferences synchronized with persisted auth storage so the visible form state matches the actual login behavior.

#### Scenario: User enables auto login
- **WHEN** the user enables auto login on the login screen
- **THEN** the desktop app SHALL also enable remember password for the same account session

#### Scenario: User disables remember password
- **WHEN** the user disables remember password on the login screen
- **THEN** the desktop app SHALL disable auto login for that session as well

#### Scenario: Login screen reflects stored preferences
- **WHEN** the user returns to the login screen after the app restores persisted auth preferences
- **THEN** the login form SHALL display the persisted remember-password and auto-login states without requiring a manual toggle

### Requirement: Stored credentials SHALL hydrate the login form
The desktop app SHALL restore stored account credentials into the login form when they are available and valid.

#### Scenario: Stored credentials exist
- **WHEN** persisted credentials are available for the current account
- **THEN** the login form SHALL prefill the account field and the password field with the stored values

#### Scenario: Auto login can run from hydrated state
- **WHEN** auto login is enabled and stored credentials are valid
- **THEN** the app SHALL be able to initiate login using the hydrated form state without requiring the user to re-enter the values

