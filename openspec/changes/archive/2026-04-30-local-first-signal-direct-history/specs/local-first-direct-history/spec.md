## ADDED Requirements

### Requirement: Direct chat history SHALL be local-first
Supported desktop direct-chat clients SHALL render readable conversation history from the local device store first and SHALL NOT require backend historical ciphertext retrieval to open an existing direct conversation.

#### Scenario: Previously used desktop opens direct conversation
- **WHEN** a logged-in desktop device opens a direct conversation that has readable messages already persisted locally
- **THEN** the client SHALL render those local messages before making any network request for pending remote delivery

#### Scenario: Backend is unavailable during direct history replay
- **WHEN** a logged-in desktop device opens a direct conversation while the backend is unavailable
- **THEN** the client SHALL still render locally persisted readable direct-message history for that conversation

#### Scenario: Local store is empty on a newly linked device
- **WHEN** a newly linked desktop device opens an existing direct conversation with no local history and no pending envelopes addressed to that device
- **THEN** the client SHALL show no old direct-message history from the backend and SHALL NOT attempt to recover old direct-message ciphertext through `/message/list`

### Requirement: Pending direct envelopes SHALL be synchronized after local replay
Supported desktop direct-chat clients SHALL fetch only pending server-side direct envelopes addressed to the authenticated device after local history replay has started or completed.

#### Scenario: Device reconnects with pending envelopes
- **WHEN** a desktop device reconnects after direct messages were sent to it while offline
- **THEN** the client SHALL fetch pending envelopes addressed to its authenticated device, decrypt them, persist them locally, and merge them into the active conversation view

#### Scenario: Direct envelope is not locally persisted
- **WHEN** a desktop device fetches a pending direct envelope but fails to decrypt or save it locally
- **THEN** the client SHALL NOT acknowledge that envelope as persisted and the backend SHALL keep it pending for that device

#### Scenario: Direct envelope is locally persisted
- **WHEN** a desktop device decrypts a pending direct envelope and successfully writes it to the local encrypted message store
- **THEN** the client SHALL acknowledge persisted delivery for that message and device

### Requirement: Local direct-message history SHALL be encrypted at rest
The desktop local store SHALL protect persisted direct-message readable content with a device-local encryption key that is not stored in plaintext alongside the message database.

#### Scenario: Desktop persists decrypted direct message
- **WHEN** the desktop client saves decrypted direct-message content to the local store
- **THEN** the stored representation SHALL be encrypted at rest using a key available only to the local device context

#### Scenario: Desktop restores direct message
- **WHEN** the desktop client reads a locally persisted direct message
- **THEN** the client SHALL decrypt the local stored representation before rendering the readable message

#### Scenario: Local encryption key is unavailable
- **WHEN** the desktop client cannot access the local message encryption key
- **THEN** the client SHALL fail closed for readable local history and SHALL NOT fall back to backend historical direct-message ciphertext

### Requirement: Direct-message local writes SHALL be idempotent
The desktop local direct-message store SHALL treat `messageId` as the stable idempotency key so retries, reconnects, and duplicate pending-envelope fetches do not create duplicate messages.

#### Scenario: Same pending envelope is processed twice
- **WHEN** the desktop client receives the same pending direct-message envelope more than once
- **THEN** the local store SHALL contain one message row for that `messageId` with the latest supported metadata

#### Scenario: Persisted acknowledgement is retried
- **WHEN** the desktop client retries a persisted acknowledgement for a direct-message envelope that was already acknowledged
- **THEN** the backend SHALL treat the acknowledgement as successful and SHALL NOT reintroduce the deleted envelope

### Requirement: New-device historical recovery SHALL be explicit
The system SHALL distinguish newly linked device history behavior from reconnect or re-login behavior on a previously used device.

#### Scenario: Previously used device logs back in
- **WHEN** a user logs back into a desktop device that still has its local encrypted message store
- **THEN** the client SHALL restore readable direct-message history from that local store

#### Scenario: Newly linked device logs in
- **WHEN** a user logs into a newly linked desktop device that has no local message store for a direct conversation
- **THEN** the client SHALL only receive direct messages delivered to that device after it became an authorized target device unless a separate encrypted restore mechanism is used

### Requirement: Signal key-chain state SHALL be local and encrypted
The desktop client SHALL persist its Signal identity keys, prekeys, signed prekeys, Kyber prekeys, and per-recipient session ratchet state in a local encrypted store and SHALL NOT rely on the backend to recover private Signal state or established direct-message sessions.

#### Scenario: Desktop restarts after Signal identity initialization
- **WHEN** the desktop client has initialized its local Signal identity and then restarts on the same device
- **THEN** the client SHALL restore the same Signal identity key pair and registration id from the local encrypted Signal store

#### Scenario: Direct session advances during message send or receive
- **WHEN** the desktop client establishes or advances a direct Signal session with another device
- **THEN** the updated session ratchet record SHALL be written to the local encrypted Signal store before the session is needed for subsequent direct messages

#### Scenario: One-time prekey is consumed locally
- **WHEN** a one-time prekey has been removed from the local Signal store after use
- **THEN** later prekey top-up SHALL generate a new prekey id above the existing maximum and SHALL NOT recreate the consumed prekey id

#### Scenario: Backend has public prekeys only
- **WHEN** the backend stores device prekey material for delivery setup
- **THEN** it SHALL store only public identity/prekey data and pending encrypted envelopes, not private identity keys, private prekeys, Kyber secret keys, or local session ratchet records
