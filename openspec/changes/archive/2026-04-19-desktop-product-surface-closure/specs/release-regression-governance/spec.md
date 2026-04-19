## MODIFIED Requirements

### Requirement: This initiative SHALL execute on a dedicated integration branch with explicit role ownership
The system delivery process for this initiative SHALL use a dedicated development branch and SHALL assign protocol-critical work to GPT and supporting lower-risk work to MiniMax. For the desktop product surface closure initiative, implementation SHALL occur on `feature/desktop-product-surface-closure`.

#### Scenario: Implementation starts from a dedicated branch
- **WHEN** implementation begins for this initiative
- **THEN** development SHALL occur on a new branch named for the initiative rather than directly on `main`

#### Scenario: Role ownership is explicit
- **WHEN** tasks are planned and executed for this initiative
- **THEN** protocol-critical backend/Rust/frontend convergence tasks SHALL be owned by GPT and supporting integration, UI, documentation, and lower-risk tasks SHALL be owned by MiniMax

#### Scenario: Desktop surface implementation uses required branch
- **WHEN** work begins on desktop product surface closure
- **THEN** the current branch SHALL be `feature/desktop-product-surface-closure`

### Requirement: Merge readiness SHALL require cross-layer regression closure
The initiative SHALL NOT be considered complete until backend, Rust, frontend, and real-account regression gates for the affected 2.0 flows are all green, including account recovery, group governance, sync reliability, and the desktop product surface interactions included in this change.

#### Scenario: Direct-message convergence gate
- **WHEN** transport convergence changes are proposed for merge
- **THEN** backend tests, desktop build, and real-account direct-message smoke validation SHALL all pass

#### Scenario: Group messaging completion gate
- **WHEN** group Rust/Sender Key and governance changes are proposed for merge
- **THEN** Rust protocol tests, backend membership/message regressions, frontend group smoke tests, and documented rollback notes SHALL all be present and passing

#### Scenario: 2.0 account recovery gate
- **WHEN** account-recovery and authentication-hardening changes are proposed for merge
- **THEN** password-policy validation, recovery flow tests, mail-channel verification, and real account recovery smoke validation SHALL all pass

#### Scenario: Desktop product surface gate
- **WHEN** desktop product surface changes are proposed for merge
- **THEN** desktop build, desktop interaction smoke, design coverage checklist, and documented deferrals for out-of-scope call/video interactions SHALL all be present
