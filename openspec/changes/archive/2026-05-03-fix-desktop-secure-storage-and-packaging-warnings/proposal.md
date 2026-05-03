## Why

Desktop encryption keys are protected by macOS Keychain today, but Windows and Linux builds fall back to fixed or in-memory keys, which is not acceptable for a production secure messaging client. The desktop package also emits avoidable release warnings, making it harder to distinguish harmless bundle-size guidance from real security or maintenance issues.

## What Changes

- Require desktop local encryption master keys to come from platform secure storage on every supported production desktop OS.
- Replace non-macOS fixed-key and volatile-key fallbacks with a production-safe provider strategy.
- Keep local Signal/private state and local readable message history encrypted with keys that are not stored in plaintext alongside SQLite databases.
- Clean up release packaging configuration so production bundles do not enable devtools by default and do not use a macOS-conflicting bundle identifier.
- Reduce actionable build warnings by removing stale Rust code paths, updating deprecated RNG usage, and making intentional frontend chunking decisions explicit.
- Preserve developer ergonomics through explicit test/development fallbacks that cannot silently ship in release builds.

## Capabilities

### New Capabilities
- `desktop-packaging-governance`: Defines desktop release packaging and build-warning expectations for production Tauri bundles.

### Modified Capabilities
- `local-first-direct-history`: Strengthens desktop local store encryption requirements so production master keys are sourced from OS-backed secure storage on supported platforms.

## Impact

- Affects the Tauri Rust desktop backend under `apps/desktop/src-tauri`, including local SQLite encryption-key providers, Cargo dependencies, release configuration, and warning cleanup.
- Affects desktop frontend build configuration under `apps/desktop`, especially Vite import/chunking choices and release warning budget.
- May add platform-specific Rust dependencies for Windows Credential Manager/DPAPI and Linux Secret Service/libsecret through a cross-platform keyring abstraction.
- Requires verification on macOS locally and at least compile/test coverage for non-macOS provider paths in CI or cross-platform jobs.
