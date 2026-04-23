## Why

Desktop messaging now supports encrypted voice messages, but users still cannot have live one-to-one voice conversations from an active chat. Adding desktop voice calls closes the next communication gap while keeping the first release scoped to a reliable, auditable WebRTC implementation.

## What Changes

- Add one-to-one desktop voice calls for direct conversations.
- Develop this change on the current branch: `codex/security-chat-v2-closed-loop-integration`.
- Add WebSocket call signaling for invite, accept, reject, cancel, offer, answer, ICE candidate, hangup, timeout, and answered-elsewhere events.
- Use WebRTC DTLS-SRTP for encrypted real-time audio transport; backend and TURN servers only relay signaling or encrypted media packets.
- Require TURN planning and configurable ICE server delivery for production reliability.
- Ring all online devices for the callee and let the first accepted device win; other callee devices receive `call.answered_elsewhere`.
- Fail immediately when the callee has no online devices, with optional missed-call history creation.
- Add desktop call UI surfaces for outgoing, incoming, connecting, connected, muted, ended, failed, and permission-denied states.
- Add call history records in the conversation timeline and conversation preview for completed, missed, rejected, canceled, failed, and answered-elsewhere outcomes.
- Keep video calls, group calls, mobile calls, call recording, and Signal-style call identity verification out of first release scope.

## Capabilities

### New Capabilities
- `desktop-voice-calls`: Desktop one-to-one voice call UI, local call lifecycle, microphone handling, WebRTC media handling, mute/hangup controls, and first-release security boundary.
- `realtime-call-signaling`: Backend and desktop real-time signaling contract for authorized call setup, multi-device ringing, WebRTC SDP/ICE relay, timeout, busy, and cleanup behavior.
- `call-history`: Conversation-level call records, missed-call behavior, call outcome metadata, and preview semantics.

### Modified Capabilities
- `desktop-chat-thread-interactions`: Header call controls become supported for one-to-one desktop voice calls while unsupported video/group call affordances remain hidden, disabled, or explanatory.

## Impact

- Backend: add a call signaling module/gateway or equivalent separated from message send-v2, Redis-backed ephemeral call state, membership checks, online-device routing, optional call record persistence, and TURN/ICE configuration support.
- Desktop: add a voice call client/service around `RTCPeerConnection`, microphone stream acquisition and cleanup, call UI surfaces, incoming call handling, active call state, audio output, and call history rendering.
- API and WebSocket: add `call.*` Socket.IO events and optional REST endpoints for call history if history is not created entirely from signaling outcomes.
- Infrastructure: introduce STUN/TURN configuration, credential delivery, and deployment documentation for production-grade connectivity.
- Security: document that first release uses WebRTC DTLS-SRTP for encrypted media transport and does not yet bind WebRTC identity to Signal device identity or expose safety-number verification.
- Tests: add backend signaling authorization/lifecycle tests, desktop call state tests, WebRTC abstraction tests, and smoke gates for permission failure, callee offline, answered-elsewhere, hangup, timeout, and TURN configuration paths.

## Development Branch and Role Allocation

- Development branch: `codex/security-chat-v2-closed-loop-integration`.
- GPT-5.4 owns architecture, backend signaling, TURN/configuration decisions, call history data semantics, security boundary review, and final verification.
- GPT-5.4-Mini owns bounded desktop call engine slices, WebRTC client state management, desktop type/model integration, and focused unit coverage.
- MiniMax-2.7 owns desktop interaction surfaces, permission/failure UX, visual call states, preview behavior, and component-level UI coverage.
- Cross-cutting changes MUST preserve message send-v2 semantics and existing desktop voice message behavior.
