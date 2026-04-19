## ADDED Requirements

### Requirement: Group conversations SHALL support managed group metadata
The system SHALL allow authorized users to read and update group metadata such as group name, avatar, and descriptive information through supported APIs and UI.

#### Scenario: Authorized user updates group profile
- **WHEN** a user with group-management permission updates the group name or avatar
- **THEN** the system SHALL persist the new metadata and expose it to current group members

#### Scenario: Unauthorized user cannot modify group profile
- **WHEN** a user without group-management permission attempts to update group metadata
- **THEN** the system SHALL reject the request and SHALL NOT mutate the stored group profile

### Requirement: Group membership SHALL follow explicit governance rules
The system SHALL define who can invite, remove, leave, and re-add members, and SHALL surface the resulting membership state consistently across backend and supported clients.

#### Scenario: Member is removed from group
- **WHEN** an authorized actor removes a member from a group
- **THEN** the system SHALL persist the membership change and SHALL show the removed member a state that prevents future participation in that group

#### Scenario: Member leaves voluntarily
- **WHEN** a member chooses to leave a group
- **THEN** the system SHALL remove that member from the active membership set and SHALL update the remaining members' visible group state

### Requirement: Group lifecycle events SHALL be visible to affected users
The system SHALL emit or persist group lifecycle events so that members can understand material group changes such as rename, invite, leave, remove, and rejoin.

#### Scenario: Membership change appears in conversation history or equivalent UI
- **WHEN** a membership-changing group event occurs
- **THEN** the system SHALL make that event visible to the affected members through supported group surfaces

#### Scenario: Rejoined member sees current membership state only
- **WHEN** a previously removed or departed member is added back to a group
- **THEN** the system SHALL expose the rejoined member to the current active membership state and current cryptographic lifecycle rules rather than silently restoring undefined prior state
