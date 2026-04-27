## ADDED Requirements

### Requirement: Current user SHALL be able to update their profile avatar
The system SHALL provide an authenticated flow for the current user to update their own profile avatar and persist the resulting avatar URL on the user profile.

#### Scenario: User uploads a valid avatar
- **WHEN** an authenticated user selects a valid avatar image from personal center
- **THEN** the desktop app SHALL compress the image before upload
- **AND** the backend SHALL store the avatar asset and persist its URL on the current user's profile
- **AND** the backend SHALL return the updated profile including `avatarUrl`

#### Scenario: User replaces an existing avatar
- **WHEN** an authenticated user uploads a valid new avatar while an avatar is already configured
- **THEN** the backend SHALL update the user's `avatarUrl` to the new avatar URL
- **AND** subsequent profile, friend, and conversation identity responses SHALL expose the new `avatarUrl`

### Requirement: Avatar uploads SHALL be compressed and bounded
The desktop app SHALL compress avatar images before upload and SHALL avoid uploading original unbounded image files.

#### Scenario: Selected image is larger than avatar bounds
- **WHEN** the user selects an image whose dimensions exceed the supported avatar maximum
- **THEN** the desktop app SHALL resize the image to the supported avatar bounds before upload
- **AND** the compressed upload payload SHALL remain within the supported avatar byte limit

#### Scenario: Compression cannot complete
- **WHEN** the desktop app cannot decode or compress the selected image
- **THEN** the desktop app SHALL not upload the original image
- **AND** the desktop app SHALL show a clear failure state that allows the user to choose another file

### Requirement: Avatar uploads SHALL be validated
The system SHALL validate avatar uploads on both the client and server for supported image type and size.

#### Scenario: User selects an unsupported file type
- **WHEN** the user selects a file that is not a supported avatar image type
- **THEN** the desktop app SHALL reject the file before upload when detectable
- **AND** the backend SHALL reject unsupported uploaded avatar MIME types

#### Scenario: Uploaded avatar exceeds backend limits
- **WHEN** a submitted avatar upload exceeds the backend avatar size limit
- **THEN** the backend SHALL reject the request without changing the user's existing `avatarUrl`
- **AND** the desktop app SHALL present the rejection as an actionable error

### Requirement: Avatar rendering SHALL fall back safely
The desktop app SHALL render stored avatar images when available and SHALL preserve readable initials or generated placeholders when no avatar image can be rendered.

#### Scenario: Avatar URL is present
- **WHEN** a user identity includes a non-empty `avatarUrl`
- **THEN** desktop avatar surfaces SHALL attempt to render that image as the primary avatar

#### Scenario: Avatar URL is missing or fails to load
- **WHEN** a user identity has no `avatarUrl` or the image cannot be rendered
- **THEN** desktop avatar surfaces SHALL show the existing initials or generated gradient fallback
- **AND** the avatar container SHALL remain the same size without layout shift

### Requirement: Avatar changes SHALL refresh visible identity state
The desktop app SHALL refresh local profile-dependent state after a successful avatar update.

#### Scenario: Current user updates avatar from personal center
- **WHEN** the avatar update succeeds in personal center
- **THEN** the personal center SHALL show the new avatar
- **AND** the navigation drawer identity area SHALL show the new avatar without requiring logout or app restart
- **AND** cached friend or conversation identity data that can display the current user's avatar SHALL be refreshed or updated consistently
