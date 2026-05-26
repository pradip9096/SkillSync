# Expert & Client Rights & Rationales

This document details the rights held by both the **Expert** (Service Provider) and **Client** (Service Consumer) roles within the Real-Time Expert Session Booking System, explaining the well-founded technical, operational, and UX rationales behind each.

---

## Part 1: Rights of the Expert (Service Provider)

### 1. The Right to Autonomously Toggle Availability (Block/Unblock Slots)
* **What it is:** The ability for an expert to dynamically flag calendar hours as "Blocked by Expert" or "Open" from their dashboard.
* **The Rationale:**
  * **Scheduling Autonomy:** Service providers must have absolute control over their time. If they cannot block slots dynamically, they risk being booked during personal conflicts, holidays, or emergency periods.
  * **Reducing Cancellation Friction:** Preventing a booking before it happens is significantly better than canceling an already scheduled booking. Cancellations create high user friction, chargeback overheads, and damage trust.
  * **Preventing Burnout & Overbooking:** Experts can pace their consulting sessions by closing slots in real-time as their day fills up.

### 2. The Right to View Client Profiles & Booking Notes
* **What it is:** Access to the client's name, email, phone number, and custom session notes for any confirmed bookings.
* **The Rationale:**
  * **Professional Preparation:** Consultations are high-value, time-bound events. To deliver quality advice, experts must review the client’s background and objectives (e.g., "Need help debugging a React Native WebSocket connection") beforehand.
  * **Safety & Security:** Knowing who is on the other end of the meeting establishes a layer of professional trust and safety for the expert prior to entering a real-time call.

### 3. The Right to Update Professional Biography & Profile Details
* **What it is:** The ability to edit their display name, experience level, professional description, and category.
* **The Rationale:**
  * **Reputation & Marketing:** An expert's profile page is their storefront. As they acquire new certifications, change focus areas, or gain years of experience, they must be able to reflect these changes to attract the right clients.
  * **Pricing Adjustments:** To align with market demand and professional growth, experts need to scale their hourly rates accordingly.

---

## Part 2: Rights of the Client (Service Consumer)

### 1. The Right to Explore, Filter, and View Real-Time Expert Profiles
* **What it is:** The ability to search experts by name, filter by category (e.g., Technology, Finance), and inspect real-time schedule grids without being forced to log in or book.
* **The Rationale:**
  * **Informed Decision-Making:** Consumers need to evaluate and compare qualifications, experience, biographies, and pricing (₹ INR) before committing to a paid booking.
  * **UX Trust:** Transparency in availability encourages booking conversions. If availability grids are hidden or stale, consumers perceive the platform as inactive and abandon it.

### 2. The Right to Atomic Booking Locks (Double-Booking Prevention)
* **What it is:** The guarantee that when a client selects and books an open time slot, it is immediately locked to their account, and any concurrent attempts by other users are transactionally rejected.
* **The Rationale:**
  * **Schedule Predictability:** A booking is a commitment of time. If two clients could book the same slot simultaneously, the system would create scheduling conflicts, forcing manual admin interventions and causing frustration for both clients.
  * **Technical Integrity:** This right is protected by backend ACID transactions (database-level locks), ensuring only one user document can lock a slot, safeguarding the system's database consistency.

### 3. The Right to View Personal Booking History
* **What it is:** Access to a dedicated dashboard panel showing past, active, and upcoming bookings along with status tags (Pending, Confirmed, Completed).
* **The Rationale:**
  * **Accountability & Tracking:** Consumers need a record of their expenditures, past advice sessions, and a way to retrieve notes on who they met with.
  * **Life-cycle Management:** Clients must be able to see upcoming sessions to prepare, join them on time, and mark completed sessions as rated.

### 4. The Right to Rate and Review Experts Post-Session
* **What it is:** The ability to submit feedback scores and comments once a session is marked as completed.
* **The Rationale:**
  * **Marketplace Quality Control:** In a decentralized platform, peer reviews act as an organic filter. High-performing experts are highlighted, while low-performing ones are naturally filtered down.
  * **Consumer Advocacy:** Reviews provide social proof, lowering the barrier of entry for new users trying to decide which expert to trust with their time and money.
