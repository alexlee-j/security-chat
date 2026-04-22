# e2ee-media-attachments Specification

## Purpose
Define encrypted media attachment handling for desktop image, audio, video, and document messages so backend storage remains ciphertext-only and clients decrypt media locally.

## Requirements
### Requirement: Media attachments are encrypted before upload
The desktop client SHALL encrypt image, audio, video, and file attachment bytes before uploading them to backend media storage.

#### Scenario: Image upload stores ciphertext
- **WHEN** a user selects an image and sends it as a message
- **THEN** the client encrypts the image bytes before calling the media upload API
- **AND** the backend stores only ciphertext bytes for the uploaded asset

#### Scenario: Audio upload stores ciphertext
- **WHEN** a user selects an audio file and sends it as a message
- **THEN** the client encrypts the audio bytes before calling the media upload API
- **AND** the backend stores only ciphertext bytes for the uploaded asset

#### Scenario: Video upload stores ciphertext
- **WHEN** a user selects a video file and sends it as a message
- **THEN** the client encrypts the video bytes before calling the media upload API
- **AND** the backend stores only ciphertext bytes for the uploaded asset
- **AND** the desktop client renders it as a video attachment surface instead of a generic document card when MIME type or filename indicates video media

#### Scenario: Document upload stores ciphertext
- **WHEN** a user selects a non-image non-audio non-video file and sends it as a message
- **THEN** the client encrypts the file bytes before calling the media upload API
- **AND** the backend stores only ciphertext bytes for the uploaded asset

### Requirement: Media decryption material is sent only in encrypted message payloads
The system SHALL deliver media keys, nonces, algorithms, digests, original filenames, MIME types, and plaintext sizes only inside the Rust Signal encrypted message payload.

#### Scenario: Direct media message payload
- **WHEN** a direct media message is sent
- **THEN** every target device envelope contains a Rust Signal encrypted payload with the encrypted media metadata
- **AND** no media key or nonce is sent as a plaintext backend field

#### Scenario: Group media message payload
- **WHEN** a group media message is sent
- **THEN** the Rust group encrypted payload contains the encrypted media metadata
- **AND** no media key or nonce is sent as a plaintext backend field

### Requirement: Voice message metadata is encrypted with media payloads
The system SHALL deliver voice-message duration, waveform, waveform version, and codec metadata only inside Signal-encrypted message payloads.

#### Scenario: Direct voice media payload
- **WHEN** a direct voice message is sent
- **THEN** every target device envelope contains encrypted media metadata
- **AND** every target device envelope contains encrypted voice metadata
- **AND** voice duration, waveform, waveform version, and codec are not sent as plaintext backend fields

#### Scenario: Group voice media payload
- **WHEN** a group voice message is sent
- **THEN** the group encrypted payload contains encrypted media metadata
- **AND** the group encrypted payload contains encrypted voice metadata
- **AND** voice duration, waveform, waveform version, and codec are not sent as plaintext backend fields

#### Scenario: Voice waveform renders before media download
- **WHEN** a recipient lists a conversation containing an encrypted voice message
- **THEN** the client can render duration and waveform from the decrypted message payload
- **AND** the client does not need to download the audio ciphertext before rendering the initial voice bubble

### Requirement: Backend treats encrypted media as opaque ciphertext
The backend SHALL authorize, store, bind, copy, download, and clean up encrypted media assets without requiring access to plaintext bytes or plaintext keys.

#### Scenario: Encrypted upload metadata
- **WHEN** the backend receives an encrypted media upload
- **THEN** it records ciphertext size and ciphertext digest
- **AND** it does not compute or persist plaintext hashes from uploaded bytes

#### Scenario: Download encrypted media
- **WHEN** an authorized conversation member downloads an encrypted media asset
- **THEN** the backend returns ciphertext bytes
- **AND** the backend does not decrypt or transform the media content

#### Scenario: Unauthorized encrypted media download
- **WHEN** a user who is not the uploader or a conversation member requests an encrypted media asset
- **THEN** the backend rejects the download

### Requirement: Recipient clients decrypt media locally
Recipient clients SHALL decrypt encrypted media bytes locally before image preview, audio playback, file opening, or file saving.

#### Scenario: Image preview decrypts locally
- **WHEN** a recipient opens an encrypted image message
- **THEN** the client downloads ciphertext, verifies it, decrypts it locally, and renders the resulting image blob

#### Scenario: Audio playback decrypts locally
- **WHEN** a recipient opens an encrypted audio message
- **THEN** the client downloads ciphertext, verifies it, decrypts it locally, and plays the resulting audio blob

#### Scenario: Video attachment opens safely
- **WHEN** a recipient opens an encrypted video message
- **THEN** the client downloads ciphertext, verifies it, decrypts it locally, saves the plaintext file using encrypted payload filename metadata, and opens it through the operating system default handler

#### Scenario: File download decrypts locally
- **WHEN** a recipient downloads an encrypted file message
- **THEN** the client downloads ciphertext, verifies it, decrypts it locally, and saves the plaintext file using the encrypted payload filename
- **AND** the client tells the user where the file was saved

### Requirement: Legacy media remains readable
The desktop client SHALL continue to read existing legacy plaintext media messages that do not contain encrypted media metadata.

#### Scenario: Legacy media message render
- **WHEN** a user opens a historical media message without `payload.media.version`
- **THEN** the client uses the legacy media resolution path
- **AND** the message remains viewable if the legacy asset is still accessible

### Requirement: Encrypted media supports forwarding and burn cleanup
Encrypted media messages SHALL remain compatible with forwarding and burn-after-reading cleanup semantics.

#### Scenario: Forward encrypted media
- **WHEN** a user forwards an encrypted media message
- **THEN** the forwarded message delivers sufficient encrypted media metadata to the new recipients inside their Signal encrypted payloads
- **AND** the backend still stores only ciphertext

#### Scenario: Burn encrypted media cleanup
- **WHEN** an encrypted burn media message expires or is triggered for cleanup
- **THEN** the backend removes the associated ciphertext asset according to existing burn cleanup rules
