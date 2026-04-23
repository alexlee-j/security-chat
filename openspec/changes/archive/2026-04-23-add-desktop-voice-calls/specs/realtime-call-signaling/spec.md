## ADDED Requirements

### Requirement: Backend authorizes call signaling by conversation membership
The backend SHALL authorize every call signaling event against the authenticated user and the target direct conversation before relaying it.

#### Scenario: Authorized call invite
- **WHEN** an authenticated user sends `call.invite` for a direct conversation where they are a member
- **THEN** the backend accepts the invite for signaling
- **AND** associates the call with that conversation

#### Scenario: Unauthorized call signaling
- **WHEN** a user sends any `call.*` signaling event for a conversation they are not a member of
- **THEN** the backend rejects the event
- **AND** does not relay the signaling payload

#### Scenario: Group call invite rejected
- **WHEN** a user sends `call.invite` for a group conversation in the first release
- **THEN** the backend rejects the invite as unsupported

### Requirement: Backend manages ephemeral call sessions
The backend SHALL maintain ephemeral active call state with timeout and cleanup behavior for ringing, connecting, connected, and terminal call states.

#### Scenario: Call session created
- **WHEN** an authorized call invite is accepted for processing
- **THEN** the backend creates an active call session with a unique `callId`
- **AND** stores caller, callee, conversation, status, and expiry metadata

#### Scenario: Ringing timeout
- **WHEN** a ringing call reaches its configured timeout without acceptance
- **THEN** the backend marks the call as timed out
- **AND** emits terminal timeout events to relevant online devices
- **AND** releases the active call session

#### Scenario: Hangup cleanup
- **WHEN** either connected participant hangs up
- **THEN** the backend emits a call ended event to the call participants
- **AND** releases the active call session

### Requirement: Call signaling rings all online callee devices
The backend SHALL route incoming call invites to all online devices for the callee and SHALL enforce that the first accepting device wins.

#### Scenario: Multiple callee devices online
- **WHEN** a caller invites a callee with multiple online desktop devices
- **THEN** the backend emits the incoming call invite to each online callee device

#### Scenario: First device accepts
- **WHEN** one callee device accepts the ringing call
- **THEN** the backend records that device as the accepted device
- **AND** emits accepted signaling to the caller
- **AND** emits `call.answered_elsewhere` to other callee devices

#### Scenario: Late accept rejected
- **WHEN** a second callee device tries to accept after another device already accepted
- **THEN** the backend rejects the late accept
- **AND** tells that device the call was answered elsewhere

### Requirement: Offline callees fail immediately
The backend SHALL fail call setup immediately when no callee device is online.

#### Scenario: Callee offline
- **WHEN** a caller invites a callee with no online devices
- **THEN** the backend rejects the call attempt with an offline outcome
- **AND** does not create a ringing call session

#### Scenario: Optional missed-call history for offline callee
- **WHEN** offline call history creation is enabled
- **THEN** the backend creates a missed-call record for the conversation

### Requirement: Backend relays WebRTC negotiation payloads without persisting media
The backend SHALL relay SDP offers, SDP answers, and ICE candidates only between authorized devices participating in an active call and SHALL NOT persist live audio media.

#### Scenario: Relay offer
- **WHEN** the caller sends a WebRTC offer for an active call
- **THEN** the backend relays the offer only to the accepted callee device

#### Scenario: Relay answer
- **WHEN** the accepted callee device sends a WebRTC answer for an active call
- **THEN** the backend relays the answer only to the caller device

#### Scenario: Relay ICE candidate
- **WHEN** either call participant sends an ICE candidate for an active call
- **THEN** the backend relays the candidate only to the other active participant device

#### Scenario: Do not persist live media
- **WHEN** a voice call is active
- **THEN** the backend does not receive, store, decrypt, or transform plaintext audio frames
