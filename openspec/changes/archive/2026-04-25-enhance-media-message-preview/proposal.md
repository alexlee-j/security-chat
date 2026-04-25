## Why

Desktop media messages currently handle encrypted image, voice, video, and file attachments, but the interaction model is uneven: images preview one at a time, voice playback progress is not seekable, videos leave the app for playback, and downloaded files are saved as new copies every time. This change makes media messages feel complete inside the app while preserving the existing E2EE boundary.

## What Changes

- Add an in-app media viewer for encrypted image and video messages.
- Upgrade image preview into a swiper-style viewer with previous/next navigation and zoom controls.
- Play encrypted video attachments inside the desktop app after local decryption instead of requiring the operating system default handler for preview playback.
- Add a draggable voice playback progress control so users can seek within voice messages.
- Change file double-click behavior to use an app-managed plaintext cache: download and decrypt on first open, then open the cached file on later double-clicks without downloading again.
- Keep right-click download/open behavior compatible with existing message actions.
- Preserve burn-after-reading semantics by avoiding persistent plaintext cache for burn media, or by clearing any related cached plaintext when burn cleanup occurs.
- Include explicit implementation ownership across GPT-5.5, GPT-5.3-Codex, and MiniMax-2.7 in the task plan.

## Capabilities

### New Capabilities
- `desktop-media-viewer-cache`: Desktop in-app image/video preview, media cache reuse, and file-opening behavior for chat attachments.

### Modified Capabilities
- `e2ee-media-attachments`: Video preview and file opening behavior changes from external-only handling to local decrypt-and-preview/cache flows.
- `desktop-voice-messages`: Voice bubbles gain seekable playback progress in addition to waveform progress display.

## Impact

- Desktop React chat surfaces: `apps/desktop/src/features/chat/chat-panel.tsx`, `apps/desktop/src/features/chat/message-bubble.tsx`, and related styling.
- Desktop media helpers: `apps/desktop/src/core/media-message.ts`, `apps/desktop/src/core/media-crypto.ts`, and URL/cache lifecycle management.
- Tauri file commands: `apps/desktop/src/core/native-file.ts` and `apps/desktop/src-tauri/src/file_commands.rs` for app cache storage, cache lookup, and system open.
- Existing OpenSpec requirements for encrypted media attachments and voice messages.
- Tests for desktop media rendering, cache reuse, voice seek behavior, and burn-message cache handling.
