# Feature Plan: My Bookings — Booking History & Status Management

> **Project:** SkillSync — Real-Time Expert Session Booking System  
> **Document Type:** Feature Plan (`plan-feature.md` format)  
> **Status:** ✅ Implemented & Validated  
> **Created:** 2026-05-24  
> **Last Updated:** 2026-05-24  
> **Author:** AI Technical Writer (subagent)  

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Feature Metadata](#2-feature-metadata)
3. [Context References](#3-context-references)
4. [Patterns Followed](#4-patterns-followed)
5. [Implementation Plan](#5-implementation-plan)
   - [Phase 1 — Foundation: Data Model](#phase-1--foundation-data-model)
   - [Phase 2 — Core: Backend API Endpoints](#phase-2--core-backend-api-endpoints)
   - [Phase 3 — Integration: Frontend Page](#phase-3--integration-frontend-page)
   - [Phase 4 — Testing](#phase-4--testing)
6. [Testing Strategy](#6-testing-strategy)
7. [Validation Commands](#7-validation-commands)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [Completion Checklist](#9-completion-checklist)
10. [Notes](#10-notes)
11. [Decision Log](#11-decision-log)
12. [Known Limitations & Future Improvements](#12-known-limitations--future-improvements)

---

## 1. Feature Overview

### 1.1 Description

The **My Bookings** page (`/my-bookings`) is the user's personal session management hub within SkillSync. It is a post-booking lifecycle manager — the place a user visits after they have booked a session with an expert, to view that session's status, take action on it, and ultimately rate their experience.

The page is entirely email-gated: there is no login wall. A user types their registration email (the same email they used during booking) and the system retrieves all bookings associated with that address. This email is persisted to `localStorage` so returning users see their history immediately on load.

Once bookings are loaded, each booking card presents:

- **Expert identity** (name + category), populated via a Mongoose `.populate()` join — no second API call needed.
- **Session metadata**: date, slot time (human-formatted AM/PM), and a truncated session ID for reference.
- **A time-lock status indicator**: a visual badge showing whether the session is eligible for completion or still locked (i.e., the session start time is in the future).
- **Conditional action buttons** based on current booking status:
  - `Confirmed` → "Mark as Completed" (time-locked) + "Cancel Session"
  - `Completed` + `!isRated` → Inline 1-5 star rating picker
  - `Completed` + `isRated` → "Experience Rated Successfully" confirmation badge
  - `Cancelled` → No actions (read-only)

Cancelling a session fires a `slot_released` Socket.io event that immediately re-opens the slot on every connected client viewing that expert's profile — closing the real-time feedback loop.

### 1.2 User Story

> **As a Knowledge Seeker,**  
> I want to look up all my booked sessions by entering my email address,  
> so that I can track their status, cancel sessions I no longer need, mark sessions I have attended as completed, and leave a rating for experts who provided value.

### 1.3 Problem Statement

After a user books a session with an expert, they have no visibility into what happens next. They cannot:
- Verify that their booking was successfully recorded
- Cancel a session if their plans change (which would otherwise permanently lock that slot for other users)
- Formally close a session they have attended (marking it `Completed`)
- Provide feedback to the expert ecosystem via ratings

Without a booking management interface, cancelled and completed sessions accumulate silently in the database as `Confirmed`, slot availability becomes permanently incorrect for cancelled sessions, and the expert rating system has no entry point.

### 1.4 Solution Statement

Implement a dedicated `/my-bookings` React page that:
1. Uses email-based identity (no JWT, Phase 1 MVP) to fetch all bookings via `GET /bookings?email=<email>`.
2. Renders each booking with full context (expert name, category via `.populate()`).
3. Enforces a **dual-layer time-lock** (backend controller + Mongoose pre-save hook) that prevents marking a session `Completed` before its scheduled time passes.
4. On cancellation, triggers real-time slot release via Socket.io's `slot_released` event to the expert's room.
5. Enables post-session rating through a two-step API sequence: first update the expert's rolling average rating, then set `booking.isRated = true` to prevent repeated submissions.

---

## 2. Feature Metadata

| Property | Value |
|---|---|
| **Feature Name** | My Bookings — Booking History & Status Management |
| **Route** | `/my-bookings` |
| **Feature Type** | Full-Stack (Backend API + Frontend Page) |
| **Phase** | Phase 1 MVP (partially labeled Phase 2 in PRD, but implemented in MVP) |
| **Complexity** | Medium–High |
| **Priority** | Should Have (per PRD `SkillSync_PRD.md`) |
| **Auth Requirement** | None (Phase 1) — Email-based identity only |
| **Real-Time Involvement** | Yes — `slot_released` event emitted on cancellation |
| **Database Operations** | Read (`find` + `populate`), Update (`findById` + `save`, `findByIdAndUpdate`) |
| **Affected Systems** | Backend: `Booking` model, `bookingController`, `expertController`, booking routes, expert routes; Frontend: `MyBookings.jsx`, `api.js` |
| **Dependencies** | `Booking` model with `isRated` field and time-lock hooks; `Expert` model with `rating`/`numReviews` fields; Socket.io room infrastructure set up in `app.js` |
| **Files Created** | `frontend/src/pages/MyBookings.jsx` |
| **Files Modified** | `backend/src/controllers/bookingController.js`, `backend/src/controllers/expertController.js`, `backend/src/models/Booking.js`, `backend/src/models/Expert.js`, `backend/src/routes/bookingRoutes.js`, `backend/src/routes/expertRoutes.js`, `frontend/src/App.jsx`, `frontend/src/services/api.js` |

---

## 3. Context References

### 3.1 Relevant Existing Files

| File | Purpose | Key Relevance |
|---|---|---|
| `backend/src/app.js` | Server entry point, Socket.io setup | `io` instance stored on `app` via `app.set('io', io)`; expert rooms via `join_expert_room` event |
| `backend/src/models/Booking.js` | Mongoose schema for bookings | Defines `status` enum, `isRated` boolean, `bookingDate`/`slotTime` strings, time-lock hooks |
| `backend/src/models/Expert.js` | Mongoose schema for experts | Defines `rating` (float, 1-5), `numReviews` (int) used by the rolling average formula |
| `backend/src/controllers/bookingController.js` | All booking CRUD logic | `getBookingsByEmail`, `updateBookingStatus`, `markAsRated` |
| `backend/src/controllers/expertController.js` | Expert CRUD + rating | `rateExpert` — rolling average calculation |
| `backend/src/routes/bookingRoutes.js` | Route definitions for `/bookings` | `GET /`, `PATCH /:id/status`, `PATCH /:id/rate` |
| `backend/src/routes/expertRoutes.js` | Route definitions for `/experts` | `POST /:id/rate` |
| `frontend/src/App.jsx` | React Router root | Registers `<Route path="/my-bookings" element={<MyBookings />} />` |
| `frontend/src/services/api.js` | Axios API service layer | `fetchBookingsByEmail`, `updateBookingStatus`, `rateExpert`, `markBookingAsRated` |
| `frontend/src/services/socket.js` | Socket.io client singleton | Singleton WebSocket connection; used in `ExpertDetail` but the `slot_released` event is emitted server-side on cancel |
| `frontend/src/components/Navbar.jsx` | Persistent navigation | "My History" link pointing to `/my-bookings` |

### 3.2 New Files

| File | Purpose |
|---|---|
| `frontend/src/pages/MyBookings.jsx` | The complete My Bookings page component (19,671 bytes, 385 lines) |

### 3.3 Documentation

| Document | Relevance |
|---|---|
| `docs/SkillSync_PRD.md` | "Booking History" listed as "Should Have" feature; BK-01, BK-02 user stories |
| `docs/ROADMAP.md` | Phase 1 MVP includes booking history; Phase 3 plans post-session rating (implemented early) |
| `log.md` | Chronological record of the time-lock fix evolution, Socket.io slot release, and rating logic |

---

## 4. Patterns Followed

### 4.1 Naming Conventions

- **Backend files:** `camelCase` for controller functions and variables (`getBookingsByEmail`, `updateBookingStatus`, `markAsRated`, `normalizedStatus`).
- **Frontend files:** `PascalCase` for React component files and component functions (`MyBookings`, `MyBookings.jsx`).
- **Service exports:** `lower camelCase` for API service functions (`fetchBookingsByEmail`, `updateBookingStatus`, `rateExpert`, `markBookingAsRated`).
- **CommonJS in backend:** `module.exports = { ... }` pattern. All backend files use `require()` for imports.
- **ES Modules in frontend:** `import` / `export` syntax used throughout. Named exports for all service functions; default export for the component.

### 4.2 Error Handling

- **Backend:** All controller functions wrapped in `try/catch`. Specific HTTP status codes are used:
  - `400` for business logic violations (missing email, time-lock, invalid data)
  - `404` for document not found
  - `500` for unexpected server errors
  - Error responses always follow `{ success: false, error: '<message>' }` shape
- **Frontend:** API calls inside `try/catch/finally` blocks. Loading states managed via dedicated booleans (`loading`, `actionLoading`, `ratingLoading`). Errors surfaced via `setError(...)` for page-level errors, and `alert(err.response?.data?.error || 'fallback message')` for action-level errors (cancel, rating). `finally` always clears loading states to prevent UI freeze.

### 4.3 Logging

- **Backend:** `console.error('Error in createBooking:', error)` or `console.error('API Error:', error)` in every catch block. Error label includes the function name for quick log correlation.
- **Frontend:** No production logging in `MyBookings.jsx`. Loading states and error states in JSX handle user-visible feedback.

### 4.4 State Management

- Local component state via React `useState` — no global store (Redux, Zustand, Context) used in Phase 1.
- `localStorage` used for email persistence (`localStorage.getItem('userEmail')` on init, `localStorage.setItem('userEmail', email)` on successful search).
- Post-action state refresh uses a full re-fetch pattern (`fetchBookingsByEmail(email)` after every mutation) rather than optimistic UI updates. This ensures the UI reflects the true database state.

### 4.5 Time-Zone Handling

- **Canonical pattern:** All IST time comparisons use ISO 8601 strings with explicit `+05:30` offset: `new Date(\`${date}T${time}:00+05:30\`)`. This forces JavaScript to interpret the moment-in-time as IST regardless of the server's or browser's local timezone.
- **Frontend time-lock check:** Uses `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` to extract current IST components hierarchically (year → month → day → hour → minute) for a numerically safe comparison.
- **Live clock update:** `setInterval(() => setCurrentTime(new Date()), 10000)` refreshes `currentTime` every 10 seconds so the time-lock status indicator on each card stays current.

### 4.6 Socket.io Pattern

- The `io` instance is stored on the Express `app` object at startup: `app.set('io', io)` (see `app.js` line 50).
- Controllers retrieve it via `req.app.get('io')`.
- Slot state changes are emitted to named rooms keyed by expert ObjectId string: `io.to(booking.expert.toString()).emit('slot_released', { bookingDate, slotTime })`.

---

## 5. Implementation Plan

### Phase 1 — Foundation: Data Model

#### Step 1.1 — Add `isRated` Field to `Booking` Schema

**File:** `backend/src/models/Booking.js` (lines 57–61)

**IMPLEMENT:**
```js
// Tracks if the user has already rated this session
isRated: {
  type: Boolean,
  default: false
}
```

**PATTERN:** Follows the existing boolean field pattern in the schema (see `expert.js` — no boolean fields, but follows Mongoose conventions). `default: false` ensures all new bookings are unrated.

**GOTCHA:** Do NOT use `isRated: Boolean` shorthand without a default — it will default to `undefined` in MongoDB, causing `!booking.isRated` to evaluate as `true` (truthy check passes), allowing repeated ratings. Always specify `default: false`.

**VALIDATE:** `db.bookings.findOne({})` should show `isRated: false` for all seeded records.

---

#### Step 1.2 — Add `numReviews` Field to `Expert` Schema

**File:** `backend/src/models/Expert.js` (lines 43–46)

**IMPLEMENT:**
```js
// Total number of reviews received
numReviews: {
  type: Number,
  default: 0
}
```

**PATTERN:** Companion field to `rating`. Used in the rolling average formula `(currentRating * numReviews + newRating) / (numReviews + 1)`. Must default to `0` so the first rating is calculated correctly: `(4.5 * 0 + newRating) / 1 = newRating`.

**GOTCHA:** The `rating` field defaults to `4.5` in the seed data but `numReviews` starts at `0`. This means the initial "4.5" is a *seed bias*, not a real review. After the first real rating, `numReviews` becomes `1` and the rating becomes the actual submitted value. This is acceptable for MVP but should be revisited if rating display accuracy is critical.

**VALIDATE:** Check seed data via `db.experts.findOne({})` — `numReviews` should be `0` post-seeding.

---

#### Step 1.3 — Add Time-Lock Pre-Save Hook to `Booking` Model

**File:** `backend/src/models/Booking.js` (lines 78–122)

**IMPLEMENT:**
```js
const parseISTSessionTime = (bookingDate, slotTime) => {
  const session = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  return Number.isNaN(session.getTime()) ? null : session;
};

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

bookingSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  const status = update.status || (update.$set && update.$set.status);
  if (status === 'Completed') {
    const bookingDate = update.bookingDate || (update.$set && update.$set.bookingDate);
    const slotTime = update.slotTime || (update.$set && update.$set.slotTime);
    if (bookingDate && slotTime) {
      const sessionTime = parseISTSessionTime(bookingDate, slotTime);
      if (sessionTime && Date.now() < sessionTime.getTime()) {
        throw new Error('Time-lock violation: Session has not started yet.');
      }
    }
  }
});
```

**PATTERN:** Mongoose lifecycle hooks. `pre('save')` fires on `booking.save()`. `pre('findOneAndUpdate')` fires on `Booking.findOneAndUpdate(...)`. Two hooks are needed because `updateBookingStatus` uses `findById` + `save()`, while `markAsRated` uses `findByIdAndUpdate` (which internally uses `findOneAndUpdate`).

**GOTCHA:** The `findOneAndUpdate` hook cannot access the existing document — only the `update` delta. If `bookingDate` and `slotTime` are not in the update payload, the hook cannot validate. This is why `updateBookingStatus` uses `findById` → mutate → `save()` instead of `findByIdAndUpdate()`, ensuring the pre-save hook has access to `this.bookingDate` and `this.slotTime`.

**GOTCHA:** Mongoose middleware callbacks must NOT use the legacy `next` parameter with `async`. Use `async function()` and throw errors instead of calling `next(err)`. The old callback style (`function(next) { next(err) }`) does not work with `async/await` in modern Mongoose versions (this was the root cause of the Server 500 bug documented in `log.md` at `2026-05-11 08:36 AM`).

**VALIDATE:** Attempt `PATCH /bookings/:id/status` with `{ status: 'Completed' }` for a future-dated booking — should return `400` with time-lock error message.

---

#### Step 1.4 — Add Compound Partial Unique Index to `Booking` Model

**File:** `backend/src/models/Booking.js` (lines 129–135)

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

**PATTERN:** MongoDB partial unique index. This is the database-level double-booking lock referenced in `SkillSync_PRD.md` user story BK-02.

**GOTCHA:** The `partialFilterExpression` is critical. Without it, once a booking is cancelled, no one could ever re-book that slot (the unique constraint would block it). With the partial filter, cancelled bookings are excluded from the uniqueness check, allowing the slot to be re-booked after cancellation.

**VALIDATE:** Run `db.bookings.getIndexes()` in MongoDB shell — should show the compound index with `partialFilterExpression`.

---

### Phase 2 — Core: Backend API Endpoints

#### Step 2.1 — Implement `getBookingsByEmail` Controller

**File:** `backend/src/controllers/bookingController.js` (lines 92–113)

**IMPLEMENT:**
```js
const getBookingsByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide an email' });
    }
    const bookings = await Booking.find({ userEmail: email })
      .populate('expert', 'name category');
    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

**IMPORTS:** `const Booking = require('../models/Booking');`

**PATTERN:** Standard Express async controller with try/catch. Email comes from `req.query` (not body, not params) because this is a `GET` request — standard REST convention for filterable read operations.

**PATTERN — Populate:** `.populate('expert', 'name category')` performs a Mongoose join: it replaces the `expert` ObjectId reference with an embedded object `{ _id, name, category }`. The second argument is a space-separated field projection string — only `name` and `category` are fetched, not the full expert document (no `hourlyRate`, `description`, etc.). This minimizes payload size.

**GOTCHA:** `Booking.find({ userEmail: email })` is case-sensitive by default. If a user books with `User@Email.com` and searches with `user@email.com`, they will get zero results. Since emails are stored as-entered and this is a Phase 1 MVP without auth, the frontend `input[type="email"]` helps normalize casing, but a server-side `toLowerCase()` should be considered for Phase 2.

**GOTCHA:** If an expert document has been deleted from the database, `.populate()` will set `booking.expert` to `null`. The frontend handles this gracefully: `booking.expert?.name || 'Deleted Expert'` (see `MyBookings.jsx` line 252).

**VALIDATE:**
```bash
curl "http://localhost:5000/bookings?email=user@example.com"
# Expected: { success: true, count: N, data: [{...}, ...] }
```

---

#### Step 2.2 — Implement `updateBookingStatus` Controller

**File:** `backend/src/controllers/bookingController.js` (lines 122–180)

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
    await booking.save();

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

**IMPORTS:** `const Booking = require('../models/Booking');` — `io` retrieved from `req.app.get('io')`.

**PATTERN — Dual time-lock:** The time-lock check occurs **twice**:
1. **In the controller** (lines 136–157): First explicit guard. Returns a user-friendly 400 error with the exact scheduled time so the client can display it.
2. **In the pre-save hook** (model layer): Second guard. Prevents any bypass of the controller (e.g., direct database manipulation or future code paths that call `booking.save()` without going through this controller).

**PATTERN — Status normalization:** `String(status || '').trim()` defensively handles `null`, `undefined`, and whitespace-padded values from the request body.

**PATTERN — Socket emission on cancel:** After saving, the controller checks `if (normalizedStatus === 'Cancelled')` and emits `slot_released`. This event is handled by the `ExpertDetail` page (`ExpertDetail.jsx`) — any user currently viewing that expert's booking form will see the slot reappear in real time.

**GOTCHA:** The `slot_released` event emits to the room identified by `booking.expert.toString()`. This works because `booking.expert` is a MongoDB ObjectId. `.toString()` converts it to a 24-character hex string (e.g., `"6630a1f2e3d5c9b001a2f3c4"`). The room name must match exactly the room that `ExpertDetail` joins via `socket.emit('join_expert_room', expertId)`.

**GOTCHA:** The `io` object retrieved from `req.app.get('io')` will be `undefined` if the server is started without `app.set('io', io)` in `app.js`. Always validate that `app.js` contains this line (it does, at line 50).

**VALIDATE:**
```bash
# Test time-lock rejection (future booking):
curl -X PATCH http://localhost:5000/bookings/<FUTURE_BOOKING_ID>/status \
  -H "Content-Type: application/json" \
  -d '{"status": "Completed"}'
# Expected: 400 { error: "Time-lock violation: ..." }

# Test cancellation (emits slot_released):
curl -X PATCH http://localhost:5000/bookings/<CONFIRMED_BOOKING_ID>/status \
  -H "Content-Type: application/json" \
  -d '{"status": "Cancelled"}'
# Expected: 200 { success: true, data: { status: "Cancelled", ... } }
```

---

#### Step 2.3 — Implement `markAsRated` Controller

**File:** `backend/src/controllers/bookingController.js` (lines 223–241)

**IMPLEMENT:**
```js
const markAsRated = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { isRated: true },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

**PATTERN:** Uses `findByIdAndUpdate` with `{ new: true }` to atomically update and return the modified document. This is simpler than `findById` + `save()` because `markAsRated` does not need the pre-save time-lock hook (rating has no time restriction — it can be done anytime after completion).

**GOTCHA:** `markAsRated` intentionally does NOT check whether the booking status is `Completed` before setting `isRated: true`. This allows an admin to mark a booking as rated even if status management is bypassed. A stricter implementation would add `if (booking.status !== 'Completed') return res.status(400)...` — deferred to Phase 2.

**VALIDATE:**
```bash
curl -X PATCH http://localhost:5000/bookings/<COMPLETED_BOOKING_ID>/rate
# Expected: 200 { success: true, data: { isRated: true, ... } }
```

---

#### Step 2.4 — Implement `rateExpert` Controller

**File:** `backend/src/controllers/expertController.js` (lines 111–141)

**IMPLEMENT:**
```js
const rateExpert = async (req, res) => {
  try {
    const { rating } = req.body;
    const expert = await Expert.findById(req.params.id);

    if (!expert) {
      return res.status(404).json({ success: false, error: 'Expert not found' });
    }

    // Rolling average: NewAvg = (CurrentAvg * CurrentCount + NewRating) / (CurrentCount + 1)
    const currentTotal = expert.rating * expert.numReviews;
    expert.numReviews += 1;
    expert.rating = (currentTotal + rating) / expert.numReviews;

    await expert.save();

    res.status(200).json({ success: true, data: expert });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

**IMPORTS:** `const Expert = require('../models/Expert');`

**PATTERN — Rolling Average (Incremental Mean):** The formula `newAvg = (currentAvg * n + newValue) / (n + 1)` computes a running mean without storing all individual ratings. This is O(1) time and O(1) space — it avoids storing every review permanently in an array.

**PATTERN:** Uses `findById` + `save()` (not `findByIdAndUpdate`) so the calculation can be done in JavaScript before writing. Using `$inc` and `$set` in a single atomic update would be cleaner but requires knowing the new average before the query, creating a race condition. For MVP scale this pattern is safe.

**GOTCHA:** There is no validation that `rating` is a number between 1 and 5. The `Expert` schema enforces `min: 1, max: 5` at the Mongoose level via `expert.save()`, which will throw a validation error caught by the `catch` block. However, it returns a generic `500 Server Error` instead of a `400`. A proper validation middleware (Joi/Zod) should validate `rating` before the controller runs (Phase 2).

**GOTCHA:** This endpoint has NO idempotency protection. If the frontend calls `rateExpert` twice (e.g., double-click, network retry), the expert's `numReviews` will increment twice and the rating will be distorted. The `isRated` flag on the booking prevents the UI from showing the rating buttons again, but provides no server-side guard. A server-side check (`if (booking.isRated)`) in the rating flow would make it truly idempotent.

**VALIDATE:**
```bash
curl -X POST http://localhost:5000/experts/<EXPERT_ID>/rate \
  -H "Content-Type: application/json" \
  -d '{"rating": 4}'
# Expected: 200 { success: true, data: { rating: <new_avg>, numReviews: <n+1>, ... } }
```

---

#### Step 2.5 — Register Routes

**File:** `backend/src/routes/bookingRoutes.js` (lines 1–53)

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

**File:** `backend/src/routes/expertRoutes.js` (lines 1–33)

**IMPLEMENT:**
```js
const express = require('express');
const router = express.Router();
const { getExperts, getExpertById, rateExpert } = require('../controllers/expertController');

router.get('/', getExperts);
router.get('/:id', getExpertById);
router.post('/:id/rate', rateExpert);

module.exports = router;
```

**GOTCHA — Route ordering:** `router.get('/booked-slots/:expertId/:date')` must be defined BEFORE any catch-all `/:id` route if one ever exists. Express matches routes top-to-bottom — a `/:id` pattern would match `/booked-slots` with `id = 'booked-slots'`. In the current implementation this is not an issue since there is no `GET /:id` on booking routes, but be aware of this when adding routes.

**VALIDATE:**
```bash
curl http://localhost:5000/bookings?email=test@example.com
curl -X PATCH http://localhost:5000/bookings/123abc/status -H "Content-Type: application/json" -d '{"status":"Cancelled"}'
curl -X PATCH http://localhost:5000/bookings/123abc/rate
curl -X POST http://localhost:5000/experts/456def/rate -H "Content-Type: application/json" -d '{"rating":5}'
```

---

### Phase 3 — Integration: Frontend Page

#### Step 3.1 — Add Route to React Router

**File:** `frontend/src/App.jsx` (line 47)

**IMPLEMENT:**
```jsx
import MyBookings from './pages/MyBookings';
// ...
<Route path="/my-bookings" element={<MyBookings />} />
```

**VALIDATE:** Navigate to `http://localhost:5173/my-bookings` — the page should render with the email search form.

---

#### Step 3.2 — Add API Service Functions

**File:** `frontend/src/services/api.js` (lines 78–110)

**IMPLEMENT:**
```js
export const fetchBookingsByEmail = (email) =>
  API.get('/bookings', { params: { email } });

export const updateBookingStatus = (id, status) =>
  API.patch(`/bookings/${id}/status`, { status });

export const rateExpert = (expertId, rating) =>
  API.post(`/experts/${expertId}/rate`, { rating });

export const markBookingAsRated = (bookingId) =>
  API.patch(`/bookings/${bookingId}/rate`);
```

**PATTERN:** All functions return raw Axios promises. The component destructures `{ data }` from the resolved value to access the response body. This matches the pattern used by `fetchExperts` and other existing service functions.

**GOTCHA:** `markBookingAsRated` sends a `PATCH` request with no body — Axios still sends the request correctly with an empty body. Ensure the backend route `PATCH /:id/rate` does not require a body (it doesn't — see `markAsRated` controller which reads only `req.params.id`).

---

#### Step 3.3 — Build `MyBookings` Component — State & Initialization

**File:** `frontend/src/pages/MyBookings.jsx` (lines 27–48)

**IMPLEMENT:**
```jsx
const MyBookings = () => {
  const [email, setEmail] = useState(localStorage.getItem('userEmail') || '');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Refresh current time every 10 seconds for time-lock UI accuracy
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Auto-load bookings if email is already in localStorage
  useEffect(() => {
    if (email) {
      handleSearch();
    }
  }, []);
};
```

**PATTERN:** `useState` initialization from `localStorage` happens synchronously during render. The `useEffect` with empty deps `[]` runs once after mount to auto-search.

**GOTCHA:** The auto-search `useEffect` calls `handleSearch()` directly. Since `handleSearch` is defined inside the component and closes over `email`, this works. However, ESLint's `react-hooks/exhaustive-deps` rule would flag `handleSearch` as a missing dependency. This is acceptable because `handleSearch` itself doesn't change between renders (it only reads state, not props). For stricter compliance, wrap `handleSearch` in `useCallback`.

**PATTERN — `actionLoading` vs `ratingLoading`:** Two separate loading states allow independent per-card loading spinners. `actionLoading` is set to the `bookingId` string (not `true`) so only the specific card being actioned shows a spinner. `ratingLoading` similarly tracks which booking is being rated. Check `actionLoading === booking._id` per card.

---

#### Step 3.4 — Build `isSessionPast` Time-Lock Helper

**File:** `frontend/src/pages/MyBookings.jsx` (lines 58–84)

**IMPLEMENT:**
```jsx
const isSessionPast = (date, time) => {
  const options = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());

  const now = {};
  parts.forEach(p => { if (p.type !== 'literal') now[p.type] = parseInt(p.value); });

  const [sYear, sMonth, sDay] = date.split('-').map(Number);
  const [sHour, sMinute] = time.split(':').map(Number);

  if (now.year > sYear) return true;
  if (now.year < sYear) return false;
  if (now.month > sMonth) return true;
  if (now.month < sMonth) return false;
  if (now.day > sDay) return true;
  if (now.day < sDay) return false;
  if (now.hour > sHour) return true;
  if (now.hour < sHour) return false;
  return now.minute >= sMinute;
};
```

**PATTERN — `Intl.DateTimeFormat`:** Uses the browser's internationalization API to extract current time components in the `Asia/Kolkata` timezone. This avoids manual UTC offset arithmetic which is fragile and browser-dependent. The `formatToParts` API returns an array of `{type, value}` objects that are mapped to a `now` object with keys `year`, `month`, `day`, `hour`, `minute`.

**PATTERN — Hierarchical comparison:** Instead of constructing two `Date` objects and comparing milliseconds, this function compares year → month → day → hour → minute sequentially. This avoids any potential IST offset construction bugs — the `now` object is already in IST components, and `date`/`time` are stored as IST strings, so the comparison is a direct field-by-field check.

**GOTCHA:** `Intl.DateTimeFormat` `month` values are 1-indexed (January = 1), consistent with how bookings store months in `YYYY-MM-DD` format. JavaScript's `Date.getMonth()` returns 0-indexed months — do NOT use `new Date().getMonth()` here without adding 1.

**GOTCHA:** `hour12: false` is required. Without it, `Intl.DateTimeFormat` may return hours in 12h format, causing comparisons like `now.hour = 2` (for 2 PM) to appear LESS than `sHour = 14`, incorrectly reporting a 2 PM session as "not yet passed" at 2:05 PM.

---

#### Step 3.5 — Build `handleSearch` Handler

**File:** `frontend/src/pages/MyBookings.jsx` (lines 109–126)

**IMPLEMENT:**
```jsx
const handleSearch = async (e) => {
  if (e) e.preventDefault();
  if (!email) return;

  try {
    setLoading(true);
    setError(null);
    const { data } = await fetchBookingsByEmail(email);
    setBookings(data.data);
    localStorage.setItem('userEmail', email);
    setHasSearched(true);
  } catch (err) {
    setError('Failed to load bookings. Please check your email and try again.');
  } finally {
    setLoading(false);
  }
};
```

**PATTERN:** `if (e) e.preventDefault()` — the handler can be called both from a form `onSubmit` (which passes an event) and from a `useEffect` (which passes nothing). The optional event guard handles both cases cleanly.

**GOTCHA:** `data.data` accesses the `data` property of the Axios response body (`data` = Axios response shape, `.data` = the JSON body). Then `.data` again accesses the `data` array from the API's `{ success, count, data: [] }` response shape. If the response shape changes, this double-`.data` access will break silently returning `undefined` to `setBookings`.

---

#### Step 3.6 — Build `handleStatusUpdate` Handler

**File:** `frontend/src/pages/MyBookings.jsx` (lines 135–147)

**IMPLEMENT:**
```jsx
const handleStatusUpdate = async (bookingId, newStatus) => {
  try {
    setActionLoading(bookingId);
    await updateBookingStatus(bookingId, newStatus);
    const { data } = await fetchBookingsByEmail(email);
    setBookings(data.data);
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to update booking status.');
  } finally {
    setActionLoading(null);
  }
};
```

**PATTERN — Re-fetch after mutation:** After a successful PATCH, the handler immediately re-fetches all bookings. This is a "fetch-on-mutation" pattern — simple and always correct, at the cost of one additional API call per action.

**PATTERN — Error surfacing:** `err.response?.data?.error` uses optional chaining to safely drill into the Axios error shape. If the backend returned `{ error: 'Time-lock violation...' }`, this string is shown in the alert. If the network failed entirely (`err.response` is `undefined`), the fallback string is shown.

---

#### Step 3.7 — Build `handleRating` Handler

**File:** `frontend/src/pages/MyBookings.jsx` (lines 157–172)

**IMPLEMENT:**
```jsx
const handleRating = async (bookingId, expertId, rating) => {
  try {
    setRatingLoading(bookingId);
    await rateExpert(expertId, rating);       // Step 1: Update expert's rolling average
    await markBookingAsRated(bookingId);      // Step 2: Set booking.isRated = true
    const { data } = await fetchBookingsByEmail(email);
    setBookings(data.data);
  } catch (err) {
    alert('Failed to submit rating.');
  } finally {
    setRatingLoading(null);
  }
};
```

**PATTERN — Sequential two-step operation:** Rating requires two API calls in a specific order:
1. `POST /experts/:id/rate` → updates `expert.rating` and `expert.numReviews`
2. `PATCH /bookings/:id/rate` → sets `booking.isRated = true`

Step 2 must happen AFTER Step 1 succeeds. If Step 2 fails, the expert's rating was already updated but the booking's `isRated` flag remains `false`, so the user could attempt to re-rate. This is an acceptable "at-least-once" trade-off for Phase 1. A transactional approach (MongoDB multi-document transactions) would guarantee atomicity in Phase 2.

**GOTCHA:** `booking.expert?._id` is passed as `expertId` in `handleRating` (see `MyBookings.jsx` line 339: `booking.expert?._id`). After `.populate('expert', 'name category')`, the `expert` field is a sub-document object containing `{ _id, name, category }`. The `._id` accessor retrieves the ObjectId needed for the rating endpoint. If the expert was deleted and `booking.expert` is `null`, `booking.expert?._id` will be `undefined` and the rating request will fail with a `404`.

---

#### Step 3.8 — Build Booking Card UI

**File:** `frontend/src/pages/MyBookings.jsx` (lines 238–361)

**IMPLEMENT (structure):**
```jsx
{bookings.map((booking, index) => (
  <div key={booking._id} className="group bg-white rounded-[2rem] ...">
    <div className="p-8">
      {/* 1. Expert Header: avatar placeholder + name + category + status badge */}
      {/* 2. Time-Lock Status Indicator */}
      {/* 3. Metadata Grid: Date | Time | Session ID */}
      {/* 4. Action Buttons (conditional on booking.status) */}
      {/* 5. Rating UI (conditional on status === 'Completed' && !isRated) */}
      {/* 6. Rating Confirmation (conditional on isRated === true) */}
    </div>
  </div>
))}
```

**PATTERN — Status badge colors** via `getStatusColor(status)`:
```jsx
const getStatusColor = (status) => {
  switch (status) {
    case 'Confirmed':  return 'bg-green-50 text-green-700 border-green-100';
    case 'Pending':    return 'bg-yellow-50 text-yellow-700 border-yellow-100';
    case 'Completed':  return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'Cancelled':  return 'bg-red-50 text-red-700 border-red-100';
    default:           return 'bg-gray-50 text-gray-700 border-gray-100';
  }
};
```

**PATTERN — Time slot AM/PM formatting** (lines 283–285):
```jsx
{booking.slotTime.startsWith('09') || booking.slotTime.startsWith('10') || booking.slotTime.startsWith('11')
  ? `${booking.slotTime} AM`
  : booking.slotTime.startsWith('12') ? '12:00 PM'
  : `${parseInt(booking.slotTime.split(':')[0]) - 12}:${booking.slotTime.split(':')[1]} PM`}
```
Backend stores time as `HH:mm` (24h). This converts to 12h AM/PM for display only.

**PATTERN — Session ID truncation** (line 293):
```jsx
#{booking._id.substring(18).toUpperCase()}
```
MongoDB ObjectIds are 24 hex chars. Taking the last 6 chars (index 18 onward) gives a short, visually distinct reference.

**PATTERN — Animation with stagger delay** (line 242):
```jsx
style={{ animationDelay: `${index * 100}ms` }}
```
Cards slide in sequentially with a 100ms stagger per card using Tailwind's `animate-slide-up` class.

**GOTCHA — Conditional rendering order:** The JSX conditions for action areas must be mutually exclusive and ordered correctly:
1. `booking.status === 'Confirmed'` → Show action buttons
2. `booking.status === 'Completed' && !booking.isRated` → Show rating UI
3. `booking.isRated` → Show "Rated" confirmation

If `booking.isRated` is `true` AND `booking.status === 'Completed'`, both condition 2 and 3 would fire if not written as exclusive checks. The `!booking.isRated` guard on condition 2 prevents this.

---

### Phase 4 — Testing

> **Note:** No automated test framework is currently configured (see `AGENTS.md`). The following represents the testing strategy and test cases to implement when a framework is added.

#### Step 4.1 — Backend Unit Tests (`bookingController.test.js`)

See [Section 6 — Testing Strategy](#6-testing-strategy) for full test cases.

#### Step 4.2 — Frontend Component Tests (`MyBookings.test.jsx`)

See [Section 6 — Testing Strategy](#6-testing-strategy) for full test cases.

---

## 6. Testing Strategy

### 6.1 Unit Tests — Backend Controllers

**File to create:** `backend/src/controllers/bookingController.test.js`  
**Framework recommendation:** Jest + supertest

```js
describe('getBookingsByEmail', () => {
  test('returns 400 if email query param is missing');
  test('returns 200 with empty array if no bookings match email');
  test('returns 200 with populated expert data');
  test('returns 200 with null expert field if expert was deleted');
});

describe('updateBookingStatus', () => {
  test('returns 404 if booking ID does not exist');
  test('returns 400 with time-lock error for future Completed status');
  test('returns 200 for past Completed status');
  test('returns 200 for Cancelled status and emits slot_released');
  test('normalizes whitespace-padded status strings');
  test('returns 400 for invalid date/time format (NaN sessionTime)');
});

describe('markAsRated', () => {
  test('returns 200 and sets isRated: true on the booking document');
  test('returns 404 if booking ID does not exist');
});
```

**File to create:** `backend/src/controllers/expertController.test.js`

```js
describe('rateExpert', () => {
  test('calculates rolling average correctly for first rating');
  test('calculates rolling average correctly for subsequent ratings');
  test('returns 404 if expert ID does not exist');
});
```

### 6.2 Unit Tests — Frontend Component

**File to create:** `frontend/src/pages/MyBookings.test.jsx`  
**Framework recommendation:** Vitest + React Testing Library

```jsx
describe('MyBookings', () => {
  test('renders email input and search button on initial load');
  test('reads email from localStorage and auto-searches');
  test('displays loading state during fetch');
  test('displays error state on API failure');
  test('displays empty state when no bookings match email');
  test('renders booking cards with expert name and category');
  test('shows "UPCOMING SESSION" disabled for future bookings');
  test('shows "MARK AS COMPLETED" active for past bookings');
  test('shows star rating UI for Completed + !isRated bookings');
  test('hides star rating UI for Completed + isRated bookings');
  test('shows "Cancel Session" button for Confirmed bookings');
});

describe('isSessionPast', () => {
  test('returns true for past date');
  test('returns false for future date');
  test('returns true for same date, past hour');
  test('returns false for same date, future hour');
  test('returns true for same date, same hour, past minute');
  test('returns true for exact minute match (>= check)');
});
```

### 6.3 Integration Tests

```
Scenario 1: Full booking lifecycle
  - Seed an expert
  - POST /bookings → create booking (status: Confirmed)
  - GET /bookings?email=... → verify booking appears
  - PATCH /bookings/:id/status (Cancelled) → verify slot_released emitted
  - GET /bookings?email=... → verify status is Cancelled
  - POST /bookings (same slot) → verify slot can be re-booked

Scenario 2: Time-lock enforcement
  - Create a booking with a FUTURE date/time
  - PATCH /bookings/:id/status (Completed) → verify 400 returned
  - (Simulate time passing)
  - PATCH /bookings/:id/status (Completed) → verify 200 returned

Scenario 3: Rating flow
  - Create and complete a booking (manually update status to Completed in DB)
  - POST /experts/:id/rate with rating=5 → verify numReviews+1, rolling average
  - PATCH /bookings/:id/rate → verify isRated=true
  - POST /experts/:id/rate again → verify numReviews+2 (idempotency gap — document this)

Scenario 4: Double booking prevention
  - POST /bookings (expert A, date X, time Y) → 201 Created
  - POST /bookings (same expert, date, time) → 400 "already booked"
```

### 6.4 Edge Cases

| Edge Case | Expected Behavior |
|---|---|
| Email with mixed case (`User@Email.com` vs `user@email.com`) | Returns 0 results if case differs; document as known limitation |
| Expert deleted after booking | `booking.expert` is `null`; UI shows "Deleted Expert", rate button disabled |
| `slotTime` in unexpected format (e.g., `"9:0"` instead of `"09:00"`) | `isSessionPast` comparison may fail; backend stores as entered — enforce `HH:mm` format at booking creation |
| User double-clicks "Cancel" button | Second request may 404 (booking already Cancelled); `alert` shows "Booking not found" |
| User double-clicks a star rating | Second `rateExpert` call updates `numReviews` again; mitigated by `ratingLoading` disable state |
| Network timeout during rating Step 1 | `rateExpert` fails; `markBookingAsRated` not called; `isRated` stays false; user can retry |
| `localStorage` cleared by browser | Email field empty on next visit; user must re-enter email manually |
| Booking with `status: 'Pending'` | No action buttons shown (only `Confirmed` triggers actions); badge shows yellow |

---

## 7. Validation Commands

### 7.1 Start Services

```bash
# Terminal 1 — Backend
cd backend && node src/app.js
# Expected: "Server running in development mode on port 5000"
# Expected: "MongoDB Connected: <hostname>"

# Terminal 2 — Frontend
cd frontend && npm run dev
# Expected: "Local: http://localhost:5173/"
```

### 7.2 API Validation (curl)

```bash
# ---- GET /bookings?email=... ----
curl -s "http://localhost:5000/bookings?email=alice@example.com" | jq .
# Expect: { success: true, count: N, data: [{ expert: { name: "...", category: "..." }, ... }] }

# Missing email — expect 400
curl -s "http://localhost:5000/bookings" | jq .
# Expect: { success: false, error: "Please provide an email" }

# ---- PATCH /bookings/:id/status — Time-lock rejection ----
FUTURE_ID="<insert a confirmed booking _id with future date>"
curl -s -X PATCH "http://localhost:5000/bookings/$FUTURE_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"Completed"}' | jq .
# Expect: { success: false, error: "Time-lock violation: ..." }

# ---- PATCH /bookings/:id/status — Successful cancellation ----
BOOKING_ID="<insert a confirmed booking _id>"
curl -s -X PATCH "http://localhost:5000/bookings/$BOOKING_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"Cancelled"}' | jq .
# Expect: { success: true, data: { status: "Cancelled", ... } }

# ---- PATCH /bookings/:id/rate — Mark as rated ----
curl -s -X PATCH "http://localhost:5000/bookings/$BOOKING_ID/rate" | jq .
# Expect: { success: true, data: { isRated: true, ... } }

# ---- POST /experts/:id/rate — Rate an expert ----
EXPERT_ID="<insert an expert _id>"
curl -s -X POST "http://localhost:5000/experts/$EXPERT_ID/rate" \
  -H "Content-Type: application/json" \
  -d '{"rating":5}' | jq .
# Expect: { success: true, data: { rating: <new_avg>, numReviews: <n+1> } }
```

### 7.3 Frontend Validation (Manual E2E)

```
1. Open http://localhost:5173/my-bookings
2. Verify: Email field is empty (or pre-filled from localStorage)
3. Enter a registered email and click "VIEW SESSIONS"
4. Verify: Booking cards appear with expert name, category, date, slot
5. Verify: A future booking shows "UPCOMING SESSION" (disabled, dashed border)
6. Verify: A future booking shows "Locked until Start Time" in the time-lock indicator
7. Verify: A past booking shows "MARK AS COMPLETED" (active, blue button)
8. Click "CANCEL SESSION" on a confirmed booking
9. Verify: Status badge changes to "Cancelled" (red)
10. Open http://localhost:5173/expert/<expert_id> in another tab
11. Verify: The cancelled slot reappears immediately (Socket.io slot_released)
12. For a Completed booking with !isRated: verify star rating UI appears
13. Click a star rating
14. Verify: "Experience Rated Successfully" confirmation shows
15. Refresh the page and re-search — verify isRated state persists (badge still shows)
```

### 7.4 Linting

```bash
cd frontend && npm run lint
# Expect: No ESLint errors
```

### 7.5 Socket.io Smoke Test

```bash
# Open browser DevTools → Network tab → WS
# Navigate to http://localhost:5173/my-bookings
# Verify: No WebSocket frames from MyBookings (socket is NOT used on this page)
# Navigate to http://localhost:5173/expert/<id>
# Verify: join_expert_room event visible in WS frames
# Cancel a booking from MyBookings in a second tab
# Verify: slot_released frame appears in the ExpertDetail tab's WS stream
```

---

## 8. Acceptance Criteria

| # | Criterion | How to Verify |
|---|---|---|
| AC-01 | User can retrieve all bookings associated with their email | `GET /bookings?email=<email>` returns correct bookings with expert data |
| AC-02 | Email is persisted to `localStorage` after first search | Check DevTools → Application → localStorage → `userEmail` key |
| AC-03 | Bookings auto-load on revisit if `userEmail` is in localStorage | Hard-refresh `/my-bookings` — bookings appear without clicking search |
| AC-04 | Confirmed bookings show "Mark as Completed" + "Cancel Session" buttons | Verify UI for a `Confirmed` status booking |
| AC-05 | "Mark as Completed" is disabled (shown as "Upcoming Session") for future sessions | Verify a booking with a future date shows the greyed-out placeholder |
| AC-06 | Marking a session Completed for a past session returns 200 and updates status | `PATCH /bookings/:id/status` with `Completed` after session time passes |
| AC-07 | Attempting to complete a future session returns a 400 time-lock error | `PATCH /bookings/:id/status` with `Completed` before session time — UI shows alert |
| AC-08 | Cancelling a booking emits `slot_released` via Socket.io | Observe WS frames in DevTools — `slot_released` event appears after cancel |
| AC-09 | Cancelled slot reappears on ExpertDetail page in real-time | Open ExpertDetail in parallel; slot becomes selectable after cancel |
| AC-10 | Completed + !isRated bookings show a 1-5 star rating UI | Verify UI for a `Completed` booking with `isRated: false` |
| AC-11 | Submitting a rating updates expert's rolling average and increments `numReviews` | Check expert document in MongoDB after rating |
| AC-12 | `isRated` flag is set to `true` after rating submission | Check booking document in MongoDB — `isRated: true` |
| AC-13 | Rating UI is replaced with "Experience Rated Successfully" after rating | Verify UI after clicking a star — rating buttons hidden, confirmation shown |
| AC-14 | Status badges use correct colors | Confirmed=green, Completed=blue, Cancelled=red, Pending=yellow |
| AC-15 | Frontend renders gracefully when expert document is deleted | `booking.expert` is `null`; shows "Deleted Expert" with no crash |
| AC-16 | Re-cancelled or re-rated requests are prevented by UI loading state | Buttons are disabled (`actionLoading === booking._id`) during in-flight requests |

---

## 9. Completion Checklist

### Backend
- [x] `Booking.js` model includes `isRated: Boolean` field with `default: false`
- [x] `Booking.js` model includes `pre('save')` time-lock hook for `Completed` status
- [x] `Booking.js` model includes `pre('findOneAndUpdate')` time-lock hook
- [x] `Booking.js` model includes `parseISTSessionTime` helper function
- [x] `Booking.js` model includes compound partial unique index excluding Cancelled bookings
- [x] `Expert.js` model includes `numReviews: Number` field with `default: 0`
- [x] `bookingController.js` implements `getBookingsByEmail` with `.populate('expert', 'name category')`
- [x] `bookingController.js` implements `updateBookingStatus` with dual-layer time-lock for Completed
- [x] `bookingController.js` implements `updateBookingStatus` with `slot_released` Socket.io emission on Cancelled
- [x] `bookingController.js` implements `markAsRated` using `findByIdAndUpdate`
- [x] `expertController.js` implements `rateExpert` with incremental mean formula
- [x] `bookingRoutes.js` registers `GET /`, `PATCH /:id/status`, `PATCH /:id/rate`
- [x] `expertRoutes.js` registers `POST /:id/rate`
- [x] `app.js` stores `io` on the Express app via `app.set('io', io)`
- [ ] Input validation middleware (Joi/Zod) for rating range 1-5 (deferred to Phase 2)
- [ ] Server-side idempotency guard on `rateExpert` (deferred to Phase 2)

### Frontend
- [x] `api.js` exports `fetchBookingsByEmail`, `updateBookingStatus`, `rateExpert`, `markBookingAsRated`
- [x] `App.jsx` registers `/my-bookings` route with `<MyBookings />`
- [x] `MyBookings.jsx` initializes email from `localStorage`
- [x] `MyBookings.jsx` persists email to `localStorage` on successful search
- [x] `MyBookings.jsx` auto-searches on mount if `localStorage` has email
- [x] `MyBookings.jsx` refreshes `currentTime` every 10 seconds via `setInterval`
- [x] `MyBookings.jsx` implements `isSessionPast` using `Intl.DateTimeFormat` with IST timezone
- [x] `MyBookings.jsx` implements `handleSearch` with loading/error/hasSearched states
- [x] `MyBookings.jsx` implements `handleStatusUpdate` with per-booking `actionLoading`
- [x] `MyBookings.jsx` implements `handleRating` with sequential two-step API calls
- [x] `MyBookings.jsx` renders time-lock status indicator on each booking card
- [x] `MyBookings.jsx` conditionally renders "Mark as Completed" / "Upcoming Session" based on `isSessionPast`
- [x] `MyBookings.jsx` conditionally renders rating UI for `Completed && !isRated`
- [x] `MyBookings.jsx` conditionally renders confirmation badge for `isRated`
- [x] `MyBookings.jsx` handles `booking.expert === null` gracefully
- [x] `MyBookings.jsx` converts `HH:mm` slot times to AM/PM format for display
- [x] `Navbar.jsx` includes "My History" link to `/my-bookings`
- [ ] `MyBookings.test.jsx` unit tests (no test framework configured yet)
- [ ] ESLint compliance for `useCallback` on `handleSearch` (minor, non-blocking)

---

## 10. Notes

### 10.1 Design Decisions

#### Email-Based Identity (No JWT)
The most significant architectural decision for this feature is the choice to use email as the sole identity mechanism for accessing booking history. This was a deliberate Phase 1 scope decision:
- **Pros:** Zero authentication infrastructure required; works immediately; users don't need to create accounts just to check their bookings.
- **Cons:** Security risk — anyone who knows a user's email can see their booking history. No session ownership enforcement means any user can technically cancel another user's booking if they know the booking ID (but the UI only shows their own).
- **Mitigation:** The `PATCH /bookings/:id/status` endpoint does NOT verify that the requesting "user" (email) matches the booking's `userEmail`. In Phase 2 with JWT, middleware should enforce `req.user.email === booking.userEmail` before allowing status changes.

#### Time-Lock Dual Enforcement
The time-lock is enforced at two levels:
1. **Controller level** (explicit check before save) — provides a detailed, user-facing error message with the exact scheduled time.
2. **Mongoose pre-save hook** (schema level) — acts as an "infrastructure safety net" that no code path through `booking.save()` can bypass.

The dual enforcement means any future feature that also calls `booking.save()` (e.g., an admin panel) automatically inherits the time-lock guarantee without requiring the developer to remember to add the check.

#### Re-Fetch Pattern After Mutations
After every mutation (status update, rating), the page re-fetches all bookings via `fetchBookingsByEmail`. This approach was chosen over optimistic UI updates because:
- The booking count is small (most users have < 50 bookings).
- It eliminates entire classes of state sync bugs.
- The latency is acceptable in a development/demo context.
For production at scale, consider optimistic updates + background sync.

#### `isRated` on Booking (Not Expert)
The `isRated` flag is stored on the `Booking` document, not the `Expert` document. This allows per-session rating tracking: a user who books the same expert 5 times can rate each session independently. If stored on `Expert`, you'd only know if the user ever rated that expert, not whether they rated each individual session.

### 10.2 Trade-Offs

| Decision | Trade-Off Made |
|---|---|
| Email identity | Simplicity over security; deferred to Phase 2 JWT |
| Rolling average (no individual review storage) | Space efficiency over full review history and per-user review analytics |
| Re-fetch on mutation | Data accuracy over UI performance |
| `findById` + `save()` in `updateBookingStatus` | Pre-save hook access over atomic `findByIdAndUpdate` |
| No rating validation middleware | Faster implementation over input security hardening |
| `Intl.DateTimeFormat` for time-lock | API correctness over simplicity of `Date.getHours()` |

### 10.3 Alternatives Considered

- **JWT Auth in Phase 1:** Rejected as over-engineering for an MVP. The email-based approach is consistent with PRD scope boundaries ("In-Scope Features Phase 1: Booking history tracking by email").
- **Storing individual ratings:** Rejected in favor of incremental mean to keep the `Expert` document size bounded.
- **WebSocket-driven state updates instead of re-fetch:** The `MyBookings` page does NOT subscribe to Socket.io events. When a booking is cancelled, the real-time update only goes to `ExpertDetail` viewers. The `MyBookings` UI is refreshed via REST re-fetch after the user's own action. This is correct because the "My Bookings" page is a personal portal — no one else's actions should mutate what you see here.
- **`findOneAndUpdate` for `updateBookingStatus`:** Rejected because it would skip the pre-save Mongoose hook, removing the secondary time-lock enforcement.

---

## 11. Decision Log

| Date | Decision | Rationale | Decided By |
|---|---|---|---|
| 2026-05-10 04:00 PM IST | Use email as user identity | Phase 1 scope constraint; JWT deferred | Architecture |
| 2026-05-10 04:00 PM IST | Store `isRated` on `Booking` not `Expert` | Per-session granularity needed | Architecture |
| 2026-05-10 04:25 PM IST | Rolling average formula for expert ratings | O(1) space, no individual rating storage | Architecture |
| 2026-05-10 04:52 PM IST | Emit `slot_released` on cancel via Socket.io | Real-time slot re-availability for other users | Architecture |
| 2026-05-10 06:12 PM IST | Add time-lock to prevent premature completion | Integrity of session records | Architecture |
| 2026-05-10 06:28 PM IST | Switch to millisecond-based time comparison | Fragile string parsing causing comparison failures | Bug Fix |
| 2026-05-10 06:41 PM IST | Use ISO 8601 `+05:30` offset universally | Eliminate timezone ambiguity across server/client | Architecture |
| 2026-05-10 06:37 PM IST | Use `Intl.DateTimeFormat` with `Asia/Kolkata` | Reliable IST extraction without manual UTC math | Bug Fix |
| 2026-05-11 08:36 AM IST | Refactor Mongoose hooks to `async/await` | Legacy `next` callback incompatible with async middleware | Critical Bug Fix |
| 2026-05-11 08:36 AM IST | Start server only after MongoDB connects | Prevent buffering timeout errors on startup | Bug Fix |

---

## 12. Known Limitations & Future Improvements

### 12.1 Known Limitations

1. **Email Case-Sensitivity:** Bookings created with `User@Email.com` will not appear if searched with `user@email.com`. The MongoDB query `Booking.find({ userEmail: email })` is an exact string match.

2. **No Server-Side Rate Idempotency:** If the frontend sends two `POST /experts/:id/rate` requests (e.g., rapid double-click before `ratingLoading` disables the UI), the expert's `numReviews` will be incremented twice. The UI `ratingLoading` state mitigates this but does not eliminate it.

3. **No Ownership Verification:** Any client that knows a booking's `_id` can cancel or complete it via `PATCH /bookings/:id/status`. There is no check that the requesting party is the booking owner.

4. **No Rating Range Validation (Server-Side):** The `rateExpert` endpoint accepts any `rating` value without validating it is between 1 and 5. The Mongoose schema's `min`/`max` constraint catches it at save time, but returns a generic `500` instead of a meaningful `400`.

5. **Deleted Expert Handling in Rating:** If an expert's document is deleted, `booking.expert` becomes `null`. Attempting to rate that booking would pass `undefined` as `expertId` to `POST /experts/undefined/rate`, causing a MongoDB cast error and a `500` response. The UI should check `booking.expert?._id` before rendering the rating UI.

6. **`useCallback` Missing on `handleSearch`:** ESLint's `react-hooks/exhaustive-deps` rule would flag the `useEffect` dependency on `handleSearch` as incomplete. This is non-breaking but can cause stale closure issues if the component grows.

7. **No Pagination:** `GET /bookings?email=...` returns ALL bookings for an email, sorted by `createdAt` default. Users with many bookings may experience slow load times.

### 12.2 Future Improvements (Phase 2+)

| Improvement | Phase | Priority |
|---|---|---|
| JWT authentication — enforce booking ownership in all PATCH routes | Phase 2 | High |
| Email normalization (`toLowerCase()`) before query and storage | Phase 2 | High |
| Server-side rating idempotency check (`if booking.isRated: 400`) | Phase 2 | High |
| Input validation middleware (Joi/Zod) on rating value (1-5 range) | Phase 2 | Medium |
| MongoDB multi-document transactions for atomic rating + markAsRated | Phase 2 | Medium |
| Pagination for booking history (`GET /bookings?email=&page=&limit=`) | Phase 2 | Medium |
| Sort/filter bookings by status or date on the My Bookings page | Phase 3 | Medium |
| Email/SMS notification on cancellation (Nodemailer/Twilio) | Phase 3 | Low |
| Expert analytics — aggregate rating history per user | Phase 3 | Low |
| Full review text (not just star rating) | Phase 3 | Low |
| WebSocket subscription for real-time status updates in My Bookings | Phase 3 | Low |
| Admin override — mark sessions complete regardless of time-lock | Phase 2 Admin Panel | Low |

---

*End of Feature Plan: My Bookings — Booking History & Status Management*
