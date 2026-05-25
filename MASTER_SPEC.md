# Master Feature Requirement Specification

> Single source of truth for all feature requirements across all projects.
> Managed by the `feature-requirement-spec` skill. Do not split into separate files.

---

## How to use this document

- **Before implementing any feature**: find or create its section here
- **During implementation**: update the section if requirements change or gaps are found
- **After implementation**: mark status as `Complete` and record what was actually built
- **For bugs or crashes**: add to the relevant feature's `Known Bugs / Stability Risks` section, tagged `MUST HAVE`

---

## Index

| Feature | Status | Last Updated |
|---------|--------|-------------|
| [Prevent Expert Self-Booking](#feature-prevent-expert-self-booking) | `Complete` | 2026-05-25 |
| [Disable Availability Toggling for Past Slots](#feature-disable-availability-toggling-for-past-slots) | `Complete` | 2026-05-25 |
| [Enforce Session Completion Time-Lock](#feature-enforce-session-completion-time-lock) | `Complete` | 2026-05-25 |
| [Simplified Phone Input UX](#feature-simplified-phone-input-ux) | `Complete` | 2026-05-25 |
| [12-Hour Format Conversion](#feature-12-hour-format-conversion) | `Complete` | 2026-05-25 |
| [Post-Session Rating & Review System](#feature-post-session-rating--review-system) | `Complete` | 2026-05-25 |

---

## Feature: Prevent Expert Self-Booking

### Overview
Restricts registered experts from booking slots or sessions with themselves to preserve business logic integrity and prevent scheduling loop vulnerabilities.

### Functional Requirements

- [MUST HAVE] Backend API must reject booking POST submissions where the authenticated user ID matches the expert's associated user ID.
  Rationale: Server-side validation safeguard is non-negotiable for system data integrity.
- [MUST HAVE] Backend API must reject booking POST submissions where the customer email matches the expert's credential email.
  Rationale: Prevents unauthenticated guests or manual API requests from self-booking via email matching.
- [MUST HAVE] Frontend must hide the logged-in expert's card from the public explore directory grid page.
  Rationale: Simplifies UX by preventing experts from finding their own page in normal flows.
- [MUST HAVE] Frontend must display a prominent yellow warning banner if an expert accesses their own detail profile page directly.
  Rationale: Notifies the expert that they are on their own page and explains that self-booking is disabled.
- [MUST HAVE] Frontend must disable all booking interactive elements on the expert's own profile page (date picker, slot selector, guest input fields, and submission button).
  Rationale: Completely deactivates the booking workflow locally for self-profiles.

### Non-Functional Requirements

- [MUST HAVE] Email comparisons must be case-insensitive and whitespace-trimmed.
  Rationale: Prevents self-booking bypass through casing (e.g. `Sarah@skillsync.com` vs `sarah@skillsync.com`) or leading/trailing spaces.
- [SHOULD HAVE] Submit button text must change to "Self-Booking Disabled" when the page belongs to the logged-in user.
  Rationale: Offers clear, immediate visual confirmation of the deactivated state.

### Edge Cases

- When an expert enters their profile directly while logged out, the page behaves normally (showing the authentication wall). As soon as they sign in, the page must dynamically compute `isOwnProfile` and apply all disabled states instantly.
- When an expert registers a guest booking with a different name but matching email, the backend must block it based on email validation.

### Best Practices
* Use the authenticated context (`useAuth`) to dynamically fetch the client `user` credentials.
* Populate the `user` reference on the `Expert` model during backend booking validation to perform accurate object ID and email checks.

### Status
`Complete`

### Last Updated
2026-05-25

---

## Feature: Disable Availability Toggling for Past Slots

### Overview
Restricts experts from blocking or unblocking availability slots that fall in the past relative to the current local IST clock.

### Functional Requirements

- [MUST HAVE] Backend `blockSlot` controller must reject block requests for date/time slots that have already passed.
  Rationale: Prevents database clutter from historical slot blocking.
- [MUST HAVE] Frontend grid must grey out and display as `"Passed"` any slots on the selected date that have already passed.
  Rationale: Informs the expert which time segments are no longer toggleable.
- [MUST HAVE] Frontend must disable click events and toggle interactions for slots that are in the past.
  Rationale: Prevents redundant API requests for historical slots.
- [SHOULD HAVE] Already blocked slots in the past must display as `"Blocked (Passed)"` and be disabled.
  Rationale: Ensures the expert has clean visibility over past blocks without allow edit access.

### Non-Functional Requirements

- [MUST HAVE] Calculations for past status must reliably convert selected date/time slots using Asia/Kolkata (IST) timezone offset UTC+5:30.
  Rationale: Prevents server/client clock drift and offset issues from incorrectly disabling active slots.

### Edge Cases

- When selected date is today, only the hourly slots prior to the current IST time are marked as `"Passed"`. Future hourly slots on the same day remain fully toggleable.
- When selected date is in the past (e.g. yesterday), all slots in the grid must be disabled and marked as `"Passed"`.

### Best Practices
* Utilize `isSlotInPast` helper utilities using the standard Asia/Kolkata timezone offset boundary comparisons on both the frontend and backend.

### Status
`Complete`

### Last Updated
2026-05-25

---

## Feature: Enforce Session Completion Time-Lock

### Overview
Time-locks session completion, preventing clients or experts from marking a confirmed session as Completed before its scheduled start time.

### Functional Requirements

- [MUST HAVE] Backend `updateBookingStatus` API must reject `Completed` status changes if the current time is before the scheduled session start time.
  Rationale: Ensures transaction logic consistency and prevents fraudulent reviews.
- [MUST HAVE] Frontend history view must disable the `"Mark as Completed"` button for client bookings until the session start time has arrived.
  Rationale: Prevents users from attempting invalid status updates.
- [MUST HAVE] Frontend Expert Dashboard sessions table must disable the `"Complete"` button (rendering it as a disabled `"Locked"` status button) for upcoming sessions.
  Rationale: Ensures the time-lock rule is enforced consistently on the provider-facing portal.

### Non-Functional Requirements

- [MUST HAVE] Validation checks must run using precise Asia/Kolkata timezone components to establish time-lock boundaries.
  Rationale: Protects scheduling rules across environments.

### Edge Cases

- When a session date has arrived but the exact hourly slot has not, the status action remains locked. The complete trigger must unlock exactly at the start hour and minute of the session.

### Best Practices
* Rely on the server's authoritative clock (`Date.now()`) compared to the session timestamp parsed with the offset `+05:30` to enforce timezone-safe constraints.

### Status
`Complete`

### Last Updated
2026-05-25

---

## Feature: Simplified Phone Input UX

### Overview
Simplifies phone input forms across the platform by accepting standard 10-digit entries from users and handling the required country prefix transparently.

### Functional Requirements

- [MUST HAVE] Frontend must allow registration, profile, and booking forms to accept standard 10-digit mobile numbers without requiring users to type `+91`.
  Rationale: Streamlines input fields and reduces form friction.
- [MUST HAVE] Frontend must prepend `+91` to the 10-digit input before sending the API request.
  Rationale: Maintains strict backend Mongoose schema compliance which mandates the `+91` prefix.
- [MUST HAVE] Frontend must strip `+91` from retrieved user profile data before displaying it in form input values.
  Rationale: Ensures input fields show clean local numbers for easier editing.

### Status
`Complete`

### Last Updated
2026-05-25

---

## Feature: 12-Hour Format Conversion

### Overview
Displays all session slot times in a clean, user-friendly 12-hour AM/PM format (e.g. `02:00 PM` instead of `14:00`).

### Functional Requirements

- [MUST HAVE] Expert Dashboard calendar scheduler, session listings, and notifications must format 24-hour database times into 12-hour equivalents.
  Rationale: Implements user-friendly time standards for resource management.
- [MUST HAVE] Booking slots displayed on the expert's detail booking page must render in 12-hour AM/PM format.
  Rationale: Standardizes customer-facing availability displays.

### Status
`Complete`

### Last Updated
2026-05-25

---

## Feature: Post-Session Rating & Review System

### Overview
Allows clients to submit ratings and optional written comments for completed sessions to establish marketplace credibility.

### Functional Requirements

- [MUST HAVE] Ratings can only be submitted for sessions that have a database status of `Completed`.
  Rationale: Prevents reviews on unfulfilled appointments.
- [MUST HAVE] Double rating prevention: once a booking's `isRated` flag is set to true, no further rating submissions can be accepted.
  Rationale: Enforces one review per session transaction.
- [MUST HAVE] Client review page must display an interactive star rating selector and an optional feedback text area.
  Rationale: Captures both quantitative ratings and qualitative comments.
- [MUST HAVE] Successful submissions must write to the `Review` collection and dynamically update the expert's rolling `averageRating` and `numReviews` fields.
  Rationale: Automatically syncs aggregate metrics.

### Status
`Complete`

### Last Updated
2026-05-25
