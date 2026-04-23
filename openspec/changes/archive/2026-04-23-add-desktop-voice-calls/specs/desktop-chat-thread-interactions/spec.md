## MODIFIED Requirements

### Requirement: Desktop chat thread SHALL expose supported header actions
The desktop app SHALL provide documented chat header actions while enabling supported one-to-one voice calls and preventing unsupported video or group call actions from appearing as functional features.

#### Scenario: User opens chat header menu
- **WHEN** the user opens the chat header more menu
- **THEN** the desktop app SHALL show supported actions such as burn settings, delete conversation, pin, or mute according to the current conversation capabilities

#### Scenario: Supported voice call action is available
- **WHEN** voice call capability is enabled and the user is viewing an eligible direct conversation
- **THEN** the desktop app SHALL expose a voice call action that starts the desktop voice call flow

#### Scenario: Unsupported video or group call action is not misleading
- **WHEN** video capability or group call capability is not part of this release
- **THEN** the desktop app SHALL hide, disable, or explain those controls rather than presenting them as working actions
