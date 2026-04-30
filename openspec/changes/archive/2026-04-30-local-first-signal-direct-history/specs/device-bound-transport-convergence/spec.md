## MODIFIED Requirements

### Requirement: Direct messaging SHALL use authenticated device-bound envelope delivery
The system SHALL deliver supported direct messages through the device-bound `send-v2` model, where one logical message is accepted with one encrypted envelope per required target device, the backend resolves pending ciphertext only by authenticated device context, and server-side direct envelopes are treated as delivery-queue records rather than durable history.

#### Scenario: Desktop direct send fans out to recipient and sender devices
- **WHEN** a desktop client sends a direct message after resolving the recipient device list and the sender's own device list
- **THEN** the client SHALL submit one logical `send-v2` request containing one envelope per recipient device and one envelope per sender device used for self-sync

#### Scenario: Device-specific pending sync resolves only the authenticated envelope
- **WHEN** an authenticated device requests pending direct envelopes for a conversation containing `send-v2` messages
- **THEN** the backend SHALL return only ciphertext envelopes addressed to that authenticated device and SHALL NOT substitute ciphertext intended for another device

#### Scenario: Persisted device envelope is retired
- **WHEN** an authenticated device acknowledges that a direct-message envelope was decrypted and persisted locally
- **THEN** the backend SHALL delete or mark retired that device's envelope for that message so it is not available as permanent direct-message history

#### Scenario: Retry preserves device-bound semantics
- **WHEN** a supported client retries a failed direct message
- **THEN** the retry path SHALL reuse or regenerate envelopes in a way that still targets the correct authenticated device set rather than falling back to a legacy single-ciphertext path

### Requirement: Device-bound direct messaging SHALL support deterministic self-sync and replay
The system SHALL preserve sender self-sync and post-login replay behavior for authorized devices using the same device-bound transport model, while direct-message readable history SHALL be replayed from each device's local encrypted store after successful persistence.

#### Scenario: Sender's second device receives self-sync delivery
- **WHEN** a user sends a direct message from one authorized device while another authorized device for that same user later synchronizes pending delivery
- **THEN** the synced device SHALL be able to retrieve, decrypt, locally persist, and acknowledge its own authorized envelope for that message

#### Scenario: Sender's device replays persisted self-sync locally
- **WHEN** a sender device later opens a direct conversation containing self-synced messages it has already persisted
- **THEN** the client SHALL replay those messages from local encrypted history without requesting backend historical direct-message ciphertext

#### Scenario: Missing device context does not trigger unsafe fallback
- **WHEN** a client or token lacks the device context required to resolve a `send-v2` pending envelope
- **THEN** the system SHALL return an explicit error instead of substituting another device's ciphertext or fabricating a default device identity
