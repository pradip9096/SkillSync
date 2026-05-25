# Centralized Standard Feature Catalog

This catalog serves as a project-agnostic blueprint for standard features across software products. By defining features with robust requirements and structured prioritization, we maintain architectural consistency, prevent scope creep, and eliminate redundant planning in future projects.

---

## 📋 Requirement Quality Standards

### The SMART Criteria
Every requirement in this catalog must be **SMART**:
1. **Specific:** Clear, unambiguous, and focused on a single function or goal.
2. **Measurable:** Able to be verified through automated testing or explicit manual checks.
3. **Achievable:** Technically feasible within the current system architecture.
4. **Relevant:** Directly supports the user role, business logic, or system security.
5. **Time-bound:** Delivered within bounded scopes (e.g., specific sprint/release schedules).

### Key FRS Elements
To be considered complete and ready for execution, each feature catalog specification must include:
* **Detailed User Interaction Flows:** Step-by-step navigation, state transitions, and boundary behavior.
* **Conceptual UI Mockups:** Structural layouts, visual states (loading, disabled, empty, error), and responsive grids.
* **API Specifications:** Endpoint definitions, parameter schemas, authorization scopes, and status codes.
* **Acceptance Criteria:** Explicit conditions that allow verification teams to confirm when a requirement is met.

---

## 🗺️ Feature Specifications Index

### 1. User Authentication & Role-Based Access Control (RBAC)

#### Rationale & Best Practices
Secure user verification is the gateway of any multi-tenant system. Best practices require JWT-based stateless authentication, secure storage (cookies/localStorage), password hashing (bcrypt), and role-based access checks at both the route (UI) and API controller levels.

#### Requirements Grid (MoSCoW)
* **[MUST HAVE]** Password hashing (minimum salt rounds: 10) before storage.
* **[MUST HAVE]** JWT token signature using a secure cryptographic key, with access check middlewares at all non-public API entry points.
* **[MUST HAVE]** Role hierarchy validation on private routes (`Client`, `Expert`, `Admin`).
* **[SHOULD HAVE]** Automatic client-side redirect to the login screen upon expiration or receiving a `401 Unauthorized` API status.
* **[COULD HAVE]** Multi-factor authentication (MFA) via SMS/TOTP.

#### User Interaction Flow
```
[Visitor] -> Clicks Login -> Inputs Credentials -> [Auth Middleware Checks DB] 
    |-- Success --> Generates JWT -> Stores Local/Session -> Redirects to Dashboard
    |-- Failure --> Renders validation error alert in UI (Stays on Login Page)
```

#### API Specifications
* `POST /api/v1/auth/register` (Registers user: returns JWT and user payload)
* `POST /api/v1/auth/login` (Authenticates user: returns JWT and user payload)
* `GET /api/v1/auth/me` (Validates session token: returns user information, role scope)

#### Acceptance Criteria
* **AC 1.1:** Attempting to access `/api/v1/admin/dashboard` without a valid token must return a `401 Unauthorized` status.
* **AC 1.2:** Attempting to access an admin route with a `Client` role token must return a `403 Forbidden` status.
* **AC 1.3:** Password entries in the database must match bcrypt criteria and never be stored in plain text.

---

### 2. Real-Time Booking & Scheduling Engine

#### Rationale & Best Practices
Preventing double-bookings is critical. Best practices dictate using atomic database locks, unique constraints (e.g., compound index on `expert` + `date` + `slot`), and real-time state synchronization via WebSockets (Socket.io) to ensure multiple users do not attempt to book the same slot simultaneously.

#### Requirements Grid (MoSCoW)
* **[MUST HAVE]** Server-side verification of slot availability before database writes.
* **[MUST HAVE]** Atomic transaction or compound unique indexing to guarantee double-booking prevention.
* **[MUST HAVE]** Client-side real-time sync: when User A books a slot, User B viewing the same page sees that slot turn to "Booked" instantly without a refresh.
* **[SHOULD HAVE]** Automatic time-lock checks: prevent booking dates or slots that fall in the past relative to the target timezone.

#### User Interaction Flow
```
[Client] -> Views Profile -> Selects Date -> Selects Slot (Real-time updates) -> Submits Form
    |-- Available --> Server books slot -> Emits 'slot_booked' to WebSocket -> Confirmed Screen
    |-- Taken/Conflict --> Database rejects transaction -> Returns 400 alert to Client UI
```

#### API Specifications
* `GET /api/v1/bookings/booked-slots/:resourceId/:date` (Retrieves already-reserved slots)
* `POST /api/v1/bookings` (Attempts slot booking; requires authorization header)
* `PATCH /api/v1/bookings/:id/status` (Updates status: Confirmed, Completed, Cancelled)

#### Acceptance Criteria
* **AC 2.1:** Simultaneously sending two `POST /api/v1/bookings` requests for the exact same resource ID, date, and slot must result in only one `201 Created` response, with the second request returning a `400 Bad Request`.
* **AC 2.2:** Real-time listeners must update the client time slot grid to disabled state within 500ms of a websocket event trigger.

---

### 3. Dynamic Availability Management (Slot Toggling)

#### Rationale & Best Practices
Providers require complete agency over their schedules. Best practices involve allowing resources to block slots they are unavailable for, keeping blocks separate from client bookings but reusing the same booking schema under a designated `Blocked` note or status, and disabling past dates/slots from being modified.

