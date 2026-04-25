## ADDED Requirements

### Requirement: Desktop SHALL provide an expanded account control center from the navigation drawer
The desktop app SHALL preserve the existing left navigation drawer and SHALL expand it into a larger account control center when the user selects personal center, settings, or about.

#### Scenario: User opens personal center from drawer
- **WHEN** the authenticated user opens the left navigation drawer and selects personal center
- **THEN** the desktop app SHALL expand the left-origin drawer into an account control center
- **AND** the control center SHALL show the personal center content without opening a right-side sheet

#### Scenario: User switches control center section
- **WHEN** the account control center is open and the user selects personal center, settings, or about from its navigation column
- **THEN** the desktop app SHALL keep the control center open
- **AND** the content region SHALL update to the selected section

#### Scenario: User dismisses control center
- **WHEN** the account control center is open and the user activates close or presses Escape
- **THEN** the desktop app SHALL close the account control center and return focus to the main workspace navigation entry point

### Requirement: Personal center SHALL show account identity and current device status
The personal center content SHALL present account identity, avatar state, current device/security state, and account actions using product-facing copy.

#### Scenario: User views account identity
- **WHEN** the user opens personal center
- **THEN** the desktop app SHALL show the user's avatar area, username, login/online state, user ID, and a copy user ID action

#### Scenario: Avatar upload affordance is reserved
- **WHEN** the user views the avatar area in personal center
- **THEN** the desktop app SHALL present an avatar upload/change affordance in or near the avatar area
- **AND** if avatar upload persistence is not supported by available APIs, the affordance SHALL be disabled or clearly marked unavailable without starting an upload flow

#### Scenario: User views device and security status
- **WHEN** the user opens personal center
- **THEN** the desktop app SHALL show current session/device status and encryption/security status using available client state

### Requirement: Settings SHALL present supported preferences as structured sections
The settings content SHALL present supported preferences as structured sections and SHALL include notification settings and display mode controls.

#### Scenario: User opens settings
- **WHEN** the user opens settings from the account control center
- **THEN** the desktop app SHALL show a structured settings surface with notification controls as a supported section
- **AND** the desktop app SHALL NOT show large "future settings" roadmap cards as primary content

#### Scenario: User changes display mode
- **WHEN** the user changes display mode from settings
- **THEN** the desktop app SHALL apply the selected light, dark, or system display mode consistently with the existing theme behavior

### Requirement: About SHALL present product and trust information
The about content SHALL present product identity, version, security capabilities, license, and copyright without exposing implementation framework details.

#### Scenario: User opens about
- **WHEN** the user opens about from the account control center
- **THEN** the desktop app SHALL show Security Chat product identity, desktop version, security capability summaries, license, and copyright
- **AND** the about content SHALL NOT show framework stack details such as Tauri, React, Vite, or shadcn-ui as user-facing build information
