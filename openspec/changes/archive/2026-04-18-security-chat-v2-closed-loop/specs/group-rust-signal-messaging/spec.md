## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Group governance actions SHALL remain consistent with Rust-managed cryptographic state
The system SHALL reject or reconcile any group governance action that would leave visible product state and Rust-managed cryptographic state inconsistent.

#### Scenario: Group rename does not disturb decryptability
- **WHEN** a group metadata update such as rename or avatar change occurs without a membership change
- **THEN** the system SHALL preserve decryptability for active members without forcing an unrelated key reset

#### Scenario: Membership action is not considered complete until governance and crypto state converge
- **WHEN** a group member is added, removed, or rejoined
- **THEN** the system SHALL only expose the resulting group state as complete after the membership record and required Sender Key lifecycle transition have both succeeded
