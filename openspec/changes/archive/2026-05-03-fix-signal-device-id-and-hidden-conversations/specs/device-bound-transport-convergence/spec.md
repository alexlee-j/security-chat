## MODIFIED Requirements

### Requirement: Direct messaging SHALL use authenticated device-bound envelope delivery

**MODIFIED FROM:** The system SHALL deliver supported direct messages through the device-bound `send-v2` model, where one logical message is accepted with one encrypted envelope per required target device, the backend resolves pending ciphertext only by authenticated device context, and server-side direct envelopes are treated as delivery-queue records rather than durable history.

**TO:** The system SHALL deliver supported direct messages through the device-bound `send-v2` model, where one logical message is accepted with one encrypted envelope per required target device, the backend resolves pending ciphertext only by authenticated device context, and server-side direct envelopes are treated as delivery-queue records rather than durable history. Each device SHALL have a backend-assigned `signal_device_id` that is unique per user and valid for libsignal `DeviceId` construction, while `registration_id` remains the libsignal registration identifier.

#### Scenario: Device registration receives backend-assigned signal_device_id
- **WHEN** a desktop device registers with the backend
- **THEN** the backend SHALL assign a numerical `signal_device_id` in the range 1..=127 that is unique for that user
- **AND** the device SHALL use this `signal_device_id` as the libsignal `DeviceId` in `ProtocolAddress`
- **AND** the device SHALL keep using its libsignal-managed `registration_id` only as the Signal registration identifier

#### Scenario: Backend uses signal_device_id for session storage
- **WHEN** a session is established with a device
- **THEN** the session SHALL be stored using the backend-assigned `signal_device_id` as the libsignal device identifier
- **AND** NOT using a hardcoded or client-generated device ID

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

### Requirement: Device-bound direct messaging SHALL support deterministic self-sync and replay

**MODIFIED FROM:** The system SHALL preserve sender self-sync and post-login replay behavior for authorized devices using the same device-bound transport model, while direct-message readable history SHALL be replayed from each device's local encrypted store after successful persistence.

**TO:** The system SHALL preserve sender self-sync and post-login replay behavior for authorized devices using the same device-bound transport model, while direct-message readable history SHALL be replayed from each device's local encrypted store after successful persistence. The device's backend-assigned `signal_device_id` SHALL be persisted locally and used consistently across restarts.

#### Scenario: Desktop restarts and restores signal_device_id
- **WHEN** the desktop client restarts after device registration
- **THEN** the client SHALL restore the `signal_device_id` from local storage
- **AND** use the same `signal_device_id` for all subsequent libsignal `DeviceId` operations

#### Scenario: All Rust direct-message DeviceId construction uses signal_device_id
- **WHEN** Rust establishes sessions, encrypts messages, decrypts messages, or converts a remote prekey bundle
- **THEN** every `ProtocolAddress` and `PreKeyBundle` SHALL be constructed with the relevant backend-assigned `signal_device_id`
- **AND** no direct-message path SHALL construct libsignal `DeviceId` from a hardcoded value or from the backend UUID `deviceId`
