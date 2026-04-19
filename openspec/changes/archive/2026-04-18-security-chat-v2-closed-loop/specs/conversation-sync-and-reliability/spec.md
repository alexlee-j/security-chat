## ADDED Requirements

### Requirement: Supported clients SHALL maintain explicit local message delivery states
The system SHALL track local message lifecycle states so users can distinguish draft, queued, sending, sent, failed, and replayed message behavior.

#### Scenario: Send failure becomes a visible failed state
- **WHEN** a client cannot complete message delivery because of transport, authentication, or encryption failure
- **THEN** the client SHALL persist a failed state for that message and SHALL present a supported retry affordance

#### Scenario: Successful send clears transient local states
- **WHEN** a queued or sending message is acknowledged as successfully persisted
- **THEN** the client SHALL transition that message to sent state and SHALL remove obsolete transient failure markers

### Requirement: Clients SHALL recover message history after reconnect or re-login
The system SHALL support deterministic catch-up after reconnect, restart, or re-login so the active device can recover missing history for its authorized conversations.

#### Scenario: Client catches up after reconnect
- **WHEN** a device reconnects after being offline while conversation activity occurred
- **THEN** the client SHALL request and persist the missing history required to bring the conversation into a consistent state

#### Scenario: Client replays readable history after re-login
- **WHEN** a user logs back into a device that has previously participated in a supported conversation
- **THEN** the system SHALL restore the readable conversation history that remains authorized for that device

### Requirement: Conversation previews SHALL use one consistent summary strategy
The system SHALL define a single source of truth for conversation preview text under encrypted delivery so preview rows do not drift from message reality.

#### Scenario: Preview text uses supported summary policy
- **WHEN** a conversation list row is rendered for a conversation containing encrypted messages
- **THEN** the preview text SHALL be derived from the declared 2.0 summary strategy rather than from ad hoc mixed fallback logic

#### Scenario: Preview remains stable after sync replay
- **WHEN** a client completes history replay or catch-up for a conversation
- **THEN** the conversation preview SHALL converge to the same effective summary that the message thread represents
