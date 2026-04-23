# call-history Specification

## Purpose
Define conversation-level voice call history records and desktop rendering behavior for completed and terminal one-to-one call outcomes.

## Requirements
### Requirement: Conversations record voice call outcomes
The system SHALL create conversation-level call history records for terminal one-to-one voice call outcomes.

#### Scenario: Completed call record
- **WHEN** a connected voice call ends normally
- **THEN** the system records the call participants
- **AND** records the accepted time, ended time, duration, and ended outcome

#### Scenario: Rejected call record
- **WHEN** the callee rejects an incoming voice call
- **THEN** the system records a rejected call outcome in the conversation

#### Scenario: Missed call record
- **WHEN** an incoming voice call times out without acceptance
- **THEN** the system records a missed call outcome in the conversation

#### Scenario: Offline call record
- **WHEN** a caller attempts a call while the callee has no online devices and offline history creation is enabled
- **THEN** the system records an offline or missed call outcome in the conversation

### Requirement: Desktop renders voice call history in the chat timeline
The desktop client SHALL render voice call history records in the conversation timeline without treating them as encrypted chat message bodies.

#### Scenario: Render completed call
- **WHEN** the chat timeline includes a completed voice call record
- **THEN** the desktop client shows a voice call history item with duration and participants

#### Scenario: Render missed call
- **WHEN** the chat timeline includes a missed voice call record
- **THEN** the desktop client shows a missed call history item

#### Scenario: Render rejected call
- **WHEN** the chat timeline includes a rejected voice call record
- **THEN** the desktop client shows a rejected call history item

### Requirement: Conversation previews remain stable when call history is loaded lazily
The desktop client SHALL NOT reorder or rewrite conversation list previews from call history data that is only loaded for the currently selected conversation.

#### Scenario: Selected conversation call history loads
- **WHEN** a desktop user selects a conversation and the client loads that conversation's call history
- **THEN** the conversation list order remains based on stable conversation metadata such as pinned state, latest message time, and unread count

#### Scenario: Call history appears in the timeline
- **WHEN** call history is available for the selected conversation
- **THEN** the desktop client renders the call history in the chat timeline

#### Scenario: Future stable preview data
- **WHEN** a future conversation list API includes call history in stable latest-activity metadata for every listed conversation
- **THEN** the conversation preview may include call history without depending on the currently selected conversation only
