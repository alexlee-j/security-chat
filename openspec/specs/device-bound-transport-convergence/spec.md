# device-bound-transport-convergence Specification

## Purpose
TBD - created by archiving change advance-to-global-completion. Update Purpose after archive.
## Requirements
### Requirement: Direct messaging SHALL use authenticated device-bound envelope delivery
The system SHALL deliver supported direct messages through the device-bound `send-v2` model, where one logical message is stored with one encrypted envelope per target device, the backend resolves ciphertext by authenticated device context, and client-side replay/retry behavior does not bypass this contract.

#### Scenario: Desktop direct send fans out to recipient and sender devices
- **WHEN** a desktop client sends a direct message after resolving the recipient device list and the sender's own device list
- **THEN** the client SHALL submit one logical `send-v2` request containing one envelope per recipient device and one envelope per sender device used for self-sync

#### Scenario: Device-specific reads resolve only the authenticated envelope
- **WHEN** an authenticated device requests message history for a conversation containing `send-v2` messages
- **THEN** the backend SHALL return the ciphertext envelope addressed to that authenticated device and SHALL NOT substitute ciphertext intended for another device

#### Scenario: Retry preserves device-bound semantics
- **WHEN** a supported client retries a failed direct message
- **THEN** the retry path SHALL reuse or regenerate envelopes in a way that still targets the correct authenticated device set rather than falling back to a legacy single-ciphertext path

### Requirement: Legacy direct-message send paths SHALL be deprecated and blocked from bypassing device-bound guarantees
The system SHALL prevent supported direct-message traffic from using legacy single-ciphertext send paths that bypass per-device envelope storage and authenticated device resolution.

#### Scenario: Legacy socket direct send is rejected or removed
- **WHEN** a supported client attempts to send a direct message through the legacy WebSocket `message.send` path
- **THEN** the system SHALL reject the request or remove the path so that the message cannot bypass `send-v2`

#### Scenario: Compatibility fallbacks are removed only after regression gates pass
- **WHEN** implementation removes device/session fallback branches that mask transport mismatches
- **THEN** the change SHALL only proceed after backend, desktop, and real-account direct-message regressions are green

### Requirement: Device-bound direct messaging SHALL support deterministic self-sync and replay
The system SHALL preserve sender self-sync and post-login replay behavior for authorized devices using the same device-bound transport model.

#### Scenario: Sender's second device receives self-sync history
- **WHEN** a user sends a direct message from one authorized device while another authorized device for that same user later syncs the conversation
- **THEN** the synced device SHALL be able to retrieve and decrypt its own authorized envelope for that message

#### Scenario: Missing device context does not trigger unsafe fallback
- **WHEN** a client or token lacks the device context required to resolve a `send-v2` message
- **THEN** the system SHALL return an explicit error instead of substituting another device's ciphertext or fabricating a default device identity

