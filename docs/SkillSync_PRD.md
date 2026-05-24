# PRODUCT REQUIREMENT DOCUMENT (PRD)

## 1. Executive Summary & Goals
* **Product Name:** SkillSync (Real-Time Expert Session Booking System)
* **Primary Objective:** To provide a robust, real-time web application where users can seamlessly discover experts by category, view live availability, and confidently book sessions without encountering double-booking conflicts.
* **Success Metrics (KPIs):** Zero instances of double-booked slots; <500ms latency for socket-based slot status updates to connected clients; 100% database lock integrity under concurrent load testing.

## 2. User Architecture & Personas
* **Primary Persona:** The "Knowledge Seeker" (Client) — A professional, student, or entrepreneur seeking specific advice from an industry expert. *Pain points:* Wasting time with back-and-forth scheduling, encountering double bookings. *Motivations:* Quick, reliable access to expertise.
* **Secondary Persona:** The "Domain Expert" — A professional offering predefined time slots. *Pain points:* Managing chaotic schedules and missed appointments. *Motivations:* Seamlessly filling their availability.
* **User Journey Mapping:** 
  1. Client lands on the web application and views the paginated list of available experts.
  2. Client filters experts by category or searches by name to find a match.
  3. Client selects an expert, navigating to their profile to view available time slots.
  4. While viewing, real-time socket updates reflect slots booked by other clients instantly.
  5. Client selects a slot, enters their details (Name, Email, Phone), and submits.
  6. System validates the payload, locks the slot atomically in the database, confirms success, and broadcasts the slot's removal to all other viewers.
  7. Client tracks their status via the "My Bookings" interface.

## 3. Scope Boundaries
* **In-Scope Features:** Expert directory with pagination/search/filter; Expert profile views; Real-time slot availability broadcasting via Socket.io; Atomic booking engine (DB-level locking); Booking history tracking by email.
* **Out-of-Scope Elements:** Payment processing and gateways; Integrated video/audio conferencing (booking handles scheduling only); Expert/Admin portal for managing schedules (experts are managed via seeding or direct DB entry for MVP); User Authentication (login/passwords).

## 4. Functional Specifications & Prioritization
| Feature | Description | Priority | Complexity |
| :--- | :--- | :--- | :--- |
| **Expert Directory** | Display experts with pagination. Allow filtering by category and searching by name. | *Must Have* | *Medium* |
| **Expert Profile & Slots** | Detailed view of the expert's profile and their currently open, unbooked time slots. | *Must Have* | *Low* |
| **Real-Time Broadcast** | Push updates to viewing clients via Socket.io when a slot is taken by another user. | *Must Have* | *High* |
| **Atomic Booking Engine** | Implement DB-level locking or unique constraints to ensure absolute prevention of concurrent double-booking. | *Must Have* | *High* |
| **Server-Side Validation** | Comprehensive input validation (Name, Email, Phone, Slot selection) using Joi/Zod. | *Must Have* | *Low* |
| **Booking History** | "My Bookings" page allowing users to look up their booking history and status (Pending/Confirmed) by email. | *Should Have* | *Medium* |

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

## 6. Technical & Non-Functional Specifications
* **Security & Compliance:** 
  - All incoming HTTP POST payloads must be strictly validated against a schema (Joi/Zod).
  - Environment variables (`MONGO_URI`, `PORT`) must remain strictly local and isolated from source control.
  - "My Bookings" lookup by email must implement rate limiting to prevent email enumeration or scraping.
* **Performance & Scalability:** 
  - The database must utilize indexes for Expert queries (Name, Category) and Booking queries (ExpertID + SlotTime).
  - Socket.io connections must utilize Rooms. Clients should only join the specific `expert_<id>` room they are viewing, ensuring the server does not broadcast slot changes to the entire global user base.
* **Risk Matrix & Mitigation Strategies:**
  - *Risk:* **Socket Disconnection.** A client drops WebSocket connection while viewing slots and sees stale data. 
    * *Mitigation:* Implement standard long-polling fallback, and enforce a REST API re-fetch of available slots immediately upon Socket reconnection.
  - *Risk:* **UI State Desync.** A user attempts to book a slot that appears open on their UI, but was booked milliseconds prior.
    * *Mitigation:* Ensure robust client-side error handling that intercepts the backend 409 Conflict response, explicitly alerts the user that the slot was just taken, and auto-refreshes the available slot list.