#### Requirements Grid (MoSCoW)
* **[MUST HAVE]** Guard preventing resources from toggling/blocking slots that have already passed.
* **[MUST HAVE]** Re-entry protection: slots already reserved by active clients cannot be blocked or overridden by the resource provider.
* **[SHOULD HAVE]** Single-click toggling UI for open slots to instantly block or unblock them.
* **[COULD HAVE]** Bulk blocking (e.g., "Block entire day", "Block recurring Mondays").

#### User Interaction Flow
```
[Provider] -> Calendar View -> Clicks Open Slot 
    |-- Future Slot --> Toggle Availability -> API Calls Block/Unblock -> Grid Updates
    |-- Past Slot --> Button is Disabled (No click events triggered)
```

#### API Specifications
* `POST /api/v1/dashboard/block-slot` (Blocks slot; requires resource payload)
* `POST /api/v1/dashboard/unblock-slot` (Unblocks slot; deletes placeholder booking)

#### Acceptance Criteria
* **AC 3.1:** Attempting to block a slot dated yesterday must return `400 Bad Request`.
* **AC 3.2:** Selecting today's date in the scheduler must dynamically disable and display as `"Passed"` any hourly slots prior to the current clock time in the local timezone.

---

### 4. Post-Session Rating & Review System

#### Rationale & Best Practices
Reviews build marketplace trust. Best practices demand preventing review spam by verifying transaction completion (only allows rating a booking with a status of `Completed`), restricting users to a single rating per booking transaction, and automatically updating average rating aggregate metrics.

#### Requirements Grid (MoSCoW)
* **[MUST HAVE]** Strict authorization: a user can only rate sessions they personally participated in.
* **[MUST HAVE]** Time-lock status constraint: review button only appears for bookings marked as `Completed`.
* **[MUST HAVE]** Double rating prevention: once a booking is rated (`isRated: true`), further rating requests for that session ID must be blocked.
* **[SHOULD HAVE]** Optional text feedback allowing star-only submissions.
* **[COULD HAVE]** Review flagging/moderation queue for administrators.

#### User Interaction Flow
```
[Client] -> My History -> Completed Session -> Clicks 'Rate & Review' -> Selects Stars -> Submits
    |-- Success --> Review Created -> Booking marked 'isRated: true' -> Average Rating updated
    |-- Re-entry --> Button disappears; API blocks any repeated submissions
```

#### API Specifications
* `POST /api/v1/reviews/:resourceId/rate` (Creates review and recalculates average rating)
* `GET /api/v1/reviews/:resourceId` (Retrieves list of reviews for public detail profiles)

#### Acceptance Criteria
* **AC 4.1:** Submitting a review for a booking that is currently in `Confirmed` or `Pending` status must return `400 Bad Request`.
* **AC 4.2:** Successful rating submissions must trigger an atomic update updating `averageRating = ((oldAvg * count) + newRate) / (count + 1)`.

---

### 5. Internationalization & Localization Engine

#### Rationale & Best Practices
Localization ensures a native user experience. Best practices involve decoupling locale configuration (currency symbols, phone prefixes, date representations) from core components, validating localized formats (e.g. phone masks, timezone offsets) at the API input boundary, and storing all times in database as normalized UTC.

#### Requirements Grid (MoSCoW)
* **[MUST HAVE]** Date, time, and currency rendering mapped to target country configurations (e.g., Indian Rupee `₹` formatting, DD-MM-YYYY displays).
* **[MUST HAVE]** Phone inputs normalized: client-side inputs accept 10 digits cleanly (UX), prepending appropriate country code templates (`+91`) transparently for database consistency.
* **[MUST HAVE]** Timezone normalization: calculate slot eligibility using target regional offsets (e.g., IST/UTC+5:30) to prevent offsets from skewing calendar days.
* **[SHOULD HAVE]** Automated IP-based locale detection.

#### User Interaction Flow
```
[User] -> Selects Input -> Types standard local format -> Utility converts format
    |-- Phone Entry -> Enters 10 digits -> App prepends country prefix on submission
    |-- Date Render -> Server UTC -> Locale formatting helper converts to localized screen format
```

#### Acceptance Criteria
* **AC 5.1:** Input phone fields must strip non-digit characters and match the validated database format constraint (`^\+91[0-9]{10}$` for India) before API dispatch.
* **AC 5.2:** Date conversions from UTC database values must show correct locale-specific values matching the target timezone offset.

---

## 🛠️ Template: Standard FRS Entry

Use this template to add new feature specifications to this catalog.

```markdown
### [Feature Name]

#### Rationale & Best Practices
[Explain why this feature exists, technical pitfalls to avoid, and standard design patterns.]

#### Requirements Grid (MoSCoW)
* **[MUST HAVE]** [Mandatory requirements for basic operation.]
* **[SHOULD HAVE]** [Important but non-blocking requirements.]
* **[COULD HAVE]** [Nice-to-have options.]
* **[WON'T HAVE]** [Explicitly out-of-scope for the current catalog version.]

#### User Interaction Flow
[Outline step-by-step user pathing and system state transitions.]

#### API Specifications
* `HTTP_METHOD /url/path` (Brief input/output description)

#### Acceptance Criteria
* **AC X.1:** [Specific, testable validation rule.]
* **AC X.2:** [Specific, testable boundary case validation.]
```
