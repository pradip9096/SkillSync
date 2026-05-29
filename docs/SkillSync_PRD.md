# PRODUCT REQUIREMENT DOCUMENT (PRD)

## 1. Executive Summary & Goals
* **Product Name:** SkillSync (Real-Time Expert Session Booking System)
* **Primary Objective:** To provide a robust, real-time web application where users can seamlessly discover experts by category, view live availability, and confidently book sessions without encountering double-booking conflicts.
* **Success Metrics (KPIs):** Zero instances of double-booked slots; <500ms latency for socket-based slot status updates to connected clients; 100% database lock integrity under concurrent load testing.

## 2. User Architecture & Personas
* **Primary Persona:** The "Knowledge Seeker" (Client) — A professional, student, or entrepreneur seeking specific advice from an industry expert. *Pain points:* Wasting time with back-and-forth scheduling, encountering double bookings. *Motivations:* Quick, reliable access to expertise.
* **Secondary Persona:** The "Domain Expert" — A professional offering predefined time slots. *Pain points:* Managing chaotic schedules and missed appointments. *Motivations:* Seamlessly filling their availability.
* **Tertiary Persona:** System Administrator — Manages the platform, seeds experts, and oversees bookings across the system.
* **User Journey Mapping:** 
  1. Client lands on the newly designed Home Page (landing page).
  2. Client navigates to the web application and views the paginated list of available experts.
  3. Client filters experts by category or searches by name to find a match.
  4. Client selects an expert, navigating to their profile to view available time slots.
  5. While viewing, real-time socket updates reflect slots booked by other clients instantly.
  6. Client selects a slot, enters their details (Name, Email, Phone), and submits.
  7. System validates the payload, locks the slot atomically in the database, confirms success, and broadcasts the slot's removal to all other viewers.
  8. Client tracks their status via the "My Bookings" interface.

## 3. Scope Boundaries

> **Note:** This PRD governs high-level business goals and scope. For strict, 15-block technical specifications of these features, `MASTER_SPEC.md` is the canonical single source of truth.

* **In-Scope Features (Phase 1 MVP):** Home Page; India Specific Localization; Placeholder Images; Expert directory with pagination/search/filter; Expert profile views; Real-time slot availability broadcasting via Socket.io; Atomic booking engine (DB-level locking); Booking history tracking by email.
* **In-Scope Features (Phase 2):** JWT Based Authentication; Role-Based Access Control (RBAC); Admin Panel; Secure User Profile Management; Expert Portal Dashboard; Prevent Expert Self-Booking; Enforce Session Completion Time-Lock; Endpoint Hardening & Ownership Verification; Availability Schema Migration (Decoupled Slot Blocking).
* **In-Scope Features (Phase 3):** Post-session Rating & Review System; Booking Cancellation Protection time-locks (Late Cancellation and Strike/Cooldown Penalty System); Two-Sided peer-to-peer feedback loops (Experts rating Clients); Automated Email & SMS Reminders; Password Recovery & Auto-Login; Real-Time Messaging & Notifications.
* **In-Scope Features (Phase 4 - System Resilience & Security Hardening):** Startup configuration checks (crashing if `JWT_SECRET` is unset); regex sanitization and input limits against ReDoS; parameter ObjectId verification middleware to prevent CastError server crashes; endpoint rate-limiting; page/limit query pagination; customized React modal prompts; and React error boundaries.
* **In-Scope Features (Phase 5 - Future Development):** Offline Fallbacks (Email notifications for unread chat messages).
* **Out-of-Scope Elements:** Payment processing and gateways; Integrated video/audio conferencing (booking handles scheduling only).

