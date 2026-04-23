## Context

Security Chat currently has a mature message transport path built around REST `send-v2`, device-bound encrypted message envelopes, Socket.IO conversation events, and encrypted media attachments. Desktop voice messages recently added microphone access, audio capture, encrypted upload, waveform rendering, and playback, but those are asynchronous media messages rather than live calls.

Voice calls introduce a different shape of system: WebSocket signaling, ephemeral call sessions, WebRTC peer connections, real-time microphone streams, TURN planning, and UI that can exist outside the currently selected conversation. Existing specs also explicitly treat audio/video calls as out of scope for the prior desktop closure, so this change must turn one-to-one desktop voice calling into a supported capability without accidentally implying video, group, mobile, or Signal-style call identity verification.

The current branch for development is `codex/security-chat-v2-closed-loop-integration`.

Role allocation for implementation:
- GPT-5.4 is responsible for architecture, backend call signaling, Redis state, TURN/ICE configuration, call history semantics, security review, and final integration verification.
- GPT-5.4-Mini is responsible for focused desktop call engine work, WebRTC client state, cleanup behavior, desktop model/type integration, and targeted unit tests.
- MiniMax-2.7 is responsible for desktop call UI surfaces, interaction states, permission and failure UX, conversation preview presentation, and component-level UI tests.
- Any role touching shared code must preserve existing message send-v2, encrypted media, and desktop voice message behavior.

## Goals / Non-Goals

**Goals:**
- Support one-to-one desktop voice calls in direct conversations.
- Ring all online callee devices and let the first accepting device win.
- Use WebRTC DTLS-SRTP for encrypted real-time audio while keeping backend and TURN servers out of plaintext audio handling.
- Add production-aware STUN/TURN configuration and delivery.
- Add call history records and conversation preview semantics for ended, missed, rejected, canceled, failed, and offline outcomes.
- Keep call signaling separate from message send-v2 and preserve message encryption semantics.
- Provide clear desktop UI states for outgoing, incoming, connecting, connected, muted, ended, failed, timeout, permission-denied, and answered-elsewhere flows.

**Non-Goals:**
- No group voice calls.
- No video calls.
- No mobile client call implementation.
- No call recording.
- No offline push notification delivery beyond optional call history creation.
- No Signal-style call identity binding, safety number, SAS, or verified-call UI in the first release.
- No custom media encryption layer above WebRTC.

## Decisions

### Develop on the current integration branch

All implementation for this change SHALL be performed on `codex/security-chat-v2-closed-loop-integration` unless the user explicitly requests a different branch. This keeps the work aligned with the current Security Chat v2 desktop integration stream and avoids drifting from the recently archived desktop voice message implementation.

Alternatives considered:
- Create a separate feature branch: useful for isolation, but the user requested current-branch planning and this branch already contains the relevant desktop/media/message context.
- Implement across multiple branches by role: rejected because the call feature spans backend, desktop, specs, and tests and needs a single integration surface.

### Use WebRTC for audio media and Socket.IO for signaling

Live audio SHALL use `RTCPeerConnection` and browser/WebView-managed DTLS-SRTP. Socket.IO SHALL carry only signaling events such as invite, accept, reject, offer, answer, ICE candidates, timeout, hangup, and cleanup.

Alternatives considered:
- Send audio chunks through WebSocket: rejected because latency, jitter, backpressure, packet loss behavior, and encryption semantics would be worse than WebRTC.
- Reuse message send-v2 for call setup: rejected because calls are ephemeral real-time sessions, not durable encrypted messages.
- Build custom RTP/SRTP handling: rejected because it is high-risk and unnecessary for desktop WebView.

### Add a dedicated call signaling module or gateway

Call events SHOULD live behind a new call-focused backend module/gateway while reusing the existing `/ws` namespace and JWT authentication. This keeps call lifecycle code separate from `MessageGateway`, which already carries messaging, typing, online status, and conversation update behavior.

Alternatives considered:
- Add all call events to `MessageGateway`: faster initially, but mixes message and call responsibilities and makes lifecycle cleanup harder to audit.
- Create a separate WebSocket namespace: cleaner isolation, but unnecessary unless call traffic or auth diverges later.

### Use Redis-backed ephemeral call state

The backend SHALL maintain active call state in Redis with TTLs for ringing and connecting phases. State includes `callId`, `conversationId`, caller, callee, accepted device if any, status, created time, and timeout deadlines.

Alternatives considered:
- In-memory process state only: rejected because the backend may scale horizontally and Socket.IO rooms already depend on Redis-adjacent infrastructure.
- Persist every transition synchronously in Postgres: rejected for hot signaling paths; durable history should be written on terminal outcomes.

### Ring all online callee devices and first accepted device wins

