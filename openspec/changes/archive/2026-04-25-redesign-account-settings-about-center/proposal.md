## Why

The current profile, settings, and about entries open separate right-side sheets from the left navigation drawer, which creates a directional mismatch and makes these low-frequency account surfaces feel disconnected from the drawer where they are discovered. The product should keep the existing left drawer entry point while expanding it into a coherent control center for account identity, preferences, and product information.

## What Changes

- Replace the right-side profile, settings, and about sheets with a left-origin expanded drawer/control-center experience.
- Keep the current left navigation drawer and bottom entries, but allow selecting profile, settings, or about to expand the drawer into a larger overlay with a persistent navigation column and a content region.
- Redesign personal center content around account identity, current device/security status, and account actions.
- Reserve avatar upload interaction in the personal center avatar area without requiring upload implementation in this change unless the underlying API already supports it.
- Redesign settings as a structured preference center, with notification settings as the first supported section and display mode available in the settings surface.
- Redesign about content as product and trust information, excluding framework/implementation stack details from the user-facing surface.
- Preserve logout confirmation before account state is cleared.

## Capabilities

### New Capabilities
- `desktop-account-control-center`: Covers the expanded left-drawer control center interaction and the profile/settings/about content model.

### Modified Capabilities
- `desktop-global-navigation`: Update global navigation requirements so profile, settings, and about are displayed inside the left-origin expanded drawer rather than right-side sheets.
- `desktop-design-system-compliance`: Clarify layout/accessibility expectations for the expanded drawer control center and its responsive behavior.
- `notification-delivery-controls`: Clarify that notification settings remain user-configurable inside the redesigned settings surface.

## Impact

- Affected desktop UI components:
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/features/navigation/profile-sheet.tsx`
  - `apps/desktop/src/features/navigation/about-sheet.tsx`
  - `apps/desktop/src/features/settings/notification-settings-sheet.tsx`
  - `apps/desktop/src/styles.css`
- Likely shared UI primitive usage:
  - Existing Radix/shadcn dialog, sheet, scroll, switch, button, avatar, badge, and tabs/segmented controls where available.
- No backend API changes are required for the drawer/control-center redesign.
- Avatar upload is represented as a reserved UI affordance unless a supported upload/update profile API is available during implementation.
