# SkillSync - Strategic Product Roadmap

**Last Updated: 2026-05-29**

## Vision & Strategy
Our goal is to build a highly adaptable, real-time platform. As the product scales, our architecture and feature sets must remain flexible to accommodate market feedback and new requirements without breaking existing functionalities.

## Prioritization Framework
We utilize a two-tiered approach to ensure sustainable growth:
1. **MoSCoW Method:** Used for strict, short-term release scoping (defining what goes into the next immediate sprint).
2. **Value vs. Complexity Matrix:** Used for long-term strategic evaluation of new feature requests.

---

## 🗺️ High-Level Roadmap

### Phase 1: The Foundation (MVP) - *Current Focus*
*Goal: Prove the core concept of conflict-free scheduling and real-time UI updates.*
- [x] Basic Project Skeleton (Backend/Frontend)
- [x] Real-Time Socket.io Infrastructure
- [x] Atomic Database Locking (MongoDB)
- [x] Home Page & Core UI Foundations
- [x] India-Specific Localization (IST, INR, +91 formats)
  - [x] Refined phone input UX: allow 10-digit entry, automatically prepend `+91` prefix for database consistency.
  - [x] Render slots in 12-hour AM/PM format (completed on Expert Dashboard and Client views).
- [x] Image Placeholders

### Phase 2: Security & Platform Management
*Goal: Secure the platform, segregate user access, and prepare for multi-tenant usage.*
- [x] JWT Based Authentication
- [x] Role-Based Access Control (RBAC: Client, Expert, Admin)
- [x] Password Recovery & Auto-Login (Forgot password self-service)
- [x] Admin Dashboard (System-wide monitoring & management)
- [x] Secure User Profile Management
- [x] Expert Portal Dashboard & Availability Slot Blocking
- [x] Prevent Expert Self-Booking (Security constraint)
- [x] Enforce Session Completion Time-Lock (State transition security)
- [x] Endpoint Hardening & Ownership Verification (Harden booking API boundaries)
- [x] System-Wide Input Validation, ReDoS Sanitization, and Capped Query Pagination (Harden API boundaries and prevent resource exhaustion)

### Phase 3: Engagement & Trust
*Goal: Build trust in the ecosystem and improve the user experience.*
- [x] Post-Session Rating & Review System
- [x] Automated Email/SMS Reminders
- [x] Expert Analytics Dashboard (Earnings, Booking metrics)
- [x] Real-Time Messaging & Notifications

### Phase 4: Monetization & Expansion (Future Horizons)
*Goal: Introduce revenue streams and broader communications.*
- [x] Payment Gateway Integration (e.g., Razorpay/Stripe)
- [ ] Integrated WebRTC Video/Audio Conferencing
- [ ] Dynamic/Surge Pricing Models for Experts
- [ ] Offline Fallbacks (Email notifications for unread chat messages)

### Phase 5: Marketplace Governance & Schema Health (Completed May 2026)
*Goal: Resolve schema overloading anomalies, balance platform rating dynamics, and protect provider calendars.*
- [x] **Availability & Slot Block Decoupling:** Migrate expert availability and calendar blocks from the overloaded `Booking` collection into a dedicated `BlockedSlot` or `Availability` collection.
- [x] **Two-Sided P2P Feedback System:** Introduce client reviews where experts can rate and comment on clients post-session to mitigate spam, no-shows, and abusive behaviors.
- [x] **Cancellation Window Policy Lock:** Add time-locks protecting expert schedules (blocking client cancellations within 2 hours of slot time, recording `"Late Cancellation"` statuses, and enforcing a 3-strike/7-day suspension cooldown policy).

### Phase 6: System Resilience & Security Hardening (Completed May 2026)
*Goal: Harden API boundaries, prevent data corruption and resource abuse, and enhance the error boundary protection.*
- [x] **Startup Secret Validation Check:** Crashes synchronously if `JWT_SECRET` is unset.
- [x] **ReDoS Search Vector Shield:** Escapes regular expressions and caps search inputs to 100 characters.
- [x] **Parameter Casting Guard:** Introduces ObjectId schema verification on parameterized path routing.
- [x] **Brute-Force Rate Limiting:** Mounts IP limits on authentication, recovery, and booking endpoints.
- [x] **Listing Database Pagination:** Optimizes database memory utilization on administrative panels and booking histories.
- [x] **Cohesive Custom Modals:** Replaces browser `alert()` and `confirm()` interactions with custom styled React modals.
- [x] **Global React UI Error boundaries:** Incorporates a client boundary catcher for runtime rendering safety.

### Phase 7: Payment & Advanced Security Hardening (Completed May 2026)
*Goal: Harden API against side-channel and DoS attacks, prevent data leakage, and ensure transactional consistency during payment flows.*
- [x] **Transaction Integrity:** Mongoose Session transaction wrapping for atomic booking and payment creation.
- [x] **Idempotency Resilience:** Tolerates duplicate 11000 errors gracefully during concurrent webhook and client verification pings.
- [x] **Side-Channel Protection:** Cryptographic timing-safe equality and buffer length checks on Razorpay webhook signatures.
- [x] **Privacy & Enumeration Hardening:** PII stripping from public socket/slot APIs and uniform generic responses on forgot-password flows.
- [x] **Resource Exhaustion Shields:** Helmet injection, Express 5.0 compatible NoSQL sanitization wrapper, and strict 10kb JSON body limits.
- [x] **Strict CORS Constraints:** Explicitly locked down HTTP and Socket.io endpoints to verified frontend origins.

### Phase 8: Agent Tooling & Developer Experience
*Goal: Empower AI agents with native capabilities to inspect systems and enforce code quality without writing boilerplate scripts.*
- [ ] **MongoDB Database Inspector (MCP Server):** A dedicated server exposing direct query, count, and index verification tools to AI agents for rapid state inspection.
- [ ] **Husky / Lint Fixer (Agent Skill):** An autonomous skill that detects pre-commit hook failures (like `ENOENT` on `eslint`), resolves pathing issues, and auto-fixes formatting violations.

---

## 🏗️ Technical Adaptability Strategy
To ensure the product can sustainably absorb new features down the line, we adhere to the following engineering practices:
1. **Modular Architecture:** Controllers, services, and models are strictly separated. Adding Payments (Phase 4) will not require rewriting the core Booking engine (Phase 1).
2. **Clean Resource-Based Paths:** Mounting API routes directly under resource root contexts (e.g., `/bookings`, `/auth`, `/expert-dashboard`) ensures clean structures and reduces request routing hops.
3. **Feature Toggles:** New UI features can be deployed behind configuration flags, allowing us to test them in production without risking stability.
4. **Schema Extensibility:** Leveraging MongoDB's NoSQL flexibility allows us to add new data requirements (like `paymentStatus`) later without painful database migrations.