## 4. Functional Specifications & Prioritization
| Feature | Description | Priority | Complexity |
| :--- | :--- | :--- | :--- |
| **Home Page** | Initial landing page introducing the platform before navigating to the directory. | *Must Have* | *Low* |
| **India Specific Localization** | Fixed IST timezone, INR currency display, and +91 phone number formatting. | *Must Have* | *Low* |
| **Image Placeholders** | Ensure all expert profiles use standard placeholder images instead of broken real images. | *Must Have* | *Low* |
| **Expert Directory** | Display experts with pagination. Allow filtering by category and searching by name. | *Must Have* | *Medium* |
| **Expert Profile & Slots** | Detailed view of the expert's profile and their currently open, unbooked time slots. | *Must Have* | *Low* |
| **Real-Time Broadcast** | Push updates to viewing clients via Socket.io when a slot is taken by another user. | *Must Have* | *High* |
| **Atomic Booking Engine** | Implement DB-level locking or unique constraints to ensure absolute prevention of concurrent double-booking. | *Must Have* | *High* |
| **JWT Based Authentication** | Secure user signup/login flows utilizing JSON Web Tokens. | *Should Have* | *High* |
| **Role-Based Access** | Segregate permissions between Client, Expert, and Admin roles. | *Should Have* | *High* |
| **Admin Panel** | Centralized dashboard for Admins to manage experts and platform-wide bookings. | *Should Have* | *High* |
| **Booking History** | "My Bookings" page allowing users to look up their booking history and status. | *Should Have* | *Medium* |
| **Review Feature** | Allow users to leave a rating and review for an expert post-session. | *Could Have* | *Medium* |
| **Availability Schema Migration** | Decouple expert availability blocks from the Booking schema into a dedicated Availability model. | *Should Have (Completed)* | *Medium* |
| **Two-Sided P2P Feedback Loop** | Enable experts to rate clients (1-5 stars and text) post-session to protect marketplace safety. | *Could Have (Completed)* | *Medium* |
| **Cancellation Protection** | Enforce cancellation windows (e.g. no cancellations within 2 hours of session start, strike-based suspension). | *Should Have (Completed)* | *Medium* |
| **Expert Business Analytics** | Add a dashboard tab for experts featuring revenue, utilization tracking, slot distribution trends, and client review logs. | *Should Have (Completed)* | *Medium* |
| **Automated Email & SMS Reminders** | Scheduled pre-session alerts and instant confirmations sent to both Clients and Experts via Agenda.js, Nodemailer, and Twilio. | *Should Have (Completed)* | *Medium* |
| **Password Recovery & Auto-Login** | Secure Forgot Password self-service with SHA-256 hashed temporary reset tokens, 10-minute expiry time-locks, and auto-login redirection. | *Should Have (Completed)* | *Medium* |
| **API Security Hardening** | Synchronous startup secret check, ReDoS query escaping, 100-character input limits, and endpoint rate limiting. | *Must Have (Completed)* | *Medium* |
| **Parameter ObjectId Validation** | Validation middleware validating parameter ObjectId compatibility on path queries to prevent CastError crashes. | *Must Have (Completed)* | *Low* |
| **Custom UX Dialog Modals** | Cohesive React modal dialog prompts replacing native browser alert and confirm interactions. | *Should Have (Completed)* | *Low* |

## 5. Agile User Stories & Acceptance Criteria

* **User Story EX-01:** As a Knowledge Seeker, I want to filter experts by category so that I can easily find the right professional for my specific problem.
  * **Acceptance Criteria:**
    * **Given** the user is viewing the main expert listing page
    * **When** they select a specific category from the filter dropdown
    * **Then** the listing updates instantly to display only experts assigned to that category.

* **User Story BK-01:** As a Knowledge Seeker, I want to see time slots disappear in real-time if booked by someone else so that I do not attempt to book an unavailable slot.
  * **Acceptance Criteria:**
    * **Given** the user is actively viewing Expert A's profile and available slots
    * **When** another user successfully books one of Expert A's slots
    * **Then** the viewing user's UI updates immediately via WebSocket to remove the booked slot without requiring a manual page refresh.

* **User Story BK-02:** As the System Architect, I want the backend to enforce atomic transactions for bookings so that two concurrent requests for the same slot result in only one confirmed booking.
  * **Acceptance Criteria:**
    * **Given** User A and User B submit a booking request for the exact same expert slot at the exact same millisecond
    * **When** the Node.js backend processes the requests
    * **Then** the MongoDB unique constraint/lock ensures exactly one booking succeeds with a 200 OK status, and the other request fails gracefully, returning a 409 Conflict error to the user.

* **User Story LO-01:** As an Indian user, I want the application to use local contexts so that scheduling and payments are intuitive.
  * **Acceptance Criteria:**
    * **Given** the user is viewing a time slot
    * **When** the slot is rendered
    * **Then** it must strictly adhere to Indian Standard Time (IST) and phone inputs must default to +91.

* **User Story BK-03:** As an Expert, I want my calendar to be protected against last-minute cancellations so that I do not lose booking opportunities.
  * **Acceptance Criteria:**
    * **Given** a confirmed booking is scheduled in less than 2 hours from the current time (in IST)
    * **When** the Client or Expert attempts to cancel the session
    * **Then** the system rejects the cancellation as standard, records a `"Late Cancellation"` status instead, releases the slot, and registers a late cancellation penalty strike on the cancelling user's account.

* **User Story BK-04:** As the System Administrator, I want to automatically suspend users who repeatedly cancel sessions late so that we deter marketplace abuse.
  * **Acceptance Criteria:**
    * **Given** a user accumulates 3 `"Late Cancellation"` strikes
    * **When** the 3rd strike is recorded
    * **Then** the user's account is automatically suspended (`suspendedUntil` is set to 7 days from the cancellation time), preventing them from booking or scheduling new slots until the cooldown period expires or an Admin resets their penalties.

* **User Story FB-01:** As a Domain Expert or Platform Admin, I want the system to enforce strict completion time-locks and display clear default status labels so that scheduling integrity is preserved and new client records are transparent.
  * **Acceptance Criteria:**
    * **Given** a session is booked, it cannot be transitioned to "Completed" status until its scheduled duration has fully ended (start time + 1 hour).
    * **Given** a client has no ratings history, their status is rendered as "New Client" rather than a raw numeric average in all dashboards.

