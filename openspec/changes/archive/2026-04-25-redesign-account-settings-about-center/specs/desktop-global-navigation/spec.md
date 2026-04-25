## MODIFIED Requirements

### Requirement: Desktop SHALL provide complete global navigation surfaces
The desktop app SHALL provide a single navigation drawer that exposes supported global destinations and account actions across chat and friend workspaces without leaving users in dead-end UI states. Profile, settings, and about SHALL render inside a left-origin expanded drawer/control-center surface rather than opening right-side sheets.

#### Scenario: User opens navigation drawer
- **WHEN** the user activates the sidebar menu button from either the chat workspace or the friend center
- **THEN** the desktop app SHALL open the same navigation drawer containing theme controls, profile, settings, about, and logout actions

#### Scenario: User navigates to global page
- **WHEN** the user selects profile, settings, or about from the navigation drawer
- **THEN** the desktop app SHALL expand the left navigation drawer into the documented control-center surface
- **AND** the selected profile, settings, or about content SHALL display inside that expanded surface
- **AND** the desktop app SHALL NOT open a right-side sheet for profile, settings, or about
