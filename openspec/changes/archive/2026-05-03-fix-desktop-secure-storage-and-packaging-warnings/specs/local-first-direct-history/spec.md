## MODIFIED Requirements

### Requirement: Local direct-message history SHALL be encrypted at rest
The desktop local store SHALL protect persisted direct-message readable content with a device-local encryption key that is not stored in plaintext alongside the message database. In production builds for supported desktop platforms, that encryption key SHALL be generated, persisted, and retrieved through OS-backed secure storage rather than fixed constants, renderer `localStorage`, or volatile process memory.

#### Scenario: Desktop persists decrypted direct message
- **WHEN** the desktop client saves decrypted direct-message content to the local store
- **THEN** the stored representation SHALL be encrypted at rest using a key available only to the local device context

#### Scenario: Desktop restores direct message
- **WHEN** the desktop client reads a locally persisted direct message
- **THEN** the client SHALL decrypt the local stored representation before rendering the readable message

#### Scenario: Local encryption key is unavailable
- **WHEN** the desktop client cannot access the local message encryption key
- **THEN** the client SHALL fail closed for readable local history and SHALL NOT fall back to backend historical direct-message ciphertext

#### Scenario: Production desktop resolves local message encryption key
- **WHEN** a production desktop build starts on macOS, Windows, or another supported desktop platform
- **THEN** the local message store encryption key SHALL be read from or created in platform secure storage
- **AND** the key SHALL NOT be a hard-coded deterministic byte array

#### Scenario: Platform secure storage is unavailable
- **WHEN** a production desktop build cannot read or create the local message store encryption key through platform secure storage
- **THEN** the client SHALL fail closed for local readable message storage
- **AND** the client SHALL NOT silently switch to a fixed, plaintext, or process-memory-only key

### Requirement: Signal key-chain state SHALL be local and encrypted
The desktop client SHALL persist its Signal identity keys, prekeys, signed prekeys, Kyber prekeys, and per-recipient session ratchet state in a local encrypted store and SHALL NOT rely on the backend to recover private Signal state or established direct-message sessions. In production builds for supported desktop platforms, the Signal store encryption key SHALL be generated, persisted, and retrieved through OS-backed secure storage rather than fixed constants, renderer `localStorage`, or volatile process memory.

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

#### Scenario: Production desktop resolves Signal store encryption key
- **WHEN** a production desktop build starts on macOS, Windows, or another supported desktop platform
- **THEN** the Signal store encryption key SHALL be read from or created in platform secure storage
- **AND** the key SHALL NOT be a hard-coded deterministic byte array

#### Scenario: Platform secure storage cannot unlock Signal state
- **WHEN** a production desktop build cannot read or create the Signal store encryption key through platform secure storage
- **THEN** the client SHALL fail closed for private Signal state access
- **AND** the client SHALL NOT regenerate a different local Signal identity as an implicit fallback for the same installed device
