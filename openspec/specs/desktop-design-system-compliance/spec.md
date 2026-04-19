# desktop-design-system-compliance Specification

## Purpose
Define desktop design-system expectations so feature work reuses shared primitives, preserves the documented visual system, and remains executable by mixed GPT/MiniMax ownership.

## Requirements
### Requirement: Desktop SHALL implement the documented theme modes
The desktop app SHALL support light, dark, and automatic theme modes using the documented Security Chat design variables.

#### Scenario: User changes theme mode
- **WHEN** the user selects light, dark, or automatic theme mode
- **THEN** the desktop app SHALL apply the selected mode consistently across navigation, conversation list, chat thread, settings, dialogs, menus, and input surfaces

#### Scenario: Automatic mode follows system theme
- **WHEN** automatic theme mode is selected and the operating system theme changes
- **THEN** the desktop app SHALL update the effective theme without losing the persisted preference

### Requirement: Desktop SHALL respect documented layout constraints
The desktop app SHALL preserve usable layout at the documented minimum window size and SHALL avoid overlapping critical navigation, message, and input surfaces.

#### Scenario: Window is at minimum size
- **WHEN** the desktop window is resized to the documented minimum dimensions
- **THEN** the sidebar, chat header, message area, and input area SHALL remain usable without critical controls being clipped

### Requirement: Desktop UI implementation SHALL prefer shared shadcn/Radix primitives
The desktop app SHALL implement common controls through existing shared shadcn/Radix primitives or standardized additions to the shared UI layer, rather than duplicating primitive behavior inside feature components.

#### Scenario: Common primitive already exists
- **WHEN** a desktop feature needs a dialog, sheet, dropdown menu, context menu, popover, tooltip, button, input, switch, checkbox, scroll area, or similar common control
- **THEN** the implementation SHALL reuse the existing shared primitive unless a documented limitation requires a standardized extension

#### Scenario: Common primitive is missing
- **WHEN** a required common primitive is missing from the shared UI layer
- **THEN** the implementation SHALL add a reusable primitive in the shared UI layer before composing it into feature-specific components

### Requirement: MiniMax UI tasks SHALL declare reuse and verification plans
MiniMax-owned UI tasks SHALL declare planned shared component reuse, state sources, and verification approach before implementation begins.

#### Scenario: MiniMax begins UI task
- **WHEN** MiniMax starts a desktop UI task
- **THEN** the task notes SHALL identify reused shadcn/Radix primitives, relevant hooks or APIs, source of truth for state, and planned verification

#### Scenario: MiniMax encounters high-risk semantics
- **WHEN** a MiniMax-owned task requires decisions about authentication, protocol, message state, group permissions, backend contracts, or destructive actions
- **THEN** the task SHALL pause for GPT-defined rules or GPT review before implementation continues
