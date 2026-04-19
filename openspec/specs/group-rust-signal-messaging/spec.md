# group-rust-signal-messaging Specification

## Purpose
TBD - created by archiving change advance-to-global-completion. Update Purpose after archive.
## Requirements
### Requirement: Group chat SHALL use a Rust-first Sender Key messaging path
The system SHALL implement group messaging on a Rust-first cryptographic path using Sender Key semantics instead of reusing direct-message per-device fan-out as the steady-state group model.

#### Scenario: Group message send uses Sender Key state
- **WHEN** a user sends a message to a group conversation
- **THEN** the client and backend SHALL use the group Sender Key path defined for that conversation rather than the direct-message `send-v2` fan-out model

#### Scenario: Group message receive decrypts through Rust-managed group state
- **WHEN** a group member receives or loads a group message
- **THEN** the desktop client SHALL decrypt the message through the Rust-managed group cryptographic state for that group

### Requirement: Group membership changes SHALL enforce explicit key lifecycle rules
The system SHALL define and enforce Sender Key lifecycle behavior for group creation, join, leave, removal, rejoin, and metadata-governed membership events so that active members can decrypt authorized messages, rejoined members receive current state correctly, and removed members cannot decrypt future messages.

#### Scenario: New member receives valid group key material
- **WHEN** a member is added to a group
- **THEN** the system SHALL provision the cryptographic state required for that member to decrypt subsequent group messages

#### Scenario: Removed member loses access to future messages
- **WHEN** a member leaves or is removed from a group
- **THEN** the system SHALL rotate or replace group key material according to the defined lifecycle so the removed member cannot decrypt future group traffic

#### Scenario: Rejoined member uses current lifecycle state
- **WHEN** a previously removed or departed member is added back into a group
- **THEN** the system SHALL provision that member from the current Sender Key lifecycle state instead of assuming stale pre-removal state remains valid

### Requirement: Group governance actions SHALL remain consistent with Rust-managed cryptographic state
The system SHALL reject or reconcile any group governance action that would leave visible product state and Rust-managed cryptographic state inconsistent.

#### Scenario: Group rename does not disturb decryptability
- **WHEN** a group metadata update such as rename or avatar change occurs without a membership change
- **THEN** the system SHALL preserve decryptability for active members without forcing an unrelated key reset

#### Scenario: Membership action is not considered complete until governance and crypto state converge
- **WHEN** a group member is added, removed, or rejoined
- **THEN** the system SHALL only expose the resulting group state as complete after the membership record and required Sender Key lifecycle transition have both succeeded

