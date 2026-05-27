# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Two-Sided P2P Feedback System:**
  - Created `ClientReview` Mongoose schema in [ClientReview.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/models/ClientReview.js) to store expert reviews of clients post-session.
  - Added `rating` (default `5.0`) and `numReviews` fields to `User` schema in [User.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/models/User.js).
  - Added `isClientRated` check boolean field to `Booking` schema in [Booking.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/models/Booking.js).
  - Implemented `/bookings/:id/rate-client` API route and `rateClient` controller in [expertDashboardController.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/controllers/expertDashboardController.js) and [expertDashboardRoutes.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/routes/expertDashboardRoutes.js) to validate completes, authenticate host expert, build review documents, and update client ratings.
  - Created integration test suite [test_client_feedback.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/test_client_feedback.js) verifying 6 key feedback constraints and rolling average math.
  - Refactored [ExpertDashboard.jsx](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend/src/pages/ExpertDashboard.jsx) to display client ratings, render Completed feedback buttons, and handle submission ratings modal.
  - Refactored [Profile.jsx](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend/src/pages/Profile.jsx) to render client reputation score inside the settings header banner.
  - Refactored [AdminDashboard.jsx](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend/src/pages/AdminDashboard.jsx) to show a `Reputation` column in the Users manager directory.
- **Late Cancellation Lock & Strike-Suspension System:**
  - Added a new `"Late Cancellation"` status to the `Booking` schema's enum in [Booking.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/models/Booking.js).
  - Added `active` boolean field on Booking model, synced using a pre-save Mongoose hook, to allow unique indexing on `{ expert, bookingDate, slotTime }` only when a booking is active (`active: true`).
  - Added `lateCancellationsCount` (Number, default 0) and `suspendedUntil` (Date) to the [User.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/models/User.js) schema.
  - Implemented automatic database partial index recreation utility [recreate_booking_index.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/seeds/recreate_booking_index.js) to migrate existing documents and enforce concurrency safety.
  - Implemented `/api/v1/admin/users/:id/reset-penalties` endpoint in [adminController.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/controllers/adminController.js) and [adminRoutes.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/routes/adminRoutes.js) to reset a user's strike counts and lift cooldown suspensions.
  - Created automated test suites: [test_late_cancellation.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/test_late_cancellation.js) (6 integration tests verifying cancellation windows, status updates, and past booking blocks) and [test_penalty_system.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/test_penalty_system.js) (6 integration tests validating user strikes, automatic suspensions, cooldown limits, and Admin resets).
  - Created [direnv-start-script-guide.md](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/docs/knowledge-base/direnv-start-script-guide.md) documenting `direnv` environment loading and the security limits of shell navigation hooks.
  - Configured root [.envrc](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/.envrc) directory configuration to dynamically load backend environments using `direnv`.

