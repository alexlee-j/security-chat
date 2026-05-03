## Context

The desktop app currently has two native encrypted SQLite stores:

- `security-chat-signal.db` persists Signal identity, prekeys, and session ratchet state through the Rust `SQLiteStore`.
- `security-chat.db` persists local conversation/message data, including readable direct-message content encrypted at rest.

On macOS, both stores derive their AES master keys from macOS Keychain entries. On non-macOS release builds, the current code path falls back to fixed byte arrays for store encryption keys, and an unused `SecureKeychain` abstraction falls back to an in-memory key. That means Windows/Linux packages can appear encrypted while using predictable or non-persistent key material.

The packaging build also emits several classes of warnings: a Tauri bundle identifier ending in `.app`, release devtools enabled in config/features, deprecated `rand::thread_rng` calls, dead Rust code from old storage/cipher paths, mixed static/dynamic frontend imports, and a large single JavaScript chunk. Some warnings represent real release hygiene issues; others are informational and should be made explicit so build output remains actionable.

## Goals / Non-Goals

**Goals:**

- Provide one shared native provider path for desktop local encryption master keys.
- Use platform-backed secure storage for production macOS, Windows, and Linux builds.
- Fail closed in production when platform secure storage is unavailable instead of silently using fixed or volatile keys.
- Keep test/development key fallbacks explicit and impossible to ship accidentally in release builds.
- Remove or document avoidable desktop packaging warnings so release output highlights real problems.
- Preserve existing encrypted SQLite data on macOS by reusing the current Keychain item names.

**Non-Goals:**

- Do not redesign the Signal protocol state schema or local message schema.
- Do not add cloud backup or cross-device restore for private Signal state.
- Do not change backend APIs.
- Do not optimize every byte of desktop bundle size; this change only requires intentional treatment of warnings.
- Do not replace local SQLite encryption with SQLCipher in this change.

## Decisions

### Use a native `SecureKeyProvider` instead of frontend WebCrypto storage

The production encryption keys for local SQLite stores SHALL be resolved in Rust before database reads/writes. Frontend `localStorage` plus WebCrypto is not sufficient because the wrapping key is stored in the same browser storage area and does not protect native SQLite stores.

Alternatives considered:

- Keep frontend `secure-storage.ts`: rejected for local database keys because it is renderer-local and stores the master key in `localStorage`.
- Store derived keys in SQLite: rejected because it places key material beside ciphertext.
- Prompt for a user passphrase: deferred; usable as a future fallback, but it changes product behavior and account recovery expectations.

### Use OS-backed secure storage per platform

The provider SHALL map stable service/account names to 32-byte random AES keys:

- macOS: existing Keychain implementation and current item names for compatibility.
- Windows: Windows Credential Manager or DPAPI-backed keyring through a Rust abstraction.
- Linux: Secret Service/libsecret through the same abstraction where available.

The implementation may use a cross-platform crate such as `keyring`, but must keep platform failures observable and must not silently downgrade production builds to fixed keys.

Alternatives considered:

- Add separate hand-written implementations for each OS: possible, but higher maintenance.
- Keep macOS-only security and document Windows as unsupported: rejected because Windows packaging is documented and requested.

### Centralize local store key names and lifecycle

Signal-store and message-store keys SHALL be requested through one helper with distinct stable key names, for example:

- `security-chat-signal-store-key`
- `security-chat-local-message-store-key`

The helper SHALL:

- read an existing key,
- validate exact length,
- generate and persist a new random 32-byte key if no key exists,
- fail if the stored key is malformed and cannot be replaced safely.

macOS item names should remain compatible with the existing `SIGNAL_STORE_KEY_NAME` and `LOCAL_MESSAGE_STORE_KEY_NAME` values unless migration code explicitly copies old keys.

### Keep development/test fallbacks explicit

Tests can keep deterministic keys under `#[cfg(test)]`. Development builds may use an explicit insecure fallback only when gated by a clear compile-time feature or debug-only branch. Release builds for supported platforms SHALL fail closed if the OS secure storage provider is unavailable.

### Treat packaging warnings by severity

Release hygiene fixes SHALL remove warnings that indicate real release risk:

- Tauri identifier ending in `.app`.
- release devtools enabled by config or Cargo feature.
- Rust deprecations and dead code from unused modules.

Frontend chunk-size warnings are not automatically release blockers for Tauri because assets load locally, but mixed static/dynamic imports should be cleaned up. If a large chunk remains intentional, the Vite warning threshold or manual chunk strategy should document that decision in config.

### Prefer cleanup over warning suppression

Rust `allow(dead_code)` or Vite warning suppression should be used only when code is intentionally kept for future integration and has an owner. Stale unused storage/cipher paths should be removed rather than hidden.

## Risks / Trade-offs

- [Risk] Linux Secret Service is not always available on minimal desktops or CI images. → Mitigation: detect provider failure clearly, document dependency expectations, and add CI behavior that validates compile paths without requiring a real user keyring.
- [Risk] Changing macOS key item names could orphan existing encrypted local stores. → Mitigation: retain existing item names or implement read-old/write-new migration before any rename.
- [Risk] Removing unused Rust code may delete a path that tests still rely on indirectly. → Mitigation: run desktop Rust tests plus full desktop build after cleanup.
- [Risk] Manual frontend chunking can make caching worse or add complexity without startup benefit. → Mitigation: first remove ineffective dynamic imports; only add manual chunks for clearly separable heavy UI such as emoji picker or audio waveform code.
- [Risk] Disabling devtools can make production debugging harder. → Mitigation: keep devtools in development builds and require an explicit debug build/profile for troubleshooting.

## Migration Plan

1. Add the secure key provider abstraction and route both native SQLite encryption key lookups through it.
2. Preserve macOS existing Keychain entries and verify existing local stores still decrypt.
3. Add Windows and Linux provider implementations or dependency-backed adapters.
4. Remove non-macOS fixed-key release fallbacks and make provider failure fail closed.
5. Clean Tauri release configuration: bundle identifier, release devtools, updater placeholders if they affect packaging.
6. Clean Rust warnings by replacing deprecated RNG API usage and removing unused modules/functions.
7. Clean frontend build warnings by normalizing import strategy and documenting any intentional chunk-size budget.
8. Verify desktop build and Tauri package output, plus targeted Rust tests for provider behavior.

Rollback is straightforward for packaging config and warning cleanup. Secure storage rollback is riskier after keys are written through a new provider, so macOS compatibility and provider read/write tests should land before removing old code paths.

## Open Questions

- Should Linux be considered a production-supported target for this release, or should release packaging fail until Secret Service support is verified?
- Should Windows use `keyring` Credential Manager integration or a narrower DPAPI implementation owned directly by this codebase?
- Should remembered login credentials continue using renderer `secure-storage.ts`, or should a later change move auth preferences into the native secure provider as well?
