# conversation-sync-and-reliability Specification

## Purpose
TBD - created by archiving change security-chat-v2-closed-loop. Update Purpose after archive.
## Requirements
### Requirement: Supported clients SHALL maintain explicit local message delivery states
The system SHALL track local message lifecycle states so users can distinguish draft, queued, sending, sent, failed, and replayed message behavior, and the desktop product surface SHALL render those states consistently in the conversation list, chat thread, and input area.

#### Scenario: Send failure becomes a visible failed state
- **WHEN** a client cannot complete message delivery because of transport, authentication, or encryption failure
- **THEN** the client SHALL persist a failed state for that message and SHALL present a supported retry affordance

#### Scenario: Successful send clears transient local states
- **WHEN** a queued or sending message is acknowledged as successfully persisted
- **THEN** the client SHALL transition that message to sent state and SHALL remove obsolete transient failure markers

#### Scenario: Failed message surface is consistent
- **WHEN** a desktop message is in failed state
- **THEN** the conversation list, chat thread, and input recovery affordance SHALL not contradict each other about whether the message was sent

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

### Requirement: Conversation previews SHALL use one consistent summary strategy
The system SHALL define a single source of truth for conversation preview text under encrypted delivery so preview rows do not drift from message reality, and the desktop conversation list SHALL render that strategy without ad hoc fallback text.

#### Scenario: Preview text uses supported summary policy
- **WHEN** a conversation list row is rendered for a conversation containing encrypted messages
- **THEN** the preview text SHALL be derived from the declared 2.0 summary strategy rather than from ad hoc mixed fallback logic

#### Scenario: Preview remains stable after sync replay
- **WHEN** a client completes history replay or catch-up for a conversation
- **THEN** the conversation preview SHALL converge to the same effective summary that the message thread represents

#### Scenario: Desktop context actions update preview consistently
- **WHEN** a desktop user deletes, forwards, quotes, or retries a message through supported actions
- **THEN** the conversation preview SHALL update according to the same summary policy used after sync replay
