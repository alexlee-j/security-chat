## 1. Dialog Structure Refactor

- [x] 1.1 Rebuild `GroupCreateModal` with dialog-native structure (`DialogHeader`/`DialogTitle`/`DialogDescription`/content/footer) and remove legacy shell dependency from core layout.
- [x] 1.2 Split create/manage form boundaries to eliminate nested form DOM and keep deterministic submit behavior.
- [x] 1.3 Ensure dialog close actions (X, cancel, escape, outside click policy) remain consistent with desktop app conventions.

## 2. Layout And Operability Hardening

- [x] 2.1 Add stable height and scroll strategy so create/manage controls remain reachable on supported desktop window sizes.
- [x] 2.2 Verify member search results and member list regions remain readable/actionable without clipping or overlap.
- [x] 2.3 Align dialog visual primitives with shared shadcn style usage and avoid fallback to ad-hoc modal mechanics.

## 3. Interaction Flow Verification

- [x] 3.1 Validate FAB -> new group dialog open path stays in chat workspace and does not introduce navigation hops.
- [x] 3.2 Validate create success/cancel close the dialog cleanly and return to expected chat context.
- [x] 3.3 Confirm no runtime warnings for dialog title accessibility or form nesting during create/manage interactions.

## 4. Regression Checks

- [x] 4.1 Run desktop build and targeted manual verification for group create/manage UI under normal and smaller window sizes.
- [x] 4.2 Document verification notes in the change task list and mark completion only after warning-free console checks.

### Verification Notes (2026-04-21)

- `pnpm -C apps/desktop build` passed (`tsc -b` + `vite build`) after modal refactor.
- `GroupCreateModal` now uses one create form + one manage-profile form, and both member-search flows are button-triggered to avoid nested form trees.
- `DialogHeader` + `DialogTitle` + `DialogDescription` are always rendered inside `DialogContent`, satisfying Radix dialog title contract.
- Dialog content is constrained with explicit max-height and internal scroll container to keep controls reachable on smaller window heights.
