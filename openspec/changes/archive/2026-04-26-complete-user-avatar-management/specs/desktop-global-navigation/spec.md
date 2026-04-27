## ADDED Requirements

### Requirement: Navigation drawer SHALL render the current user's stored avatar
The desktop navigation drawer SHALL render the authenticated user's stored avatar in the identity header when available and SHALL update it after a successful avatar change.

#### Scenario: User opens drawer with configured avatar
- **WHEN** the authenticated user opens the navigation drawer and their profile includes `avatarUrl`
- **THEN** the drawer identity header SHALL render the stored avatar image
- **AND** the drawer SHALL preserve initials fallback if the image cannot be rendered

#### Scenario: User updates avatar while drawer profile state is cached
- **WHEN** the current user successfully updates their avatar from personal center
- **THEN** the navigation drawer profile state SHALL refresh or be updated with the new `avatarUrl`
- **AND** reopening the drawer SHALL show the updated avatar without logout or app restart
