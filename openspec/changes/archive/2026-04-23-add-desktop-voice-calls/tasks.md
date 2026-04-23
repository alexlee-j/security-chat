## 0. Branch and Role Ownership

- [x] 0.1 [GPT-5.4] Keep implementation on `codex/security-chat-v2-closed-loop-integration` unless the user explicitly requests another branch.
- [x] 0.2 [GPT-5.4] Coordinate shared architecture boundaries across backend, desktop, specs, and tests before role-specific implementation begins.
- [x] 0.3 [GPT-5.4-Mini] Own bounded desktop call engine and type/model tasks without modifying backend signaling contracts unless coordinated.
- [x] 0.4 [MiniMax-2.7] Own desktop call UI and UX tasks without modifying backend signaling contracts unless coordinated.
- [x] 0.5 [GPT-5.4] Review integration points touched by all roles and resolve conflicts before final verification.

## 1. Discovery and Compatibility

- [x] 1.1 [GPT-5.4] Confirm current branch is `codex/security-chat-v2-closed-loop-integration` before implementation begins.
- [x] 1.2 [GPT-5.4] Map current Socket.IO auth, user room, conversation room, and online-device behavior to define call signaling integration points.
- [x] 1.3 [GPT-5.4-Mini] Run a desktop WebRTC compatibility spike for `getUserMedia`, `RTCPeerConnection`, audio output, and cleanup in the Tauri WebView.
- [x] 1.4 [MiniMax-2.7] Validate desktop UI permission behavior for microphone denied, unavailable microphone, and repeated call attempts.
- [x] 1.5 [GPT-5.4] Document first-release security wording: WebRTC DTLS-SRTP encrypted media transport, no Signal-style call identity verification.

## 2. Backend Call Signaling

- [x] 2.1 [GPT-5.4] Create a backend call signaling module or gateway separated from message send-v2 responsibilities while reusing authenticated `/ws` infrastructure.
- [x] 2.2 [GPT-5.4] Define call event DTOs for invite, invited, accept, accepted, reject, rejected, cancel, canceled, offer, answer, ICE candidate, hangup, ended, timeout, answered-elsewhere, and error.
- [x] 2.3 [GPT-5.4] Enforce conversation membership and direct-conversation-only validation for every `call.*` event.
- [x] 2.4 [GPT-5.4] Implement Redis-backed active call session state with TTLs for ringing and connecting phases.
- [x] 2.5 [GPT-5.4] Implement offline callee detection using online device/user state and fail immediately when no callee device is online.
- [x] 2.6 [GPT-5.4] Implement multi-device ringing so all online callee devices receive the invite.
- [x] 2.7 [GPT-5.4] Implement atomic first-accept-wins behavior and emit `call.answered_elsewhere` to losing callee devices.
- [x] 2.8 [GPT-5.4] Relay WebRTC offer, answer, and ICE candidate payloads only between authorized active participant devices.
- [x] 2.9 [GPT-5.4] Implement reject, cancel, hangup, timeout, disconnect cleanup, and terminal state emission.

## 3. TURN and Configuration

- [x] 3.1 [GPT-5.4] Add backend configuration shape for STUN/TURN ICE servers and production validation.
- [x] 3.2 [GPT-5.4] Add an authenticated way for desktop clients to obtain ICE server configuration without exposing unrelated secrets.
- [x] 3.3 [MiniMax-2.7] Add desktop diagnostics or user-facing failure handling for missing or invalid ICE configuration.
- [x] 3.4 [GPT-5.4] Document local development ICE defaults and production TURN deployment expectations.

## 4. Call History

