# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changelog policy, workflow, and SOP are maintained in
[docs/CHANGELOG_POLICY.md](docs/CHANGELOG_POLICY.md).

## [Unreleased]

### Added

- Added Automated Email & SMS Reminders using Agenda.js and persistent MongoDB jobs, with immediate confirmation alerts and scheduled 24-hour and 2-hour pre-session reminder triggers.
- Added email delivery service with Nodemailer, including support for Ethereal Mail preview URLs and console log fallbacks.
- Added SMS delivery service with Twilio SDK and development console logging fallbacks.
- Added integration test suite `test_reminders.js` covering creation, cancellation, and manual execution flows.
- Added Forgot Password and Reset Password self-service capabilities for Clients and Experts, with token generation, hashing, 10-minute expiry time-locks, and Ethereal/SMTP email reset notifications.
- Added frontend ForgotPassword and ResetPassword pages with glassmorphic cards, validation rules, navigation links on the Login view, and automatic dashboard redirection upon successful credential updates.
- Added integration test suite `test_forgot_password.js` covering token requests, token validations, expiry constraints, resets, and post-reset credentials verification.

## [1.0.1] - 2026-05-27

### Changed

- Refactored this changelog to align with Keep a Changelog structure and SemVer release
  headings, keeping release history separate from changelog policy.
- Added [docs/CHANGELOG_POLICY.md](docs/CHANGELOG_POLICY.md) to define changelog process,
  workflow, SOP, requirements, constraints, and writing guidelines.

### Fixed

- Fixed Admin Booking Manager search so admins can find bookings by client email from
  either the booking's denormalized `userEmail` field or populated client `user.email`.

## [1.0.0] - 2026-05-27

### Added

- Added the core real-time expert session booking platform with expert directory,
  expert detail pages, booking creation, booking history, and Socket.io slot updates.
- Added JWT authentication and role-based access control for Client, Expert, and Admin
  accounts.
- Added Expert Portal capabilities for viewing sessions, editing expert profile details,
  and blocking or unblocking availability slots.
- Added Admin Dashboard capabilities for viewing users, managing bookings, updating
  statuses, deleting bookings, and creating or deleting expert accounts.
- Added secure user profile management through authenticated profile read/update flows.
- Added professional seeded expert portraits and personalized image fallback behavior
  for expert cards and profile pages.
- Added India-specific localization for INR pricing, Indian phone handling, IST-aware
  scheduling, and 12-hour AM/PM time display.
- Added feature specification standards, product requirement documentation, roadmap
  documentation, and feature-plan references.
- Added MongoDB transaction support for multi-document user/expert creation and
  cascading deletion flows, with documented replica set prerequisites.
- Added a dedicated `Availability` collection and migration utility to separate expert
  blocked slots from client booking history.
- Added late cancellation policy support with a two-hour cancellation window, late
  cancellation status, user strike tracking, cooldown suspension, and Admin penalty reset.
- Added two-sided feedback so Experts can rate Clients after completed sessions.
- Added Expert Business Analytics with earnings, session counts, utilization, trend
  charts, slot density, and review summaries.
- Added standalone integration test scripts for booking, availability migration, penalty
  logic, client feedback, and expert analytics scenarios.
- Added local development support with `start.sh`, backend `npm run dev`, nodemon, and
  port-clearing safeguards.
- Added developer knowledge-base documentation for Admin sessions, MongoDB transactions,
  direnv environment loading, and role capability boundaries.

### Changed

- Changed booking completion time-lock behavior to prevent premature completion and align
  frontend and backend checks around IST-safe epoch comparisons.
- Changed booking and slot availability controllers to consult both bookings and dedicated
  availability blocks after the schema separation.
- Changed phone inputs to accept clean 10-digit Indian mobile numbers in the UI while
  preserving `+91` schema compatibility at API boundaries.
- Changed Client-facing, Expert-facing, and Admin-facing dashboards to display reputation,
  strike, suspension, cancellation, and completion states more clearly.
- Changed route protection so non-Client roles cannot access client booking history and
  non-Expert roles cannot access Expert Portal functionality.
- Changed frontend authentication initialization to refresh profile/role data from the
  backend, reducing stale-token role desynchronization.
- Changed feature specifications to remove outdated `/api/v1` prefixes and align documented
  routes with the current Express route mounts.
- Changed Admin and Expert dashboard UI behavior to isolate role-specific actions and avoid
  presenting scheduling controls to unauthorized roles.

### Fixed

- Fixed expert self-booking and Admin booking loopholes by enforcing booking creation
  restrictions in both UI and backend validation.
- Fixed blocked expert slots leaking into client-facing booking history.
- Fixed unauthorized booking access risks by protecting booking retrieval, status update,
  and rating endpoints with authentication and ownership checks.
- Fixed Expert Dashboard unblock rendering by returning richer booked-slot objects and
  handling both object and string slot payloads in the frontend.
- Fixed real-time client updates after expert unblock by standardizing the `slot_released`
  event payload.
- Fixed Admin Add Expert modal clipping on small viewports with constrained modal layout
  and scrollable form content.
- Fixed stale role/session issues that produced incorrect dashboard access after user role
  changes or deleted accounts.
- Fixed local development port hijacking by clearing stale processes on expected frontend
  and backend ports.
- Fixed timezone and clock-skew issues across booking completion, slot availability, and
  session-history flows.
- Fixed default ratings UX so new Clients display as `New Client` instead of showing a
  misleading default rating.

### Security

- Secured booking history lookup so users can only view their own bookings unless they are
  Admins.
- Secured booking status updates and rating operations with owner, host Expert, or Admin
  authorization checks.
- Blocked public Admin registration and restricted Admin-only operational endpoints.
- Hardened cascading database mutations with transaction boundaries to prevent orphaned
  users, experts, or bookings after partial failures.
- Enforced database-level active booking uniqueness so cancelled and late-cancelled sessions
  release slots without allowing duplicate active bookings.

[Unreleased]: https://github.com/pradip9096/SkillSync/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/pradip9096/SkillSync/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pradip9096/SkillSync/releases/tag/v1.0.0
