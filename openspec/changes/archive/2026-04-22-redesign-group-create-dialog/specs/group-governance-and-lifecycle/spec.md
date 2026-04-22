## ADDED Requirements

### Requirement: Desktop group creation and management surfaces SHALL remain operable at supported desktop sizes
The desktop app SHALL keep group creation and group management controls reachable and readable within supported desktop window sizes, including smaller-height windows where content overflow occurs.

#### Scenario: Dialog content exceeds viewport height
- **WHEN** the group creation or management content is taller than the available dialog viewport
- **THEN** the desktop app SHALL provide a usable scrollable content region
- **AND** users SHALL still be able to reach primary action controls without hidden or clipped mandatory fields

#### Scenario: User manages group members in dialog
- **WHEN** the user performs member search, add, or remove operations in the group management tab
- **THEN** the desktop app SHALL keep those controls visible and actionable without overlapping sidebar or chat-thread surfaces
