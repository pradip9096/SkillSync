# SkillSync - Strategic Product Roadmap

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
- [x] Admin Dashboard (System-wide monitoring & management)
- [x] Secure User Profile Management
- [x] Expert Portal Dashboard & Availability Slot Blocking
- [x] Prevent Expert Self-Booking (Security constraint)
- [x] Enforce Session Completion Time-Lock (State transition security)
- [x] Endpoint Hardening & Ownership Verification (Harden booking API boundaries)

### Phase 3: Engagement & Trust
*Goal: Build trust in the ecosystem and improve the user experience.*
- [x] Post-Session Rating & Review System
- [ ] Automated Email/SMS Reminders
- [x] Expert Analytics Dashboard (Earnings, Booking metrics)

### Phase 4: Monetization & Expansion (Future Horizons)
*Goal: Introduce revenue streams and broader communications.*
- [ ] Payment Gateway Integration (e.g., Razorpay/Stripe)
- [ ] Integrated WebRTC Video/Audio Conferencing
- [ ] Dynamic/Surge Pricing Models for Experts

### Phase 5: Marketplace Governance & Schema Health (Future Development)
*Goal: Resolve schema overloading anomalies, balance platform rating dynamics, and protect provider calendars.*
- [x] **Availability & Slot Block Decoupling:** Migrate expert availability and calendar blocks from the overloaded `Booking` collection into a dedicated `BlockedSlot` or `Availability` collection.
- [x] **Two-Sided P2P Feedback System:** Introduce client reviews where experts can rate and comment on clients post-session to mitigate spam, no-shows, and abusive behaviors.
- [x] **Cancellation Window Policy Lock:** Add time-locks protecting expert schedules (blocking client cancellations within 2 hours of slot time, recording `"Late Cancellation"` statuses, and enforcing a 3-strike/7-day suspension cooldown policy).

---

## 🏗️ Technical Adaptability Strategy
To ensure the product can sustainably absorb new features down the line, we adhere to the following engineering practices:
1. **Modular Architecture:** Controllers, services, and models are strictly separated. Adding Payments (Phase 4) will not require rewriting the core Booking engine (Phase 1).
2. **Clean Resource-Based Paths:** Mounting API routes directly under resource root contexts (e.g., `/bookings`, `/auth`, `/expert-dashboard`) ensures clean structures and reduces request routing hops.
3. **Feature Toggles:** New UI features can be deployed behind configuration flags, allowing us to test them in production without risking stability.
4. **Schema Extensibility:** Leveraging MongoDB's NoSQL flexibility allows us to add new data requirements (like `paymentStatus`) later without painful database migrations.
