## ADDED Requirements

### Requirement: Desktop media viewer previews image messages with navigation and zoom
The desktop client SHALL provide an in-app image viewer for chat image messages that supports navigating between image messages in the active conversation and changing image zoom level.

#### Scenario: Open image viewer
- **WHEN** a user opens an image message in a desktop conversation
- **THEN** the client downloads ciphertext if needed, decrypts the image locally, and displays the image in an in-app viewer
- **AND** the viewer includes controls to close the viewer, move to adjacent images, zoom in, zoom out, and reset zoom

#### Scenario: Navigate image messages
- **WHEN** the image viewer is open and the user moves to the next or previous image
- **THEN** the client displays the corresponding image message from the active conversation
- **AND** the client does not require closing the viewer between images

#### Scenario: Prefetch adjacent images
- **WHEN** an image is active in the viewer
- **THEN** the client MAY prepare adjacent image sources
- **AND** the client MUST NOT eagerly download and decrypt every image in the conversation solely because the viewer opened

#### Scenario: Keyboard image controls
- **WHEN** the image viewer is focused
- **THEN** Escape closes the viewer
- **AND** left and right navigation keys move between available image messages

### Requirement: Desktop media viewer previews video messages in app
The desktop client SHALL preview playable video attachments inside the app after local decryption.

#### Scenario: Open video preview
- **WHEN** a user opens a video attachment message
- **THEN** the client downloads ciphertext if needed, decrypts the video locally, and displays it in an in-app video viewer
- **AND** the video viewer provides playback controls without requiring the operating system default handler for preview playback

#### Scenario: Unsupported video playback
- **WHEN** a decrypted video cannot be played by the desktop webview runtime
- **THEN** the client shows a clear playback failure state
- **AND** the client preserves the existing download or system-open fallback path

#### Scenario: Close video preview
- **WHEN** the video viewer closes or switches to another media item
- **THEN** the client releases any preview object URL that is no longer in use
- **AND** playback stops.

### Requirement: Desktop file open reuses cached decrypted files
The desktop client SHALL open generic file attachments from an app-managed local cache when possible.

#### Scenario: First double-click downloads and caches file
- **WHEN** a user double-clicks a generic file attachment that is not cached
- **THEN** the client downloads ciphertext if needed, decrypts the file locally, writes the plaintext file to the app cache using a sanitized original filename, and opens the cached file with the operating system handler

#### Scenario: Later double-click reuses cached file
- **WHEN** a user double-clicks a generic file attachment that already has a valid cached plaintext file
- **THEN** the client opens the cached file directly
- **AND** the client does not download the media asset again

#### Scenario: Cached file is missing
- **WHEN** the cache record exists but the cached plaintext file is missing from disk
- **THEN** the client treats the file as not cached
- **AND** the client downloads, decrypts, writes, and opens a fresh cached file

#### Scenario: Cache key avoids filename collision
- **WHEN** two file attachments share the same original filename but have different media identity or plaintext digest
- **THEN** the client stores them as distinct cached files
- **AND** opening one attachment MUST NOT open the other attachment's plaintext.

### Requirement: Desktop media cache respects destructive media semantics
The desktop client SHALL prevent persistent plaintext cache from undermining burn-after-reading media behavior.

#### Scenario: Open burn media
- **WHEN** a user previews or opens a burn-after-reading media message
- **THEN** the client avoids persistent plaintext caching for that media whenever possible
- **AND** any temporary plaintext source is released after use

#### Scenario: Burn cleanup removes cached plaintext
- **WHEN** a burn-after-reading media message is destroyed and a cached plaintext file exists for that message
- **THEN** the client removes the cached plaintext file or invalidates the cache entry
