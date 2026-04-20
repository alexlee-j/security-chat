## Overview

This is a **UI-only refactor** of the FriendPanel component. No new capabilities are introduced and no existing requirements are modified. All existing business logic remains unchanged.

**Refer to**: `../proposal.md` for change motivation and `../design.md` for implementation approach.

## ADDED Requirements

### Requirement: FriendPanel UI follows ConversationSidebar design system

The FriendPanel component SHALL use shadcn/ui components and Tailwind CSS classes consistent with the ConversationSidebar component, achieving visual cohesion across desktop workspace areas.

#### Scenario: Visual consistency
- **WHEN** user switches between Chat workspace and Friend workspace
- **THEN** both workspaces present unified visual language (avatar styling, button variants, card layouts, spacing system)
