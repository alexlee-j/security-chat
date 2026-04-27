## Why

The personal center currently shows an avatar area and upload affordance, but avatar persistence is not implemented and many desktop surfaces still ignore the `avatarUrl` values already returned by backend APIs. Completing avatar management now turns the reserved UI into a real profile feature and makes user identity consistent across navigation, chat, friend, and group-related surfaces.

## What Changes

- Add a supported current-user avatar update flow from the personal center.
- Compress selected avatar images before upload so stored avatars remain lightweight and predictable for repeated desktop rendering.
- Persist the updated avatar URL on the authenticated user's profile and return the updated profile to the client.
- Validate avatar uploads by file type and size, with clear client-side and server-side failure states.
- Update all desktop avatar renderers to prefer `avatarUrl` and fall back to initials/gradient placeholders when no image is configured or an image fails to load.
- Refresh local profile/conversation/friend state after avatar changes so visible avatar surfaces update without requiring logout or app restart.

## Capabilities

### New Capabilities
- `user-avatar-management`: Covers profile avatar upload, compression, persistence, validation, profile refresh, and consistent fallback behavior.

### Modified Capabilities
- `desktop-account-control-center`: Personal center avatar affordance changes from reserved/unavailable to a supported avatar change flow.
- `desktop-global-navigation`: Navigation drawer identity area must reflect the current user's stored avatar and update after avatar changes.
- `desktop-conversation-list-surface`: Conversation list avatars must render stored user/group avatars when available.
- `desktop-chat-thread-interactions`: Chat header and thread-adjacent avatar surfaces must render stored avatars when available.
- `desktop-friend-center-surface`: Friend list, search, request, removal, and detail surfaces must render stored avatars when available.

## Impact

- Backend user profile API gains a current-user avatar update endpoint and avatar-specific validation/storage behavior.
- Desktop API client gains avatar update support and image compression before upload.
- Desktop personal center gains a real file selection/upload/update flow with loading, error, success, and fallback states.
- Desktop avatar rendering is normalized across navigation drawer, account control center, conversation list, chat header, friend center, add-friend dialog, remove-friend dialog, group member pickers, and forwarding surfaces.
- Tests should cover backend profile update validation, desktop avatar compression/update behavior, and representative UI rendering paths that use image avatars and fallback avatars.
