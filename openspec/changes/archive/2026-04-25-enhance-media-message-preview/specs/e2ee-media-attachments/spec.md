## MODIFIED Requirements

### Requirement: Recipient clients decrypt media locally
Recipient clients SHALL decrypt encrypted media bytes locally before image preview, audio playback, video preview, file opening, or file saving.

#### Scenario: Image preview decrypts locally
- **WHEN** a recipient opens an encrypted image message
- **THEN** the client downloads ciphertext, verifies it, decrypts it locally, and renders the resulting image blob

#### Scenario: Audio playback decrypts locally
- **WHEN** a recipient opens an encrypted audio message
- **THEN** the client downloads ciphertext, verifies it, decrypts it locally, and plays the resulting audio blob

#### Scenario: Video attachment previews in app
- **WHEN** a recipient opens an encrypted video message
- **THEN** the client downloads ciphertext, verifies it, decrypts it locally, and renders the resulting video blob inside the desktop app
- **AND** preview playback does not require opening the operating system default handler

#### Scenario: File open decrypts and caches locally
- **WHEN** a recipient opens an encrypted generic file message
- **THEN** the client downloads ciphertext if the file is not already cached
- **AND** the client verifies it, decrypts it locally, saves the plaintext file using encrypted payload filename metadata, and opens it through the operating system default handler
- **AND** later opens of the same valid cached file do not download the media asset again

#### Scenario: File download decrypts locally
- **WHEN** a recipient downloads an encrypted file message
- **THEN** the client downloads ciphertext, verifies it, decrypts it locally, and saves the plaintext file using the encrypted payload filename
- **AND** the client tells the user where the file was saved

### Requirement: Encrypted media supports forwarding and burn cleanup
Encrypted media messages SHALL remain compatible with forwarding and burn-after-reading cleanup semantics.

#### Scenario: Forward encrypted media
- **WHEN** a user forwards an encrypted media message
- **THEN** the forwarded message delivers sufficient encrypted media metadata to the new recipients inside their Signal encrypted payloads
- **AND** the backend still stores only ciphertext

#### Scenario: Burn encrypted media cleanup
- **WHEN** an encrypted burn media message expires or is triggered for cleanup
- **THEN** the backend removes the associated ciphertext asset according to existing burn cleanup rules
- **AND** the desktop client removes or invalidates any related persistent plaintext cache entry
