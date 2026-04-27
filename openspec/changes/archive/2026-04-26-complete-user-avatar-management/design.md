## Context

The backend already has `users.avatar_url`, and several APIs already return `avatarUrl` for users, friends, conversation peers, group members, and groups. The desktop app also carries `avatarUrl` in its TypeScript types, but many UI surfaces still render only initials or generated gradients.

The current personal center was intentionally designed with a reserved avatar upload affordance because no supported profile update API existed at that time. This change converts that affordance into a working flow and makes avatar rendering consistent across the desktop product.

The existing media upload system is optimized for chat attachments. It supports encrypted media, conversation attachment, and conversation-based download authorization. Profile avatars are public identity metadata within the authenticated product surface, so reusing conversation media semantics would create avoidable permission and lifecycle coupling.

## Goals / Non-Goals

**Goals:**
- Let the authenticated desktop user update their profile avatar from personal center.
- Compress selected avatar images on the client before upload.
- Validate avatar uploads on the backend and persist the resulting URL in `users.avatar_url`.
- Keep uploaded avatars lightweight enough for repeated rendering in lists and headers.
- Update all desktop avatar surfaces to render `avatarUrl` first and fall back to existing initials/gradient behavior.
- Refresh visible profile, friend, and conversation state after an avatar update without requiring logout or app restart.

**Non-Goals:**
- Do not change Signal message encryption, encrypted media attachment payloads, or message media access rules.
- Do not add public unauthenticated profile pages.
- Do not implement avatar cropping UI beyond deterministic compression/resizing needed for this change.
- Do not implement group avatar upload unless an existing group profile flow only needs renderer consistency; user avatar upload is the primary persistence scope.
- Do not migrate historical null avatars to generated image assets.

## Decisions

### Decision: Add a dedicated current-user avatar update API

Add a current-user profile avatar endpoint under the user/profile area rather than reusing `/media/upload`.

Rationale:
- Avatar assets need to be readable wherever authenticated users can see identity metadata.
- Chat media download authorization is conversation-scoped and would block valid avatar use cases such as friend search results.
- A profile-specific endpoint can enforce avatar-specific limits, MIME types, and response shape.

Alternative considered: upload avatar through `/media/upload`, store a media download URL as `avatarUrl`, and loosen media authorization. This would blur encrypted message media and identity asset rules, so it should be avoided.

### Decision: Compress on the desktop client before upload and validate again on the backend

The desktop app should load the selected image into an image/canvas pipeline, resize it to a bounded square dimension, encode it to a compact image format supported by the runtime, and upload the compressed blob. The backend should still enforce allowed MIME types, maximum byte size, and basic content validation because client compression is not a trust boundary.

Suggested constraints:
- Accept JPEG, PNG, and WebP when the runtime and backend can validate them.
- Resize longest edge to a fixed avatar maximum, such as 512 px.
- Target a small upload size, such as under 256 KB after compression, with a backend hard cap.
- Preserve a simple fallback path if canvas decoding fails: reject with clear UI copy rather than uploading the original unbounded file.

Alternative considered: upload original files and compress server-side. This centralizes quality control, but it adds server image-processing dependencies and increases upload/network cost. Client-side compression is sufficient for this desktop flow when paired with server validation.

### Decision: Store avatar assets in an avatar-specific storage path and save a stable URL

Persist avatar files separately from conversation media, then store the resulting URL or path-derived URL in `users.avatar_url`. Replacing an avatar should update `avatar_url`; old files may be left for later cleanup or removed if deletion is straightforward and safe.

Rationale:
- Avatar URLs should be stable product metadata, not message attachment records.
- This keeps media attachment lifecycle separate from profile lifecycle.
- It allows the frontend to use a plain image URL in `AvatarImage` across all surfaces.

### Decision: Normalize avatar rendering through a shared desktop helper/component

Create or reuse a small avatar renderer that accepts `avatarUrl`, display name, size/style variant, active state, and online status. Existing gradient/initial behavior remains the fallback. Surfaces that currently strip `avatarUrl` from local view models should keep the field.

Target surfaces:
- Personal center hero and account rows.
- Navigation drawer identity header.
- Conversation sidebar direct and group rows.
- Chat top bar.
- Friend center list/detail/search/request/removal surfaces.
- Add-friend dialog and remove-friend dialog.
- Group create/manage member lists.
- Forward dialog conversation rows.

Rationale:
- Without a shared rendering path, future avatar fixes will drift across components.
- A single fallback policy prevents broken-image or empty-avatar states.

### Decision: Refresh profile-dependent desktop state after avatar update

After a successful update, the personal center should update its local profile state and notify the application shell so `navProfile` is updated immediately. The desktop app should also refresh friend/conversation data where the changed avatar can appear, especially for the current user's identity and any cached profile rows.

Rationale:
- The current app fetches nav profile and personal-center profile separately.
- Without a callback or shared refresh action, successful updates can leave stale drawer/header avatars until a reload.

## Risks / Trade-offs

- [Risk] Canvas compression quality differs across platforms or source images. → Mitigation: use bounded dimensions, explicit quality settings, tests around output size/type, and clear failure handling when decoding fails.
- [Risk] Avatar URLs become accessible outside the intended auth context. → Mitigation: serve avatars through authenticated backend routes or through a storage path whose exposure is explicitly accepted for in-product identity metadata.
- [Risk] Existing APIs return fresh `avatarUrl` but desktop caches stale rows. → Mitigation: refresh profile, conversation list, and friend data after update and keep `avatarUrl` in local view models.
- [Risk] Broken remote image URLs create visually empty avatars. → Mitigation: every renderer must keep initials/gradient fallback visible when the image is missing or fails to load.
- [Risk] Adding server-side image processing would slow the change. → Mitigation: start with client compression plus server validation; defer server transcoding unless product/security review requires it.

## Migration Plan

1. Add backend avatar-specific upload/update support while preserving existing `avatar_url` nullable column.
2. Add desktop API client and compression helper.
3. Wire personal center upload/update flow and profile refresh callback.
4. Update avatar renderers across desktop surfaces to use `avatarUrl` first.
5. Add backend and desktop tests for update, compression, rendering, and fallback behavior.
6. Existing users with null `avatar_url` continue to see initials/gradient fallback.

Rollback is straightforward: disable or hide the personal-center avatar update action while preserving read-only avatar rendering and existing `avatar_url` data.

## Open Questions

- Should avatar image delivery require authenticated API requests, or is an app-served static URL acceptable for this product?
- Should old avatar files be deleted immediately on replacement or cleaned asynchronously later?
- Should WebP be accepted in the first implementation if all target desktop runtimes support encoding and display consistently?
