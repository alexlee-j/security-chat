## MODIFIED Requirements

### Requirement: Desktop SHALL provide complete global navigation surfaces
The desktop app SHALL provide a single navigation drawer that exposes supported global destinations and account actions across chat and friend workspaces without leaving users in dead-end UI states.

#### Scenario: User opens navigation drawer
- **WHEN** the user activates the sidebar menu button from either the chat workspace or the friend center
- **THEN** the desktop app SHALL open the same navigation drawer containing theme controls, profile, settings, about, and logout actions

#### Scenario: User navigates to global page
- **WHEN** the user selects profile, settings, or about from the navigation drawer
- **THEN** the desktop app SHALL display the selected supported page or sheet and close or preserve the drawer according to the documented interaction

### Requirement: Desktop SHALL confirm logout before clearing account state
The desktop app SHALL ask for confirmation before logging out and SHALL clear authenticated local state only after confirmation.

#### Scenario: User cancels logout
- **WHEN** the user selects logout and then cancels the confirmation dialog
- **THEN** the desktop app SHALL keep the current authenticated session active

#### Scenario: User confirms logout
- **WHEN** the user confirms logout
- **THEN** the desktop app SHALL clear authenticated state and return to the login surface
