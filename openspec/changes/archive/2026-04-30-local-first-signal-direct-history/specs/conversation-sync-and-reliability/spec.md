## MODIFIED Requirements

### Requirement: Clients SHALL recover message history after reconnect or re-login
The system SHALL support deterministic recovery after reconnect, restart, or re-login. For supported direct conversations, readable history SHALL be restored from the local encrypted device store, and server synchronization SHALL be limited to pending delivery envelopes and metadata events. For conversation types that remain outside the local-first direct-history model, the system MAY continue using their existing supported recovery path.

#### Scenario: Client catches up after reconnect
- **WHEN** a device reconnects after being offline while direct conversation activity occurred
- **THEN** the client SHALL render locally persisted direct-message history and SHALL request only pending direct-message envelopes and metadata events needed to bring the conversation into a consistent state

#### Scenario: Client replays readable history after re-login
- **WHEN** a user logs back into a device that has previously participated in a supported direct conversation and still has its local encrypted message store
- **THEN** the system SHALL restore readable direct-message history from that local store without requiring backend historical direct-message ciphertext

#### Scenario: New device has no local direct history
- **WHEN** a user logs into a newly linked device that has no local encrypted history for a supported direct conversation
- **THEN** the system SHALL NOT recover old direct-message history from the backend and SHALL only synchronize pending envelopes addressed to that device

#### Scenario: Pending envelope persists until local save
- **WHEN** a direct-message envelope is available on the backend for an authenticated device but the device has not acknowledged local persistence
- **THEN** the system SHALL keep the envelope pending for that device so reconnect or retry can process it again
