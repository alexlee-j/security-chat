## 1. Compatibility and Contracts

- [x] 1.1 [GPT-5.4] Confirm current branch is `codex/security-chat-v2-closed-loop-integration` before implementation begins.
- [x] 1.2 [GPT-5.4] Define the desktop voice payload TypeScript shape with `voice.durationMs`, `voice.waveform`, `voice.waveformVersion`, and `voice.codec` kept inside encrypted payload content.
- [x] 1.3 [GPT-5.4-Mini] Add runtime MIME selection for `MediaRecorder`, prioritizing `audio/webm;codecs=opus`, then compatible fallbacks.
- [x] 1.4 [MiniMax-2.7] Run a desktop compatibility spike for microphone permission, `MediaRecorder`, selected MIME type, and Web Audio waveform APIs in the Tauri WebView.

## 2. Recorder Core

- [x] 2.1 [GPT-5.4-Mini] Implement a bounded desktop voice recorder module or hook with states for idle, requesting permission, recording, recorded preview, uploading, sending, failed, and cleanup.
- [x] 2.2 [GPT-5.4-Mini] Enforce the 60 second maximum recording duration and automatic stop behavior.
- [x] 2.3 [GPT-5.4-Mini] Enforce the 1 second minimum duration validation before allowing send.
- [x] 2.4 [MiniMax-2.7] Generate live waveform samples from microphone input using Web Audio analysis.
- [x] 2.5 [MiniMax-2.7] Generate stable normalized waveform peaks from the final recorded audio blob for encrypted payload storage.
- [x] 2.6 [GPT-5.4] Review recorder cleanup to ensure media streams, audio contexts, timers, and object URLs are released on cancel, send, conversation switch, and unmount.

## 3. Composer UX

- [x] 3.1 [GPT-5.4-Mini] Wire the microphone button to enter the Telegram Web-style recording surface only when an active conversation exists.
- [x] 3.2 [GPT-5.4-Mini] Add permission-denied and unavailable-microphone states with actionable user messages.
- [x] 3.3 [MiniMax-2.7] Build the recording surface with elapsed time, live waveform, cancel/delete, stop, preview playback, and send controls.
- [x] 3.4 [MiniMax-2.7] Style the voice recording and preview surfaces to fit the existing desktop chat visual language.
- [x] 3.5 [GPT-5.4-Mini] Update composer send-button validation so valid recorded voice messages can be sent without text input.

## 4. Encrypted Send Flow

- [x] 4.1 [GPT-5.4] Integrate recorded voice blobs with existing `encryptMediaFile` and `uploadMedia` using `messageType = 3`, `mediaKind = 3`, and `encryptionVersion = 1`.
- [x] 4.2 [GPT-5.4] Ensure voice duration, waveform, waveform version, codec, and media decryption material are included only in the Signal-encrypted payload.
- [x] 4.3 [GPT-5.4-Mini] Preserve retry/discard behavior for failed voice upload or failed message send.
- [x] 4.4 [GPT-5.4] Confirm backend changes are unnecessary or document any blocker before adding backend scope.

## 5. Voice Bubble Playback

- [x] 5.1 [MiniMax-2.7] Extend voice message bubbles to render duration and stable waveform bars from decrypted payload metadata.
- [x] 5.2 [MiniMax-2.7] Add playback progress coloring across waveform bars while audio plays.
- [x] 5.3 [GPT-5.4-Mini] Reuse existing encrypted media download/decrypt resolution for voice playback.
- [x] 5.4 [GPT-5.4-Mini] Add voice-specific loading and failure states for download, decryption, and playback failures.
- [x] 5.5 [GPT-5.4] Verify burn-after-reading and read-once behavior remains consistent when a voice message is played.

## 6. Forwarding, Persistence, and Compatibility

- [x] 6.1 [GPT-5.4] Verify forwarding preserves encrypted media and voice metadata for target recipients without plaintext backend fields.
- [x] 6.2 [GPT-5.4-Mini] Ensure local message persistence and replay can handle payloads containing `voice` metadata.
- [x] 6.3 [MiniMax-2.7] Ensure legacy audio attachments without `voice` metadata still render through the existing audio fallback path.

## 7. Testing and Verification

- [x] 7.1 [GPT-5.4-Mini] Add unit coverage for recorder duration limits, too-short rejection, MIME fallback selection, and cleanup behavior where feasible.
- [x] 7.2 [GPT-5.4-Mini] Add UI/component coverage for composer recording states and send-button validation.
- [x] 7.3 [MiniMax-2.7] Add UI/component coverage for waveform rendering and playback progress behavior.
- [x] 7.4 [GPT-5.4] Add or update integration coverage proving voice metadata is not sent as plaintext API fields.
- [x] 7.5 [GPT-5.4] Run relevant desktop and backend verification commands, including encrypted media and message send regressions.
- [x] 7.6 [GPT-5.4] Perform final security and E2EE review before marking implementation complete.
