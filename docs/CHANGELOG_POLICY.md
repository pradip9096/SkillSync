# Changelog Policy

This document defines how SkillSync maintains `CHANGELOG.md`. The changelog itself
should stay focused on release history; this policy captures the meta rules, process,
workflow, and SOP for keeping that history reliable.

## Problem Statement

The changelog previously mixed multiple development phases inside a single `[Unreleased]`
section, repeated `Added`, `Changed`, and `Fixed` headings, used machine-local `file:///`
links, and did not expose dated Semantic Versioning release sections. That made the
document harder to scan, harder to link, and weaker as a release-history artifact.

## Purpose

`CHANGELOG.md` records human-readable, notable product and engineering changes for
SkillSync. It is not a commit log, implementation inventory, or replacement for feature
requirements in [`MASTER_SPEC.md`](../MASTER_SPEC.md).

## Goals / Objectives

- Keep release notes readable for developers, reviewers, and project stakeholders.
- Preserve the latest release first, followed by older release history.
- Group changes by consistent Keep a Changelog categories.
- Use SemVer release headings in the form `## [x.y.z] - YYYY-MM-DD`.
- Keep `[Unreleased]` available for merged changes that are not yet released.
- Keep release links portable and valid for GitHub readers.

## Requirement Specifications

- Every released version must have a dated SemVer heading.
- Every release should group entries under standard categories: `Added`, `Changed`,
  `Deprecated`, `Removed`, `Fixed`, and `Security`.
- Entries must describe user-visible, operator-visible, or maintainer-relevant changes.
- Links must be portable repository-relative Markdown links or valid public repository
  links, not local absolute paths.
- Breaking changes must be called out explicitly under `Changed` or `Removed`.
- Security-sensitive authorization, data exposure, or integrity fixes must appear under
  `Security`, even if they also resolve a bug.

## Constraints

- SkillSync currently contains separate frontend and backend package versions; the root
  changelog tracks the SkillSync product release version, not an individual package.
- Historical work before the first formal release is consolidated into `1.0.0`.
- Detailed implementation requirements remain in [`MASTER_SPEC.md`](../MASTER_SPEC.md).
- Test scripts are not uniformly wired into package managers, so release notes may refer
  to manual checks and standalone integration verification where applicable.
- Version comparison links should only point to tags or releases that exist, or should be
  updated when the tag/release is created.

## Best Practices

- Add changelog entries in the same change set as the code or documentation change.
- Prefer concise outcome-focused bullets over file-by-file implementation detail.
- Move entries from `[Unreleased]` into a versioned release section when cutting a release.
- Keep bug fixes under `Fixed` and vulnerability/authorization hardening under `Security`.
- Keep internal-only refactors out unless they affect maintainability, compatibility, or
  operations.
- Prefer one strong bullet per notable outcome instead of many low-level sub-bullets.

## Guidelines

- Write for humans first.
- Use present-perfect or past-tense release-note language.
- Avoid duplicating the same category heading within a single version.
- Avoid raw commit messages unless they are rewritten into release-note form.
- Use ISO 8601 dates: `YYYY-MM-DD`.
- Keep entries neutral, factual, and specific.
- Do not include secrets, private credentials, local filesystem paths, or environment-only
  details.

## Guiding Principle

A changelog entry should explain what meaningfully changed for users, operators, or
maintainers, while SemVer communicates the compatibility impact of that change.

## Process

1. Identify whether the change is notable enough for the changelog.
2. Choose the correct category: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or
   `Security`.
3. Add the entry under `[Unreleased]` unless a release is being cut immediately.
4. Keep the entry outcome-focused and avoid implementation-only detail.
5. Verify links are portable and version references are accurate.
6. During release, move relevant `[Unreleased]` entries into a dated SemVer section.
7. Update comparison links at the bottom of `CHANGELOG.md`.

## Workflow

- Feature work: update `MASTER_SPEC.md` first when the feature requirement changes, then
  add a changelog entry once the user-visible outcome is implemented.
- Bug fix: add a `Fixed` entry when the resolved behavior affects users, admins,
  operators, or maintainers.
- Security or authorization fix: add a `Security` entry and keep wording specific enough
  to communicate impact without exposing exploit instructions.
- Documentation-only change: add a changelog entry only when the document materially
  changes how the project is understood, operated, or released.
- Release preparation: convert `[Unreleased]` into a versioned release section, confirm
  SemVer impact, run relevant verification, and update links.

## SOP

1. Open `CHANGELOG.md`.
2. Confirm `[Unreleased]` exists at the top of the release history.
3. Add the new entry under the single matching category inside `[Unreleased]`.
4. If the category does not exist, create it once.
5. Keep the bullet short and readable.
6. Avoid local links such as `file:///...`; use repository-relative links if a file link is
   necessary.
7. If the change is breaking, start the bullet with `Breaking:`.
8. If cutting a release, create `## [x.y.z] - YYYY-MM-DD` below `[Unreleased]`.
9. Move the release-ready bullets from `[Unreleased]` into that version section.
10. Leave empty `[Unreleased]` in place for future work.
11. Update `[Unreleased]` and version comparison links at the bottom of the file.
12. Review the changelog diff before committing to ensure there are no duplicate category
    headings, dead local links, or implementation-only notes.
