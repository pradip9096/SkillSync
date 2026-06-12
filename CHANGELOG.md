# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changelog policy, workflow, and SOP are maintained in
[.agents/skills/changelog-guardian/references/CHANGELOG_POLICY.md](.agents/skills/changelog-guardian/references/CHANGELOG_POLICY.md).

## [Unreleased]

### Added

- Added comprehensive ISO/IEC/IEEE 29119-3 compliant test specifications and implementation plans across the `docs/software-testing/` directory for all End-to-End user journeys.
- Added System Hardening (Webhook Idempotency & Job Recovery) feature specifications to `MASTER_SPEC.md`.
- Added automated Razorpay refund check and log dispatch to the background abandoned-booking cancellation job to gracefully handle dropped payment webhooks.

### Changed

- Changed Admin and Expert dashboard data fetching to use server-side pagination to prevent memory exhaustion bottlenecks on large datasets.
- Changed guest booking form inputs to explicitly enforce database field `maxLength` properties on the client side.

### Fixed

- Fixed Admin Dashboard E2E test suite flakiness by replacing brittle network intercepts with stable UI toast assertions and resolving dialog timing.
- Fixed backend crashes and CORS preflight failures caused by Express 5.0 `req.query` immutability when sanitizing NoSQL injection payloads.
- Fixed messaging UI crash caused by unhandled `.map()` operations by injecting fallback array chaining.
- Fixed guest checkout double-booking risks by completely resetting the UI form state and inputs upon a successful booking redirection.
- Fixed `cancel-abandoned-booking` Agenda scheduler failing silently on database errors by enforcing exception-throws and utilizing Agenda's native exponential backoff retries.
- Fixed E2E test suite timeout by isolating the checkout flow with a global `window.Razorpay` mock and correcting native date-picker DOM locators.
- Fixed testing environment authentication failures caused by a double-hashing bug in the database seeding scripts.

## [1.5.0] - 2026-05-31

### Added

- Added automated cancellation and slot-release handling for `payment.failed` webhook events in the backend to free pending slots immediately upon payment failure.
- Added conflict-detection and automatic refund triggers for late payments on expired/cancelled bookings where the slot has been booked by another user.

### Fixed

- Fixed Agenda scheduler integration crashes by checking the database collection initialization status before trying to schedule/cancel reminders.
- Fixed webhook signature validation crashes in local environment by adding a default `RAZORPAY_WEBHOOK_SECRET` configuration value.
- Fixed Razorpay checkout mobile number prefill blank issue by passing database-validated, correctly prefixed phone numbers directly.
- Fixed Brave/Adblocker payment freezes by adding explicit UI warning/troubleshooting tips in the error box regarding blocked sardine.ai and lumberjack scripts.
- Fixed payment idempotency race conditions by gracefully catching MongoDB `11000` duplicate key errors on the `PaymentLog` model during concurrent webhook and client pings.
- Fixed `Booking` schema default status from `Confirmed` to `Pending` to ensure programmatically created bookings cannot bypass the payment flow.

### Security

- Secured backend API with `helmet` for HTTP headers and `express-mongo-sanitize` for NoSQL injection prevention.
- Secured backend from denial-of-service via massive payloads by enforcing a `10kb` limit on `express.json()`.
- Secured HTTP and Socket.io endpoints by replacing wildcard CORS with strict frontend origin configurations.
- Secured Razorpay webhook verification from timing attacks by using `crypto.timingSafeEqual()` alongside buffer length validations.
- Secured payment verification by adding booking ownership checks to ensure the authenticated user owns the transaction.
- Secured the `/auth/forgot-password` endpoint against user enumeration attacks by returning a uniform generic response.
- Secured the public `/booked-slots` endpoint by stripping Personal Identifiable Information (PII) like names and notes from the response.
- Secured active sessions by reducing JWT token lifespan from 30 days to 7 days.
- Removed hardcoded fallback Razorpay secrets from the booking creation flow.

## [1.4.0] - 2026-05-31

### Added

- Added programmatic Razorpay refund API query integration inside the session cancellation path when a client cancels outside the 2-hour penalty window.
- Added database transaction boundary logic wrapping booking creation and Razorpay order creation in a Mongoose session to ensure atomicity on failure.
- Added integration verification test suite `test_phase_3.js` to assert transactional rollback safety and refund dispatches.

## [1.3.0] - 2026-05-31

### Added

- Added Razorpay Payment Gateway integration for client bookings, including automated slot-release cleanup for unpaid sessions.
- Added `PaymentLog` schema to record an immutable audit trail of verified transactions and guarantee idempotency.
- Added timing-safe webhook signature verification middleware to protect the payment callback endpoint from side-channel attacks.
- Added integration test suite `test_phase_1.js` verifying signature checks, audit logs, and double-booking prevention.
- Added public webhook API route (`POST /bookings/webhook`) to handle asynchronous payment notifications from Razorpay.
- Added reusable, idempotent booking confirmation helper to prevent racing signature calls and duplicate reminders.
- Added frontend checkout retry action with dynamic script loading and a 5-minute reservation countdown timer.
- Added integration test suite `test_phase_2.js` covering webhook routes, signature verification, and idempotency locks.

