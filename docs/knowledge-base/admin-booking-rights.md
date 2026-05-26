# Admin Booking Rights & Role Isolation Design Decision

This document details the architectural and product design decision regarding whether accounts with the `Admin` role should have the right to book sessions for themselves and view their personal booking history within the Real-Time Expert Session Booking System.

---

## Question
**Should the admin have the right to book an expert for himself and view his booking history?**

## Answer / Design Decision
**No, the Admin should NOT have the right to book an expert or maintain a personal booking history under their administrative account.** 

If an administrator wishes to book an expert, they must create and utilize a dedicated **Client** account.

---

## Architectural & Product Rationale

### 1. Role Isolation & Session Integrity (Preventing State Pollution)
From a client-side state perspective, combining administrative privileges and client-side consumption inside a single account causes state pollution:
* **UI/UX Complexity:** The dashboard would need to conditionally render client-facing features (like personal booking timelines, rating cards, and payment logs) alongside global admin oversight tools (like user listings, transaction directories, and override switches).
* **State Corruption Risks:** As documented during development, mixing admin tokens with consumer-level API queries increases the risk of **session leakage**. An admin-level override token should never be exposed to or used by standard customer-facing endpoints, and vice versa.

### 2. Database Integrity & Reporting Accuracy
Administrative actions are fundamentally different from customer actions, and their data should remain isolated at the database layer:
* **Metrics Contamination:** Booking reports, revenue charts, and platform utilization metrics depend on aggregating standard `Client` bookings. Allowing Admin accounts to book sessions contaminates these analytics with management/testing data, rendering business intelligence reports inaccurate.
* **Schema Integrity:** The `Booking` schema links user IDs and emails to booking documents. Admin users do not have corresponding client profile records (e.g., payment methods, preferences, client-specific notes). Forcing the Mongoose models to handle Admin-type users as booking participants introduces conditional schema logic and query complexities.

### 3. Security and Audit Trails (Principle of Least Privilege)
In secure, production-grade applications, the actions of system administrators must have clear audit logs:
* **Compromise Mitigation:** If an Admin account is compromised, the attacker would gain access to both administrative controls (the ability to delete experts or database records) and sensitive personal data (the admin's personal booking history, meeting notes, and scheduled times). 
* **Separation of Duty:** Administrators monitor the platform; they are not participants in the platform's marketplace. Restricting Admin accounts to administrative tasks makes it easier to track admin actions for security compliance without mixing in personal consumer events.

### 4. QA and Testing Fidelity
During development and QA, administrators must be able to experience the application exactly as a real user would:
* **Sandbox Testing:** Testing a booking flow using an Admin account bypasses client-specific validation checks (e.g., standard scheduling limits, double-booking checks, or client roles).
* **High-Fidelity Feedback:** To guarantee that the booking engine works under standard client constraints, the admin must log in with a standard sandbox Client account (e.g., `client-test@skillsync.com`), ensuring the test mimics the exact end-user experience.
