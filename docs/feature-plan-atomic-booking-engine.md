# Feature Plan: Atomic Booking Engine (Double-Booking Prevention)

**Project:** SkillSync — Real-Time Expert Session Booking System  
**Document Version:** 1.0  
**Created:** 2026-05-24  
**Author:** Architecture Team  
**Status:** ✅ Implemented  

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Feature Metadata](#2-feature-metadata)
3. [Context References](#3-context-references)
4. [Patterns to Follow](#4-patterns-to-follow)
5. [Implementation Plan](#5-implementation-plan)
6. [Step-by-Step Tasks](#6-step-by-step-tasks)
7. [Testing Strategy](#7-testing-strategy)
8. [Validation Commands](#8-validation-commands)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Completion Checklist](#10-completion-checklist)
11. [Decision Log](#11-decision-log)
12. [Known Limitations](#12-known-limitations)
13. [Future Improvements](#13-future-improvements)
14. [Notes](#14-notes)

---

## 1. Feature Overview

### Feature Description

The **Atomic Booking Engine** is the most critical backend subsystem in SkillSync. It guarantees that no two users can ever successfully book the same expert, on the same date, at the same time slot — regardless of network latency, server concurrency, or race conditions. The engine achieves this through a deliberate **two-layer defense** architecture: a pre-check query as the first layer (fast path, human-readable errors) and a MongoDB compound unique index with a partial filter expression as the second, atomic, bulletproof layer (race-condition safety net).

The feature spans the full vertical slice of the application: the Mongoose schema model, the Express controller, the API routing layer, the Socket.io broadcast event, and the React frontend's real-time slot state management.

### User Story

> **BK-02 (System Architect):** As the System Architect, I want the backend to enforce atomic transactions for bookings so that two concurrent requests for the same slot result in only one confirmed booking.
>
> **BK-01 (Knowledge Seeker):** As a Knowledge Seeker, I want to see time slots disappear in real-time if booked by someone else so that I do not attempt to book an unavailable slot.

### Problem Statement

In any multi-user booking system, there exists a classic **TOCTOU race condition** (Time-Of-Check vs Time-Of-Use). The sequence of events that causes a double booking is:

1. User A queries the database: "Is slot X available?" → Database responds: "Yes."
2. User B queries the database: "Is slot X available?" → Database responds: "Yes."
3. User A writes their booking to the database → Succeeds.
4. User B writes their booking to the database → **Also succeeds** — double booking has occurred.

This race window is real and exploitable under normal HTTP concurrency. Node.js processes multiple requests on the same event loop tick, and even with `async/await`, two `findOne` calls can both complete before either `create` call begins. The result is data corruption: the same slot is sold twice, the expert must turn someone away, and trust in the platform is destroyed.

Additional sub-problems:

- **Cancelled slot re-usability:** A naïve unique index would permanently block a slot after cancellation, making it un-bookable by anyone else.
- **Fraudulent completion:** Without a time-lock, a user or admin could mark a session as "Completed" before it begins, potentially triggering downstream review flows prematurely.
- **Stale UI:** Other users viewing the same expert page won't know a slot was just taken unless the system actively notifies them.
- **Date/Time representation:** Inconsistent timezone handling between client and server could cause phantom slot conflicts or missed conflicts.

### Solution Statement

The Atomic Booking Engine implements a **two-layer defense** pattern:

**Layer 1 — Pre-check query (`Booking.findOne`):**  
Before attempting a write, the controller queries for any existing, non-cancelled booking matching the `(expert, bookingDate, slotTime)` tuple. If found, the request is rejected immediately with a clean, human-readable error. This layer handles the 99.9% case — where two users don't submit at the exact same millisecond — and provides a friendly UX response.

**Layer 2 — MongoDB compound unique partial index:**  
The Mongoose schema defines a `{ expert: 1, bookingDate: 1, slotTime: 1 }` unique index with `partialFilterExpression: { status: { $ne: 'Cancelled' } }`. This index is enforced **atomically at the storage engine level** by MongoDB's WiredTiger engine. Even if two requests pass Layer 1 simultaneously, only one `Booking.create()` can succeed — the other will throw a `MongoServerError` with `code: 11000` (Duplicate Key Error). The controller catches this exact error code and returns a specific user-facing message: *"Double booking detected. This slot was just taken."*

**Layer 3 — Real-time broadcast (Socket.io):**  
Upon a successful booking, the server emits a `slot_booked` event to all clients currently in the expert's Socket.io room. The frontend listens for this event and immediately marks the slot as booked in local state — closing the UI-level race window for other concurrently-viewing users.

**Layer 4 — Time-lock enforcement (Mongoose pre-save hook):**  
A Mongoose `pre('save')` hook and a `pre('findOneAndUpdate')` hook prevent any booking's status from being set to `'Completed'` before the scheduled session time has passed. This uses IST-aware `Date` object construction (`new Date(\`${bookingDate}T${slotTime}:00+05:30\``)`).

---

## 2. Feature Metadata

| Property            | Value                                                  |
|---------------------|--------------------------------------------------------|
| **Feature Type**    | Backend Core / Data Integrity / Concurrency Control    |
| **Complexity**      | High                                                   |
| **Priority**        | Must Have (MVP)                                        |
| **PRD Reference**   | BK-02, Section 4 "Atomic Booking Engine"               |
| **Risk Level**      | Critical — failure causes data corruption              |
| **Affected Systems**| Backend model, controller, routes; Frontend ExpertDetail page, Socket service |
| **Database Impact** | New compound unique partial index on `bookings` collection |
| **API Changes**     | `POST /bookings` (error handling extended); `PATCH /bookings/:id/status` (time-lock added); `GET /bookings/booked-slots/:expertId/:date` (new endpoint) |
| **Socket Events**   | `slot_booked` (emit on success); `slot_released` (emit on cancellation); `join_expert_room` (client join) |

### Dependencies

| Dependency         | Version   | Purpose                                               |
|--------------------|-----------|-------------------------------------------------------|
| `mongoose`         | `^8.x`    | Schema definition, index creation, ORM                |
| `express`          | `^4.x`    | HTTP request handling                                 |
| `socket.io`        | `^4.x`    | Real-time broadcast on booking events                 |
| `socket.io-client` | `^4.x`    | Frontend WebSocket connection                         |
| `axios`            | `^1.x`    | Frontend HTTP client for booking API calls            |
| MongoDB            | `^6.x`    | WiredTiger storage engine for atomic index enforcement|

---

## 3. Context References

### Relevant Existing Files

| File | Role in Feature | Key Lines |
|------|----------------|-----------|
| `backend/src/models/Booking.js` | **Central** — Defines the schema, the compound unique partial index, the `pre('save')` time-lock hook, and the `pre('findOneAndUpdate')` time-lock hook | L10–69 (schema), L78–81 (`parseISTSessionTime`), L88–99 (`pre('save')`), L106–122 (`pre('findOneAndUpdate')`), L129–135 (index) |
| `backend/src/controllers/bookingController.js` | **Central** — Implements `createBooking` (Layer 1 pre-check + Layer 2 error catch), `updateBookingStatus` (time-lock enforcement + `slot_released` broadcast), `getBookedSlots` (slot availability query) | L17–83 (`createBooking`), L122–180 (`updateBookingStatus`), L189–214 (`getBookedSlots`) |
| `backend/src/routes/bookingRoutes.js` | Route definitions mapping HTTP verbs/paths to controller functions | L23 (`POST /`), L37 (`PATCH /:id/status`), L51 (`GET /booked-slots/:expertId/:date`) |
| `backend/src/app.js` | Server entry point; binds `io` to the Express `app` object, defines Socket.io room logic, mounts booking routes | L41–75 (Socket.io setup), L50 (`app.set('io', io)`), L66–69 (`join_expert_room` handler), L101 (route mount) |
| `frontend/src/services/api.js` | Axios service layer; `createBooking`, `fetchBookedSlots`, `updateBookingStatus` | L53, L68, L89 |
| `frontend/src/services/socket.js` | Singleton Socket.io client; connects to `http://localhost:5000` with `websocket` transport | L23–26 |
| `frontend/src/pages/ExpertDetail.jsx` | React page consuming the entire booking flow — slot fetching, Socket.io listeners, booking form submission, error handling | L100–138 (socket effect), L143–156 (slot fetch effect), L164–186 (`handleBooking`) |
| `backend/src/config/db.js` | MongoDB connection; `mongoose.connect()` must succeed before the index is active | L20–32 |
| `backend/src/models/Expert.js` | Expert schema referenced by `expert` ObjectId in Booking schema | L10–65 |

### New Files Created

> All functionality for this feature lives within the existing files listed above. No new files were required. The feature was implemented as a vertical extension of the existing MVC structure.

### Documentation References

| Document | Relevance |
|----------|-----------|
| `docs/SkillSync_PRD.md` | User Story BK-02, Section 4 (Atomic Booking Engine priority), Section 5 (acceptance criteria for concurrent booking), Section 6 (risk matrix: UI State Desync) |
| `docs/ROADMAP.md` | Confirms Atomic Booking Engine as Phase 1 MVP deliverable |
| `GEMINI.md` | Section "Prevent Double Booking" — architectural guidance, challenge/solution framing |
| `AGENTS.md` | Module organization, CommonJS vs ESM rules, naming conventions |

---

## 4. Patterns to Follow

### Module System
- **Backend:** CommonJS (`require` / `module.exports`) — all controller, model, route, and config files use `require`.
- **Frontend:** ES Modules (`import` / `export`) — all React components and service files use `import`.
- Do **not** mix module systems within the same package.

### Naming Conventions
- **Models:** PascalCase (`Booking.js`, `Expert.js`) — file name matches the Mongoose model name exactly.
- **Controllers:** camelCase function names (`createBooking`, `updateBookingStatus`, `getBookedSlots`).
- **Routes:** kebab-case URL paths (`/bookings/booked-slots/:expertId/:date`).
- **Frontend components:** PascalCase (`ExpertDetail.jsx`, `ExpertCard.jsx`).
- **Frontend service exports:** lower camelCase (`createBooking`, `fetchBookedSlots`).
- **Socket event names:** `snake_case` (`slot_booked`, `slot_released`, `join_expert_room`).

### Error Handling Pattern
Controllers follow a consistent try/catch pattern:

```js
const controllerFn = async (req, res) => {
  try {
    // ... business logic
    res.status(2xx).json({ success: true, data: ... });
  } catch (error) {
    console.error('Error in controllerFn:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Human-readable duplicate message.' });
    }
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

- Always return `{ success: true/false, data/error: ... }` as the response shape.
- Always log errors with `console.error` with a context prefix.
- Always check for MongoDB error code `11000` as a **separate branch** before the generic 500 handler.
- Never expose raw error messages (stack traces, internal field names) to the client.

### Logging Pattern
- `console.log` for informational Socket.io connection events (in `app.js`).
- `console.error('Error in <functionName>:', error)` for caught exceptions in controllers.
- `console.error('API Error:', error)` for secondary controller functions.
- `console.log(\`MongoDB Connected: ${conn.connection.host}\`)` in `db.js`.

### Mongoose Schema Pattern
- Always include `{ timestamps: true }` in schema options.
- Use `required: [true, 'Human-readable message']` for validation.
- Use `match: [/regex/, 'message']` for format validation (email, phone).
- Add JSDoc block comments above every hook explaining purpose, params, returns, and side effects.
- Define indexes **after** the schema and **before** `mongoose.model()`.

### Socket.io Pattern
- Access `io` in controllers via `req.app.get('io')` — never import `io` directly.
- Emit to a **room** (expert's ObjectId string), never broadcast globally.
- Room name equals the expert's `_id` as a string.
- Events: `slot_booked` when a booking is created; `slot_released` when a booking is cancelled.
- Frontend joins a room with `socket.emit('join_expert_room', expertId)` on component mount.
- Frontend cleans up listeners with `socket.off('slot_booked')` and `socket.off('slot_released')` on component unmount.

---

## 5. Implementation Plan

The feature is organized into four phases, from foundational data modeling through full integration and test coverage.

```
Phase 1: Foundation     → Mongoose schema + compound unique partial index
Phase 2: Core Engine    → bookingController.js createBooking (two-layer defense)
Phase 3: Integration    → Status update time-lock + Socket.io broadcast + route wiring
Phase 4: Testing        → Race condition tests, unit tests, edge case validation
```

### Phase 1: Foundation — Schema & Index Design

**Goal:** Establish the MongoDB data contract that makes atomic booking enforcement possible. Without the correct index, no amount of application-layer logic can fully prevent double bookings.

**Key Deliverable:** `backend/src/models/Booking.js` with the compound unique partial index.

**Why this comes first:** The index must exist in MongoDB before any booking write is attempted. Mongoose syncs indexes on connection (via `autoIndex: true` by default in development), so the model file must be correct before the server starts.

### Phase 2: Core Engine — createBooking Controller

**Goal:** Implement the two-layer defense within `createBooking` in `bookingController.js`. This is the function called on every `POST /bookings` request.

**Key Deliverable:** `createBooking` function with Layer 1 pre-check, Layer 2 `create` + `11000` catch, and Layer 3 Socket.io broadcast.

### Phase 3: Integration — Status Lifecycle + Socket.io + Routes

**Goal:** Complete the booking lifecycle: cancellation (slot release), status time-lock enforcement, slot availability query endpoint, and route definitions. Wire Socket.io rooms in `app.js`.

**Key Deliverables:**
- `updateBookingStatus` with time-lock for `'Completed'` and `slot_released` Socket.io emit for `'Cancelled'`.
- `getBookedSlots` endpoint returning booked slot times array.
- `bookingRoutes.js` with all five routes registered.
- `app.js` Socket.io room management.
- `ExpertDetail.jsx` consuming all events and API calls.

### Phase 4: Testing — Race Conditions, Edge Cases, Validation

**Goal:** Prove the two-layer defense works correctly under all conditions, including the exact simultaneous-request scenario described in BK-02.

**Key Deliverables:** Manual concurrency tests using parallel `curl` or a script; index verification in MongoDB Compass or the shell; edge case manual tests for time-lock, cancelled slot re-booking, and invalid inputs.

---

## 6. Step-by-Step Tasks

---

### Phase 1: Foundation

#### Task 1.1 — Define the Booking Schema Fields

**File:** `backend/src/models/Booking.js` (L10–69)

**IMPLEMENT:**
```js
const bookingSchema = new mongoose.Schema({
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: true
  },
  userName: { type: String, required: [true, 'Please add your name'], trim: true },
  userEmail: {
    type: String,
    required: [true, 'Please add your email'],
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
  },
  userPhone: {
    type: String,
    required: [true, 'Please add your phone number'],
    match: [/^\+91[0-9]{10}$/, 'Please add a valid Indian phone number starting with +91']
  },
  bookingDate: { type: String, required: true },   // YYYY-MM-DD
  slotTime:    { type: String, required: true },   // HH:mm
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Confirmed'
  },
  isRated: { type: Boolean, default: false },
  notes:   { type: String }
}, { timestamps: true });
```

**PATTERN:** All fields include `required` with human-readable error messages. `userPhone` uses a strict regex for Indian E.164 format (`+91` followed by exactly 10 digits). `bookingDate` and `slotTime` are **strings**, not `Date` objects — see Decision Log DL-01.

**GOTCHA:** The `userPhone` regex `^\+91[0-9]{10}$` validates the stored value. In the frontend (`ExpertDetail.jsx` L176), the phone is stripped of spaces with `formData.userPhone.replace(/\s/g, '')` before submission so `+91 9876543210` becomes `+919876543210` which then matches the regex. If you ever change the regex, update the frontend `pattern` attribute (L407) too.

**VALIDATE:** Start the server and `POST /bookings` with a phone like `+91 9876543210` — the space must be stripped by the frontend before it reaches the schema validator.

---

#### Task 1.2 — Implement `parseISTSessionTime` Helper

**File:** `backend/src/models/Booking.js` (L78–81)

**IMPLEMENT:**
```js
const parseISTSessionTime = (bookingDate, slotTime) => {
  const session = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  return Number.isNaN(session.getTime()) ? null : session;
};
```

**PATTERN:** Constructs an ISO 8601 datetime string with the `+05:30` timezone offset appended. The `new Date()` constructor in Node.js (V8) correctly parses this and returns a UTC-equivalent `Date` object. `Number.isNaN(session.getTime())` is the canonical way to validate a `Date` object — `isNaN(date)` also works but is less explicit.

**IMPORTS:** No imports needed — this is a pure utility function using only native JavaScript `Date`.

**GOTCHA:** This function returns `null` for invalid inputs (e.g., `bookingDate = "not-a-date"`). All callers **must** check for a `null` return before using the result. The `pre('save')` hook at L91–93 performs this null check. If you add new callers of this function, always null-check before calling `.getTime()`.

**GOTCHA:** `new Date('2024-01-01T10:00:00+05:30')` produces a `Date` object representing the **UTC equivalent**: `2024-01-01T04:30:00.000Z`. This is intentional — `Date.now()` also returns UTC milliseconds, so the comparison at L95 (`Date.now() < sessionTime.getTime()`) is a correct UTC-to-UTC comparison.

---

#### Task 1.3 — Implement `pre('save')` Time-Lock Hook

**File:** `backend/src/models/Booking.js` (L88–99)

**IMPLEMENT:**
```js
bookingSchema.pre('save', async function () {
  if (this.isModified('status') && this.status === 'Completed') {
    const sessionTime = parseISTSessionTime(this.bookingDate, this.slotTime);
    if (!sessionTime) {
      throw new Error('Invalid booking date or slot time.');
    }
    if (Date.now() < sessionTime.getTime()) {
      throw new Error('Time-lock violation: Session has not started yet.');
    }
  }
});
```

**PATTERN:** The `this.isModified('status')` check ensures the hook only runs when the `status` field is changed — not on initial creation or updates to other fields. `this` refers to the document being saved. The hook uses `throw new Error(...)` which Mongoose converts into a rejection that propagates to the controller's `catch` block.

**GOTCHA:** This hook only fires when using `document.save()`. If you use `Model.findByIdAndUpdate()` with `{ status: 'Completed' }` directly, this hook does **not** fire. This is why the `pre('findOneAndUpdate')` hook (Task 1.4) also exists, and why `updateBookingStatus` controller fetches the document first then calls `booking.save()` (L160–161) rather than using a direct update query.

**GOTCHA:** In the `pre('save')` hook, `this.bookingDate` and `this.slotTime` are already present on the document from the original creation, so the time-lock check has all data it needs without additional queries.

---

#### Task 1.4 — Implement `pre('findOneAndUpdate')` Time-Lock Hook

**File:** `backend/src/models/Booking.js` (L106–122)

**IMPLEMENT:**
```js
bookingSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  const status = update.status || (update.$set && update.$set.status);

  if (status === 'Completed') {
    const bookingDate = update.bookingDate || (update.$set && update.$set.bookingDate);
    const slotTime    = update.slotTime    || (update.$set && update.$set.slotTime);

    if (bookingDate && slotTime) {
      const sessionTime = parseISTSessionTime(bookingDate, slotTime);
      if (sessionTime && Date.now() < sessionTime.getTime()) {
        throw new Error('Time-lock violation: Session has not started yet.');
      }
    }
  }
});
```

**PATTERN:** `this.getUpdate()` returns the update object passed to `findOneAndUpdate`. Mongoose supports two update styles: `{ status: 'Completed' }` and `{ $set: { status: 'Completed' } }`. The hook must handle both, hence the double lookup `update.status || (update.$set && update.$set.status)`.

**GOTCHA:** This hook only validates if `bookingDate` and `slotTime` are present in the update payload. Since `updateBookingStatus` controller currently fetches the document and calls `booking.save()`, this hook serves as a defensive second layer for any future code that might use `findOneAndUpdate` directly. The current controller flow does **not** trigger this hook (it triggers `pre('save')` instead).

**GOTCHA:** This hook cannot access `this.bookingDate` or `this.slotTime` — it is operating on the update query, not a hydrated document. To get those fields in the update hook, they must be included in the update payload, which is not done in the current controller. The hook safely skips the check when those fields are absent.

---

#### Task 1.5 — Create the Compound Unique Partial Index — THE CORE GUARD

**File:** `backend/src/models/Booking.js` (L129–135)

**IMPLEMENT:**
```js
bookingSchema.index(
  { expert: 1, bookingDate: 1, slotTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'Cancelled' } }
  }
);
```

**PATTERN:** Index is defined using `Schema.index()` as the last step before `mongoose.model()`. The index covers the three fields that together constitute a unique "booking slot identity": `expert` (ObjectId), `bookingDate` (string), and `slotTime` (string).

**IMPORTS:** No imports — uses `bookingSchema` which is already in scope.

**GOTCHA — The Partial Filter is Non-Negotiable:**  
Without `partialFilterExpression: { status: { $ne: 'Cancelled' } }`, a cancelled booking would permanently block that slot. Suppose User A books `2024-01-01 / 10:00` with Expert X, then cancels. The slot status becomes `'Cancelled'`. Without the partial filter, the unique index still contains a document for `(Expert X, 2024-01-01, 10:00)` and any future booking attempt for the same slot will fail with error 11000 — even though the slot is now available. The `partialFilterExpression` tells MongoDB: "Only include documents in this index where `status != 'Cancelled'`." Cancelled documents fall out of the index and no longer participate in uniqueness enforcement.

**GOTCHA — Index Sync Timing:**  
Mongoose syncs indexes when `mongoose.connect()` is called (in development, `autoIndex` defaults to `true`). In production, set `autoIndex: false` and run index sync separately to avoid slowing startup. Regardless, the index must exist in MongoDB **before** any concurrent bookings are processed. Running the server for the first time creates the index; after that it persists.

**GOTCHA — Existing Duplicate Data:**  
If the database already contains duplicate `(expert, bookingDate, slotTime)` documents with a non-cancelled status, MongoDB will **refuse** to create this index. You must clean up duplicate data before the index can be applied. Use the MongoDB shell query in the Validation Commands section to detect duplicates first.

**VALIDATE:**
```bash
# In MongoDB shell after starting the server:
db.bookings.getIndexes()
# Should show the compound index:
# { "expert": 1, "bookingDate": 1, "slotTime": 1 }, unique: true, partialFilterExpression: { status: { $ne: "Cancelled" } }
```

---

### Phase 2: Core Engine

#### Task 2.1 — Implement `createBooking` Controller (Layer 1: Pre-Check)

**File:** `backend/src/controllers/bookingController.js` (L17–38)

**IMPLEMENT:**
```js
const createBooking = async (req, res) => {
  try {
    const { expert, userName, userEmail, userPhone, bookingDate, slotTime, notes } = req.body;

    // LAYER 1: Pre-check — fast path, human-readable error
    const existingBooking = await Booking.findOne({
      expert,
      bookingDate,
      slotTime,
      status: { $ne: 'Cancelled' }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is already booked.'
      });
    }
    // ... continues in Task 2.2
```

**PATTERN:** Destructure all fields from `req.body` at the top of the handler. The `findOne` query mirrors the uniqueness tuple exactly: `(expert, bookingDate, slotTime)` with `status: { $ne: 'Cancelled' }`. This ensures cancelled bookings don't falsely trigger the pre-check. Return early with `return res.status(400)...` to avoid any further execution.

**IMPORTS:**
```js
const Booking = require('../models/Booking');
// (at top of bookingController.js, L8)
```

**GOTCHA:** The pre-check and the `Booking.create()` (Layer 2) are **not atomic together**. Between the `findOne` and the `create`, another request can slip through. This is acceptable and expected — Layer 1 handles the common case cleanly; Layer 2 (the index) handles the uncommon race condition. Never try to "fix" this by wrapping both in a transaction unless you're moving to a replica set environment (see Future Improvements).

**GOTCHA:** The `findOne` query uses `status: { $ne: 'Cancelled' }` rather than `status: { $in: ['Pending', 'Confirmed', 'Completed'] }`. Using `$ne` is more resilient — if you add new status values to the enum in the future, you don't need to update the pre-check query. It automatically excludes only `'Cancelled'`.

---

#### Task 2.2 — Implement `createBooking` Controller (Layer 2: Atomic Write + Error Catch)

**File:** `backend/src/controllers/bookingController.js` (L40–82)

**IMPLEMENT:**
```js
    // LAYER 2: Atomic write — index enforces uniqueness at storage level
    const booking = await Booking.create({
      expert,
      userName,
      userEmail,
      userPhone,
      bookingDate,
      slotTime,
      notes
    });

    // LAYER 3: Real-time broadcast
    const io = req.app.get('io');
    io.to(expert).emit('slot_booked', { bookingDate, slotTime });

    res.status(201).json({ success: true, data: booking });

  } catch (error) {
    console.error('Error in createBooking:', error);

    // MongoDB duplicate key error — race condition caught at the index level
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Double booking detected. This slot was just taken.'
      });
    }

    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

**PATTERN:** `Booking.create()` wraps `new Booking(data).save()`. When the unique index constraint is violated, MongoDB throws a `MongoServerError` with `error.code === 11000`. The catch block checks for this exact code before falling through to the generic 500 handler. The `11000` code is a MongoDB-level constant that never changes. 

**PATTERN:** `req.app.get('io')` retrieves the Socket.io `Server` instance that was bound with `app.set('io', io)` in `app.js:50`. This is the standard Express pattern for sharing stateful objects (like `io`) across the application without creating circular imports.

**GOTCHA:** The `io.to(expert)` call uses `expert` (the ObjectId string from `req.body`) as the room name. When the frontend calls `socket.emit('join_expert_room', id)`, `id` is the same ObjectId string from the URL params. These **must match exactly**. If the frontend passes a different representation (e.g., `{ expertId: id }` object instead of `id` string), the room join fails silently and real-time updates don't work.

**GOTCHA:** `Booking.create()` with invalid enum values (e.g., `status: 'Invalid'`) throws a Mongoose ValidationError, not an 11000 error. ValidationErrors are also caught by the generic catch block and return a `500 Server Error` response — but they should ideally return `400`. Consider adding a Mongoose ValidationError check if you add more complex validation logic later.

**GOTCHA:** The Socket.io emit happens **after** the successful `Booking.create()`. Never emit before the write succeeds — a failed write followed by a broadcast would cause clients to mark a slot as booked when it isn't.

**VALIDATE:**
```bash
# Successful booking
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"<valid_expert_id>","userName":"Test User","userEmail":"test@test.com","userPhone":"+919876543210","bookingDate":"2026-06-01","slotTime":"10:00"}'
# Expected: 201 { success: true, data: { ... } }

# Duplicate booking (same slot)
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"<same_expert_id>","userName":"User 2","userEmail":"user2@test.com","userPhone":"+919876543211","bookingDate":"2026-06-01","slotTime":"10:00"}'
# Expected: 400 { success: false, error: "This time slot is already booked." }
```

---

### Phase 3: Integration

#### Task 3.1 — Implement `updateBookingStatus` with Time-Lock and Slot Release

**File:** `backend/src/controllers/bookingController.js` (L122–180)

**IMPLEMENT:**
```js
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const normalizedStatus = String(status || '').trim();

    if (normalizedStatus === 'Completed') {
      const nowMs = Date.now();
      const sessionTime = new Date(`${booking.bookingDate}T${booking.slotTime}:00+05:30`);
      const sessionMs = sessionTime.getTime();

      if (Number.isNaN(sessionMs)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid booking date or slot time. Cannot verify session start time.'
        });
      }

      if (nowMs < sessionMs) {
        return res.status(400).json({
          success: false,
          error: `Time-lock violation: This session is scheduled for ${booking.bookingDate} ${booking.slotTime} IST and cannot be completed yet.`
        });
      }
    }

    booking.status = normalizedStatus;
    await booking.save(); // triggers pre('save') hook for additional validation

    if (normalizedStatus === 'Cancelled') {
      const io = req.app.get('io');
      io.to(booking.expert.toString()).emit('slot_released', {
        bookingDate: booking.bookingDate,
        slotTime: booking.slotTime
      });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

**PATTERN:** Fetch the document first (`Booking.findById`), then mutate `booking.status`, then call `booking.save()`. This ensures the `pre('save')` hook fires and performs its own time-lock check as a safety net. **Never** use `findByIdAndUpdate` for status changes in this feature — it bypasses `pre('save')`.

**PATTERN:** `normalizedStatus = String(status || '').trim()` defensively handles `undefined`, `null`, and leading/trailing whitespace in the `status` body parameter.

**GOTCHA:** When emitting `slot_released`, use `booking.expert.toString()` — not `booking.expert` directly. When Mongoose populates a document, `booking.expert` might be an ObjectId object. `.toString()` ensures a plain string room name that matches what the frontend passed during `join_expert_room`.

**GOTCHA:** The time-lock in this controller is an explicit pre-check, duplicating what the `pre('save')` hook does. This redundancy is intentional: the controller provides a **specific, descriptive error message** including the exact scheduled date/time, while the hook provides a generic fallback. If the hook fires and throws, the controller's catch block would return `500 Server Error` with no useful detail. The explicit pre-check returns a `400` with a human-readable error.

---

#### Task 3.2 — Implement `getBookedSlots` Endpoint

**File:** `backend/src/controllers/bookingController.js` (L189–214)

**IMPLEMENT:**
```js
const getBookedSlots = async (req, res) => {
  try {
    const { expertId, date } = req.params;

    const bookings = await Booking.find({
      expert: expertId,
      bookingDate: date,
      status: { $ne: 'Cancelled' }
    });

    const bookedSlots = bookings.map(b => b.slotTime);

    res.status(200).json({ success: true, data: bookedSlots });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

**PATTERN:** Returns a flat array of strings (e.g., `["10:00", "14:00"]`) — not full booking objects. The frontend only needs the slot times to mark buttons as disabled. Returning full booking documents would expose other users' names and emails.

**GOTCHA:** The query uses `status: { $ne: 'Cancelled' }` consistently — the same filter used in `createBooking`'s pre-check and in the compound unique index's partial filter expression. This trio of consistent filtering is critical for correctness. If any one of them allowed `'Cancelled'` through, cancelled slots would appear as booked on the frontend.

**VALIDATE:**
```bash
curl "http://localhost:5000/bookings/booked-slots/<expertId>/2026-06-01"
# Expected: 200 { success: true, data: ["10:00"] }  (after booking from Task 2.2)
```

---

#### Task 3.3 — Wire All Routes in `bookingRoutes.js`

**File:** `backend/src/routes/bookingRoutes.js`

**IMPLEMENT:**
```js
const express = require('express');
const router = express.Router();
const {
  createBooking,
  getBookingsByEmail,
  updateBookingStatus,
  getBookedSlots,
  markAsRated
} = require('../controllers/bookingController');

router.post('/', createBooking);
router.get('/', getBookingsByEmail);
router.patch('/:id/status', updateBookingStatus);
router.patch('/:id/rate', markAsRated);
router.get('/booked-slots/:expertId/:date', getBookedSlots);

module.exports = router;
```

**GOTCHA — Route Order Matters:**  
The `GET /booked-slots/:expertId/:date` route must be defined **after** the `GET /` route. Express matches routes in the order they are declared. If `/:id` existed as a GET route, it would match before `/booked-slots/...`. However, since the root `GET /` takes no path parameters, this isn't an issue in the current configuration. Always verify route ordering when adding new parameterized routes to avoid shadowing.

**GOTCHA:** `PATCH /:id/status` and `PATCH /:id/rate` are separate routes for separate concerns. Don't merge them into a single `PATCH /:id` handler that reads the body to decide behavior — keep route handlers single-purpose.

---

#### Task 3.4 — Configure Socket.io Room Management in `app.js`

**File:** `backend/src/app.js` (L41–75)

**IMPLEMENT:**
```js
const io = new Server(server, {
  cors: {
    origin: "*",       // lock down to specific origin in production
    methods: ["GET", "POST", "PATCH"],
    credentials: true
  }
});

app.set('io', io);    // make accessible in controllers via req.app.get('io')

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_expert_room', (expertId) => {
    socket.join(expertId);
    console.log(`User joined room for expert: ${expertId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});
```

**PATTERN:** `app.set('io', io)` at L50 is the critical line that enables `req.app.get('io')` in every controller. This must be called **before** any routes are mounted and **before** any controller that uses `io` can execute.

**GOTCHA:** Socket.io's CORS is configured separately from Express's CORS middleware (L81). Both must be permissive enough to allow frontend requests. In development, `origin: "*"` is acceptable. In production, replace with the specific frontend domain.

**GOTCHA:** When a client refreshes the page or navigates away, the socket disconnects and the room membership is automatically removed by Socket.io. The client re-joins the room on the next page load. No manual leave logic is needed for this feature.

---

#### Task 3.5 — Frontend Socket.io Integration in `ExpertDetail.jsx`

**File:** `frontend/src/pages/ExpertDetail.jsx` (L100–156)

**IMPLEMENT:**
```jsx
// Effect 1: Expert data + Socket.io listeners
useEffect(() => {
  const getExpertData = async () => { /* fetch expert */ };
  getExpertData();

  socket.emit('join_expert_room', id);   // join this expert's room

  socket.on('slot_booked', (data) => {
    if (data.bookingDate === selectedDate) {
      setBookedSlots((prev) => [...prev, data.slotTime]);
    }
  });

  socket.on('slot_released', (data) => {
    if (data.bookingDate === selectedDate) {
      setBookedSlots((prev) => prev.filter(slot => slot !== data.slotTime));
    }
  });

  return () => {
    socket.off('slot_booked');
    socket.off('slot_released');
  };
}, [id, selectedDate]);  // re-runs when expertId or selectedDate changes

// Effect 2: Fetch booked slots on date change
useEffect(() => {
  const getBooked = async () => {
    const { data } = await fetchBookedSlots(id, selectedDate);
    setBookedSlots(data.data);
  };
  getBooked();
}, [id, selectedDate]);
```

**PATTERN:** Two separate `useEffect` hooks for two separate concerns — expert data + socket listeners vs slot fetching. This separation follows the single-responsibility principle and makes dependency arrays clean and correct.

**PATTERN:** `setBookedSlots((prev) => [...prev, data.slotTime])` uses the functional updater form of `useState` to avoid stale closure issues with the `bookedSlots` state inside the socket listener.

**GOTCHA:** The `useEffect` dependency array `[id, selectedDate]` means socket listeners are torn down and re-added every time the user changes the selected date. This is necessary because the `slot_booked` / `slot_released` handlers filter by `data.bookingDate === selectedDate` — if `selectedDate` changes without re-binding the listener, the closure would reference the old date. The `socket.off` / `socket.on` cycle ensures the closure captures the current `selectedDate` value.

**GOTCHA:** If the socket is disconnected, `slot_booked` events won't be received. A hard page refresh or navigating away and back re-runs the `useEffect`, which calls `fetchBookedSlots` again (Effect 2) and re-fetches from the REST API — effectively self-healing the state.

**GOTCHA:** The booking form's `handleBooking` function at L182 handles the error case with:
```js
alert(err.response?.data?.error || 'Booking failed');
```
This means the user sees the exact error message from the server (either `"This time slot is already booked."` or `"Double booking detected. This slot was just taken."`) as a browser alert. In production, replace `alert()` with a toast notification or inline error component.

---

### Phase 4: Testing

#### Task 4.1 — Manual Concurrent Request Test (Race Condition Simulation)

**Goal:** Prove that Layer 2 (the compound index) catches simultaneous bookings that both pass Layer 1.

**IMPLEMENT:** This test simulates the exact race condition described in PRD BK-02 using `curl` with `&` (background execution) to fire two requests simultaneously.

```bash
# Start the backend server first
cd backend && node src/app.js

# In a test terminal, run two POST requests simultaneously (using & for parallel execution)
EXPERT_ID="<paste_valid_expert_ObjectId_here>"
DATE="2026-07-01"
SLOT="11:00"

curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d "{\"expert\":\"$EXPERT_ID\",\"userName\":\"User A\",\"userEmail\":\"usera@test.com\",\"userPhone\":\"+919876543210\",\"bookingDate\":\"$DATE\",\"slotTime\":\"$SLOT\"}" &

curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d "{\"expert\":\"$EXPERT_ID\",\"userName\":\"User B\",\"userEmail\":\"userb@test.com\",\"userPhone\":\"+919876543211\",\"bookingDate\":\"$DATE\",\"slotTime\":\"$SLOT\"}" &

wait
echo "Both requests completed."
```

**Expected outcome:**
- One response: `201 { "success": true, "data": { ... } }`
- Other response: `400 { "success": false, "error": "This time slot is already booked." }` (Layer 1 caught it) OR `400 { "success": false, "error": "Double booking detected. This slot was just taken." }` (Layer 2 caught it)
- **Never:** Two `201` responses.

**VALIDATE:**
```bash
# After the concurrent test, verify only one booking exists for that slot
curl "http://localhost:5000/bookings/booked-slots/$EXPERT_ID/$DATE"
# Expected: { "success": true, "data": ["11:00"] }  (only one entry, not two)
```

---

#### Task 4.2 — Unit Test: Pre-Check Rejection (Layer 1)

**Test file (suggested):** `backend/src/controllers/bookingController.test.js`

```js
describe('createBooking - Layer 1 Pre-check', () => {
  it('should return 400 when slot is already booked', async () => {
    // Arrange: seed one existing Confirmed booking
    await Booking.create({
      expert: testExpertId,
      userName: 'First User',
      userEmail: 'first@test.com',
      userPhone: '+919999999999',
      bookingDate: '2026-07-01',
      slotTime: '10:00'
    });

    // Act: attempt to book the same slot
    const res = await request(app)
      .post('/bookings')
      .send({
        expert: testExpertId,
        userName: 'Second User',
        userEmail: 'second@test.com',
        userPhone: '+918888888888',
        bookingDate: '2026-07-01',
        slotTime: '10:00'
      });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('This time slot is already booked.');
  });
});
```

---

#### Task 4.3 — Unit Test: Cancelled Slot Re-Booking

```js
describe('createBooking - Cancelled slot re-booking', () => {
  it('should allow booking a slot that was previously cancelled', async () => {
    // Arrange: seed a Cancelled booking
    await Booking.create({
      expert: testExpertId,
      userName: 'Original User',
      userEmail: 'orig@test.com',
      userPhone: '+919999999999',
      bookingDate: '2026-07-02',
      slotTime: '14:00',
      status: 'Cancelled'
    });

    // Act: book the same slot
    const res = await request(app)
      .post('/bookings')
      .send({
        expert: testExpertId,
        userName: 'New User',
        userEmail: 'new@test.com',
        userPhone: '+918888888888',
        bookingDate: '2026-07-02',
        slotTime: '14:00'
      });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
```

**WHY THIS TEST MATTERS:** This test directly validates the `partialFilterExpression` in the compound index. Without the partial filter, this test would fail with a 400 or 11000 error.

---

#### Task 4.4 — Unit Test: Time-Lock Enforcement

```js
describe('updateBookingStatus - Time-lock', () => {
  it('should reject Completed status for a future session', async () => {
    // Arrange: create a booking for a future date
    const booking = await Booking.create({
      expert: testExpertId,
      userName: 'Test User',
      userEmail: 'test@test.com',
      userPhone: '+919999999999',
      bookingDate: '2026-12-31',  // future date
      slotTime: '10:00'
    });

    // Act: attempt to mark as Completed
    const res = await request(app)
      .patch(`/bookings/${booking._id}/status`)
      .send({ status: 'Completed' });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Time-lock violation');
  });

  it('should allow Completed status for a past session', async () => {
    // Arrange: create a booking with a past date (must be in the past in IST)
    const booking = await Booking.create({
      expert: testExpertId,
      userName: 'Test User',
      userEmail: 'test@test.com',
      userPhone: '+919999999999',
      bookingDate: '2020-01-01',  // definitely in the past
      slotTime: '09:00'
    });

    // Act
    const res = await request(app)
      .patch(`/bookings/${booking._id}/status`)
      .send({ status: 'Completed' });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Completed');
  });
});
```

---

#### Task 4.5 — Edge Case Tests

```js
describe('createBooking - Edge Cases', () => {
  it('should reject invalid phone number format', async () => {
    const res = await request(app)
      .post('/bookings')
      .send({
        expert: testExpertId,
        userName: 'Test',
        userEmail: 'test@test.com',
        userPhone: '9876543210',   // missing +91 prefix
        bookingDate: '2026-07-01',
        slotTime: '10:00'
      });
    expect(res.status).toBe(500); // Mongoose ValidationError
  });

  it('should reject invalid email format', async () => {
    const res = await request(app)
      .post('/bookings')
      .send({
        expert: testExpertId,
        userName: 'Test',
        userEmail: 'not-an-email',
        userPhone: '+919876543210',
        bookingDate: '2026-07-01',
        slotTime: '10:00'
      });
    expect(res.status).toBe(500); // Mongoose ValidationError
  });

  it('should allow two different experts to both book the same date/time', async () => {
    // The unique index is (expert, bookingDate, slotTime) —
    // the same slot on different experts should NOT conflict
    const res1 = await request(app)
      .post('/bookings')
      .send({ expert: expertA_Id, bookingDate: '2026-07-01', slotTime: '10:00', ...validUserData });

    const res2 = await request(app)
      .post('/bookings')
      .send({ expert: expertB_Id, bookingDate: '2026-07-01', slotTime: '10:00', ...validUserData });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201); // MUST succeed — different expert
  });

  it('should allow the same user to book different slots on the same expert', async () => {
    const res1 = await request(app)
      .post('/bookings')
      .send({ expert: testExpertId, bookingDate: '2026-07-01', slotTime: '10:00', ...validUserData });

    const res2 = await request(app)
      .post('/bookings')
      .send({ expert: testExpertId, bookingDate: '2026-07-01', slotTime: '11:00', ...validUserData });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201); // different slot — no conflict
  });
});
```

---

## 7. Testing Strategy

### Unit Tests

| Test | Target | Assertion |
|------|--------|-----------|
| Layer 1 pre-check blocks duplicate | `createBooking` | Returns 400 with "already booked" |
| Layer 2 index blocks race | Concurrent POSTs | Only one 201, other gets 400 |
| Cancelled slot is re-bookable | `createBooking` after cancel | Returns 201 |
| Same slot, different expert: allowed | `createBooking` | Both return 201 |
| Same user, different slot: allowed | `createBooking` | Both return 201 |
| `Completed` status blocked for future | `updateBookingStatus` | Returns 400 "Time-lock violation" |
| `Completed` status allowed for past | `updateBookingStatus` | Returns 200 |
| `Cancelled` status triggers `slot_released` | `updateBookingStatus` | Socket event emitted |
| Invalid phone rejected | `createBooking` | Mongoose ValidationError → 500 |
| Invalid email rejected | `createBooking` | Mongoose ValidationError → 500 |
| Missing required fields | `createBooking` | Mongoose ValidationError → 500 |
| `getBookedSlots` excludes Cancelled | `getBookedSlots` | Cancelled slots not in response array |
| `parseISTSessionTime` null for bad date | Internal helper | Returns `null` |
| `parseISTSessionTime` valid for ISO date | Internal helper | Returns valid `Date` |

### Integration Tests

| Scenario | Test Type | Expected Result |
|----------|-----------|-----------------|
| Full booking flow: POST → 201 → Socket event | HTTP + Socket.io | `slot_booked` received by room member |
| Cancel booking → slot available again → re-book | HTTP sequence | Second booking returns 201 |
| Concurrent requests to same slot | Parallel HTTP | Exactly one 201, one 400 |
| `getBookedSlots` reflects live state | HTTP + create | Slot appears in booked list after booking |

### Race Condition Focus

The most important test is the **concurrent request** simulation (Task 4.1). The key question is: **can two `201` responses ever be returned for the same slot?** The answer must always be **no**.

Factors that affect race condition reproducibility in testing:
- MongoDB deployment type (standalone vs replica set) — standalone single-node MongoDB does not support multi-document transactions, but the unique index operates atomically within a single write operation regardless.
- Network latency between Node.js and MongoDB — lower latency increases the race window by reducing the gap between the `findOne` response and the `create` call.
- Node.js event loop scheduling — on a single-core machine, true parallelism doesn't exist at the JS level, but the I/O callbacks for two in-flight MongoDB queries can interleave.

The only way to guarantee correctness under all conditions is the **compound unique index** (Layer 2). Layer 1 is an optimization, not a guarantee.

### Edge Cases

| Edge Case | Risk | Mitigation |
|-----------|------|------------|
| `bookingDate` in wrong format (e.g., `"01-06-2026"`) | `parseISTSessionTime` returns `null`; time-lock hook throws; controller returns 500 | Add input validation in controller before processing |
| `slotTime` in 12-hour format (e.g., `"10:00 AM"`) | Index mismatch — same physical slot stored with two different strings | Frontend always sends 24-hour `HH:mm`; document this constraint clearly |
| Expert ObjectId doesn't exist in database | `Booking.create` succeeds (no referential integrity enforced by default) | Add Mongoose population validation or a pre-check `Expert.findById` if needed |
| MongoDB index doesn't exist yet (first run) | `findOne` passes, `create` doesn't enforce uniqueness | Server startup calls `connectDB()` which triggers Mongoose `autoIndex` sync; wait for sync before accepting traffic |
| Two different emails booking same slot for same user | Layer 1 + Layer 2 both catch it | Correct behavior — slot is still the same slot |
| `bookingDate` = today in a past timezone | Frontend `isSlotInPast` uses IST offset; backend `parseISTSessionTime` uses `+05:30` | Consistent IST usage prevents phantom past-slot errors |
| `status` sent as `" Completed "` with whitespace | `normalizedStatus = String(status || '').trim()` handles this | Correct behavior |
| `notes` field contains very long text | No length validation defined in schema | Add `maxlength` to schema if needed in production |

---

## 8. Validation Commands

### Start Services

```bash
# Terminal 1: Start MongoDB (if running locally)
mongod --dbpath /path/to/data/db

# Terminal 2: Start backend
cd /home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend
node src/app.js
# Expected output:
# MongoDB Connected: <host>
# Server running in development mode on port 5000

# Terminal 3: Start frontend
cd /home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend
npm run dev
```

### Verify Index Creation

```bash
# In MongoDB shell (mongosh)
use <your_database_name>
db.bookings.getIndexes()
```
**Expected output includes:**
```json
{
  "v": 2,
  "unique": true,
  "key": { "expert": 1, "bookingDate": 1, "slotTime": 1 },
  "name": "expert_1_bookingDate_1_slotTime_1",
  "partialFilterExpression": { "status": { "$ne": "Cancelled" } }
}
```

### Detect Pre-Existing Duplicate Data

```bash
# Run before first deployment if database has existing data
db.bookings.aggregate([
  { $match: { status: { $ne: "Cancelled" } } },
  { $group: {
      _id: { expert: "$expert", bookingDate: "$bookingDate", slotTime: "$slotTime" },
      count: { $sum: 1 },
      ids: { $push: "$_id" }
  }},
  { $match: { count: { $gt: 1 } } }
])
# If this returns documents, there are duplicates that must be resolved before the index can be created.
```

### API Endpoint Tests

```bash
# 1. Health check
curl http://localhost:5000/
# Expected: "API is running..."

# 2. Get experts (to find a valid expertId)
curl http://localhost:5000/experts | python3 -m json.tool

# 3. Create a booking (replace <EXPERT_ID>)
EXPERT_ID="<paste_objectid_here>"
curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d "{
    \"expert\": \"$EXPERT_ID\",
    \"userName\": \"Integration Test\",
    \"userEmail\": \"integration@test.com\",
    \"userPhone\": \"+919876543210\",
    \"bookingDate\": \"2026-08-01\",
    \"slotTime\": \"10:00\"
  }" | python3 -m json.tool

# 4. Attempt duplicate booking (should fail with 400)
curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d "{
    \"expert\": \"$EXPERT_ID\",
    \"userName\": \"Another User\",
    \"userEmail\": \"another@test.com\",
    \"userPhone\": \"+919999999999\",
    \"bookingDate\": \"2026-08-01\",
    \"slotTime\": \"10:00\"
  }" | python3 -m json.tool
# Expected: 400 { "success": false, "error": "This time slot is already booked." }

# 5. Get booked slots for that expert on that date
curl -s "http://localhost:5000/bookings/booked-slots/$EXPERT_ID/2026-08-01" | python3 -m json.tool
# Expected: { "success": true, "data": ["10:00"] }

# 6. Cancel the booking (replace <BOOKING_ID> from step 3 response)
BOOKING_ID="<paste_booking_objectid_here>"
curl -s -X PATCH "http://localhost:5000/bookings/$BOOKING_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "Cancelled"}' | python3 -m json.tool

# 7. Re-book the now-cancelled slot (should succeed with 201)
curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d "{
    \"expert\": \"$EXPERT_ID\",
    \"userName\": \"Re-booker\",
    \"userEmail\": \"rebooker@test.com\",
    \"userPhone\": \"+918888888888\",
    \"bookingDate\": \"2026-08-01\",
    \"slotTime\": \"10:00\"
  }" | python3 -m json.tool
# Expected: 201 { "success": true, ... }
```

### Race Condition Test (Parallel Requests)

```bash
EXPERT_ID="<paste_objectid_here>"
DATE="2026-08-02"
SLOT="15:00"

echo "Firing two simultaneous booking requests..."

curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d "{\"expert\":\"$EXPERT_ID\",\"userName\":\"User A\",\"userEmail\":\"a@test.com\",\"userPhone\":\"+911111111111\",\"bookingDate\":\"$DATE\",\"slotTime\":\"$SLOT\"}" \
  -o /tmp/res_a.json &

curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d "{\"expert\":\"$EXPERT_ID\",\"userName\":\"User B\",\"userEmail\":\"b@test.com\",\"userPhone\":\"+912222222222\",\"bookingDate\":\"$DATE\",\"slotTime\":\"$SLOT\"}" \
  -o /tmp/res_b.json &

wait

echo "=== Response A ==="
cat /tmp/res_a.json
echo -e "\n=== Response B ==="
cat /tmp/res_b.json

# Verify only one booking exists
echo -e "\n=== Booked Slots (must show only one entry) ==="
curl -s "http://localhost:5000/bookings/booked-slots/$EXPERT_ID/$DATE"
```

### ESLint Frontend Validation

```bash
cd /home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/frontend
npm run lint
# Expected: 0 errors, 0 warnings related to ExpertDetail.jsx or socket.js
```

---

## 9. Acceptance Criteria

### Functional Acceptance Criteria

| ID | Criterion | Status |
|----|-----------|--------|
| AC-01 | Given User A and User B submit simultaneous booking requests for the same expert, date, and slot, exactly one request returns HTTP 201 and the other returns HTTP 400. | ✅ Met via compound unique partial index (error code 11000 catch) |
| AC-02 | Given a booking exists for slot X, a subsequent booking attempt for the same (expert, date, slot) returns `{ success: false, error: "This time slot is already booked." }`. | ✅ Met via Layer 1 `findOne` pre-check |
| AC-03 | Given a booking is cancelled, the same slot can be successfully re-booked by another user. | ✅ Met via `partialFilterExpression: { status: { $ne: 'Cancelled' } }` |
| AC-04 | Given a booking exists with status `'Confirmed'` for a future date, attempting to update its status to `'Completed'` returns HTTP 400 with a time-lock error message. | ✅ Met via `updateBookingStatus` time-lock check + `pre('save')` hook |
| AC-05 | Given a booking is created successfully, all other users currently viewing that expert's detail page see the slot become unavailable without refreshing. | ✅ Met via `io.to(expert).emit('slot_booked', ...)` + frontend `socket.on('slot_booked', ...)` |
| AC-06 | Given a booking is cancelled, all users viewing that expert's page see the slot become available again without refreshing. | ✅ Met via `io.to(...).emit('slot_released', ...)` + frontend `socket.on('slot_released', ...)` |
| AC-07 | Given two different experts, the same (date, slotTime) combination can be booked for both without conflict. | ✅ Met — `expert` is part of the index tuple |
| AC-08 | `GET /bookings/booked-slots/:expertId/:date` returns only non-cancelled booked slots as an array of `HH:mm` strings. | ✅ Met via `getBookedSlots` with `status: { $ne: 'Cancelled' }` |
| AC-09 | The MongoDB compound unique index with partial filter is present and verified via `db.bookings.getIndexes()`. | ✅ Met via `bookingSchema.index()` definition |
| AC-10 | Phone numbers must match `+91XXXXXXXXXX` format; emails must match a standard email regex. | ✅ Met via Mongoose schema `match` validators |

### Performance Acceptance Criteria

| Criterion | Target | Notes |
|-----------|--------|-------|
| Booking creation latency (p95) | < 200ms | With compound index, MongoDB write is O(log n) |
| Socket event delivery latency | < 500ms | Per PRD Section 6 KPIs |
| `getBookedSlots` query time | < 50ms | Benefits from compound index scan |

---

## 10. Completion Checklist

### Schema & Model

- [x] `bookingSchema` fields defined with required validators, trim, match regex
- [x] `bookingDate` stored as `String` in `YYYY-MM-DD` format
- [x] `slotTime` stored as `String` in `HH:mm` format
- [x] `status` enum with `['Pending', 'Confirmed', 'Completed', 'Cancelled']` and default `'Confirmed'`
- [x] `isRated` boolean field with default `false`
- [x] `{ timestamps: true }` schema option enabled
- [x] `parseISTSessionTime` helper function implemented and null-safe
- [x] `pre('save')` hook for `'Completed'` status time-lock
- [x] `pre('findOneAndUpdate')` hook for defensive time-lock on direct update queries
- [x] Compound unique partial index `{ expert, bookingDate, slotTime }` with `partialFilterExpression: { status: { $ne: 'Cancelled' } }`
- [x] Model exported as `mongoose.model('Booking', bookingSchema)`

### Controller

- [x] `createBooking`: destructures all required fields from `req.body`
- [x] `createBooking`: Layer 1 `findOne` pre-check with `status: { $ne: 'Cancelled' }` filter
- [x] `createBooking`: Layer 1 returns `400` with `"This time slot is already booked."`
- [x] `createBooking`: Layer 2 `Booking.create()` wrapped in try/catch
- [x] `createBooking`: `error.code === 11000` caught and returns `400` with `"Double booking detected. This slot was just taken."`
- [x] `createBooking`: `req.app.get('io').to(expert).emit('slot_booked', ...)` on success
- [x] `updateBookingStatus`: fetches document with `findById` before modifying
- [x] `updateBookingStatus`: `normalizedStatus` trim + string coercion
- [x] `updateBookingStatus`: explicit time-lock check for `'Completed'` with IST-aware Date
- [x] `updateBookingStatus`: calls `booking.save()` (not `findByIdAndUpdate`) to trigger hooks
- [x] `updateBookingStatus`: emits `slot_released` to expert room on `'Cancelled'`
- [x] `getBookedSlots`: returns flat array of `slotTime` strings, excludes cancelled
- [x] `getBookingsByEmail`: populates `expert` with `name` and `category`
- [x] `markAsRated`: uses `findByIdAndUpdate` with `{ new: true }`

### Routes

- [x] `POST /` → `createBooking`
- [x] `GET /` → `getBookingsByEmail`
- [x] `PATCH /:id/status` → `updateBookingStatus`
- [x] `PATCH /:id/rate` → `markAsRated`
- [x] `GET /booked-slots/:expertId/:date` → `getBookedSlots`
- [x] Routes mounted in `app.js` at `/bookings`

### Socket.io

- [x] `io` bound to `app` with `app.set('io', io)` in `app.js`
- [x] `join_expert_room` event handler in `app.js`
- [x] `slot_booked` emitted in `createBooking` on success
- [x] `slot_released` emitted in `updateBookingStatus` on cancellation
- [x] Frontend `socket.emit('join_expert_room', id)` on ExpertDetail mount
- [x] Frontend `socket.on('slot_booked', ...)` updates `bookedSlots` state
- [x] Frontend `socket.on('slot_released', ...)` removes slot from `bookedSlots` state
- [x] Frontend `socket.off` cleanup on unmount

### Frontend

- [x] `fetchBookedSlots` called on `[id, selectedDate]` change
- [x] Slot buttons disable when `bookedSlots.includes(slot.value)`
- [x] `handleBooking` sends `userPhone.replace(/\s/g, '')` (strips space before submit)
- [x] `handleBooking` shows `alert(err.response?.data?.error)` on failure
- [x] Success state redirects to `/my-bookings` after 3 seconds

### Validation

- [x] `db.bookings.getIndexes()` shows the compound unique partial index
- [x] Sequential duplicate booking test returns 400 on second request
- [x] Parallel booking test never produces two 201 responses
- [x] Cancelled slot re-booking test returns 201
- [x] Future-session `'Completed'` status update returns 400

---

## 11. Decision Log

| ID | Decision | Rationale | Alternatives Considered |
|----|----------|-----------|------------------------|
| DL-01 | Store `bookingDate` and `slotTime` as `String`, not `Date` | Timezone neutrality. Storing `"2024-01-01"` and `"10:00"` as strings avoids UTC conversion ambiguity. If stored as a single `Date` object in UTC, a slot at `10:00 IST` would be stored as `04:30 UTC`, and any timezone discrepancy between client, server, or database could cause spurious conflicts or missed ones. Strings are explicit and human-readable. The compound index on strings is just as efficient as on dates for this use case. | Single `Date` field (`bookingDateTime: Date`) combining both. Rejected because it requires all parties to agree on timezone conversion, which is error-prone in a distributed system. |
| DL-02 | Use `partialFilterExpression: { status: { $ne: 'Cancelled' } }` instead of a naive unique index | A simple unique index on `(expert, bookingDate, slotTime)` without a partial filter would permanently block a slot after cancellation. The partial filter makes the index only apply to active (non-cancelled) bookings, allowing slot reuse after cancellation. This is the correct semantics for a booking system. | Deleting cancelled bookings instead of changing their status. Rejected because booking history must be preserved for audit and user-facing "My Bookings" history. Nullifying the slot fields (setting to `null`) was also considered, but it complicates queries and the data model. |
| DL-03 | Two-layer defense (pre-check + index) instead of index-only | The index alone would work for correctness, but it would always return an `11000` MongoDB error to the controller — a technical, not user-friendly message. Having a Layer 1 pre-check means that in the 99.9% case (no race), the user gets a clean, descriptive error. Layer 2 (index) is the real guarantee that handles the 0.1% concurrent-request scenario. | Index only (no pre-check): valid but poor UX for the common case. Pre-check only (no index): valid for single-instance deployments but fails under concurrency. |
| DL-04 | Fetch document then `booking.save()` instead of `findByIdAndUpdate` in `updateBookingStatus` | `Model.findByIdAndUpdate()` bypasses Mongoose middleware including `pre('save')` hooks. The time-lock enforcement must run as a hook for defensive depth. By fetching the document and calling `save()`, the hook fires and provides an additional validation layer. | `findByIdAndUpdate` with `runValidators: true`: runs schema validators but NOT custom hooks. `findOneAndUpdate` middleware exists but is more complex to implement correctly (see `pre('findOneAndUpdate')` hook added as future-proofing). |
| DL-05 | Access `io` via `req.app.get('io')` in controllers | Avoids circular imports. If `io` were defined in `app.js` and imported in `bookingController.js`, which is required by `bookingRoutes.js`, which is required by `app.js`, a circular dependency would form. The `app.set('io', io)` pattern breaks this cycle cleanly. | Exporting `io` from a dedicated `socket.js` module in the backend: valid, but adds a new file. Passing `io` as a middleware `res.locals.io`: valid, but less conventional. |
| DL-06 | IST `+05:30` offset hardcoded in `parseISTSessionTime` | The system is explicitly designed for the Indian market (PRD Section 6 "Localization"). The IST offset is a constant (`+05:30`). Using `process.env.TZ` or a library like `moment-timezone` would add complexity without benefit for a single-timezone system. | `moment-timezone` / `luxon` for timezone handling: correct but unnecessary overhead. `process.env.TZ = 'Asia/Kolkata'`: affects the entire Node.js process's `Date` behavior, which can cause unexpected side effects in other time calculations. |
| DL-07 | Default booking status is `'Confirmed'` (not `'Pending'`) | In the current Phase 1 MVP, there is no admin review workflow. Bookings are confirmed immediately upon creation. Setting the default to `'Confirmed'` simplifies the UX — the user sees a confirmation immediately. | Default to `'Pending'` with an admin-approval workflow: appropriate for Phase 2 but over-engineered for Phase 1 MVP. |

---

## 12. Known Limitations

### 1. No Multi-Document ACID Transactions
The current implementation does not use MongoDB multi-document transactions. The two-layer defense (pre-check + index) is correct and sufficient for preventing double bookings, but it does not provide full ACID semantics across multiple documents. For example, if the `Booking.create()` succeeds but the Socket.io emit fails, the booking is persisted but other users don't see the real-time update. They will see the correct state on their next page load (REST fallback). This is an acceptable trade-off for a standalone MongoDB deployment.

**Impact:** Low. Socket.io failures are temporary; the REST API is always the source of truth.

### 2. No Input Validation Middleware Layer
Request body validation is currently handled entirely by Mongoose schema validators. There is no dedicated validation middleware (e.g., `express-validator`, `Joi`, or `Zod`) at the route level. This means invalid payloads are not rejected until they reach the database operation, and Mongoose ValidationErrors currently return `500 Server Error` instead of `400 Bad Request`.

**Impact:** Medium. Users submitting invalid data get a non-descriptive error. This should be fixed in a follow-up by adding a validation middleware layer.

### 3. Single-Instance Socket.io
The Socket.io instance is in-memory. If the backend is scaled to multiple Node.js processes (e.g., with PM2 cluster mode or Kubernetes), each instance has its own room registry. A booking confirmed by Process A emits to its own room — but a user connected to Process B won't receive the event.

**Impact:** Not applicable for current single-instance deployment. Will need `socket.io-redis` adapter (Redis pub/sub) before horizontal scaling.

### 4. No Authentication
The booking API is public. Any client can create a booking for any `expertId` with any `userEmail` without proof of identity. There is no JWT validation, no session management, and no protection against spam bookings.

**Impact:** Critical for production. Phase 2 addresses this with JWT authentication and RBAC.

### 5. Phone Number Validation is India-Specific
The `userPhone` regex (`^\+91[0-9]{10}$`) hardcodes the Indian country code and digit count. Internationalizing the system would require a more flexible validator (e.g., `libphonenumber-js`).

**Impact:** Low for current India-focused deployment. Noted for future globalization.

### 6. Time Slots Are Hardcoded in Frontend
The 13 available time slots (`09:00` through `22:00`, hourly) are hardcoded in `ExpertDetail.jsx` (L80–94). There is no API for experts to define their own custom availability windows.

**Impact:** Medium. Limits flexibility but is correct for Phase 1 MVP. The database schema supports any `HH:mm` string; the constraint is only on the frontend display.

### 7. No Rate Limiting
The `POST /bookings` endpoint has no rate limiting. A malicious actor could flood the endpoint to exhaust booking slots, perform denial-of-service attacks, or stress-test the database.

**Impact:** Medium for production. Add `express-rate-limit` middleware as a follow-up.

---

## 13. Future Improvements

### F-01: Pessimistic Locking with MongoDB Transactions (Replica Set Required)

For the highest level of correctness guarantee, replace the two-layer defense with a MongoDB multi-document transaction on a replica set:

```js
const session = await mongoose.startSession();
session.startTransaction();
try {
  const existing = await Booking.findOne(
    { expert, bookingDate, slotTime, status: { $ne: 'Cancelled' } },
    null,
    { session }
  );
  if (existing) {
    await session.abortTransaction();
    return res.status(400).json({ success: false, error: 'Slot already booked.' });
  }
  const booking = await Booking.create([{ expert, ... }], { session });
  await session.commitTransaction();
  // emit socket event
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

**Requirements:** MongoDB replica set (even a single-node replica set works). The current Atlas free tier or any Atlas cluster supports transactions. A local standalone `mongod` does not.

**Trade-off:** Transactions add latency (2-phase commit protocol) and require a replica set. The current index-based approach is simpler, faster, and sufficient for all realistic concurrency scenarios.

### F-02: Redis-Based Optimistic Locking

Use Redis `SET NX EX` (set-if-not-exists with expiry) to implement a fast, distributed booking lock:

```js
const lockKey = `booking_lock:${expert}:${bookingDate}:${slotTime}`;
const acquired = await redis.set(lockKey, 'locked', 'NX', 'EX', 30); // 30s TTL
if (!acquired) {
  return res.status(409).json({ success: false, error: 'Slot is temporarily locked. Try again.' });
}
try {
  // create booking
} finally {
  await redis.del(lockKey); // release lock
}
```

**Advantage:** Dramatically faster than a database write for the conflict check. Naturally distributed across multiple Node.js instances. The 30-second TTL ensures locks are auto-released if the server crashes.

**Trade-off:** Adds Redis as an infrastructure dependency. Requires `ioredis` or `redis` npm package.

### F-03: Dedicated Validation Middleware (Joi/Zod)

```js
// backend/src/middleware/bookingValidation.js
const Joi = require('joi');

const createBookingSchema = Joi.object({
  expert:      Joi.string().hex().length(24).required(),
  userName:    Joi.string().min(2).max(100).trim().required(),
  userEmail:   Joi.string().email().required(),
  userPhone:   Joi.string().pattern(/^\+91[0-9]{10}$/).required(),
  bookingDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  slotTime:    Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  notes:       Joi.string().max(500).optional()
});

const validateCreateBooking = (req, res, next) => {
  const { error } = createBookingSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};
```

Apply in route: `router.post('/', validateCreateBooking, createBooking)`.

**Benefit:** Proper `400 Bad Request` for invalid inputs instead of `500 Server Error`. Catches format errors before they hit the database.

### F-04: Socket.io Redis Adapter for Horizontal Scaling

```js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

**Benefit:** Enables Socket.io to work correctly across multiple Node.js instances — all instances share the same room registry through Redis pub/sub.

### F-05: Expert-Defined Availability Windows

Replace the hardcoded `timeSlots` array in `ExpertDetail.jsx` with an API-driven availability model. Extend the `Expert` schema:

```js
availability: [{
  dayOfWeek: { type: Number, min: 0, max: 6 }, // 0=Sunday
  slots: [{ type: String }] // ["09:00", "10:00", ...]
}]
```

Add `GET /experts/:id/slots?date=YYYY-MM-DD` endpoint that computes available slots based on the expert's schedule, minus already-booked slots.

### F-06: Rate Limiting on Booking Endpoint

```js
const rateLimit = require('express-rate-limit');

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // max 10 booking attempts per minute per IP
  message: { success: false, error: 'Too many requests. Please slow down.' }
});

router.post('/', bookingLimiter, createBooking);
```

### F-07: Replace `alert()` with Toast Notifications

In `ExpertDetail.jsx` `handleBooking` error handler (L182):

```jsx
// Current (poor UX)
alert(err.response?.data?.error || 'Booking failed');

// Improved (add react-hot-toast or similar)
import toast from 'react-hot-toast';
toast.error(err.response?.data?.error || 'Booking failed');
```

---

## 14. Notes

### Design Philosophy: Defense in Depth

The Atomic Booking Engine deliberately implements **defense in depth** — multiple independent layers that each provide a different kind of guarantee:

- **Layer 1** (pre-check) is for **UX**: fast response, human-readable message.
- **Layer 2** (index) is for **correctness**: atomic guarantee that cannot be bypassed at the application layer.
- **Layer 3** (socket broadcast) is for **consistency**: propagates state changes to other clients in real-time.
- **Layer 4** (time-lock) is for **integrity**: prevents data corruption in the booking lifecycle.

Removing any one of these layers degrades the system in a different way. Together, they make the booking system both user-friendly and data-correct.

### Why Not Use Mongoose's `unique: true` Directly on a Field?

Mongoose supports `{ type: String, unique: true }` on individual schema fields. However, this feature only enforces uniqueness on a single field. Our uniqueness requirement is a **compound tuple**: `(expert + bookingDate + slotTime)`. Compound uniqueness can only be expressed as a schema-level index using `bookingSchema.index()`. Additionally, the partial filter expression (`partialFilterExpression`) is only available on indexes, not on individual field validators.

### The `11000` Error Code

MongoDB error code `11000` is a `MongoServerError` with the name `"MongoServerError"` and `codeName: "DuplicateKey"`. It is thrown by the WiredTiger storage engine when a write would violate a unique index constraint. This code is stable and has not changed since MongoDB 2.x. The full error object structure:

```js
{
  code: 11000,
  keyPattern: { expert: 1, bookingDate: 1, slotTime: 1 },
  keyValue: { expert: ObjectId("..."), bookingDate: "2026-06-01", slotTime: "10:00" }
}
```

The `keyValue` field can be parsed to extract which specific slot caused the conflict, if needed for debugging.

### IST Timezone Strategy

The project uses a **manual offset approach** for IST: `new Date(\`${bookingDate}T${slotTime}:00+05:30\`)`. This is a deliberate choice over using libraries like `moment-timezone` or `luxon` for the following reasons:

1. **Zero dependencies** for the backend model.
2. **Explicit and auditable** — the `+05:30` offset is visible in the code.
3. **Sufficient** for the single-timezone use case (India).
4. **V8-compatible** — Node.js's V8 engine correctly parses ISO 8601 strings with timezone offsets.

The frontend uses the same strategy: `new Date(now.getTime() + (5.5 * 60 * 60 * 1000))` to get the current IST time for the `isSlotInPast` helper. Note that calling `.getUTCHours()` on this adjusted date gives the IST hours — this is a deliberate numeric trick documented inline in `ExpertDetail.jsx` at L70–71.

### Trade-Off: Eventual UI Consistency vs. Strong Consistency

The UI uses an **optimistic, event-driven model**: when a socket event arrives, the frontend immediately updates `bookedSlots` state. There is no REST API re-validation call after a socket event. This means:

- If a `slot_booked` event is received for a date the user is not viewing (`data.bookingDate !== selectedDate`), it is silently ignored.
- If a socket event is missed due to disconnection, the UI shows a stale state until the next full `fetchBookedSlots` call.

The system achieves **eventual consistency**: even if the UI is briefly stale, the next full page load or date change triggers a fresh `fetchBookedSlots` REST call that corrects the state. The **database is always the authoritative source of truth**; the socket events are a performance optimization, not a consistency mechanism.

---

*End of Feature Plan — Atomic Booking Engine (Double-Booking Prevention)*  
*Document Path: `docs/feature-plan-atomic-booking-engine.md`*  
*Last Updated: 2026-05-24*