### Changed

- Expanded the layout of the messaging panel to improve usability and spacing.
- Updated codebase documentation (README.md, ROADMAP.md, and MASTER_SPEC.md) to align with implemented system features.
- Changed booking models to store `razorpayOrderId` and return expert `hourlyRate` for client checkout retry flows.

### Fixed

- Fixed duplicate rendering of real-time messages by refining WebSocket room listeners in the messaging panel.
- Resolved UI layout congestion in the messaging sidebar and resolved React lint warnings.

### Security

- Secured payment processing by enforcing strict server-startup validation of Razorpay environment variables.
- Removed default fallback credentials from code paths, requiring explicit environment setup in production.

## [1.2.0] - 2026-05-29

### Added

- Added cursor-based message pagination support on both backend and frontend to optimize bandwidth and UI performance for long chat histories.
- Added parameter-level database validator middleware to reject malformed MongoDB ObjectIds, preventing application exceptions from bubbling up as server errors.

### Changed

- Changed frontend dialog interactions in `MyBookings` and `ExpertDetail` by replacing native browser alerts and confirmations with custom, state-driven themed React modals.
- Enabled pagination support for Admin lists (all users and bookings) and user booking history queries to improve database scale-breaking behavior.

### Fixed

- Enforced strict character length validation limits on user-supplied strings including name, profile descriptions, and image URLs.
- Removed redundant inline token decoding logic in the booking controller, aligning authorization boundaries with standard route middleware.

### Security

- Sanitized search query parameters using input regex escapes to eliminate Regular Expression Denial of Service (ReDoS) vulnerability.
- Secured WebSocket and endpoint JWT authentication by removing hardcoded fallback secrets and adding strict runtime environment assertions.
- Implemented rate limiting boundaries for registration, login, forgot-password, reset-password, and booking creation endpoints.


## [1.1.1] - 2026-05-29

### Fixed

- Fixed messaging UI delays by implementing optimistic UI updates instead of waiting for socket echoes.
- Fixed `MyBookings` and `ExpertDashboard` status update sluggishness by replacing full network refetches with optimistic UI state mutations.
- Fixed missing incoming messages when not actively viewing a chat by elevating socket listeners to the global component scope in `Messaging.jsx`.
- Fixed destructive global event listener wipeouts by explicitly passing named function references during `socket.off()` cleanups in `ExpertDetail.jsx`.
- Fixed silent real-time failures following background network reconnections by automatically re-joining `user`, `booking`, and `expert` rooms upon Socket.io `connect` events.

## [1.1.0] - 2026-05-29

### Added

- Added Real-Time Messaging and Notification feature allowing private, booking-bounded chats between Clients and Experts.
- Added global unread badge indicators powered by React Context API and real-time Socket.io events.
- Added system notifications for booking creations, status updates, cancellations, strikes, and new messages.
- Added Automated Email & SMS Reminders using Agenda.js and persistent MongoDB jobs, with immediate confirmation alerts and scheduled 24-hour and 2-hour pre-session reminder triggers.
- Added email delivery service with Nodemailer, including support for Ethereal Mail preview URLs and console log fallbacks.
- Added SMS delivery service with Twilio SDK and development console logging fallbacks.
- Added integration test suite `test_reminders.js` covering creation, cancellation, and manual execution flows.
- Added Forgot and Reset Password self-service flows with 10-minute expiring tokens and SMTP email alerts.
- Added frontend ForgotPassword and ResetPassword pages with glassmorphic cards, validation rules, navigation links on the Login view, and automatic dashboard redirection upon successful credential updates.
- Added integration test suite `test_forgot_password.js` covering token requests, token validations, expiry constraints, resets, and post-reset credentials verification.

### Changed

- Changed chat thread grouping in the sidebar to display unique participants instead of individual bookings.

### Security

- Secured WebSocket connections against unauthorized listeners using JWT-authenticated Socket.io middleware.

## [1.0.1] - 2026-05-27

### Added

- Added [docs/CHANGELOG_POLICY.md](docs/CHANGELOG_POLICY.md) to define changelog process,
  workflow, SOP, requirements, constraints, and writing guidelines.

### Changed

- Refactored this changelog to align with Keep a Changelog structure and SemVer release
  headings, keeping release history separate from changelog policy.

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

[Unreleased]: https://github.com/pradip9096/SkillSync/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/pradip9096/SkillSync/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/pradip9096/SkillSync/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/pradip9096/SkillSync/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/pradip9096/SkillSync/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/pradip9096/SkillSync/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/pradip9096/SkillSync/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/pradip9096/SkillSync/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pradip9096/SkillSync/releases/tag/v1.0.0
