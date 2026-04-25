## Context

The desktop chat app already sends encrypted media by uploading ciphertext to the backend and delivering decryption metadata only inside Signal-encrypted message payloads. `ChatPanel` resolves media by downloading ciphertext, decrypting locally, and creating `blob:` URLs for image and voice playback. Message type `4` covers both generic files and videos, with `isVideoMediaPayload()` distinguishing video attachments by MIME type or filename.

The current UX is incomplete for richer media handling:
- Images open in a single-image modal without navigation or zoom.
- Voice playback updates waveform progress but does not let users seek.
- Videos render as a video-looking card but are opened/downloaded externally.
- Generic files are saved to Downloads as a fresh unique file on every open.

This change stays desktop-focused. The backend remains ciphertext-only and does not learn plaintext names beyond existing encrypted payload behavior.

## Goals / Non-Goals

**Goals:**
- Provide an app-native media viewer for images and videos.
- Support image swiper navigation, zoom in/out, reset, keyboard navigation, and bounded object URL lifecycle.
- Support in-app playback for decrypted video blobs using native browser/Tauri media controls.
- Add seekable voice playback while preserving existing play/pause/resume behavior.
- Add app-managed file cache reuse for double-click file open: first open downloads/decrypts/caches, later opens reuse the cached file path.
- Preserve E2EE constraints: backend stores ciphertext and media keys remain inside encrypted message payloads.
- Treat burn-after-reading media conservatively so persistent plaintext cache does not outlive message destruction.
- Divide implementation ownership across GPT-5.5, GPT-5.3-Codex, and MiniMax-2.7.

**Non-Goals:**
- No backend media schema redesign.
- No new message type for video; video remains `messageType = 4` with MIME/filename detection.
- No mobile implementation.
- No video editing, transcoding, thumbnail generation, streaming ranges, or adaptive playback.
- No cloud cache or cross-device cache sync.

## Decisions

### Decision: Split preview URLs from persistent file cache

Use two different resolution paths:

```text
resolveMediaBlobUrl(message)
  └─ download ciphertext -> decrypt locally -> return blob URL for in-app preview/playback

ensureCachedMediaFile(message)
  └─ if cached plaintext exists -> open cached path
  └─ else download ciphertext -> decrypt locally -> write app cache file -> open cached path
```

Rationale: `blob:` URLs are good for viewer playback and lifecycle cleanup, but they cannot satisfy "double-click opens cached file without downloading again." The persistent file cache needs a stable filesystem path.

Alternative considered: store all decrypted media only as blob URLs in React state. This avoids plaintext disk writes but cannot survive repeated opens or app restarts, so it does not meet the file-cache requirement.

### Decision: Cache generic files by media identity plus plaintext digest

The cache key SHOULD include `mediaAssetId` and the encrypted payload `plainDigest` when available:

```text
<app-cache>/media/<mediaAssetId>-<plainDigest-prefix>/<sanitized-original-name>
```

Rationale: file names are not unique, forwarded media can share storage, and digest-aware keys avoid opening stale plaintext if metadata changes.

Alternative considered: cache by original filename only. This is simpler but unsafe because two messages can have the same filename with different contents.

### Decision: Do not persistently cache burn media

Burn-after-reading media SHOULD use memory-only preview/open behavior where possible. If a persistent cache file is created for a burn message, burn cleanup MUST remove that cached plaintext path.

Rationale: leaving plaintext in app cache after a burn message expires violates user expectations for destructive media.

Alternative considered: allow burn media caching and rely on OS/app cache cleanup. This is easier but weakens the product's security model.

### Decision: Keep video as type 4 and preview inside a shared media viewer

Video messages continue to use `messageType = 4`, with `isVideoMediaPayload(payload)` deciding whether the bubble opens video preview or generic file open. The viewer uses a decrypted blob URL and native `<video controls>`.

Rationale: the current send pipeline already distinguishes video by MIME and filename without needing backend changes.

Alternative considered: add `messageType = 5` for video. That would create backend, migration, and compatibility work without adding value for this release.

### Decision: Make the voice waveform seekable rather than adding a separate heavy control

The existing waveform/progress area should become pointer and keyboard seekable. Dragging sets a pending seek ratio; releasing updates `audio.currentTime`.

Rationale: this preserves the compact chat-bubble design while adding direct progress control.

Alternative considered: add a full native audio slider under every voice message. It is easier technically but visually heavier and duplicates the waveform.

### Decision: Assign implementation ownership by risk area

- GPT-5.5 owns architecture integration, security-sensitive cache semantics, final review, and OpenSpec conformance.
- GPT-5.3-Codex owns Tauri/native cache commands, media helper integration, and backend compatibility checks.
- MiniMax-2.7 owns React UI surfaces, CSS states, viewer controls, and focused UI tests.

Rationale: the work has separable native/cache, UI, and integration risks. Explicit ownership reduces overlap when implementation starts.

## Risks / Trade-offs

- Plaintext cache increases local data exposure -> Store only in app cache, sanitize filenames, key by media identity/digest, exclude or purge burn media, and provide cleanup hooks.
- Large videos may consume memory when converted to blob URLs -> Limit preloading to active media, release object URLs on close/switch, and avoid decoding all videos in a thread.
- Browser/Tauri codec support varies by platform -> Use native `<video>` support, show a clear unsupported playback state, and keep right-click download/open as fallback.
- Image swiper could trigger too many downloads -> Load current image first and prefetch only adjacent images.
- Voice seek can race with play/pause state -> Centralize playback state around the existing single `Audio` element and guard seeking while media is loading.
- Cached files can go missing outside the app -> Verify file existence before opening; if missing, download/decrypt/cache again.
- Legacy plaintext media may not have full encrypted metadata -> Keep legacy URL fallback and avoid cache-key assumptions that require encrypted payload fields.

## Migration Plan

1. Add native cache/open commands while preserving the existing save-and-open command.
2. Add media helper functions for blob preview and cached file open without changing backend APIs.
3. Replace video/file double-click branching in chat UI with in-app video preview or cache open.
4. Upgrade image preview state to a viewer model that supports image lists, active index, zoom, and adjacent prefetch.
5. Upgrade voice bubble progress handling to support pointer/keyboard seek.
6. Add tests around viewer navigation, video preview fallback, cache reuse, burn cache behavior, and voice seeking.
7. Rollback strategy: keep the existing download/open command path available and gate new cache/viewer calls behind the chat UI integration.

## Open Questions

- Should users have a visible "clear media cache" action in settings as part of this change, or should that be a follow-up?
- Should generic non-burn file cache survive logout, or should logout clear all cached plaintext?
- Should video preview single-click open the app viewer while double-click also opens the viewer, or should double-click be reserved for download/open fallback?