- [x] 4.1 [GPT-5.4] Design and implement call history persistence for completed, rejected, missed, canceled, failed, and offline outcomes.
- [x] 4.2 [GPT-5.4] Keep call records distinct from encrypted message bodies while making them available to conversation timeline and preview surfaces.
- [x] 4.3 [GPT-5.4-Mini] Extend desktop conversation models/types to include call history items alongside messages where needed.
- [x] 4.4 [GPT-5.4-Mini] Render completed, missed, rejected, canceled, and failed call history items in the chat timeline.
- [x] 4.5 [MiniMax-2.7] Keep conversation preview ordering stable while rendering selected conversation call history in the timeline.

## 5. Desktop Call Engine

- [x] 5.1 [GPT-5.4-Mini] Add a desktop voice call client or hook with idle, requesting-permission, outgoing, incoming, connecting, connected, muted, ended, failed, timeout, and answered-elsewhere states.
- [x] 5.2 [GPT-5.4-Mini] Integrate Socket.IO call events with the call client without disrupting existing message sync and typing events.
- [x] 5.3 [GPT-5.4-Mini] Implement caller-side `RTCPeerConnection` creation, local microphone stream attachment, SDP offer creation, and ICE candidate emission.
- [x] 5.4 [GPT-5.4-Mini] Implement callee-side accept flow, microphone acquisition, SDP answer creation, and ICE candidate handling.
- [x] 5.5 [GPT-5.4-Mini] Attach remote audio playback and handle autoplay or user-gesture constraints.
- [x] 5.6 [GPT-5.4-Mini] Implement mute/unmute by toggling local audio track transmission.
- [x] 5.7 [GPT-5.4-Mini] Implement deterministic cleanup for media tracks, peer connection, remote audio, timers, and event listeners on every terminal state.
- [x] 5.8 [GPT-5.4] Review the call engine for stale closure, reconnect, duplicate event, and resource leak risks.

## 6. Desktop Call UI

- [x] 6.1 [MiniMax-2.7] Add supported voice call action to eligible direct chat headers and keep video/group call affordances hidden, disabled, or explanatory.
- [x] 6.2 [MiniMax-2.7] Build outgoing call UI with callee identity, ringing state, elapsed dialing time, and cancel action.
- [x] 6.3 [MiniMax-2.7] Build incoming call UI with caller identity, accept, reject, and answered-elsewhere behavior.
- [x] 6.4 [MiniMax-2.7] Build active call UI with duration, mute/unmute, hangup, and connection status.
- [x] 6.5 [MiniMax-2.7] Build failure UI for offline, timeout, permission denied, ICE failure, and network disconnect outcomes.
- [x] 6.6 [GPT-5.4-Mini] Ensure incoming calls can surface even when a different conversation is selected.

## 7. Security and Product Boundaries

- [x] 7.1 [GPT-5.4] Ensure backend never receives, stores, decrypts, or transforms plaintext live audio frames.
- [x] 7.2 [GPT-5.4] Ensure call signaling payloads are minimal and authorized before relay.
- [x] 7.3 [GPT-5.4] Ensure UI and documentation do not claim Signal-style call identity verification in this release.
- [x] 7.4 [GPT-5.4] Add TODO or design notes for a future Signal identity binding phase without blocking first-release calls.

## 8. Verification

- [x] 8.1 [GPT-5.4] Add backend tests for unauthorized call events, group call rejection, callee offline, timeout, first-accept-wins, answered-elsewhere, and signaling relay authorization.
- [x] 8.2 [GPT-5.4-Mini] Add desktop unit tests for call state transitions, cleanup, mute, permission-denied, and answered-elsewhere behavior.
- [x] 8.3 [MiniMax-2.7] Add desktop component tests for outgoing, incoming, active, failed, and history call UI states.
- [x] 8.4 [GPT-5.4] Add integration or smoke coverage for two desktop clients completing a local WebRTC call where feasible.
- [x] 8.5 [GPT-5.4] Run backend verification commands relevant to WebSocket and call signaling.
- [x] 8.6 [GPT-5.4] Run desktop build and targeted desktop call tests.
- [x] 8.7 [GPT-5.4] Perform final OpenSpec, security, and regression review before marking tasks complete.
