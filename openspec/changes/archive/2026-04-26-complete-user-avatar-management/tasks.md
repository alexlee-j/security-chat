## 1. Backend Avatar Profile API

- [x] 1.1 Add avatar-specific backend configuration for storage path, maximum bytes, allowed MIME types, and served URL prefix.
- [x] 1.2 Implement a current-user avatar update endpoint guarded by JWT authentication.
- [x] 1.3 Validate uploaded avatar files on the backend for presence, size, MIME type, and image content before mutating profile state.
- [x] 1.4 Store accepted avatar files in an avatar-specific storage location separate from conversation media attachments.
- [x] 1.5 Persist the resulting avatar URL to `users.avatar_url` and return the updated profile shape.
- [x] 1.6 Add backend tests for valid avatar update, replacement, unsupported type rejection, oversize rejection, and unchanged profile state on failure.

## 2. Desktop Avatar Upload And Compression

- [x] 2.1 Add a desktop API client function for the avatar update endpoint.
- [x] 2.2 Add a client-side avatar compression helper that decodes the selected image, resizes it to supported bounds, and emits a bounded upload blob.
- [x] 2.3 Ensure compression failure rejects the flow without uploading the original unbounded file.
- [x] 2.4 Add desktop tests for compression output bounds, unsupported file handling, and compression failure behavior.

## 3. Personal Center Upload Flow

- [x] 3.1 Replace the inert personal-center avatar button with a file picker flow for supported image types.
- [x] 3.2 Wire selected files through compression and the avatar update API.
- [x] 3.3 Show clear loading, success, and error states during avatar update.
- [x] 3.4 Update personal-center local profile state with the returned `avatarUrl`.
- [x] 3.5 Notify the app shell after a successful avatar update so navigation profile state refreshes immediately.

## 4. Shared Avatar Rendering

- [x] 4.1 Introduce or refactor to a shared desktop avatar renderer that accepts `avatarUrl`, display name, size/variant, active state, and optional online status.
- [x] 4.2 Preserve existing initials and generated gradient fallback behavior when no avatar URL exists.
- [x] 4.3 Preserve fallback rendering when the avatar image fails to load without changing container size.
- [x] 4.4 Verify active selection and online indicators remain visible when image avatars are used.

## 5. Update Desktop Avatar Surfaces

- [x] 5.1 Update the navigation drawer identity header to render and refresh the current user's avatar.
- [x] 5.2 Update personal center avatar display to use the shared renderer and returned `avatarUrl`.
- [x] 5.3 Update conversation sidebar direct and group rows to render stored avatars when available.
- [x] 5.4 Update chat top bar to accept and render an avatar URL for direct and group conversations.
- [x] 5.5 Update forward dialog conversation rows to render stored avatars.
- [x] 5.6 Update friend center list and detail surfaces to keep and render `avatarUrl`.
- [x] 5.7 Update add-friend and remove-friend dialogs to render stored avatars where available.
- [x] 5.8 Update group create/manage member pickers to render member avatars where available.

## 6. State Refresh And Data Plumbing

- [x] 6.1 Keep `avatarUrl` in friend center local entry models instead of dropping it during mapping.
- [x] 6.2 Pass avatar URLs through remove-friend dialog props and any other dialog models that currently only pass username/user ID.
- [x] 6.3 Refresh profile, friend, and conversation data after avatar update where visible avatar state can become stale.
- [x] 6.4 Confirm backend friend, conversation, and group responses still expose avatar URLs needed by the updated UI.

## 7. Verification

- [x] 7.1 Run backend tests covering the avatar profile API.
- [x] 7.2 Run desktop unit or contract tests for compression, API client behavior, and shared avatar fallback rendering.
- [ ] 7.3 Run desktop GUI verification for personal-center upload flow and immediate drawer avatar refresh.
- [ ] 7.4 Run visual or browser verification across representative avatar surfaces: navigation drawer, personal center, conversation list, chat header, friend center, add/remove friend dialogs, group member picker, and forward dialog.
- [x] 7.5 Run existing backend and desktop regression commands relevant to changed modules.
