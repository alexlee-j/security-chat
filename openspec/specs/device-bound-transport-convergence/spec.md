# device-bound-transport-convergence Specification

## Purpose
TBD - created by archiving change advance-to-global-completion. Update Purpose after archive.
## Requirements
### Requirement: Direct messaging SHALL use authenticated device-bound envelope delivery
The system SHALL deliver supported direct messages through the device-bound `send-v2` model, where one logical message is accepted with one encrypted envelope per required target device, the backend resolves pending ciphertext only by authenticated device context, and server-side direct envelopes are treated as delivery-queue records rather than durable history. Each device SHALL have a backend-assigned `signal_device_id` that is unique per user and valid for libsignal `DeviceId` construction, while `registration_id` remains the libsignal registration identifier.

#### Scenario: Device registration receives backend-assigned signal_device_id
- **WHEN** a desktop device registers with the backend
- **THEN** the backend SHALL assign a numerical `signal_device_id` in the range 1..=127 that is unique for that user
- **AND** the device SHALL use this `signal_device_id` as the libsignal `DeviceId` in `ProtocolAddress`
- **AND** the device SHALL keep using its libsignal-managed `registration_id` only as the Signal registration identifier

#### Scenario: Backend uses signal_device_id for session storage
- **WHEN** a session is established with a device
- **THEN** the session SHALL be stored using the backend-assigned `signal_device_id` as the libsignal device identifier
- **AND** NOT using a hardcoded or client-generated device ID

#### Scenario: Desktop direct send fans out to recipient and sender devices
- **WHEN** a desktop client sends a direct message after resolving the recipient device list and the sender's own device list
- **THEN** the client SHALL submit one logical `send-v2` request containing one envelope per recipient device and one envelope per sender device used for self-sync

#### Scenario: Device discovery exposes both delivery and Signal identifiers
- **WHEN** the client lists devices, fetches devices by user IDs, or fetches a prekey bundle for a target device
- **THEN** each device response SHALL include `deviceId` as the backend UUID used for authentication, prekey lookup, and send-v2 envelope delivery
- **AND** each device response SHALL include `signalDeviceId` as the 1..=127 value used to construct libsignal `DeviceId`
- **AND** the client SHALL NOT pass the UUID `deviceId` into libsignal `DeviceId::new`

#### Scenario: Prekey bundle carries remote signal_device_id
- **WHEN** a client fetches or peeks a target device's prekey bundle
- **THEN** the response SHALL include the target device's `registration_id` for libsignal registration semantics
- **AND** the response SHALL include the target device's `signal_device_id` for `PreKeyBundle::new` and `ProtocolAddress`
- **AND** Rust `RemotePrekeyBundleDto` SHALL carry both fields without deriving one from the other

#### Scenario: Device-specific pending sync resolves only the authenticated envelope
- **WHEN** an authenticated device requests pending direct envelopes for a conversation containing `send-v2` messages
- **THEN** the backend SHALL return only ciphertext envelopes addressed to that authenticated device and SHALL NOT substitute ciphertext intended for another device

#### Scenario: Persisted device envelope is retired
- **WHEN** an authenticated device acknowledges that a direct-message envelope was decrypted and persisted locally
- **THEN** the backend SHALL delete or mark retired that device's envelope for that message so it is not available as permanent direct-message history

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
The system SHALL preserve sender self-sync and post-login replay behavior for authorized devices using the same device-bound transport model, while direct-message readable history SHALL be replayed from each device's local encrypted store after successful persistence. The device's backend-assigned `signal_device_id` SHALL be persisted locally and used consistently across restarts.

#### Scenario: Desktop restarts and restores signal_device_id
- **WHEN** the desktop client restarts after device registration
- **THEN** the client SHALL restore the `signal_device_id` from local storage
- **AND** use the same `signal_device_id` for all subsequent libsignal `DeviceId` operations

#### Scenario: All Rust direct-message DeviceId construction uses signal_device_id
- **WHEN** Rust establishes sessions, encrypts messages, decrypts messages, or converts a remote prekey bundle
- **THEN** every `ProtocolAddress` and `PreKeyBundle` SHALL be constructed with the relevant backend-assigned `signal_device_id`
- **AND** no direct-message path SHALL construct libsignal `DeviceId` from a hardcoded value or from the backend UUID `deviceId`

#### Scenario: Sender's second device receives self-sync delivery
- **WHEN** a user sends a direct message from one authorized device while another authorized device for that same user later synchronizes pending delivery
- **THEN** the synced device SHALL be able to retrieve, decrypt, locally persist, and acknowledge its own authorized envelope for that message

#### Scenario: Sender's device replays persisted self-sync locally
- **WHEN** a sender device later opens a direct conversation containing self-synced messages it has already persisted
- **THEN** the client SHALL replay those messages from local encrypted history without requesting backend historical direct-message ciphertext

#### Scenario: Missing device context does not trigger unsafe fallback
- **WHEN** a client or token lacks the device context required to resolve a `send-v2` pending envelope
- **THEN** the system SHALL return an explicit error instead of substituting another device's ciphertext or fabricating a default device identity
