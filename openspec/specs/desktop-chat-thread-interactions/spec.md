# desktop-chat-thread-interactions Specification

## Purpose
Define the desktop chat thread surfaces that complete the non-call/chat product loop for supported 2.0 messaging interactions.

## Requirements
### Requirement: Desktop chat thread SHALL expose supported header actions
The desktop app SHALL provide documented chat header actions while preventing unsupported call and video actions from appearing as functional features.

#### Scenario: User opens chat header menu
- **WHEN** the user opens the chat header more menu
- **THEN** the desktop app SHALL show supported actions such as burn settings, delete conversation, pin, or mute according to the current conversation capabilities

#### Scenario: Unsupported call action is not misleading
- **WHEN** call or video capability is not part of this release
- **THEN** the desktop app SHALL hide, disable, or explain the call/video controls rather than presenting them as working actions

### Requirement: Desktop message bubbles SHALL provide type-aware context actions
The desktop app SHALL provide message context actions based on message type, sender ownership, and delivery state.

#### Scenario: User opens text message context menu
- **WHEN** the user opens the context menu for a text message
- **THEN** the desktop app SHALL expose supported actions such as copy, quote, forward, and delete according to message ownership and state

#### Scenario: User opens media message context menu
- **WHEN** the user opens the context menu for an image, file, or audio message
- **THEN** the desktop app SHALL expose supported actions such as copy, quote, forward, download, and delete according to message type and state

### Requirement: Desktop chat search SHALL locate visible message results
The desktop app SHALL support searching within a chat thread and SHALL allow users to move from search result to the corresponding visible message.

#### Scenario: User searches current chat
- **WHEN** the user enters a keyword in chat search
- **THEN** the desktop app SHALL list matching visible messages and SHALL allow selecting a result to focus or scroll to that message
