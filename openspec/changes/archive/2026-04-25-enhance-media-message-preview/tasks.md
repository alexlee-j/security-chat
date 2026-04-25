## 1. Architecture and Media Resolution

- [x] 1.1 [GPT-5.5] Confirm current chat media flow, object URL lifecycle, burn-message cleanup hooks, and exact integration points in `ChatPanel`.
- [x] 1.2 [GPT-5.5] Define the shared media resolution contract for preview blob URLs versus persistent cached file paths.
- [x] 1.3 [GPT-5.3-Codex] Add desktop media helper functions for resolving decrypted preview blobs without changing backend media APIs.
- [x] 1.4 [GPT-5.3-Codex] Preserve legacy media URL fallback behavior for messages without encrypted media metadata.

## 2. Native File Cache and Open Flow

- [x] 2.1 [GPT-5.3-Codex] Add Tauri commands to store decrypted files in the app cache directory using sanitized filenames and media identity/digest-aware paths.
- [x] 2.2 [GPT-5.3-Codex] Add Tauri command support to check cached file existence and open cached files with the operating system handler.
- [x] 2.3 [GPT-5.3-Codex] Add frontend `native-file` wrappers for ensure-cache/open-cache behavior.
- [x] 2.4 [GPT-5.5] Integrate generic file double-click so first open downloads/decrypts/caches and later opens reuse the cached file without downloading again.
- [x] 2.5 [GPT-5.5] Ensure burn-after-reading media does not leave persistent plaintext cache after burn cleanup.

## 3. Image Viewer

- [x] 3.1 [MiniMax-2.7] Replace single-image preview state with an image viewer state model containing active image message, image list, zoom, and loaded sources.
- [x] 3.2 [MiniMax-2.7] Implement swiper navigation for previous/next image messages in the active conversation.
- [x] 3.3 [MiniMax-2.7] Implement zoom in, zoom out, reset, double-click zoom, and keyboard close/navigation controls.
- [x] 3.4 [MiniMax-2.7] Add current-image-first loading and adjacent-image prefetch while avoiding eager full-thread image downloads.
- [x] 3.5 [GPT-5.5] Review image viewer object URL cleanup on close, conversation switch, and source replacement.

## 4. Video Preview

- [x] 4.1 [MiniMax-2.7] Update video message interaction so video attachments open an in-app viewer instead of the generic file-open path.
- [x] 4.2 [MiniMax-2.7] Implement video viewer UI using decrypted blob URLs and native playback controls.
- [x] 4.3 [MiniMax-2.7] Add unsupported-playback and loading/error states for decrypted videos.
- [x] 4.4 [GPT-5.5] Preserve right-click download/open fallback behavior for video messages.
- [x] 4.5 [GPT-5.5] Verify video viewer releases object URLs and stops playback when closed or switched.

## 5. Voice Seek Control

- [x] 5.1 [MiniMax-2.7] Upgrade the voice waveform/progress area into a pointer-accessible seek control.
- [x] 5.2 [MiniMax-2.7] Support click and drag seek for playing voice messages.
- [x] 5.3 [MiniMax-2.7] Support seek while paused so resume starts from the selected position.
- [x] 5.4 [GPT-5.5] Ensure seeking reuses the existing single-audio-element state and does not regress pause/resume or failure states.

## 6. Styling and Accessibility

- [x] 6.1 [MiniMax-2.7] Add responsive viewer styling for image and video preview without overlapping chat controls.
- [x] 6.2 [MiniMax-2.7] Add accessible labels and keyboard focus behavior for viewer controls and voice seeking.
- [x] 6.3 [MiniMax-2.7] Keep message bubbles compact and stable while adding seekable voice progress.

## 7. Tests and Verification

- [x] 7.1 [GPT-5.3-Codex] Add focused tests for cached file reuse, missing-cache recovery, and filename collision handling.
- [x] 7.2 [MiniMax-2.7] Add UI tests for image viewer navigation, zoom controls, and video viewer open/error behavior.
- [x] 7.3 [MiniMax-2.7] Add UI or component tests for voice click/drag seek and paused seek behavior.
- [x] 7.4 [GPT-5.5] Add or update tests for burn media cache cleanup semantics.
- [x] 7.5 [GPT-5.5] Run desktop typecheck/test suite and targeted Rust checks for the Tauri command changes.
- [x] 7.6 [GPT-5.5] Perform final review against proposal, design, and all spec scenarios before marking the change complete.
