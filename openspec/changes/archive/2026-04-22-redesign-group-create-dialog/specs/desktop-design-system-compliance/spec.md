## ADDED Requirements

### Requirement: Desktop dialogs SHALL satisfy structural and accessibility contracts
Desktop dialogs implemented with shared shadcn/Radix primitives SHALL satisfy required semantic structure and valid DOM hierarchy so runtime warnings do not indicate broken interaction or accessibility contracts.

#### Scenario: Dialog content rendered
- **WHEN** a desktop feature renders a shadcn/Radix dialog content surface
- **THEN** the dialog SHALL include a valid dialog title semantic
- **AND** the dialog implementation SHALL avoid invalid nested form structures

#### Scenario: User interacts with dialog form actions
- **WHEN** the user submits or searches within dialog form controls
- **THEN** the dialog implementation SHALL use valid, non-nested form boundaries
- **AND** the interaction SHALL NOT trigger React DOM nesting warnings related to form containment
