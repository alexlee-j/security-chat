## 1. Branch And Baseline Governance

- [x] 1.1 Verify implementation branch is `feature/desktop-product-surface-closure` before any code changes
- [x] 1.2 Create a desktop design coverage matrix from the 2026-04-07 design documents, explicitly excluding audio/video calling
- [x] 1.3 Document GPT / MiniMax ownership in the implementation notes: GPT owns state semantics and cross-layer contracts; MiniMax owns low-risk UI surface and design fidelity
- [x] 1.4 Audit existing desktop components and classify each as reuse, refactor, or replace
- [x] 1.5 GPT: produce a MiniMax execution checklist requiring shadcn/Radix reuse, state-source identification, verification notes, and escalation points before MiniMax starts UI tasks
- [x] 1.6 MiniMax: before each UI task, list the existing shadcn/Radix primitives, hooks, API functions, and CSS tokens to reuse; do not create duplicate primitives without GPT approval

## 2. Global Navigation And Core Pages

- [x] 2.1 MiniMax: complete navigation drawer actions for theme, profile, settings, about, and logout using existing Sheet/Dialog/Button primitives where possible
- [x] 2.2 MiniMax: implement `/profile` or equivalent profile surface with account identity and supported profile fields using shared Card/Avatar/Button primitives where possible
- [x] 2.3 MiniMax: implement `/settings` or equivalent settings surface that hosts notification and future settings sections using shared Sheet/Switch/Button/Input primitives where possible
- [x] 2.4 MiniMax: implement `/about` or equivalent about surface with version, copyright, license, and repository/build information using shared layout primitives and existing design tokens
- [x] 2.5 GPT: define and verify logout state clearing semantics so logout does not leave stale account or device state

## 3. Design System And Theme Compliance

- [x] 3.1 MiniMax: align light, dark, and auto theme surfaces with documented design variables
- [x] 3.2 MiniMax: verify sidebar, chat panel, dialogs, menus, sheets, popovers, and settings surfaces respect theme changes
- [x] 3.3 MiniMax: verify minimum desktop window layout does not clip critical controls
- [x] 3.4 GPT: define behavior for unsupported call/video controls as hidden, disabled, or explained unavailable state

## 4. Conversation List Surface

- [x] 4.1 MiniMax: complete conversation list search behavior, clear action, empty state, and active selection styling using existing Input/Button/search-shell styles where possible
- [x] 4.2 MiniMax: implement conversation context menu UI for pin, mute, delete, and copy conversation ID using shared ContextMenu primitives
- [x] 4.3 GPT: define pin/mute/delete backend or local-state contract and prevent UI actions from faking unsupported persistence
- [x] 4.4 GPT: verify conversation preview and unread display remain consistent after context actions and sync replay

## 5. Chat Thread Interactions

- [x] 5.1 MiniMax: complete chat header more menu for supported non-call actions using shared DropdownMenu primitives
- [x] 5.2 GPT: define message action rule matrix by message type, ownership, delivery state, direct/group context, and media availability
- [x] 5.3 MiniMax: implement message context menu UI for copy, quote, forward, delete, and download according to GPT rule matrix using shared ContextMenu primitives
- [x] 5.4 GPT: verify quote, forward, delete, and download actions preserve encrypted-message and group/direct contracts
- [x] 5.5 MiniMax: complete chat search result list and scroll/focus behavior for visible messages

## 6. Input Surface Completion

- [x] 6.1 MiniMax: complete emoji picker insertion without clearing existing text, quote, or attachment state, reusing the existing emoji picker unless GPT approves replacement
- [x] 6.2 MiniMax: complete attachment selection preview and supported send entry points using existing media upload APIs and shared Button/Popover/Dialog primitives where possible
- [x] 6.3 GPT: verify attachment send flow preserves media upload, message state, and retry semantics
- [x] 6.4 MiniMax: implement quote-state visual treatment and cancel behavior in the input area
- [x] 6.5 GPT: define recording support level for this release and require microphone entry to be working, disabled, hidden, or explicitly explained

## 7. Group Product Surface

- [x] 7.1 MiniMax: complete group profile or management surface with group metadata and member list using shared Sheet/Dialog/ScrollArea/Button primitives where possible
- [x] 7.2 MiniMax: expose add member, remove member, leave group, and metadata edit affordances based on available permissions; do not invent permission rules without GPT matrix
- [x] 7.3 GPT: verify group UI actions align with 2.0 group governance and Sender Key lifecycle rules
- [x] 7.4 MiniMax: render group lifecycle events or equivalent visible state for rename, invite, leave, remove, and rejoin
- [x] 7.5 GPT: verify removed-member and rejoined-member desktop states match backend and cryptographic authorization semantics

## 8. Settings And Notification Surface

- [x] 8.1 MiniMax: expose all backend-supported notification categories in desktop settings using shared Switch/Button/Sheet primitives
- [x] 8.2 MiniMax: persist notification setting changes and refresh visible effective values after save
- [x] 8.3 GPT: verify desktop settings values match backend notification policy for message, friend request, burn, group, account recovery, and security events

## 9. Regression Gates And Documentation

- [x] 9.1 MiniMax: update README and desktop design coverage checklist with implemented, deferred, and out-of-scope items
- [x] 9.2 GPT: update release/regression matrix for desktop product surface closure
- [x] 9.3 MiniMax: add or update Playwright/desktop smoke coverage for navigation, settings, conversation list, chat thread, input surface, and group UI
- [x] 9.4 GPT: run final verification gates including `pnpm -C apps/desktop build` and required desktop smoke checks
- [x] 9.5 GPT: produce merge-readiness conclusion, including explicit call/video exclusion and any deferred desktop surface items
