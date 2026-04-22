## ADDED Requirements

### Requirement: Desktop users can record voice messages
The desktop client SHALL allow an authenticated user in an active conversation to record a voice message from the chat composer.

#### Scenario: Start recording from composer
- **WHEN** the user activates the microphone control in an active desktop conversation
- **THEN** the desktop client requests microphone access if needed
- **AND** the composer enters a voice recording surface when access is granted

#### Scenario: Microphone permission denied
- **WHEN** microphone access is denied or unavailable
- **THEN** the desktop client does not start recording
- **AND** the user sees an actionable permission failure message

#### Scenario: No active conversation
- **WHEN** the user activates the microphone control without an active conversation
- **THEN** the desktop client does not start recording
- **AND** the user is told to select a conversation first

### Requirement: Voice recording follows Telegram Web-style controls
The desktop client SHALL provide a dedicated recording surface with elapsed time, real-time waveform, cancel/delete, preview playback, and explicit send behavior.

#### Scenario: Recording surface displays live status
- **WHEN** voice recording is active
- **THEN** the composer shows elapsed recording time
- **AND** the composer shows a real-time waveform derived from microphone input
- **AND** the composer provides a visible cancel action

#### Scenario: Cancel recording
- **WHEN** the user cancels an active or completed voice recording
- **THEN** the desktop client stops microphone capture if active
- **AND** discards the recorded audio
- **AND** returns the composer to its normal text input state

#### Scenario: Preview before send
- **WHEN** the user stops a valid voice recording before sending
- **THEN** the desktop client allows the user to preview playback
- **AND** the user can delete or send the recording

### Requirement: Voice recording duration is constrained
The desktop client SHALL enforce voice recording duration limits before sending.

#### Scenario: Maximum duration reached
- **WHEN** an active voice recording reaches 60 seconds
- **THEN** the desktop client stops recording automatically
- **AND** presents the recording for preview or sending

#### Scenario: Recording too short
- **WHEN** the user attempts to send a recording shorter than 1 second
- **THEN** the desktop client rejects the voice message
- **AND** tells the user the recording is too short

### Requirement: Voice messages are sent as encrypted media messages
The desktop client SHALL send recorded voice messages as `messageType = 3` encrypted media messages through the existing message send flow.

#### Scenario: Send valid voice recording
- **WHEN** the user sends a valid recorded voice message
- **THEN** the desktop client encrypts the recorded audio before upload
- **AND** uploads the ciphertext as audio media
- **AND** sends a `messageType = 3` message referencing the uploaded media asset

#### Scenario: Voice message does not require text
- **WHEN** a valid recorded voice message is ready to send and the text input is empty
- **THEN** the desktop client allows the message to be sent

#### Scenario: Upload or send failure
- **WHEN** encrypted upload or message send fails for a voice message
- **THEN** the desktop client shows a failed state
- **AND** the user can retry or discard the voice message

### Requirement: Voice message bubbles show waveform playback
The desktop client SHALL render voice messages with duration, waveform, playback progress, and error states.

#### Scenario: Render received voice message
- **WHEN** a conversation contains a voice message with encrypted voice metadata
- **THEN** the desktop client renders a voice bubble with duration and waveform bars

#### Scenario: Play voice message
- **WHEN** the user plays a voice message
- **THEN** the desktop client downloads ciphertext if needed
- **AND** decrypts audio locally
- **AND** plays the decrypted audio
- **AND** updates waveform progress during playback

#### Scenario: Voice playback failure
- **WHEN** voice media download or decryption fails
- **THEN** the desktop client shows a voice-specific failure state
- **AND** does not expose plaintext media data

### Requirement: Voice messages preserve existing message semantics
Voice messages SHALL remain compatible with existing read acknowledgments, burn-after-reading, forwarding, and conversation update behavior.

#### Scenario: Burn voice message playback
- **WHEN** a recipient opens or plays a burn-after-reading voice message
- **THEN** the desktop client applies the existing read-once and burn countdown behavior for media messages

#### Scenario: Forward voice message
- **WHEN** a user forwards a voice message
- **THEN** the forwarded message preserves sufficient encrypted media and voice metadata for the target recipients
- **AND** no voice metadata is sent as plaintext backend fields
