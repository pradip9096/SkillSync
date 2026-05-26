# SkillSync Knowledge Base: Admin Portal & Session Management

This guide compiles reference information, credentials, architectural responsibilities, and testing guidelines for the SkillSync Admin Portal and Session Isolation.

---

## 1. Accessing the Admin Panel

### Question: How to access the admin panel?

#### Answer:
To access the Admin Panel in your local environment, use the following steps:

1. Open the application login screen at **`http://localhost:5173/login`**.
2. Log in using the seeded system administrator credentials:
   - **Email**: `admin@skillsync.com`
   - **Password**: `adminpassword123`
3. After authenticating, a red **"Admin Panel"** navigation link will appear in the top-right header menu. Alternatively, you can directly access the route at **`http://localhost:5173/admin`**.

---

## 2. Core Responsibilities of an Admin

### Question: What is the responsibility of the admin?

#### Answer:
The Admin role in SkillSync is equipped with system-wide management capabilities across three core entities:

* **User Management**:
  - View all registered accounts in the system (`GET /admin/users`) including display names, emails, phone numbers, roles, and registration timestamps.
* **Expert Management**:
  - Register new Expert accounts directly through the panel (`POST /admin/experts`). This triggers a transaction that creates the user credential record and the professional expert profile details together.
  - Delete Expert accounts and profiles (`DELETE /admin/experts/:id`).
* **Booking & Session Management**:
  - View and audit all session bookings made across the entire platform (`GET /admin/bookings`).
  - Force-update any booking status (`PATCH /admin/bookings/:id/status`), allowing administrators to bypass standard client-side time lock constraints (such as completing a session before its scheduled time).
  - Cancel and delete bookings completely (`DELETE /admin/bookings/:id`).

---

## 3. Impact & Criticality Analysis of Admin Responsibilities

### Question: Explain the weight of each responsibility that an admin has. What would occur if any of these responsibilities did not exist?

#### Answer:

### 1. Global User Monitoring & Directory View
* **Weight**: **Medium-High (Security, Auditing, and Compliance)**
  * **System Role**: Provides operational visibility into account directories. Critical for auditing registration activity, spotting bot/spam signups, and fulfilling privacy compliance requests (such as account verification or deletion).
* **If it did not exist**:
  - The system would be a "black box" regarding user registry. Support agents would be unable to verify whether a user's account exists or troubleshoot account registration issues.
  - Bot registrations, spam, or malicious profiles could multiply in the database undetected, degrading query performance and storage efficiency over time.

### 2. Expert Account Lifecycle Management (Create & Delete)
* **Weight**: **High (Marketplace Quality Control & Database Integrity)**
  * **System Role**: Acts as the gatekeeper for service providers. Onboarding and offboarding controls ensure only verified professionals are listed.
  * **If it did not exist**:
    - **Loss of Quality Control**: The public directory would fill up with unverified, fake, or low-quality expert profiles, degrading the platform's commercial credibility.
    - **Ghost Calendars**: Abusive or inactive experts could not be removed, leaving stale availability grids in the public explorer.
    - **Database Desynchronization**: If experts had to be deleted manually through direct database scripts, developers might delete the `Expert` document but leave the `User` login credentials in the DB (or vice versa). This mismatch would cause crashes when the orphaned user tried to load their dashboard.

### 3. Global Booking Control & Status Overrides
* **Weight**: **Critical (Operational Resiliency & Dispute Resolution)**
  * **System Role**: Serves as the ultimate authority for system state. While normal Clients and Experts are restricted by strict validation rules (e.g. they cannot mark a future session as completed), the Admin can force-update booking states to resolve conflicts.
* **If it did not exist**:
  - **Locked Booking States**: If a meeting was disrupted by a technical issue or internet outage, the booking would remain stuck in a `Pending` or `Confirmed` state forever because standard validation checks prevent users from manually updating them.
  - **Frozen Slots**: Stale locked bookings would indefinitely block those calendar slots, preventing other clients from booking the expert.
  - **No Resolution Path**: Support staff would have no mechanism to refund a client, cancel disputed sessions, or resolve scheduling conflicts.

---

## 4. Testing & Session Isolation Guidelines

### Question: Does any problem occur if the client and expert use the same browser?

#### Answer:
Yes, **session and storage collisions** will occur if a Client and an Expert use the same browser instance concurrently.

* **Why it happens**: Both sessions share the same `localStorage` namespace on the origin (`http://localhost:5173`). Logging in as one user overwrites the `token` and `user` keys in `localStorage`, desynchronizing active tabs.
* **Consequences**: If you are logged in as a Client in one tab and open the Expert dashboard in another, the backend will verify the token and return a `403 Forbidden` response because the active token belongs to a Client.
* **Testing Best Practice**: To test real-time booking, slot blocking, or socket events between client and expert roles on the same machine, **always isolate their environments** using one of the following:
  1. Open one session in a normal window and the other in an **Incognito / Private Window**.
  2. Use two different browsers (e.g., Chrome for the Client and Firefox for the Expert).
  3. Use separate browser user profiles.
