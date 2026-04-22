## Context

The current branch for this work is `codex/security-chat-v2-closed-loop-integration`.

The desktop app already has encrypted media upload/download primitives, `messageType = 3` voice-message rendering paths, and playback support that downloads encrypted media, decrypts locally, and creates an object URL. The missing production feature is composer-side microphone recording with real waveform generation, preview, send/cancel controls, and robust permission/compatibility handling.

The backend already treats encrypted media assets as opaque ciphertext and supports `mediaKind = 3` for audio. This change should avoid backend schema changes unless implementation discovery proves a hard requirement. Voice-message metadata such as duration, waveform peaks, codec, and media keys must stay inside the Signal-encrypted payload.

## Goals / Non-Goals

**Goals:**

- Add desktop-only voice message recording from the chat composer.
- Use Telegram Web-style UX: click microphone to enter a dedicated recording surface, show timer and live waveform, allow cancel/delete, allow preview, and send explicitly.
- Enforce a 60 second recording limit and reject recordings shorter than 1 second.
- Generate real waveform data from recorded audio, not decorative placeholder bars.
- Preserve E2EE media behavior: encrypt before upload, keep media keys and voice metadata in encrypted message payloads, and keep backend storage ciphertext-only.
- Render voice-message bubbles with duration, waveform, playback progress, loading/failure states, and existing burn-after-reading semantics.
- Assign work for three available implementation roles:
  - `GPT-5.4`: architecture owner, security review, integration owner, and final acceptance.
  - `GPT-5.4-Mini`: bounded implementation for recorder state management, composer wiring, and regression tests.
  - `MiniMax-2.7`: bounded implementation for waveform rendering, playback UI polish, and browser/Tauri compatibility verification.

**Non-Goals:**

- Real-time voice calls.
- Mobile voice recording.
- Speech-to-text, voice effects, noise suppression, or transcription.
- Server-side audio processing or waveform extraction.
- Persisting plaintext audio outside short-lived local object URLs or in-memory blobs.

## Decisions

### Use browser recording first, with runtime MIME detection

Use `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder` as the primary desktop recording mechanism. Select the first supported MIME type from a prioritized list such as `audio/webm;codecs=opus`, `audio/webm`, `audio/mp4`, and default recorder output.

Rationale: the desktop app is React inside Tauri WebView, and Web APIs keep the first implementation close to existing UI code. Runtime MIME detection is required because WebView audio recording support varies by platform.

Alternative considered: implement recording only in Rust/Tauri commands. That gives stronger platform control but increases native complexity before proving WebView recording is insufficient. If compatibility testing fails for macOS or Windows, introduce a Tauri recorder adapter behind the same TypeScript interface.

### Separate recording lifecycle from message sending

Introduce a recorder state model independent of the existing text/media composer state:

```text
idle
  -> requesting-permission
  -> recording
  -> recorded-preview
  -> encrypting-uploading
  -> ready-to-send
  -> sending
  -> sent | failed
```

Rationale: voice messages have different validation and controls than text messages. Sending should not depend on `messageText.trim()` when a valid recorded voice attachment exists.

Alternative considered: reuse the existing generic file attachment path directly. That handles encryption/upload but does not provide recording, waveform, timer, preview, cancellation, or short-recording validation.

### Generate two waveform views from real audio

Use Web Audio `AnalyserNode` for live recording visualization and decode the completed audio blob to generate a stable fixed-length peak array for message payload and playback rendering.

Rationale: live waveform improves user feedback during recording, while stable peaks ensure every recipient sees the same waveform without downloading the audio first. The stable waveform should be compact, normalized, and stored in the encrypted payload.

Alternative considered: render decorative/random bars. Rejected because the requirement is production-grade real waveform. Another alternative is to require recipients to download and decode before rendering waveform; that delays layout and leaks less metadata only marginally because duration/waveform are already encrypted in payload.

### Store voice metadata inside encrypted payload

Extend decoded message payload shape with a `voice` object:

```json
{
  "voice": {
    "durationMs": 8200,
    "waveform": [4, 8, 16, 29],
    "waveformVersion": 1,
    "codec": "opus"
  }
}
```

Rationale: voice metadata is message content. It should be delivered with media keys only inside Signal-encrypted payloads, not as plaintext backend fields.

Alternative considered: add duration/waveform columns to backend messages or media assets. Rejected because that exposes content metadata to the server and creates avoidable schema work.

### Keep backend behavior unchanged unless validation reveals a blocker

The backend should continue accepting encrypted audio uploads as `application/octet-stream` with `mediaKind = 3` and `encryptionVersion = 1`. Message send paths should continue using `messageType = 3`.

Rationale: the existing E2EE media design already supports audio as opaque ciphertext.

Alternative considered: add dedicated voice endpoints. Rejected because it duplicates media infrastructure and increases security surface area.

### Role allocation during implementation

Implementation should be coordinated to avoid overlapping file edits:

- `GPT-5.4` owns final design interpretation, core payload contracts, security-sensitive changes, integration, and final verification.
- `GPT-5.4-Mini` can own bounded recorder/composer changes in `apps/desktop/src/features/chat/` and related tests, avoiding media crypto internals unless explicitly assigned.
- `MiniMax-2.7` can own bounded waveform rendering/playback UI polish and compatibility notes, avoiding backend or encryption changes unless explicitly assigned.

The roles are planning guidance. Any delegated task must have disjoint file ownership and must not revert work from other roles.

## Risks / Trade-offs

- [Risk] Tauri WebView may not support the preferred recording MIME type consistently. -> [Mitigation] Use `MediaRecorder.isTypeSupported()` runtime detection and document a Tauri-native recorder fallback if WebView recording fails in verification.
- [Risk] Waveform extraction can block the UI for long recordings. -> [Mitigation] Cap recordings at 60 seconds, downsample to a compact fixed number of peaks, and avoid storing raw PCM.
- [Risk] Existing send button validation requires text content. -> [Mitigation] Update composer validation to allow valid pending voice attachments without text.
- [Risk] Permission denial can look like a broken microphone button. -> [Mitigation] Add explicit permission-denied state with actionable user copy.
- [Risk] Object URL leaks can accumulate during playback and preview. -> [Mitigation] Revoke preview/playback object URLs on cancel, send completion, conversation switch, and component unmount.
- [Risk] Duration and waveform metadata could accidentally be sent as plaintext API fields. -> [Mitigation] Keep metadata only inside the encrypted payload and add tests around outbound payload/API shape.

## Migration Plan

- No database migration is expected.
- Existing audio attachments remain readable through the current encrypted or legacy media paths.
- If implementation introduces a new optional payload field, recipients without the feature should still show the voice message as an audio media message or file fallback.
- Rollback is limited to desktop UI/client behavior; backend encrypted media records remain compatible.

## Open Questions

- Which MIME type is actually supported by the target macOS and Windows Tauri WebViews in local verification?
- Should waveform peak count be fixed globally, for example 48 or 64 bars, or responsive by container width with normalized source data?
- Should sent voice messages auto-play on preview before sending, or require explicit user playback?
