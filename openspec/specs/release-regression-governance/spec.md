# release-regression-governance Specification

## Purpose
TBD - created by archiving change advance-to-global-completion. Update Purpose after archive.
## Requirements
### Requirement: This initiative SHALL execute on a dedicated integration branch with explicit role ownership
The system delivery process for this initiative SHALL use a dedicated development branch and SHALL assign protocol-critical work to GPT and supporting lower-risk work to MiniMax.

#### Scenario: Implementation starts from a dedicated branch
- **WHEN** implementation begins for this initiative
- **THEN** development SHALL occur on a new branch named for the initiative rather than directly on `main`

#### Scenario: Role ownership is explicit
- **WHEN** tasks are planned and executed for this initiative
- **THEN** protocol-critical backend/Rust/frontend convergence tasks SHALL be owned by GPT and supporting integration, UI, documentation, and lower-risk tasks SHALL be owned by MiniMax

### Requirement: Merge readiness SHALL require cross-layer regression closure
The initiative SHALL NOT be considered complete until backend, Rust, frontend, and real-account regression gates for the affected 2.0 flows are all green, including account recovery, group governance, and sync reliability.

#### Scenario: Direct-message convergence gate
- **WHEN** transport convergence changes are proposed for merge
- **THEN** backend tests, desktop build, and real-account direct-message smoke validation SHALL all pass

#### Scenario: Group messaging completion gate
- **WHEN** group Rust/Sender Key and governance changes are proposed for merge
- **THEN** Rust protocol tests, backend membership/message regressions, frontend group smoke tests, and documented rollback notes SHALL all be present and passing

#### Scenario: 2.0 account recovery gate
- **WHEN** account-recovery and authentication-hardening changes are proposed for merge
- **THEN** password-policy validation, recovery flow tests, mail-channel verification, and real account recovery smoke validation SHALL all pass

### Requirement: Version 2.0 SHALL publish one maintained regression matrix and one maintained rollback plan
The system delivery process SHALL keep the release matrix and rollback instructions current with the implemented 2.0 scope so the version can be evaluated and, if necessary, reversed by milestone.

#### Scenario: Regression matrix matches implemented scope
- **WHEN** a 2.0 feature area is added or materially changed
- **THEN** the release matrix SHALL be updated so its required commands and real-flow checks match the new scope

#### Scenario: Rollback plan is milestone-based
- **WHEN** a severe regression is found in a 2.0 release candidate
- **THEN** the documented rollback plan SHALL identify which milestone can be reverted without requiring ad hoc manual rollback steps

