## ADDED Requirements

### Requirement: Desktop direct conversations support one-to-one voice calls
The desktop client SHALL allow a user to start a one-to-one voice call from a direct conversation when voice calling is available.

#### Scenario: Start direct voice call
- **WHEN** a desktop user activates the voice call control in an eligible direct conversation
- **THEN** the desktop client requests microphone access if needed
- **AND** the desktop client begins the outgoing call flow after access is granted

#### Scenario: Group conversation call is unavailable
- **WHEN** a desktop user is viewing a group conversation
- **THEN** the desktop client does not expose group voice calling as an available action

#### Scenario: No active conversation
- **WHEN** a desktop user activates voice calling without an active conversation
- **THEN** the desktop client does not start a call
- **AND** the user sees an actionable message to select a direct conversation first

### Requirement: Desktop voice call UI exposes clear call lifecycle states
The desktop client SHALL render distinct call states for outgoing, incoming, connecting, connected, muted, ended, failed, timeout, rejected, canceled, permission-denied, and answered-elsewhere outcomes.

#### Scenario: Outgoing call is ringing
- **WHEN** a user starts a valid outgoing call
- **THEN** the desktop client shows the callee identity
- **AND** shows a ringing or dialing state
- **AND** provides a cancel action

#### Scenario: Incoming call is shown
- **WHEN** the desktop client receives an authorized incoming call invite
- **THEN** the desktop client shows the caller identity
- **AND** provides accept and reject actions

#### Scenario: Active call is shown
- **WHEN** the call becomes connected
- **THEN** the desktop client shows active call duration
- **AND** provides mute and hangup controls

#### Scenario: Answered on another device
- **WHEN** another online device for the same callee accepts the call first
- **THEN** the desktop client exits the incoming call prompt
- **AND** shows or records an answered-elsewhere outcome without starting local media

### Requirement: Desktop voice calls manage local audio resources safely
The desktop client SHALL acquire, use, mute, unmute, and release microphone and remote audio resources according to call lifecycle.

#### Scenario: Microphone permission denied
- **WHEN** microphone access is denied during call start or accept
- **THEN** the desktop client does not join the call
- **AND** releases any partially acquired resources
- **AND** reports a permission-denied call outcome

#### Scenario: User mutes microphone
- **WHEN** a connected call participant activates mute
- **THEN** the desktop client disables local microphone transmission
- **AND** keeps receiving remote audio

#### Scenario: Call ends
- **WHEN** a call ends for any reason
- **THEN** the desktop client stops local media tracks
- **AND** closes the WebRTC peer connection
- **AND** detaches remote audio playback
- **AND** clears call timers and event listeners

### Requirement: Desktop voice calls use WebRTC encrypted media transport
The desktop client SHALL use WebRTC audio media transport with DTLS-SRTP for first-release calls and SHALL not send live audio through application WebSocket messages.

#### Scenario: Connected call transports audio
- **WHEN** two desktop clients establish a connected voice call
- **THEN** microphone audio is transported through WebRTC media streams
- **AND** Socket.IO carries only signaling and call lifecycle events

#### Scenario: Security boundary is represented accurately
- **WHEN** desktop call security is documented or shown to users
- **THEN** the product states that WebRTC DTLS-SRTP encrypts live media transport
- **AND** does not claim Signal-style call identity verification for the first release

### Requirement: Desktop voice calls use configurable ICE servers
The desktop client SHALL use configured STUN/TURN ICE servers when creating WebRTC peer connections.

#### Scenario: ICE configuration available
- **WHEN** the desktop client prepares a call
- **THEN** it obtains configured ICE server data
- **AND** creates the peer connection with that ICE server configuration

#### Scenario: ICE configuration missing or invalid
- **WHEN** required ICE server configuration is missing or invalid in a production profile
- **THEN** the desktop client or backend reports a call configuration failure
- **AND** the call does not proceed as if production connectivity were reliable
