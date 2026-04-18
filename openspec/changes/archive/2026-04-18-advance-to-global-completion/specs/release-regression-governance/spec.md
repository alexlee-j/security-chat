## ADDED Requirements

### Requirement: This initiative SHALL execute on a dedicated integration branch with explicit role ownership
The system delivery process for this initiative SHALL use a dedicated development branch and SHALL assign protocol-critical work to GPT and supporting lower-risk work to MiniMax.

#### Scenario: Implementation starts from a dedicated branch
- **WHEN** implementation begins for this initiative
- **THEN** development SHALL occur on a new branch named for the initiative rather than directly on `main`

#### Scenario: Role ownership is explicit
- **WHEN** tasks are planned and executed for this initiative
- **THEN** protocol-critical backend/Rust/frontend convergence tasks SHALL be owned by GPT and supporting integration, UI, documentation, and lower-risk tasks SHALL be owned by MiniMax

### Requirement: Merge readiness SHALL require cross-layer regression closure
The initiative SHALL NOT be considered complete until backend, Rust, frontend, and real-account regression gates for the affected flows are all green.

#### Scenario: Direct-message convergence gate
- **WHEN** transport convergence changes are proposed for merge
- **THEN** backend tests, desktop build, and real-account direct-message smoke validation SHALL all pass

#### Scenario: Group messaging completion gate
- **WHEN** group Rust/Sender Key changes are proposed for merge
- **THEN** Rust protocol tests, backend membership/message regressions, frontend group smoke tests, and documented rollback notes SHALL all be present and passing
