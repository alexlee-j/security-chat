## ADDED Requirements

### Requirement: Voice message metadata is encrypted with media payloads
The system SHALL deliver voice-message duration, waveform, waveform version, and codec metadata only inside Signal-encrypted message payloads.

#### Scenario: Direct voice media payload
- **WHEN** a direct voice message is sent
- **THEN** every target device envelope contains encrypted media metadata
- **AND** every target device envelope contains encrypted voice metadata
- **AND** voice duration, waveform, waveform version, and codec are not sent as plaintext backend fields

#### Scenario: Group voice media payload
- **WHEN** a group voice message is sent
- **THEN** the group encrypted payload contains encrypted media metadata
- **AND** the group encrypted payload contains encrypted voice metadata
- **AND** voice duration, waveform, waveform version, and codec are not sent as plaintext backend fields

#### Scenario: Voice waveform renders before media download
- **WHEN** a recipient lists a conversation containing an encrypted voice message
- **THEN** the client can render duration and waveform from the decrypted message payload
- **AND** the client does not need to download the audio ciphertext before rendering the initial voice bubble
