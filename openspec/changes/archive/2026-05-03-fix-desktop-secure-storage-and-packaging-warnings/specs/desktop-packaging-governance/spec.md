## ADDED Requirements

### Requirement: Production desktop bundles SHALL use release-safe Tauri configuration
Production desktop bundles SHALL use package identifiers and runtime settings that are appropriate for distribution and do not expose development-only tooling by default.

#### Scenario: macOS bundle identifier is validated
- **WHEN** a production macOS desktop bundle is built
- **THEN** the configured Tauri bundle identifier SHALL NOT end with `.app`

#### Scenario: Production devtools are disabled
- **WHEN** a production desktop bundle is built
- **THEN** the bundled application SHALL NOT enable webview devtools by default
- **AND** Cargo release features SHALL NOT include Tauri devtools unless an explicit debug package profile is being built

### Requirement: Desktop release builds SHALL keep warning output actionable
Desktop release build output SHALL distinguish accepted informational bundle-size guidance from warnings that indicate stale code, deprecated APIs, or ineffective build configuration.

#### Scenario: Rust release build emits deprecated API warnings
- **WHEN** the desktop Rust release build is executed
- **THEN** first-party Rust code SHALL NOT emit deprecation warnings for APIs that have direct supported replacements

#### Scenario: Rust release build emits dead-code warnings
- **WHEN** the desktop Rust release build is executed
- **THEN** first-party Rust dead-code warnings SHALL be resolved by removing stale code, wiring intentional code into production paths, or documenting a narrow owner-approved exception

#### Scenario: Frontend dynamic import cannot split a module
- **WHEN** Vite reports that a module is both dynamically and statically imported
- **THEN** the desktop frontend SHALL normalize that module to one intentional import strategy so the warning does not mask ineffective code splitting

#### Scenario: Frontend chunk-size warning is intentionally accepted
- **WHEN** a Tauri desktop build keeps a chunk larger than the default Vite warning threshold
- **THEN** the build configuration or implementation notes SHALL document whether the chunk is accepted for local desktop loading or split through manual chunks/dynamic imports

### Requirement: Desktop package verification SHALL include native and frontend outputs
Desktop package verification SHALL check both the frontend bundle and the native Tauri package output before a packaging cleanup is considered complete.

#### Scenario: Frontend bundle is verified
- **WHEN** desktop packaging governance changes are proposed for merge
- **THEN** `pnpm build:desktop` SHALL pass

#### Scenario: Native desktop package is verified
- **WHEN** desktop packaging governance changes are proposed for merge
- **THEN** `pnpm --filter @security-chat/desktop tauri:build` SHALL pass on the current development platform or an explicit platform limitation SHALL be documented
