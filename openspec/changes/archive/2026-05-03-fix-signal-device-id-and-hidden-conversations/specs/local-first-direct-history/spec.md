## MODIFIED Requirements

### Requirement: Direct chat history SHALL be local-first

**MODIFIED FROM:** Supported desktop direct-chat clients SHALL render readable conversation history from the local device store first and SHALL NOT require backend historical ciphertext retrieval to open an existing direct conversation.

**TO:** Supported desktop direct-chat clients SHALL render readable conversation history from the local device store first and SHALL NOT require backend historical ciphertext retrieval to open an existing direct conversation. Hidden conversations (where `hidden=true` for the current user) SHALL NOT appear in the default conversation list but SHALL remain accessible when explicitly unhidden.

#### Scenario: Previously used desktop opens direct conversation that is hidden
- **WHEN** a logged-in desktop device opens a direct conversation that has `hidden=true` for the current user
- **THEN** the client SHALL check if a hidden conversation exists before creating a new conversation
- **AND** if found, SHALL set `hidden=false` and display the conversation

#### Scenario: Previously used desktop opens direct conversation that is not hidden
- **WHEN** a logged-in desktop device opens a direct conversation that has `hidden=false` for the current user
- **THEN** the client SHALL render those local messages before making any network request for pending remote delivery

### Requirement: Pending direct envelopes SHALL be synchronized after local replay

**MODIFIED FROM:** Supported desktop direct-chat clients SHALL fetch only pending server-side direct envelopes addressed to the authenticated device after local history replay has started or completed.

**TO:** Supported desktop direct-chat clients SHALL fetch only pending server-side direct envelopes addressed to the authenticated device after local history replay has started or completed. When a pending envelope is received from a sender whose conversation is hidden for the current user, the client SHALL automatically unhide that conversation.

#### Scenario: Device receives message from user with hidden conversation
- **WHEN** a desktop device receives a pending direct envelope from 用户 B while 用户 A's conversation with 用户 B is `hidden=true`
- **THEN** the client SHALL set `hidden=false` for that conversation locally
- **AND** the conversation SHALL appear in the conversation list after the message is persisted