For a direct call invite, the backend SHALL emit `call.invited` to all online devices for the callee. The first valid `call.accept` wins and the backend SHALL emit `call.answered_elsewhere` to other callee devices.

Alternatives considered:
- Ring only the latest active device: simpler but loses expected multi-device behavior.
- Let every device join: rejected for one-to-one MVP and creates echo, identity, and participant complexity.

### Treat offline callees as immediate failure with optional missed-call history

If no callee device is online, the backend SHALL reject call setup immediately with an offline outcome. The design allows creating a missed-call history record so the conversation timeline can explain what happened.

Alternatives considered:
- Queue offline call invites: rejected because live calls cannot be fulfilled after the caller gives up.
- Push notifications in first release: deferred to a later notification scope.

### Store call history separately from encrypted message bodies

Call history is metadata about call attempts and outcomes. First release SHOULD use explicit call records rather than pretending call events are encrypted chat messages. Conversation preview may render these records similarly to system timeline items.

Alternatives considered:
- Store call records as messageType values in `messages`: simple UI integration, but risks confusing E2EE message semantics and message sync contracts.
- Store only ephemeral UI events: rejected because users expect missed and completed calls to appear in history.

### Require configurable ICE servers and TURN planning

Desktop clients SHALL receive ICE server configuration from backend configuration or an authenticated config endpoint. Production deployments MUST support TURN credentials because direct peer-to-peer connectivity will fail under common NAT and corporate network conditions.

Alternatives considered:
- Hardcode public STUN only: acceptable for local spikes, not production-grade.
- Make TURN optional in design: rejected because the requirement is reliable production calling.

### State the first-release security boundary precisely

The product SHALL state that first-release calls use WebRTC DTLS-SRTP encrypted media transport, and backend/TURN servers do not process plaintext audio. It SHALL NOT claim Signal Double Ratchet or Signal-style call identity verification for calls until WebRTC fingerprints are bound to Signal device identity and user-facing verification exists.

Alternatives considered:
- Implement Signal-style identity binding now: deferred because it requires device identity binding, fingerprint verification, multi-device semantics, and additional UI.
- Avoid security wording entirely: rejected because this is a secure messaging product and users need accurate expectations.

## Risks / Trade-offs

- [Risk] TURN is not configured or credentials expire incorrectly -> Mitigation: add explicit configuration validation, a desktop diagnostics path, and a smoke test that verifies ICE server delivery.
- [Risk] Browser/Tauri WebView microphone or WebRTC behavior differs by platform -> Mitigation: start with a compatibility spike for macOS/Windows/Linux desktop WebView and document platform-specific permissions.
- [Risk] Multi-device ringing races create double-accept or stale UI -> Mitigation: make backend Redis state authoritative, enforce atomic accept, and broadcast terminal outcomes to all devices.
- [Risk] Signaling events leak more metadata than intended -> Mitigation: keep payloads minimal, require membership checks for every event, and avoid SDP/candidate persistence beyond ephemeral relay.
- [Risk] Users interpret WebRTC encryption as Signal-equivalent call verification -> Mitigation: document the security boundary in specs and UI copy, and reserve identity binding for a future capability.
- [Risk] Call records conflict with message history semantics -> Mitigation: model call history explicitly and integrate it into conversation timeline/preview without treating it as encrypted message plaintext.
- [Risk] Audio resources remain open after hangup or navigation -> Mitigation: define cleanup requirements for local media tracks, peer connection, remote audio element, timers, and event listeners.

## Migration Plan

1. Add backend configuration for ICE/TURN servers and validate that development defaults are explicit.
2. Add backend call signaling module/gateway with Redis-backed active call state and terminal cleanup.
3. Add optional call history persistence and read paths used by conversation timeline/preview.
4. Add desktop WebRTC call client/service with an abstraction layer for tests.
5. Add desktop UI surfaces for header call action, incoming call prompt, active call surface, and history rendering.
6. Add regression tests and smoke gates for offline, answered-elsewhere, timeout, reject, hangup, permission denied, and TURN configuration.

Rollback strategy:
- Disable the desktop call button and incoming call handling behind a feature flag or configuration switch.
- Leave call history records readable as system events if any were already created.
- Keep message send-v2 and voice message behavior unchanged.

## Open Questions

- Should missed-call history be created only for callee offline, or also for ringing timeout and caller cancel after ringing?
- Should call history be delivered through existing conversation list APIs or through a separate call-history endpoint merged client-side?
- What TURN provider or self-hosted TURN deployment should production use?
- Should incoming calls interrupt the user globally within the desktop app, or only surface when the relevant conversation is open?
- What is the exact UI copy for first-release encrypted call security so it is accurate but not alarming?
