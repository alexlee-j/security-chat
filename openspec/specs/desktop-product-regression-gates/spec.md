# desktop-product-regression-gates Specification

## Purpose
Define the desktop product-surface release gates and design coverage tracking needed before merging the 2.0 desktop closure work.

## Requirements
### Requirement: Desktop product surface SHALL have release gates
The desktop product surface change SHALL not be considered complete until build, key interaction discovery, and documented smoke gates pass.

#### Scenario: Desktop build gate
- **WHEN** the desktop product surface is proposed for merge
- **THEN** `pnpm -C apps/desktop build` SHALL pass

#### Scenario: Desktop interaction gate
- **WHEN** the desktop product surface is proposed for merge
- **THEN** navigation, settings, conversation list, chat thread, input surface, and group UI smoke checks SHALL be documented and executed or explicitly deferred with rationale

### Requirement: Design coverage SHALL be tracked against the 2026-04-07 desktop design documents
The implementation SHALL maintain a design coverage checklist for the desktop design documents, excluding audio/video call capability from this release.

#### Scenario: Design item is implemented
- **WHEN** a documented desktop design interaction is implemented
- **THEN** the design coverage checklist SHALL record the implementation and its verification path

#### Scenario: Design item is out of scope
- **WHEN** a documented desktop design interaction is excluded from this release
- **THEN** the design coverage checklist SHALL record the exclusion rationale, including whether it is excluded because it belongs to audio/video calling
