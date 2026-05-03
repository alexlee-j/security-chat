## Verification Notes

- macOS: Verified locally with `cargo test --lib`, `pnpm build:desktop`, and `pnpm --filter @security-chat/desktop tauri:build`.
- macOS compatibility: The secure key provider keeps the existing `signal_protocol_store_key` and `local_message_store_key` account names, so existing Keychain-backed encrypted stores continue to resolve the same master keys.
- Windows: The production key provider is compiled through the `keyring` Windows native backend configuration, but runtime Credential Manager behavior was not executed on this macOS machine.
- Linux: The production key provider is compiled through the `keyring` Linux native persistent backend configuration, but runtime Secret Service/libsecret behavior was not executed on this macOS machine.
- Font payload: No font subset change was made in this pass. Material Symbols remains intentionally bundled because current UI uses symbol font names across navigation, chat, settings, and message controls.
