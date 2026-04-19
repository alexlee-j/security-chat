## MODIFIED Requirements

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
