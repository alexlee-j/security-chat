# Desktop Voice Calls

This document captures the first-release implementation boundary for `add-desktop-voice-calls` on branch `codex/security-chat-v2-closed-loop-integration`.

## Scope

The first release supports one-to-one desktop voice calls for direct conversations. It does not support group calls, video calls, mobile calls, call recording, or Signal-style call identity verification.

## Security Boundary

Live call audio uses WebRTC DTLS-SRTP. The backend relays call signaling and never receives plaintext audio frames. TURN servers relay encrypted RTP packets and do not decrypt audio.

The first release must not be described as Signal Double Ratchet call encryption. It does not yet bind WebRTC certificate fingerprints to Signal device identity and does not expose safety-number or short-authentication-string verification.

Future Signal identity binding should be treated as a separate change:

- Bind WebRTC peer certificate fingerprints to authenticated device identity.
- Detect and surface device identity changes before or during calls.
- Add a user-verifiable call safety UI.
- Define multi-device verification semantics for answered-elsewhere behavior.

## Signaling

Call signaling uses Socket.IO events under `/ws` and is separate from message `send-v2`.

Backend signaling responsibilities:

- Authenticate sockets with access JWTs.
- Track online call devices in Redis.
- Authorize every `call.*` event by conversation membership.
- Restrict first-release calls to direct conversations.
- Maintain Redis-backed ephemeral call sessions.
- Ring all online callee devices.
- Enforce first-accept-wins and emit `call.answered_elsewhere` to losing devices.
- Relay SDP offers, SDP answers, and ICE candidates only between active call participant devices.
- Emit terminal outcomes for reject, cancel, hangup, timeout, and failure.

## ICE and TURN Configuration

Development can use a public STUN default. Production must configure TURN.

Supported environment variables:

- `CALL_ICE_SERVERS`: JSON array of RTCIceServer-compatible entries. This takes precedence over individual variables.
- `CALL_STUN_URLS`: comma-separated STUN URLs used when `CALL_ICE_SERVERS` is absent.
- `CALL_TURN_URL`: TURN or TURNS URL used when `CALL_ICE_SERVERS` is absent.
- `CALL_TURN_USERNAME`: TURN username.
- `CALL_TURN_CREDENTIAL`: TURN credential.
- `CALL_RING_TIMEOUT_SECONDS`: ringing TTL, default `30`.
- `CALL_CONNECT_TIMEOUT_SECONDS`: connecting TTL, default `45`.
- `CALL_CREATE_OFFLINE_HISTORY`: set to `false` to skip offline missed-call records.

Example:

```env
CALL_ICE_SERVERS=[{"urls":["stun:stun.example.com:3478"]},{"urls":["turns:turn.example.com:5349"],"username":"user","credential":"pass"}]
```

Production validation fails if no TURN/TURNS server is configured. A STUN-only production setup is not considered reliable enough for this feature.

## Call History

Call history is stored separately from encrypted message bodies. Records describe call metadata and outcomes, such as completed, rejected, missed, canceled, failed, offline, and timeout.

Desktop timeline and conversation preview work can render these records as system-style call items without treating them as message plaintext.
