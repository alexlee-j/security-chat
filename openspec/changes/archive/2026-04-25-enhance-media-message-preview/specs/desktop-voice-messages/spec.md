## MODIFIED Requirements

### Requirement: Voice message bubbles show waveform playback
The desktop client SHALL render voice messages with duration, waveform, seekable playback progress, pause/resume control, and error states.

#### Scenario: Render received voice message
- **WHEN** a conversation contains a voice message with encrypted voice metadata
- **THEN** the desktop client renders a voice bubble with duration and waveform bars

#### Scenario: Play voice message
- **WHEN** the user plays a voice message
- **THEN** the desktop client downloads ciphertext if needed
- **AND** decrypts audio locally
- **AND** plays the decrypted audio
- **AND** updates waveform progress during playback
- **AND** displays a pause control while the voice message is playing

#### Scenario: Pause and resume voice message
- **WHEN** the user activates the playing voice message control
- **THEN** the desktop client pauses playback without resetting progress
- **AND** activating the same voice message again resumes playback from the paused position

#### Scenario: Seek voice message by dragging progress
- **WHEN** the user drags or clicks the voice message progress control
- **THEN** the desktop client seeks the active audio playback position to the selected progress
- **AND** the waveform progress display reflects the selected position

#### Scenario: Seek paused voice message
- **WHEN** a voice message is paused and the user changes the progress position
- **THEN** the desktop client updates the paused playback position
- **AND** the next resume starts from the selected position

#### Scenario: Voice playback failure
- **WHEN** voice media download or decryption fails
- **THEN** the desktop client shows a voice-specific failure state
- **AND** does not expose plaintext media data
