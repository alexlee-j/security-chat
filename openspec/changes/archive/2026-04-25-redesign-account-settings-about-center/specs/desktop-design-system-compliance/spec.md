## MODIFIED Requirements

### Requirement: Desktop SHALL respect documented layout constraints
The desktop app SHALL preserve usable layout at the documented minimum window size and SHALL avoid overlapping critical navigation, message, input, and account control-center surfaces.

#### Scenario: Window is at minimum size
- **WHEN** the desktop window is resized to the documented minimum dimensions
- **THEN** the sidebar, chat header, message area, and input area SHALL remain usable without critical controls being clipped

#### Scenario: Account control center is open at supported desktop sizes
- **WHEN** the account control center is open at supported desktop window sizes
- **THEN** the control center SHALL keep its navigation column and content region usable without overlapping its close, back, section navigation, or primary action controls

#### Scenario: Account control center is open at narrow widths
- **WHEN** the account control center is open at a narrow supported window width
- **THEN** the control center SHALL adapt to a full-width or stacked layout so text, controls, and section navigation remain readable and operable

### Requirement: Desktop dialogs SHALL satisfy structural and accessibility contracts
Desktop dialogs and expanded drawer surfaces implemented with shared shadcn/Radix primitives SHALL satisfy required semantic structure and valid DOM hierarchy so runtime warnings do not indicate broken interaction or accessibility contracts.

#### Scenario: Dialog content rendered
- **WHEN** a desktop feature renders a shadcn/Radix dialog content surface
- **THEN** the dialog SHALL include a valid dialog title semantic
- **AND** the dialog implementation SHALL avoid invalid nested form structures

#### Scenario: User interacts with dialog form actions
- **WHEN** the user submits or searches within dialog form controls
- **THEN** the dialog implementation SHALL use valid, non-nested form boundaries
- **AND** the interaction SHALL NOT trigger React DOM nesting warnings related to form containment

#### Scenario: Account control center rendered
- **WHEN** the account control center is rendered as an overlay
- **THEN** it SHALL expose a valid accessible title, keyboard dismissal, focus management, and close control through shared primitives or a standardized shared extension