* **User Story AN-01:** As an Expert, I want a Business Analytics dashboard so that I can monitor my weekly/monthly earnings, time slot utilization, and review feedback.
  * **Acceptance Criteria:**
    * **Given** an Expert is authenticated and logged into the portal
    * **When** they click on the "Business Analytics" tab
    * **Then** the portal fetches and renders dynamic KPI metrics (Total Earnings, Completed Hours, Calendar Utilization, Average Rating), native CSS charts representing monthly trends, weekly booking volume, and hourly slot distribution, as well as a list of the last 5 client reviews.

* **User Story RM-01:** As a User (Client or Expert), I want to receive automated email and SMS confirmations and pre-session reminders so that I do not miss scheduled consultations.
  * **Acceptance Criteria:**
    * **Given** a booking is successfully created or cancelled
    * **When** the system processes the action
    * **Then** it instantly schedules and dispatches confirmation or cancellation emails/SMS messages to both the client and the expert.
    * **Given** a confirmed booking is scheduled for the future
    * **When** the time reaches exactly 24 hours and 2 hours before the session start time (IST)
    * **Then** the Agenda.js background runner executes the scheduled reminder job and sends email/SMS alerts.
    * **Given** a local development environment is running with no email/SMS credentials
    * **When** a notification triggers
    * **Then** the systems write Ethereal Mail preview URLs and SMS text directly to the console logs.

* **User Story LO-02:** As a User, I want to securely reset my password if I forget it so that I can regain access to my account.
  * **Acceptance Criteria:**
    * **Given** the user is on the Login screen and clicks "Forgot Password?"
    * **When** they submit their registered email address
    * **Then** the system generates a secure SHA-256 hashed token, sets a 10-minute expiry time-lock, and emails a reset URL containing the raw token.
    * **Given** the user accesses the reset URL link
    * **When** they enter and confirm a new password of at least 6 characters
    * **Then** the system validates the token and expiration, updates their password (hashing it via bcrypt), clears the token fields, immediately authenticates their session, and redirects them to their respective dashboard dashboard page.

* **User Story SEC-01:** As the System Architect, I want the system to validate env secrets on boot and sanitize search inputs so that we ensure credential safety and prevent ReDoS attacks.
  * **Acceptance Criteria:**
    - **Given** the backend is starting up
    - **When** `JWT_SECRET` is missing from environment variables
    - **Then** the server prints a critical error to console and exits immediately.
    - **Given** a user performs a search on the public directory with regex characters
    - **When** the query is processed by the controller
    - **Then** it escapes regex characters and caps the input string to 100 characters.

* **User Story SEC-02:** As the System Architect, I want the system to enforce parameter validation and rate limiting so that brute-force attacks and Mongoose CastErrors are prevented.
  * **Acceptance Criteria:**
    - **Given** a client sends parameterized routes (e.g. `/bookings/:id`)
    - **When** the path variables are processed
    - **Then** the `validationMiddleware` checks format compatibility, returning `400 Bad Request` on invalid MongoDB ObjectIds before database operations run.
    - **Given** a client sends more than 15 authentication/recovery calls in 15 minutes or 5 booking calls in 1 minute
    - **When** the rates are evaluated
    - **Then** the client receives a `429 Too Many Requests` response.

* **User Story UI-02:** As a Client or Expert, I want custom modal prompt windows instead of standard browser popups so that the UX layout is premium and styled.
  * **Acceptance Criteria:**
    - **Given** a user books a slot or cancels a session
    - **When** a confirmation prompt is required
    - **Then** the system shows custom styled React modal overlays instead of standard browser `alert()` or `confirm()` prompts.

## 6. Technical & Non-Functional Specifications
* **Security & Compliance:** 
  - All incoming HTTP POST payloads must be strictly validated against a schema (Joi/Zod).
  - Environment variables (`MONGO_URI`, `PORT`, `JWT_SECRET`) must remain strictly local and isolated from source control; `JWT_SECRET` presence must be checked synchronously at startup.
  - Phase 2 routes must be protected via JWT middleware verifying Role-Based Access controls, using secure env secrets with no hardcoded fallback strings.
  - Core booking actions (retrieval by email, status updates, rating toggles) must enforce strict server-side ownership validations to ensure users only fetch or modify booking records they own or host.
  - Administrative accounts are restricted from booking creation, enforcing platform role isolation.
  - Core routes must be rate-limited to prevent automated resource exhaustion.
* **Performance & Scalability:** 
  - The database must utilize indexes for Expert queries (Name, Category) and Booking queries (ExpertID + SlotTime).
  - Socket.io connections must utilize Rooms. Clients should only join the specific `expert_<id>` room they are viewing.
* **Localization:**
  - System clock and rendering must assume Indian Standard Time (IST). Currency must be formatted as INR (₹).
* **Risk Matrix & Mitigation Strategies:**
  - *Risk:* **Socket Disconnection.** A client drops WebSocket connection while viewing slots and sees stale data. 
    * *Mitigation:* Implement standard long-polling fallback, and enforce a REST API re-fetch of available slots immediately upon Socket reconnection.
  - *Risk:* **UI State Desync.** A user attempts to book a slot that appears open on their UI, but was booked milliseconds prior.
    * *Mitigation:* Ensure robust client-side error handling that intercepts the backend 409 Conflict response, explicitly alerts the user that the slot was just taken, and auto-refreshes the available slot list.