### Changed
- **Cancellation Logic and Dashboard Interfaces for Penalty Tracking:**
  - Refactored `updateBookingStatus` in [bookingController.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/controllers/bookingController.js) to enforce a 2-hour IST window check relative to slot start time, block cancellation of past bookings (Admins bypass), apply late cancellation status and user strike counts, and trigger 7-day cooldown suspensions.
  - Secured `createBooking` in [bookingController.js](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/controllers/bookingController.js) to block new booking creations if the Client is currently suspended.
  - Refactored [MyBookings.jsx](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend/src/pages/MyBookings.jsx) to check the 2-hour late cancellation window (IST), warn users on cancellation prompts, show orange status badges for `"Late Cancellation"`, and display suspension alert banners.
  - Refactored [ExpertDashboard.jsx](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend/src/pages/ExpertDashboard.jsx) to support the `"Late Cancellation"` status, show orange status badges, and hide past sessions/cancellations.
  - Hardened [ExpertDetail.jsx](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend/src/pages/ExpertDetail.jsx) to disable slot selections and display warning alerts if the Client is suspended.
  - Refactored [AdminDashboard.jsx](file:///home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend/src/pages/AdminDashboard.jsx) to show user strikes (`Strikes`) and suspension dates (`Suspended Until`) in the users manager table, and added interactive `"Reset Penalties"` buttons.

### Added
- **Availability Schema Migration (Decoupled Slot Blocking):**
  - Created a dedicated `Availability` collection in MongoDB (`Availability.js`) with a compound unique index on `{ expert, bookingDate, slotTime }` to store expert availability blocks separately from client bookings.
  - Implemented an automated seed/migration utility `migrateBlockedSlots.js` to transfer existing placeholders (`notes: 'Blocked by Expert'`) from `bookings` to `availabilities` atomically.
  - Created an integration test suite `test_availability_migration.js` to verify block creation, lookups, double-booking rejection, and unblocking.

### Changed
- **Backend Controllers for Decoupled Availability:**
  - Modified `createBooking` and `getBookedSlots` in `bookingController.js` to check both `Booking` and `Availability` collections, merging their outputs for the frontend with zero breaking changes.
  - Modified `blockSlot` and `unblockSlot` in `expertDashboardController.js` to perform create/delete operations on the `Availability` collection instead of `Booking`.
  - Modified `getExpertBookings` to query only the `Booking` collection (which is now naturally clean of blocks).

### Fixed
- **Admin Layout Hardening & Role Isolation:**
  - Disabled interactive date selectors, slots grids, and client information inputs in `ExpertDetail.jsx` when viewed by an Admin account, updating the action button text to a static `'Booking Disabled for Admins'`.
  - Hidden the personal booking history link (`My History`) in `Navbar.jsx` for Admin users, directing them to the global booking manager in the Admin Panel instead.
  - Documented future development plans in `SkillSync_PRD.md` and `ROADMAP.md` under a new Phase 5 (Marketplace Governance & Schema Health) to address structural availability schema separation, two-sided rating imbalances, and cancellation policy windows.
- **Unauthorized Booking Access & Information Disclosure Vulnerabilities:**
  - Secured `GET /api/v1/bookings`, `PATCH /api/v1/bookings/:id/status`, and `PATCH /api/v1/bookings/:id/rate` endpoints with JWT-based `protect` authentication middleware.
  - Restricted email query lookups to own bookings or administrators, preventing anonymous users from harvesting booking records, names, or phone numbers.
  - Enforced ownership verification checks on status changes and ratings to ensure only the Client owner, host Expert, or Admin can cancel or complete bookings.
  - Proactively blocked Admin accounts from booking expert sessions directly, enforcing separation of duties.
- **Admin Add Expert Modal Layout Clipping & Design Refinement:**
  - Prevented modal height truncation on smaller viewports by applying viewport constraints (`max-h-[90vh]`), layout structuring (`flex flex-col`), and internal scroll areas (`overflow-y-auto`) to the form body.
  - Styled header and footer blocks with static gray backgrounds (`bg-gray-50`) to ensure "Add Expert" and "Cancel" buttons remain pinned and accessible.
  - Replaced the plain input selector with a custom styled category dropdown featuring a standard Lucide chevron-down arrow, and integrated micro-scale animations and smooth focus/hover transitions across all input fields.
- **Expert Profile Self-Booking History Leak:**
  - Modified the backend `getBookingsByEmail` query in `bookingController.js` to exclude bookings where `notes === 'Blocked by Expert'`, preventing expert-blocked calendar slots from showing up in their client-facing booking history list.
- **Stale Token Role Desynchronization (403 Forbidden on Dashboard):**
  - Configured frontend `AuthContext.jsx` initialization to proactively query `/auth/profile` and sync the latest user role and profile details from the database on startup. This prevents role mismatches (e.g. database-demoted Experts with stale client-side tokens accessing Expert dashboard routes and triggering `403 Forbidden`). Automatically wipes invalid sessions/stale tokens on database deletions.
- **Local Dev Port Hijacking & Hanging Processes:**
  - Added port-clearing logic to `start.sh` that detects and forcefully kills (`kill -9`) any legacy ghost processes listening on ports `5000` (backend) and `5173` (frontend), ensuring fresh servers always bind to the expected ports successfully.

### Added
- **Admin Roles & Session Guide:**
  - Created `docs/knowledge-base/admin-and-session-guide.md` covering Admin Panel credentials, roles, criticality impact analysis, and session sandbox isolation tips for developers testing client/expert interactions concurrently.

### Fixed
- **Timezone Mismatches & Clock-Skew Safety:**
  - Standardized date-time past checks on `ExpertDashboard.jsx` (slot availability grid and sessions list), `ExpertDetail.jsx` (available slots selector), and `MyBookings.jsx` (eligible completion check) to use UTC-offset absolute millisecond comparisons (`+05:30`) against `new Date().getTime()`. This aligns the client validation 100% with the backend's epoch validation logic, preventing phantom past-slot errors.
  - Satisfied strict React hooks purity lint rules by replacing `Date.now()` with `new Date().getTime()`.
- **Expert Dashboard Unblock Slot Rendering Mismatch:**
  - Corrected the `getBookedSlots` backend controller response format to return full slot objects (containing `slotTime`, `userName`, and `notes`) instead of a flat array of strings. This enables the Expert Dashboard to successfully read `notes` and identify expert-blocked slots from client-booked slots, fixing the unblock functionality.
  - Dynamically updated client-side socket event handlers and slot lookups in `ExpertDetail.jsx` to handle both strings and objects transparently.
- **Real-Time Client View Updates on Expert Unblock:**
  - Aligned the `slot_released` Socket.io event payload emitted by the `unblockSlot` controller to include the standard `bookingDate` and `slotTime` fields, enabling instant availability updates on connected client booking screens.

### Added
- **Nodemon Dev Startup Script:**
  - Installed `nodemon` as a development dependency and added an `npm run dev` script in `backend/package.json` to monitor server file changes and automatically restart the backend process, preventing stale code deployment bugs during development.

### Added
- **Feature Specification Standards & Tooling:**
  - Standardized all 10 User Interaction Flow plain-text blocks in `MASTER_SPEC.md` into highly readable, unambiguous Mermaid flowcharts with distinct actor swimlanes and explicit success/failure branching.
  - Formally codified requirement terminology (Feature, Functionality, Feature Cluster, User Story) within the `MASTER_SPEC.md` Glossary to prevent scope ambiguity across projects.
  - Documented extensive industry standard comparisons (IREB, SAFe, FDD) for defining features in `docs/feature_definitions.md`.
  - Created a robust `/start.sh` wrapper script in the root directory that concurrently boots both frontend and backend development servers while applying protective port checks to prevent ghost processes and terminal hijacking crashes.

- **Systemic Database Consistency Architecture:**
  - Integrated native MongoDB Replica Set ACID multi-document transactions (`session.withTransaction()`) globally across the backend to prevent partial data mutations.
  - Protected User Registration (`authController.js`), Admin Expert Creation, and Admin Cascading Deletion (`adminController.js`) pathways to ensure zero orphaned `User` or `Expert` records remain if complex insertions/deletions fail midway.
  - Created an engineering knowledge base reference at `docs/knowledge-base/mongodb-transactions.md` documenting the transaction architecture with an ASCII flow diagram.

- **Simplified Phone Input UX:**
  - Refactored frontend phone inputs (`ExpertDetail.jsx`, `Register.jsx`, `Profile.jsx`, `AdminDashboard.jsx`) to accept a standard 10-digit mobile number, removing the need for users to type or see the `+91` country code.
  - Prepend `+91` country code transparently on API submit to satisfy Mongoose schema validations.
  - Automatically strip `+91` prefix from loaded user profiles to display clean 10-digit numbers in forms.
- **12-Hour Format Conversion on Expert Dashboard:**
  - Added a centralized `formatTime12H` helper in `ExpertDashboard.jsx` to display time slots in 12-hour AM/PM format (e.g. `09:00 AM`, `02:00 PM`).
  - Formatted dates/slots inside the client sessions table list and the calendar block/unblock grid on the Expert Dashboard page.
  - Updated toggle success status alerts to show standard 12-hour values.
- **Expert Profile Image Fallback (Phase 2):**
  - Updated `ExpertCard` and `ExpertDetail` components to treat default Mongoose/generic placeholder image URLs (like `placehold.co`) as missing, successfully triggering the premium initials-based personalized avatar fallback (`ui-avatars.com`) instead of loading generic gray "150 x 150" boxes.

### Added
- **Professional Expert Portrait Assets (Phase 2):**
  - Generated and included 6 high-resolution professional portrait photos for the seeded experts inside the frontend public asset folder (`frontend/public/experts/`).
  - Updated `expertSeeder.js` to seed the database with paths pointing to these premium portrait image assets, replacing all default placeholder gray boxes on the directory grid and expert profile pages.
- **Registration Form Validation & Field Extensions (Phase 2):**
  - Refined Client registration flow to only require Email, Password, and Confirm Password (optional fields are hidden for client signup).
  - Expanded registration endpoint (`POST /auth/register`) and frontend `Register` page to dynamically collect and validate Full Name and Indian (+91) Mobile Number conditionally for the Expert role.
  - Dynamically prompt for expert professional profile details (category, experience, hourly rate, and description bio) during expert registration, and programmatically initialize their `Expert` schema profile document in the database.
  - Configured frontend Socket.io client to utilize both HTTP long-polling and WebSockets as an upgrade path to avoid raw WebSocket connection handshake failures in strict proxy/CORS environments.
- **Expert Portal Dashboard (Phase 2):**
  - Added JWT-protected backend endpoints under `/expert-dashboard` restricted to `Expert` role to get sessions, fetch/update profile biography, and block/unblock slots.
  - Implemented the frontend `ExpertDashboard` page with tabbed panels: Sessions Directory, Slot Availability, and Edit Profile Bio.
  - Configured navbar layout to display the Expert Portal navigation link only for authenticated experts.
- **Availability Slot Blocking (Phase 2):**
  - Leveraged the existing Atomic Booking Engine by treating blocked slots as a transactional booking where the client email matches the expert's email and notes indicate `"Blocked by Expert"`.
  - Implemented real-time Socket.io broadcasting (`slot_booked` / `slot_released`) on block/unblock events, ensuring client browsers reflect changes instantly.
- **Secure User Profile Management (Phase 2):**
  - Added backend endpoints `GET /auth/profile` and `PUT /auth/profile` to retrieve and update user data (display name, phone format, and optional password).
  - Created a frontend `Profile` page matching the modern glassmorphism design system.
  - Configured navbar layout to display the Profile link for authenticated users.
- **Admin Panel Dashboard (Phase 2):**
  - Added administrative backend controller `adminController.js` and router `adminRoutes.js` at `/admin`.
  - Created endpoints to view all users, view all bookings, force update booking status (override time-locks), delete bookings with real-time slot release, and add/delete expert accounts.
  - Implemented a frontend `AdminDashboard` page with tab layouts for Users list, Bookings manager, and Experts configuration.
  - Configured navbar navigation to display the Admin Panel link only to verified system administrators.
- **JWT Authentication & RBAC (Phase 2):**
  - Added backend `User` schema with automated password hashing via `bcryptjs` and credential verification.
  - Implemented JWT token generation and validation middleware (`authMiddleware`).
  - Added REST endpoints for `/auth/register` and `/auth/login`, including strict validations to block public admin account creation.
  - Added `userSeeder.js` utility to bootstrap initial system admin users.
  - Created client-side `AuthContext` to persist user login state and handle JWT auth headers in Axios requests.
  - Implemented frontend `Login` and `Register` pages with a role dropdown selector (Client or Expert).
  - Protected sensitive frontend routes (like `My Bookings`) using the `<ProtectedRoute>` guard.
- **Feature Documentation:** Generated 8 comprehensive Feature Plan markdown files under the `docs/` directory.
- **Anatomy Blueprint:** Created `docs/feature-plan-anatomy.txt` defining the visual component hierarchy template for future planning documents.
- **Home Landing Page:** Implemented `Home.jsx` with a hero section and feature highlights; updated navigation routes so the root path `/` renders the Home page and `/experts` renders the directory listing.
- **India-Specific Localization:** Added Indian Rupee (`₹`) currency symbol, automatic `+91` phone number formatting, HTML5 number patterns, and timezone-aware IST scheduling constraints.
- **Smart Image Fallbacks:** Implemented a two-level client-side fallback system on `ExpertCard` and `ExpertDetail` using `ui-avatars.com` with infinite-loop prevention.
- **CI/CD & Lint Hardening:** Resolved all frontend ESLint warnings and errors, verifying a clean production build with Vite.
- **SkillSync PRD & Roadmap:** Defined product requirements (`docs/SkillSync_PRD.md`) and strategic milestones (`docs/ROADMAP.md`).
