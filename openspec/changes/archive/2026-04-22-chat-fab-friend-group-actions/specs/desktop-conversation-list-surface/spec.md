## ADDED Requirements

### Requirement: Desktop conversation list SHALL expose in-place FAB quick actions
The desktop app SHALL provide FAB quick actions for add-friend and new-group creation on the chat workspace without forcing a workspace switch before the action opens.

#### Scenario: User chooses add friend from FAB
- **WHEN** the user selects add-friend from the FAB menu while on the chat workspace
- **THEN** the desktop app SHALL open the add-friend dialog on the current page
- **AND** the user SHALL remain in the chat workspace

#### Scenario: User chooses new group from FAB
- **WHEN** the user selects new-group from the FAB menu while on the chat workspace
- **THEN** the desktop app SHALL open the group creation dialog on the current page
- **AND** the user SHALL remain in the chat workspace
