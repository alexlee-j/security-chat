## Implementation Notes

### Final Media Flow

`ChatPanel` remains the desktop integration point for message media. Encrypted media still resolves through `props.onResolveMediaUrl(message)`, which downloads ciphertext when needed, decrypts locally, and returns a `blob:` preview URL. The backend media API and encrypted payload format are unchanged.

```text
MessageBubble interaction
  └─ ChatPanel handler
      ├─ image/video/voice preview: decrypted blob URL, released by UI lifecycle
      └─ generic file open: app-cache lookup, decrypt/cache on miss, OS open
```

### Cache and Burn Semantics

Generic non-burn files now use the native app cache path. Cache keys prefer media identity plus plaintext digest, and filenames are sanitized in the Tauri command layer. Later double-click opens reuse an existing cached plaintext file when it still exists.

Burn-after-reading file opens bypass persistent cache and use temporary preview/open behavior. Burn cleanup also attempts to remove a matching cached file entry before triggering message destruction, covering both automatic countdown burn and manual burn.

### Viewer Lifecycles

Image previews use an image viewer state with active message, image list, zoom, and loaded sources. The viewer loads the active image first and only prefetches adjacent images. Conversation switches and unmount cleanup revoke image/audio/video blob sources and clear media maps.

Video messages remain `messageType = 4` and are identified by `isVideoMediaPayload(payload)`. Single-click and keyboard activation open an in-app video viewer with native controls. Closing the viewer, switching videos, switching conversations, or unmounting pauses the video element and revokes the no-longer-used preview object URL. Right-click/download behavior remains available as fallback.

### Voice Seek

Voice messages still use one shared `HTMLAudioElement` tracked by `audioElementRef` and `audioMessageIdRef`. The waveform now acts as a seek slider. Pointer and keyboard seek requests update the active audio element when it matches the message; otherwise they store a pending seek ratio that is applied on play/resume.

The seek control stops event propagation so dragging the waveform does not also toggle the surrounding message bubble play/pause handler.

### Verification Summary

- Desktop media helper tests cover encrypted preview resolution and burn cache persistence decisions.
- Native file cache tests cover cache reuse, missing-file recovery, filename collisions, and deterministic cleanup paths.
- Voice bubble tests cover playing/paused/error states and pending seek display.
- UI test definitions cover image navigation/zoom, video open/error behavior, and voice pointer/keyboard seek paths.
- Desktop typecheck, desktop build, and targeted Rust file command tests passed.
