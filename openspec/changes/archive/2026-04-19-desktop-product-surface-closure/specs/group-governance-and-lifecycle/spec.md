## MODIFIED Requirements

### Requirement: Group conversations SHALL support managed group metadata
The system SHALL allow authorized users to read and update group metadata such as group name, avatar, and descriptive information through supported APIs and UI, and the desktop app SHALL expose those supported metadata actions through a group product surface.

#### Scenario: Authorized user updates group profile
- **WHEN** a user with group-management permission updates the group name or avatar
- **THEN** the system SHALL persist the new metadata and expose it to current group members

#### Scenario: Unauthorized user cannot modify group profile
- **WHEN** a user without group-management permission attempts to update group metadata
- **THEN** the system SHALL reject the request and SHALL NOT mutate the stored group profile

#### Scenario: Desktop user opens group profile surface
- **WHEN** a desktop user opens a group conversation profile or management surface
- **THEN** the desktop app SHALL show supported group metadata and available management actions according to the user's permissions

### Requirement: Group lifecycle events SHALL be visible to affected users
The system SHALL emit or persist group lifecycle events so that members can understand material group changes such as rename, invite, leave, remove, and rejoin, and the desktop app SHALL render those lifecycle events or equivalent visible state.

#### Scenario: Membership change appears in conversation history or equivalent UI
- **WHEN** a membership-changing group event occurs
- **THEN** the system SHALL make that event visible to the affected members through supported group surfaces

#### Scenario: Rejoined member sees current membership state only
- **WHEN** a previously removed or departed member is added back to a group
- **THEN** the system SHALL expose the rejoined member to the current active membership state and current cryptographic lifecycle rules rather than silently restoring undefined prior state

#### Scenario: Desktop renders removed member state
- **WHEN** a desktop user has been removed from a group
- **THEN** the desktop app SHALL prevent future participation actions and explain the user's current group state
