## Context

The desktop app currently exposes profile, settings, about, and logout from the bottom of the left navigation drawer. Profile, settings, and about open separate right-side sheets, while the drawer closes. This makes the interaction feel directionally inconsistent: the user starts in the left drawer, but the resulting content appears on the opposite side of the application.

The desired model is to keep the existing left drawer and turn these low-frequency account surfaces into a left-origin expanded control center. The chat/friend workspace remains underneath as context, while the expanded drawer owns account identity, settings, and about content until dismissed.

## Goals / Non-Goals

**Goals:**
- Preserve the current left navigation drawer entry point and chat/friend navigation.
- Replace right-side profile, settings, and about sheets with an expanded drawer/control-center overlay.
- Provide a consistent control-center layout with a persistent navigation column and a content region.
- Redesign personal center content around account identity, avatar area with upload affordance, current device/security status, and account actions.
- Redesign settings as a structured preference surface with notification controls and display mode controls.
- Redesign about content around product identity, version, security capabilities, license, and copyright, without showing framework stack details.
- Keep logout confirmation intact.

**Non-Goals:**
- Adding a backend avatar upload or profile update API.
- Implementing actual avatar persistence if no supported API exists.
- Adding new notification categories beyond backend-supported settings.
- Reworking chat, friend center, message, or call behavior.
- Introducing a full route-based settings page.

## Decisions

### Use a left-origin expanded drawer instead of right sheets

Selecting personal center, settings, or about from the existing drawer SHALL expand the drawer into a larger overlay rather than opening right-side sheets.

Rationale:
- The action originates in the drawer, so the content should preserve spatial continuity.
- Account/settings/about are auxiliary surfaces and should not replace the main chat/friend workspace as full app pages.
- The expanded state can preserve the existing navigation column while giving enough space for structured content.

Alternative considered: standalone full pages. Rejected because these surfaces are low-frequency account utilities and would compete with chat/friend as primary workspaces.

Alternative considered: keep right sheets. Rejected because it causes directional mismatch and fragments the account/settings/about interaction model.

### Model the expanded drawer as a control center state

The implementation should distinguish three navigation overlay states:

```
closed
  -> drawer
  -> expanded-control-center(profile | settings | about)
```

The expanded control center should include:
- A header with product/title context and a close affordance.
- A left navigation column reusing the current drawer entries.
- A content region that renders the selected account surface.
- A back affordance where useful to return from expanded mode to the normal drawer.

### Keep account content product-facing

The personal center should remove implementation-stage copy such as "supported fields" and present stable user-facing information:
- Account identity card with avatar, username, online/login state, user ID, and copy action.
- Avatar upload affordance reserved at the avatar area, shown as an action/overlay even if disabled or marked pending when no API is available.
- Account information rows for user ID, username, and avatar state.
- Current device/security rows for login state, current device label, encryption status, and sync/security status using available client state.
- Account actions such as copying user ID and entering logout confirmation.

### Settings use sections, not "future settings" cards

Settings should be presented as a preference center. Notification settings remain the first supported section. Display mode should be available in settings, using light/dark/system options.

Unimplemented future features should not appear as large product-roadmap cards. If a future area must be visible, it should be a compact disabled row with clear status, not explanatory internal copy.

### About excludes framework stack details

About should focus on:
- Security Chat product identity.
- Desktop app version.
- Security capabilities such as end-to-end encryption, encrypted media handling, and protected voice transport.
- License and copyright.

Framework details such as Tauri, React, Vite, or shadcn-ui should not be shown in the user-facing about surface.

### Reuse existing primitives

The implementation should reuse existing Radix/shadcn primitives where possible. If a drawer/control-center primitive needs behavior not covered by the existing Sheet wrapper, add or extend a shared primitive rather than duplicating accessibility behavior inside feature components.

## Risks / Trade-offs

- [Risk] Expanded drawer can feel too heavy on small windows → Use responsive width constraints, allow full-width presentation below the desktop breakpoint, and keep content scrollable.
- [Risk] Mixing navigation and settings content can create focus-management issues → Use a single accessible dialog/sheet root with a valid title, focus trap, close action, and keyboard escape behavior.
- [Risk] Avatar upload affordance may imply a working feature before the API exists → Present it as a reserved/disabled affordance unless implementation confirms a supported profile update path.
- [Risk] Settings save failures may be hard to notice in a denser layout → Keep row-level disabled/saving/error states for toggles that persist through backend APIs.
- [Risk] Removing right-side sheets may leave dead imports/components during migration → Replace or retire old sheet components only after the expanded control center renders equivalent content.

## Migration Plan

1. Introduce the expanded drawer/control-center state and route profile/settings/about selections into it.
2. Move or refactor profile/settings/about content into content panels usable by the expanded drawer.
3. Remove the right-side sheet usage after parity is reached.
4. Verify drawer open/close, expanded navigation, keyboard escape, focus behavior, notification setting persistence, display mode switching, and logout confirmation.

Rollback strategy: keep the previous sheet components until the expanded drawer is complete, allowing the selection handlers to be restored to the old sheet behavior if needed.

## Open Questions

- Should avatar upload be disabled with "Coming soon" text, or should it open a file picker if an existing profile update API can be discovered during implementation?
- Should selecting "Back" from the expanded control center return to the normal drawer, or close the overlay entirely? The proposed default is to return to the normal drawer when a visible back affordance is used, and close entirely when the close control or Escape is used.
