## Why

Desktop chat already supports encrypted media attachments and has partial voice-message rendering paths, but users cannot record and send voice messages from the desktop composer. Adding production-grade desktop voice messages closes that gap while preserving the current ciphertext-only backend storage model.

This change is planned for development on the current branch: `codex/security-chat-v2-closed-loop-integration`.

## What Changes

- Add desktop voice-message recording in the chat composer, scoped to desktop only.
- Use Telegram Web-style interaction: enter a dedicated recording surface from the microphone button, show elapsed time and waveform, allow cancel/delete, preview playback, and send after recording.
- Enforce a 60 second maximum recording duration and reject recordings that are too short to be useful.
- Generate and display real waveform data for recorded voice messages.
- Send voice recordings through the existing E2EE media attachment path: encrypt locally, upload ciphertext, and deliver media metadata only inside Signal-encrypted message payloads.
- Render received voice messages with waveform playback progress, duration, loading, decrypt/download failure, and burn-after-reading behavior.
- Keep real-time voice calls out of scope.
- Keep mobile voice recording out of scope for this change.
- Document model-role allocation for implementation:
  - `GPT-5.4`: architecture owner, final integration, security-sensitive review, and acceptance decisions.
  - `GPT-5.4-Mini`: focused implementation tasks with bounded ownership, especially UI state wiring and tests.
  - `MiniMax-2.7`: focused implementation tasks with bounded ownership, especially waveform/playback UX polish and compatibility checks.

## Capabilities

### New Capabilities

- `desktop-voice-messages`: Desktop voice recording, preview, sending, playback, waveform, failure handling, and composer interaction requirements.

### Modified Capabilities

- `e2ee-media-attachments`: Add voice-message-specific encrypted media metadata requirements for duration and waveform data inside encrypted payloads.

## Impact

- Desktop React chat composer and message bubble UI under `apps/desktop/src/features/chat/`.
- Desktop chat state and media handling under `apps/desktop/src/core/`.
- Existing encrypted media upload/download APIs under `apps/desktop/src/core/api.ts` and backend `apps/backend/src/modules/media/`.
- Existing message send/list paths for `messageType = 3`.
- Tauri desktop runtime permissions and WebView audio recording compatibility.
- OpenSpec requirements for desktop voice messages and E2EE media attachments.
