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
* **In-Scope Features (Phase 2):** JWT Based Authentication; Role-Based Access Control (RBAC); Admin Panel; Secure User Profile Management; Expert Portal Dashboard; Prevent Expert Self-Booking; Enforce Session Completion Time-Lock.
* **In-Scope Features (Phase 3):** Post-session Rating & Review System.
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

## 6. Technical & Non-Functional Specifications
* **Security & Compliance:** 
  - All incoming HTTP POST payloads must be strictly validated against a schema (Joi/Zod).
  - Environment variables (`MONGO_URI`, `PORT`, `JWT_SECRET`) must remain strictly local and isolated from source control.
  - Phase 2 routes must be protected via JWT middleware verifying Role-Based Access controls.
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
