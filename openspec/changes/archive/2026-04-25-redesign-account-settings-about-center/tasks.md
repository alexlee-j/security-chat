## 1. Control Center Shell

- [x] 1.1 Audit current navigation drawer, profile sheet, settings sheet, and about sheet state ownership in `App.tsx`.
- [x] 1.2 Add control-center state for `profile`, `settings`, and `about` while preserving the existing normal drawer open/close behavior.
- [x] 1.3 Build or extend a shared overlay/sheet primitive for a left-origin expanded drawer with accessible title, focus management, Escape dismissal, and close control.
- [x] 1.4 Compose the expanded control center with a persistent navigation column, selected-section state, content region, back affordance, and close affordance.

## 2. Personal Center Content

- [x] 2.1 Refactor profile content out of the right-side sheet into a reusable personal-center panel.
- [x] 2.2 Redesign the account identity card with avatar, username, login/online state, user ID, and copy user ID action.
- [x] 2.3 Add an avatar upload/change affordance at the avatar area, disabled or clearly unavailable if no supported profile update API exists.
- [x] 2.4 Add account information rows and current device/security status rows using available client/profile state.
- [x] 2.5 Route logout from personal center through the existing logout confirmation dialog.

## 3. Settings Content

- [x] 3.1 Refactor notification settings content out of the right-side sheet into a reusable settings panel.
- [x] 3.2 Present settings as structured sections with notification controls as the supported section.
- [x] 3.3 Move or duplicate display mode selection into the settings surface with light, dark, and system options wired to existing theme behavior.
- [x] 3.4 Remove large "future settings" roadmap cards from the user-facing settings content.
- [x] 3.5 Preserve notification loading, saving, disabled, and failure behavior for backend-persisted toggles.

## 4. About Content

- [x] 4.1 Refactor about content out of the right-side sheet into a reusable about panel.
- [x] 4.2 Redesign about content around product identity, desktop version, security capability summaries, license, and copyright.
- [x] 4.3 Remove framework stack details and internal implementation explanations from user-facing about content.

## 5. Styling And Responsiveness

- [x] 5.1 Add styles for normal drawer, expanded control center width, content column, section navigation, and responsive narrow-width behavior.
- [x] 5.2 Tune overlay opacity so the main workspace remains contextual without competing with the control center.
- [x] 5.3 Verify text wrapping, button sizing, and scroll behavior at minimum supported desktop window sizes.

## 6. Verification

- [x] 6.1 Add or update desktop component tests for opening the drawer, expanding each section, switching sections, and closing the control center.
- [x] 6.2 Add or update tests for settings notification toggles and display mode controls inside the redesigned settings panel.
- [x] 6.3 Add visual or browser verification for profile, settings, and about at desktop and narrow widths.
- [x] 6.4 Run desktop build/typecheck and relevant test commands.
