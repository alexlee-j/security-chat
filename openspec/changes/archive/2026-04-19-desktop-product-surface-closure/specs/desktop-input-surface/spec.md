## ADDED Requirements

### Requirement: Desktop input surface SHALL support documented composition states
The desktop app SHALL represent empty, text, quoted, attachment, and sending states in the message input area according to the documented interaction model.

#### Scenario: User composes text message
- **WHEN** the user enters text into the message input
- **THEN** the send action SHALL become available and sending SHALL clear the input only after the message is accepted into the local delivery lifecycle

#### Scenario: User quotes a message
- **WHEN** the user selects quote from a message action
- **THEN** the input area SHALL show the quoted context and SHALL include that quote state in the next supported send action

### Requirement: Desktop input surface SHALL support emoji and attachments
The desktop app SHALL let users insert emoji and select supported attachments without corrupting the current composed message state.

#### Scenario: User inserts emoji
- **WHEN** the user selects an emoji from the emoji picker
- **THEN** the emoji SHALL be inserted into the current input text without clearing existing text or quote state

#### Scenario: User selects attachment
- **WHEN** the user selects a supported file attachment
- **THEN** the desktop app SHALL show a preview or file summary and SHALL send it through the supported media message path

### Requirement: Desktop recording entry SHALL be explicit about support level
The desktop app SHALL either provide a working recording flow or clearly disable/explain the recording entry if full recording support is not implemented in this release.

#### Scenario: Recording is unsupported
- **WHEN** full recording support is not implemented
- **THEN** the microphone entry SHALL be hidden, disabled, or display a clear unavailable state rather than silently failing
