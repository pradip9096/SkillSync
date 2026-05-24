# Feature Plan: Expert Detail Page & Booking Form

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Feature Metadata](#2-feature-metadata)
3. [Context References](#3-context-references)
4. [Patterns Followed](#4-patterns-followed)
5. [Architecture & Data Flow](#5-architecture--data-flow)
6. [Implementation Plan](#6-implementation-plan)
   - [Phase 1 — Foundation](#phase-1--foundation)
   - [Phase 2 — Core](#phase-2--core)
   - [Phase 3 — Integration](#phase-3--integration)
   - [Phase 4 — Testing & Hardening](#phase-4--testing--hardening)
7. [Testing Strategy](#7-testing-strategy)
8. [Validation Commands](#8-validation-commands)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Completion Checklist](#10-completion-checklist)
11. [Notes](#11-notes)
12. [Decision Log](#12-decision-log)
13. [Known Limitations & Future Improvements](#13-known-limitations--future-improvements)

---

## 1. Feature Overview

### Description

The **Expert Detail Page & Booking Form** is the primary transactional interface of SkillSync. It serves as the single-screen experience where a Knowledge Seeker discovers an expert's full professional profile, selects a session date and time, and completes a booking — all within a real-time-aware UI. The page is accessible at the route `/expert/:id` and is the natural continuation of the Expert Listing journey.

### User Story

> **As a Knowledge Seeker**, I want to view an expert's full profile with live slot availability and book a session by entering my details, so that I can secure a consultation without the risk of accidentally booking an already-taken slot.

Mapped PRD stories: **BK-01** (real-time slot disappearance), **BK-02** (atomic booking engine), **LO-01** (IST & +91 localization).

### Problem Statement

Before this feature:
- Users had no way to view an individual expert's profile in depth (bio, stats, photo).
- There was no mechanism to select a booking date or time slot.
- No guest information form existed to capture the user's identity before booking.
- Concurrent booking attempts could produce a double-booked slot if only naive application-level checks were used.
- Users in India saw UTC-based times by default, making scheduling confusing.

### Solution Statement

This feature implements a **two-step booking UX flow** embedded in a single page:

1. **Step 1 — Session Selection:** The user picks a date (defaulting to today in IST) and then clicks one of 13 predefined hourly time slots. Slots that are already booked or in the past are visually disabled and non-interactive. Slot availability is kept live via Socket.io room membership — any concurrent booking by another user removes the slot from the grid without a page refresh.

2. **Step 2 — Guest Information:** Once a slot is selected, the user fills in their full name, email, an India-locked phone number (+91 prefix), and optional meeting notes. Submitting the form calls `POST /bookings`, which performs an application-level conflict check **and** relies on a MongoDB compound unique partial index as an atomic fallback against race conditions.

On success, a full-screen confirmation card is shown for 3 seconds before automatically redirecting the user to `/my-bookings`.

---

## 2. Feature Metadata

| Property              | Value                                                          |
|-----------------------|----------------------------------------------------------------|
| **Feature ID**        | `FEAT-003`                                                     |
| **Feature Name**      | Expert Detail Page & Booking Form                              |
| **Feature Type**      | Full-Stack (Frontend Page + Backend API endpoints)             |
| **Complexity**        | High                                                           |
| **PRD Phase**         | Phase 1 — MVP                                                  |
| **Route (Frontend)**  | `/expert/:id`                                                  |
| **Primary File**      | `frontend/src/pages/ExpertDetail.jsx`                          |
| **Status**            | ✅ Implemented                                                  |
| **Depends On**        | Expert Listing Page (provides navigation links), Socket.io infrastructure, Booking model, Expert model |
| **Affects**           | My Bookings page (redirect target), Expert rating (post-session) |
| **Affected Systems**  | Frontend (React/Vite), Backend (Express), Database (MongoDB), Real-Time layer (Socket.io) |
| **Indian Locale**     | IST date initialization, +91 phone prefix, ₹ INR currency      |

### Dependencies

| Dependency                        | Location                                       | Purpose                                          |
|-----------------------------------|------------------------------------------------|--------------------------------------------------|
| `react-router-dom`                | `frontend/package.json`                        | `useParams`, `useNavigate` hooks for routing     |
| `lucide-react`                    | `frontend/package.json`                        | Icon set (Calendar, Clock, User, Mail, etc.)     |
| `axios` (via `api.js`)            | `frontend/src/services/api.js`                 | HTTP requests to backend                         |
| `socket.io-client` (via `socket.js`) | `frontend/src/services/socket.js`           | Singleton WebSocket connection                   |
| `mongoose` Booking model          | `backend/src/models/Booking.js`                | Unique index for atomic double-booking prevention|
| `mongoose` Expert model           | `backend/src/models/Expert.js`                 | Expert profile data                              |
| Express booking controller        | `backend/src/controllers/bookingController.js` | API logic for `createBooking`, `getBookedSlots`  |
| Express expert controller         | `backend/src/controllers/expertController.js`  | API logic for `getExpertById`                    |
| Socket.io server setup            | `backend/src/app.js` (lines 41–75)             | Room-based real-time broadcast infrastructure    |
| `ui-avatars.com`                  | External CDN                                   | Fallback avatar generation from expert name      |

---

## 3. Context References

### Existing Files Modified / Consumed

| File | Role | Key Lines |
|------|------|-----------|
| `frontend/src/pages/ExpertDetail.jsx` | **Primary** — the entire feature lives here | 1–477 |
| `frontend/src/services/api.js` | HTTP client; exports `fetchExpertById`, `fetchBookedSlots`, `createBooking` | 42, 53, 68 |
| `frontend/src/services/socket.js` | Singleton `io()` connection; transports forced to `websocket` | 23–26 |
| `frontend/src/App.jsx` | Route registration: `<Route path="/expert/:id" element={<ExpertDetail />} />` | 44 |
| `frontend/src/components/ExpertCard.jsx` | Navigation source — `<Link to={/expert/${expert._id}}>` | 90 |
| `backend/src/controllers/bookingController.js` | `createBooking` (conflict check + Socket emit), `getBookedSlots` | 17–83, 189–214 |
| `backend/src/controllers/expertController.js` | `getExpertById` — returns full expert document by MongoDB `_id` | 79–102 |
| `backend/src/models/Booking.js` | Compound unique partial index; IST-aware `parseISTSessionTime` helper; pre-save time-lock hook | 129–135, 78–81, 88–99 |
| `backend/src/models/Expert.js` | Schema for expert profile data surfaced in the sidebar | 10–65 |
| `backend/src/routes/bookingRoutes.js` | `GET /booked-slots/:expertId/:date`, `POST /` | 23, 51 |
| `backend/src/routes/expertRoutes.js` | `GET /:id` | (expertRoutes.js line mapping `getExpertById`) |
| `backend/src/app.js` | `io.to(expert).emit(...)` infrastructure; `socket.join(expertId)` room handler | 56–75 |

### New Files Created

No new files were created for this feature. All logic is consolidated in `ExpertDetail.jsx`. The backend controllers and models existed and were extended in-place.

### Documentation References

| Document | Relevance |
|----------|-----------|
| `docs/SkillSync_PRD.md` | User stories BK-01, BK-02, LO-01; Risk matrix (socket disconnect, UI state desync) |
| `docs/ROADMAP.md` | Phase 1 MVP scope confirmation |
| `GEMINI.md` | Architecture overview; IST & double-booking critical requirements |
| `AGENTS.md` | Coding conventions: PascalCase pages, camelCase service exports, CommonJS backend |

---

## 4. Patterns Followed

### Naming Conventions

- **Page component:** `ExpertDetail` — PascalCase per project convention (`AGENTS.md`).
- **Service functions:** `fetchExpertById`, `fetchBookedSlots`, `createBooking` — lower camelCase per project convention.
- **State variables:** descriptive camelCase: `bookedSlots`, `selectedDate`, `selectedSlot`, `isSubmitting`, `formData`.
- **Helper function:** `isSlotInPast` — boolean-returning helpers prefixed with `is`.
- **Event handlers:** `handleBooking` — event handlers prefixed with `handle`.
- **Socket events:** `snake_case` strings matching server-side event names: `join_expert_room`, `slot_booked`, `slot_released`.

### Module System

- **Frontend:** ES Modules (`import`/`export`) throughout.
- **Backend:** CommonJS (`require`/`module.exports`) throughout per `AGENTS.md`.

### Component Structure Pattern

```
ExpertDetail.jsx
├── Imports (React hooks, router, services, lucide icons)
├── State declarations (7 useState calls)
├── isSlotInPast() helper
├── timeSlots[] constant
├── useEffect #1: expert fetch + socket room join + socket listeners
├── useEffect #2: booked slots fetch (re-runs on date change)
├── handleBooking() async form handler
├── Render: loading state
├── Render: expert-not-found error state
├── Render: success confirmation state
└── Render: main two-column booking UI
```

### Error Handling Pattern

- **Network errors:** caught in `try/catch` blocks inside `async` functions.
- **Expert not found:** graceful `null` guard renders a user-friendly "profile not found" screen with a navigation escape hatch.
- **Booking conflict:** `catch` block reads `err.response?.data?.error` with a safe fallback string `'Booking failed'`, displayed via `alert()`.
- **Image load error:** `onError` handler on `<img>` falls back to `ui-avatars.com` URL, with `e.target.onerror = null` to prevent infinite error loops.
- **Backend double-booking (race condition):** MongoDB error code `11000` (duplicate key) is caught separately in `bookingController.js` (line 71–76) and returns a distinct `400` with a human-readable message.

### Logging Pattern

- Backend controllers use `console.error('Error in createBooking:', error)` (line 64) — prefixed with the function name for easy grep.
- Frontend does not log to console in the happy path; errors are caught and shown to the user via `alert()`.

### Real-Time Pattern

- Socket.io uses **room-based broadcasting**: each expert page client joins a room keyed by `expertId` via `socket.emit('join_expert_room', id)`.
- The server emits `slot_booked` / `slot_released` only `io.to(expert)`, not globally, limiting blast radius.
- Listeners are registered inside `useEffect` and cleaned up in the return function (`socket.off(...)`) to prevent listener accumulation on re-renders.

---

## 5. Architecture & Data Flow

### Component Data Flow Diagram

```
ExpertCard (list page)
  └─ <Link to="/expert/:id"> ──────────────────────────────────────► ExpertDetail mounts
                                                                              │
                                                           ┌──────────────────┼──────────────────┐
                                                           │                  │                  │
                                                   fetchExpertById()   fetchBookedSlots()   socket.emit(
                                                   GET /experts/:id    GET /bookings/         'join_expert_room', id)
                                                           │           booked-slots/:id/:date   │
                                                           ▼                  ▼                  │
                                                       setExpert()    setBookedSlots()           │
                                                                                                 │
                                                                              ◄──────────────────┘
                                                                         socket.on('slot_booked')
                                                                         → setBookedSlots(prev => [...prev, slotTime])
                                                                         socket.on('slot_released')
                                                                         → setBookedSlots(prev => prev.filter(...))

User selects date ──► setSelectedDate() ──► useEffect #1 re-runs (new socket listener with new date)
                                       ──► useEffect #2 re-runs ──► new fetchBookedSlots() call

User selects slot ──► setSelectedSlot()

User submits form ──► handleBooking()
                         └─ createBooking() POST /bookings
                               ├─ 201 Created ──► setSuccess(true) ──► setTimeout(navigate('/my-bookings'), 3000)
                               └─ 400/500     ──► alert(error message)
```

### Backend Booking Request Flow

```
POST /bookings
      │
      ▼
bookingController.createBooking()
      │
      ├─ 1. Booking.findOne({ expert, bookingDate, slotTime, status: {$ne:'Cancelled'} })
      │       ├─ Found  ──► 400 "This time slot is already booked."
      │       └─ Not Found ──► continue
      │
      ├─ 2. Booking.create({ ... })
      │       ├─ Success ──► io.to(expert).emit('slot_booked', { bookingDate, slotTime })
      │       │              ──► 201 { success: true, data: booking }
      │       └─ Error code 11000 (race condition) ──► 400 "Double booking detected."
      │
      └─ 3. catch(error) ──► 500 "Server Error"
```

### Socket.io Room Architecture

```
Client A opens /expert/abc123
  └─ socket.emit('join_expert_room', 'abc123')
       └─ server: socket.join('abc123')  [app.js:67]

Client B opens /expert/abc123
  └─ socket.emit('join_expert_room', 'abc123')
       └─ server: socket.join('abc123')

Client B books slot "14:00" on 2026-05-25
  └─ createBooking() succeeds
       └─ io.to('abc123').emit('slot_booked', { bookingDate: '2026-05-25', slotTime: '14:00' })
            └─ Client A's listener: setBookedSlots(prev => [...prev, '14:00'])
                 └─ Slot "14:00" button renders as disabled immediately
```

---

## 6. Implementation Plan

### Phase 1 — Foundation

> Goal: Establish routing, static data structures, and initial state shape before any API or Socket.io work.

---

#### Task 1.1 — Register the Route in App.jsx

**IMPLEMENT:**
Open `frontend/src/App.jsx`. Add the import for `ExpertDetail` and register the route under `/expert/:id`. This must use a dynamic segment (`:id`) so `useParams()` can extract the MongoDB ObjectId.

```jsx
// frontend/src/App.jsx (line 16 already present)
import ExpertDetail from './pages/ExpertDetail';

// Inside <Routes> (line 44)
<Route path="/expert/:id" element={<ExpertDetail />} />
```

**PATTERN:** Route path uses kebab-case prefix `/expert/` matching the resource name, identical to REST convention for `GET /experts/:id`.

**GOTCHA:** Do **not** use `/experts/:id` (plural) for the frontend route — this conflicts visually with the listing page at `/experts`. The frontend uses the singular `/expert/:id` while the backend API uses `/experts/:id`. Both are intentional and correct.

**VALIDATE:**
```bash
grep -n "expert/:id" frontend/src/App.jsx
# Expected: line 44 with <Route path="/expert/:id" ...>
```

---

#### Task 1.2 — Declare Component State

**IMPLEMENT:**
At the top of the `ExpertDetail` function body in `frontend/src/pages/ExpertDetail.jsx`, declare all seven state variables before any side effects or helpers.

```jsx
// ExpertDetail.jsx lines 33–51
const [expert, setExpert] = useState(null);
const [loading, setLoading] = useState(true);
const [bookedSlots, setBookedSlots] = useState([]);
const [selectedDate, setSelectedDate] = useState(() => {
  const now = new Date();
  const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return istNow.toISOString().split('T')[0];
});
const [selectedSlot, setSelectedSlot] = useState('');
const [formData, setFormData] = useState({
  userName: '',
  userEmail: '',
  userPhone: '+91 ',
  notes: ''
});
const [isSubmitting, setIsSubmitting] = useState(false);
const [success, setSuccess] = useState(false);
```

**PATTERN:** State is co-located in the single page component. No global state management (Redux/Context) is used — this is appropriate for a self-contained booking flow that doesn't need to share slot data with sibling routes.

**IMPORTS:**
```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
```

**GOTCHA — IST date initialization:**
The `selectedDate` initializer uses a lazy state function (arrow function passed to `useState`) to avoid recalculating the IST date on every render. The trick is:

```js
const now = new Date();  // UTC time from JS engine
const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
// 5.5 hours = 5 * 3600000 + 0.5 * 3600000 = 19800000 ms
return istNow.toISOString().split('T')[0];
// toISOString() always returns UTC representation.
// Since we manually added 5.5hr, the "UTC" of istNow = IST wall-clock time.
// Splitting on 'T' gives us the YYYY-MM-DD in IST.
```

This avoids relying on `Intl.DateTimeFormat` or the browser's locale, which could return a different date at midnight depending on the user's system timezone. Since SkillSync is India-specific (`GEMINI.md` localization requirement), all users are assumed to be in IST.

**GOTCHA — Phone pre-fill:**
`userPhone` is initialized to `'+91 '` (with a trailing space). This is deliberate: the display format requires a space between `+91` and the 10-digit number. See Task 3.3 for the full formatter logic.

---

#### Task 1.3 — Define the `timeSlots` Constant

**IMPLEMENT:**
Declare `timeSlots` as a constant array inside the component body (after state, before effects). Each slot has a `value` (24h format stored in DB) and a `label` (12h AM/PM format shown in UI).

```jsx
// ExpertDetail.jsx lines 80–94
const timeSlots = [
  { value: '09:00', label: '09:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '14:00', label: '02:00 PM' },
  { value: '15:00', label: '03:00 PM' },
  { value: '16:00', label: '04:00 PM' },
  { value: '17:00', label: '05:00 PM' },
  { value: '18:00', label: '06:00 PM' },
  { value: '19:00', label: '07:00 PM' },
  { value: '20:00', label: '08:00 PM' },
  { value: '21:00', label: '09:00 PM' },
  { value: '22:00', label: '10:00 PM' },
];
```

**PATTERN:** 13:00 (1:00 PM) is intentionally absent — this creates a 1-hour lunch break gap between 12:00 PM and 2:00 PM. This is not a bug; it is a hardcoded "no-book" window by design. The backend has no awareness of this gap; the slot simply never appears in the UI.

**GOTCHA — 24h vs 12h:**
The `value` field (`'14:00'`) is what gets sent to the backend and stored in MongoDB. The `label` field (`'02:00 PM'`) is display-only and never sent in the API request. This separation prevents AM/PM confusion on the server side.

---

### Phase 2 — Core

> Goal: Implement the IST time utilities, data-fetching effects, Socket.io integration, and the booking submission handler.

---

#### Task 2.1 — Implement `isSlotInPast()` Helper

**IMPLEMENT:**
Define `isSlotInPast` inside the component body, before the `useEffect` calls, at `ExpertDetail.jsx` lines 60–77.

```js
const isSlotInPast = (slotTime) => {
  const now = new Date();
  const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const todayStr = istNow.toISOString().split('T')[0];

  // If selected date is not today, it can't be in the past
  if (selectedDate !== todayStr) return false;

  const [sHour, sMinute] = slotTime.split(':').map(Number);

  // KEY TRICK: Because we manually added the 5.5-hour UTC offset to create istNow,
  // calling .getUTCHours() on istNow returns the IST hours (not UTC hours).
  const nowHour = istNow.getUTCHours();
  const nowMinute = istNow.getUTCMinutes();

  if (nowHour > sHour) return true;
  if (nowHour === sHour && nowMinute >= sMinute) return true;
  return false;
};
```

**Deep Explanation of the UTC Trick:**

JavaScript `Date` objects always store milliseconds since the Unix epoch in UTC. When you call `new Date().getUTCHours()`, you get the current hour in UTC. When you call `new Date().getHours()`, you get the hour in the browser's local timezone — which is unreliable for a geographically targeted app.

By constructing `istNow = new Date(now.getTime() + 19800000)`, you are creating a Date object whose UTC representation equals what IST wall-clock time currently is. Therefore:

```
now (UTC)    = 12:30 UTC
istNow (UTC) = 18:00 UTC  (because 12:30 + 5:30 = 18:00)
istNow.getUTCHours() = 18  ← This IS the IST hour (6 PM IST)
```

This is more portable than `Intl.DateTimeFormat` in environments with locked locales, and more predictable than `getHours()` on a system clock that might be set to UTC or any other timezone.

**GOTCHA — Boundary condition at exact minute:**
The check `nowMinute >= sMinute` means a slot is considered "passed" at the exact moment it begins. A user cannot book the `09:00` slot at `09:00:00` IST — they must book it before `09:00:00`. This is intentional: booking at the exact start time gives zero prep time.

**GOTCHA — Future dates:**
If `selectedDate !== todayStr`, `isSlotInPast` immediately returns `false`. This means all slots appear available for any future date (regardless of time). Whether they are actually available is determined solely by the `bookedSlots` array fetched from the backend.

---

#### Task 2.2 — Implement Expert Data Fetch + Socket.io Effect

**IMPLEMENT:**
The first `useEffect` in `ExpertDetail.jsx` (lines 100–138) handles three responsibilities: fetching expert data, joining the Socket.io room, and registering real-time slot update listeners.

```jsx
useEffect(() => {
  const getExpertData = async () => {
    try {
      const { data } = await fetchExpertById(id);
      setExpert(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  getExpertData();

  // Join expert-specific Socket.io room
  socket.emit('join_expert_room', id);

  // Real-time: another user booked a slot
  socket.on('slot_booked', (data) => {
    if (data.bookingDate === selectedDate) {
      setBookedSlots((prev) => [...prev, data.slotTime]);
    }
  });

  // Real-time: a booking was cancelled, releasing the slot
  socket.on('slot_released', (data) => {
    if (data.bookingDate === selectedDate) {
      setBookedSlots((prev) => prev.filter(slot => slot !== data.slotTime));
    }
  });

  // Cleanup: remove listeners on unmount or dependency change
  return () => {
    socket.off('slot_booked');
    socket.off('slot_released');
  };
}, [id, selectedDate]);
```

**PATTERN — `data.data` access:**
`fetchExpertById()` calls `GET /experts/:id` which responds with `{ success: true, data: expert }`. Axios wraps the body in its own `.data` property. Hence `response.data.data` is the actual expert object:
- `response` → Axios response object
- `response.data` → `{ success: true, data: {...} }` (parsed JSON)
- `response.data.data` → the expert document

**PATTERN — Dependency array `[id, selectedDate]`:**
Both `id` and `selectedDate` are in the dependency array because:
- `id` changes if the user navigates directly from one expert to another (React Router keeps the component mounted).
- `selectedDate` changes when the user picks a new date — the socket listeners need to re-register with the current `selectedDate` in their closure to correctly filter `slot_booked` events.

**GOTCHA — Socket listener accumulation:**
Without `socket.off('slot_booked')` in the cleanup function, each re-run of this effect (triggered by a date change) would add an additional listener. After 5 date changes, there would be 5 `slot_booked` listeners, each calling `setBookedSlots` — causing state to be appended 5 times per event. The cleanup function prevents this.

**GOTCHA — `socket.off()` removes ALL listeners for that event:**
`socket.off('slot_booked')` (with no second argument) removes every registered listener for `'slot_booked'`. This is acceptable here because this component is the only place these listeners are registered. If other components ever need their own `slot_booked` listeners, the cleanup must pass the specific handler function as a second argument: `socket.off('slot_booked', handlerRef)`.

**IMPORTS:**
```jsx
import { fetchExpertById, fetchBookedSlots, createBooking } from '../services/api';
import socket from '../services/socket';
```

---

#### Task 2.3 — Implement Booked Slots Fetch Effect

**IMPLEMENT:**
The second `useEffect` (lines 143–156) is a focused, single-responsibility effect that fetches the booked slots array from the API whenever the expert ID or selected date changes.

```jsx
useEffect(() => {
  const getBooked = async () => {
    try {
      const { data } = await fetchBookedSlots(id, selectedDate);
      setBookedSlots(data.data);  // data.data is string[] e.g. ["10:00", "14:00"]
    } catch (err) {
      console.error(err);
    }
  };
  getBooked();
}, [id, selectedDate]);
```

**Why two separate effects?**
Effect #1 fetches expert data (runs once when `id` changes) and manages socket room membership (must re-run when `selectedDate` changes to refresh listener closures). Effect #2 fetches booked slots (must re-run when either `id` or `selectedDate` changes). Separating them avoids re-fetching expert profile data every time the user changes the date, which would be wasteful.

**API Contract:**
`GET /bookings/booked-slots/:expertId/:date` → `{ success: true, data: ["10:00", "14:00"] }`
The `data.data` array contains only the `slotTime` strings of non-cancelled bookings for that expert on that date (`bookingController.js` lines 197–204).

**GOTCHA — Race between two effects:**
Both effects run on mount. Effect #1 runs first but they're both asynchronous. If Effect #2 resolves before Effect #1's `getExpertData()`, `setLoading(false)` hasn't been called yet — but `setBookedSlots()` updating an empty array is harmless. The loading gate (`if (loading) return <Loader2>`) ensures the main UI doesn't render until Effect #1 resolves.

---

#### Task 2.4 — Implement `handleBooking` Submission Handler

**IMPLEMENT:**
`handleBooking` is the `onSubmit` handler for the booking `<form>` element (lines 164–186).

```js
const handleBooking = async (e) => {
  e.preventDefault();
  if (!selectedSlot) return;  // Guard: submit button is also disabled, but defensive check

  try {
    setIsSubmitting(true);
    await createBooking({
      expert: id,                          // MongoDB ObjectId string from URL
      bookingDate: selectedDate,           // "YYYY-MM-DD" string
      slotTime: selectedSlot,              // "HH:mm" string e.g. "14:00"
      ...formData,                         // userName, userEmail, userPhone, notes
      userPhone: formData.userPhone.replace(/\s/g, '')  // Strip display space
    });
    setSuccess(true);
    setTimeout(() => navigate('/my-bookings'), 3000);
  } catch (err) {
    alert(err.response?.data?.error || 'Booking failed');
  } finally {
    setIsSubmitting(false);
  }
};
```

**PATTERN — Phone number normalization:**
The UI stores `userPhone` as `'+91 9876543210'` (with a space for readability). The backend `Booking.js` model validates against `/^\+91[0-9]{10}$/` — no space allowed. The `replace(/\s/g, '')` call in `handleBooking` strips all whitespace before sending, converting `'+91 9876543210'` → `'+919876543210'`.

Note: the comment in the original code incorrectly says the output is `'+91 9876543210'`; the regex strips the space, so the actual output is `'+919876543210'`.

**PATTERN — Spread then override:**
`{ ...formData, userPhone: formData.userPhone.replace(...) }` spreads all `formData` keys first, then overrides `userPhone` with the sanitized version. This is idiomatic and avoids destructuring every field manually.

**PATTERN — `finally` for `isSubmitting`:**
`setIsSubmitting(false)` is in `finally` so it always runs — whether the booking succeeds or fails. Without this, a failed booking would leave the submit button permanently disabled.

**GOTCHA — Alert-based error UI:**
Errors are surfaced via `alert()`, which is a blocking browser dialog. This is functional but not polished. See [Known Limitations](#13-known-limitations--future-improvements) for the recommended upgrade path to inline toast/banner errors.

---

### Phase 3 — Integration

> Goal: Build the complete JSX render tree including the profile sidebar, slot selection grid, and guest information form.

---

#### Task 3.1 — Implement Conditional Render States

**IMPLEMENT:**
Before the main `return`, add three early-return render branches for the three non-standard states (lines 188–220 of `ExpertDetail.jsx`).

**Loading State (lines 189–193):**
```jsx
if (loading) return (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
  </div>
);
```
Uses `Loader2` from `lucide-react`. The `animate-spin` class is a Tailwind utility for a CSS `rotate` animation.

**Expert Not Found (lines 196–201):**
```jsx
if (!expert) return (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <p className="text-xl font-bold text-gray-400">Expert profile not found.</p>
    <button onClick={() => navigate('/')} className="mt-4 text-blue-600 font-bold">
      Return to Explore
    </button>
  </div>
);
```
This triggers when `loading` is `false` but `expert` is still `null` — meaning the API returned a 404 or the network request failed without throwing (e.g., non-JSON error body). Navigation goes to `/` (Home), not `/experts`, because the user may have arrived via a shared link.

**Success Confirmation (lines 203–220):**
```jsx
if (success) return (
  <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-md w-full border border-green-50">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
        <CheckCircle className="w-12 h-12 text-green-600" />
      </div>
      <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Confirmed!</h2>
      <p className="text-lg text-gray-600 mb-8 leading-relaxed">
        Your session with <span className="font-bold text-gray-900">{expert.name}</span> is set
        for <span className="font-bold text-blue-600">{selectedDate}</span> at{' '}
        <span className="font-bold text-blue-600">{selectedSlot}</span>.
      </p>
      <div className="flex items-center justify-center gap-2 text-gray-400 text-sm italic">
        <Loader2 className="w-4 h-4 animate-spin" />
        Redirecting to your history...
      </div>
    </div>
  </div>
);
```

**PATTERN — `expert.name` safety:**
`expert` is accessed safely here because the `if (!expert)` guard above this render branch ensures `expert` is non-null by the time the `success` branch is checked.

**PATTERN — `animate-bounce` on CheckCircle:**
The bouncing green circle provides kinetic feedback that the booking action was processed — reinforcing the confirmation without requiring the user to read closely.

**IMPORTS (lucide-react):**
```jsx
import {
  Calendar as CalendarIcon, Clock, User, Mail, Phone,
  MessageSquare, Loader2, ChevronLeft, CheckCircle, ShieldCheck, Star
} from 'lucide-react';
```
Note `Calendar` is aliased as `CalendarIcon` to avoid collision with any native `Calendar` global.

---

#### Task 3.2 — Implement the Expert Profile Sidebar (Left Column)

**IMPLEMENT:**
The main render output uses a 12-column CSS Grid layout (`lg:grid-cols-12`). The left column occupies 4 columns (`lg:col-span-4`) and is `sticky top-32` — it stays fixed while the right column scrolls.

**Image with Fallback (lines 239–247):**
```jsx
<img
  src={expert.profileImage ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=512`
  }
  alt={expert.name}
  className="w-full h-80 object-cover"
  onError={(e) => {
    e.target.onerror = null;  // Prevent infinite error loop
    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=512`;
  }}
/>
```

**Two-layer image fallback strategy:**
1. **Layer 1 (JSX `src`):** If `expert.profileImage` is falsy (empty string, `null`, or the default `'https://placehold.co/150'` which was set in the model but may be overridden), use `ui-avatars.com`.
2. **Layer 2 (`onError`):** If `expert.profileImage` was a non-empty URL but the image fails to load (broken URL, CDN down, 404), `onError` fires and replaces `src` with `ui-avatars.com`. `e.target.onerror = null` prevents the `ui-avatars.com` URL itself from causing another `onError` if it were to fail.

`ui-avatars.com` parameters:
- `name=`: URL-encoded expert name → generates initials-based avatar
- `background=e0e7ff`: light indigo background (matches brand palette)
- `color=4f46e5`: deep indigo text (Tailwind `indigo-600`)
- `size=512`: high-resolution for the large sidebar photo

**Stats display (lines 261–276):**
Three stat cards: Experience (years), Hourly Rate (₹ INR — note the Rupee symbol, satisfying `LO-01`), and Global Rating (rendered with a `Star` icon and `expert.rating.toFixed(1)` for consistent 1-decimal display).

**GOTCHA — `expert.rating.toFixed(1)` safety:**
If `expert.rating` were somehow `null` or `undefined`, `.toFixed()` would throw. This is prevented by the `Booking.js` model's `default: 4.5` and `min: 1, max: 5` validators on the Expert schema, making `null` impossible for any properly seeded expert.

---

#### Task 3.3 — Implement Date Picker & Slot Selection Grid (Right Column, Part 1)

**IMPLEMENT:**
The first card in the right column handles date selection and slot rendering.

**Date Input (lines 299–311):**
```jsx
<input
  id="bookingDate"
  type="date"
  min={(() => {
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return istNow.toISOString().split('T')[0];
  })()}
  value={selectedDate}
  onChange={(e) => setSelectedDate(e.target.value)}
/>
```

The `min` attribute is computed inline with an IIFE (Immediately Invoked Function Expression) using the same IST offset trick. This prevents the browser's native date picker from allowing the user to select a past date.

**GOTCHA — `min` IIFE recalculates on every render:**
Because `min` is computed in an IIFE within JSX, it re-evaluates on every render. This is a minor inefficiency but is negligible in practice since the component doesn't re-render at high frequency. A `useMemo` could optimize this but would add complexity for marginal gain.

**GOTCHA — `min` does not auto-advance at midnight:**
If the user opens the page before midnight IST and leaves it open, the `min` date will be yesterday's date by 12:01 AM IST. This is a known limitation — see [Known Limitations](#13-known-limitations--future-improvements).

**Slot Grid (lines 316–352):**
```jsx
{timeSlots.map((slot) => {
  const isBooked = bookedSlots.includes(slot.value);
  const isPassed = isSlotInPast(slot.value);
  const isDisabled = isBooked || isPassed;

  return (
    <button
      key={slot.value}
      disabled={isDisabled}
      onClick={() => setSelectedSlot(slot.value)}
      className={`
        group relative py-5 rounded-2xl font-black transition-all duration-300
        ${isDisabled
          ? 'bg-gray-100 text-gray-300 cursor-not-allowed grayscale'
          : selectedSlot === slot.value
            ? 'bg-blue-600 text-white shadow-2xl shadow-blue-400 scale-105'
            : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-blue-500 hover:text-blue-600'
        }
      `}
    >
      <span className="flex items-center justify-center gap-2">
        {!isDisabled && <Clock className="w-4 h-4" />}
        {slot.label}
      </span>
      {isDisabled && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-tighter text-gray-400/50 -rotate-12">
          {isBooked ? 'Booked' : 'Passed'}
        </span>
      )}
    </button>
  );
})}
```

**Three visual states for each slot button:**
1. **Disabled** (`isBooked || isPassed`): gray background, muted text, `cursor-not-allowed`, overlaid rotated label "Booked" or "Passed".
2. **Selected** (`selectedSlot === slot.value` and not disabled): solid blue background, white text, `scale-105` lift effect with drop shadow.
3. **Available** (default): white background with light border; hover state adds blue border and text.

**PATTERN — `isBooked` uses `Array.includes()`:**
`bookedSlots` is a `string[]` like `["10:00", "14:00"]`. `slot.value` is also a string like `"10:00"`. `Array.includes()` performs strict equality comparison — this works correctly for string comparisons.

---

#### Task 3.4 — Implement Guest Information Form (Right Column, Part 2)

**IMPLEMENT:**
The second card in the right column is the `<form>` element with `onSubmit={handleBooking}`.

**Full Name field (lines 362–377):** Standard controlled text input, `required`, spreads into `formData.userName`.

**Email field (lines 378–393):** `type="email"` with HTML5 native validation + `required`. Validates format before form submission.

**Phone Number field with Indian formatter (lines 397–423):**
```jsx
<input
  type="tel"
  pattern="\+91\s[0-9]{10}"
  title="Please enter a 10-digit number after the +91 prefix"
  value={formData.userPhone}
  onChange={(e) => {
    let val = e.target.value.replace(/\s/g, '');      // Strip all spaces
    if (!val.startsWith('+91')) {
      val = '+91' + val.replace(/^\+?9?1?/, '');      // Force +91 prefix
    }
    let displayVal = val.slice(0, 13);                // Limit to +91XXXXXXXXXX (13 chars)
    if (displayVal.length > 3) {
      displayVal = displayVal.slice(0, 3) + ' ' + displayVal.slice(3);  // Insert space after +91
    }
    setFormData({...formData, userPhone: displayVal});
  }}
/>
```

**Step-by-step phone formatter logic:**

| User input event | `e.target.value` | After `replace(/\s/g,'')` | After prefix check | After `slice(0,13)` | After space insertion | Stored as |
|---|---|---|---|---|---|---|
| User types `9` into `+91 ` | `+91 9` | `+919` | `+919` (already starts with +91) | `+919` | `+91 9` | `'+91 9'` |
| User types `876543210` | `+91 9876543210` | `+919876543210` | `+919876543210` | `+919876543210` | `+91 9876543210` | `'+91 9876543210'` |
| User pastes `9876543210` | `+91 9876543210` (pre-fill still there) | — | — | — | — | — |
| User deletes `+91 ` | `` | `` | `+91` (prefix re-added) | `+91` | `+91` | `'+91'` |
| User tries to type `+44 7...` | `+44 7...` | `+447...` | `+91` + leftover digits | limited to 13 | `+91 ...` | corrected |

**PATTERN — The `slice(0,13)` limit:**
`+91` is 3 characters. A 10-digit Indian number is 10 characters. Total: 13 characters (`+919876543210`). The display version (`+91 9876543210`) is 14 characters (includes the space). The slice is applied *before* the space is inserted, so `slice(0,13)` on `+919876543210` gives the correct 13-char string, then inserting the space yields the 14-char display string.

**HTML5 `pattern` attribute:**
`pattern="\+91\s[0-9]{10}"` validates the *display* format `+91 9876543210` (with space). The browser validates this on form submit. The backend validates `+919876543210` (without space) after the `handleBooking` stripping.

**Notes field (lines 425–439):** Optional `type="text"` input. No `required` attribute. Maps to the `notes` field in the Booking document.

**Submit Button (lines 444–464):**
The button has three display states based on `isSubmitting` and `selectedSlot`:
1. `isSubmitting`: blue → disabled gray with "Finalizing Booking..." + spinner
2. No slot selected (`!selectedSlot`): disabled gray, text "Select a Slot Above"
3. Slot selected + idle: active blue, text "Secure My Appointment"

---

### Phase 4 — Testing & Hardening

> Goal: Validate that all states, edge cases, and real-time scenarios behave correctly.

---

#### Task 4.1 — Manual Smoke Test: Happy Path

**VALIDATE:**
1. Start backend: `cd backend && node src/app.js`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:5173/expert/<valid-expert-id>`
4. Verify: Loading spinner appears, then expert profile loads in sidebar.
5. Verify: Date picker defaults to today's IST date.
6. Verify: Past slots (before current IST hour) are shown as "Passed" and non-clickable.
7. Select an available future slot → button turns blue with `scale-105`.
8. Fill in all form fields with Name, valid email, `+91 9876543210`, and optional notes.
9. Click "Secure My Appointment".
10. Verify: Button becomes "Finalizing Booking..." with spinner.
11. Verify: Success screen appears with expert name, date, and slot displayed correctly.
12. Verify: After 3 seconds, page redirects to `/my-bookings`.
13. Verify: The booking appears in "My Bookings" with status "Confirmed".

---

#### Task 4.2 — Manual Test: Real-Time Slot Update

**VALIDATE:**
1. Open two browser tabs to the same `/expert/:id` URL.
2. In Tab A, note an available slot (e.g., "03:00 PM").
3. In Tab B, book that slot (complete the full form and submit).
4. Watch Tab A without refreshing.
5. Verify: The "03:00 PM" slot in Tab A becomes grayed out with "Booked" overlay within 1–2 seconds of Tab B's booking.

---

#### Task 4.3 — Manual Test: Double Booking (Race Condition)

**VALIDATE (requires two simultaneous POST requests):**
```bash
# Terminal 1
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"<id>","bookingDate":"2026-05-30","slotTime":"15:00","userName":"Alice","userEmail":"alice@test.com","userPhone":"+919876543210","notes":""}'

# Terminal 2 (run simultaneously)
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"<id>","bookingDate":"2026-05-30","slotTime":"15:00","userName":"Bob","userEmail":"bob@test.com","userPhone":"+919123456789","notes":""}'
```
Expected: One request returns `201` with booking data. The other returns `400` with either `"This time slot is already booked."` (application-level check) or `"Double booking detected. This slot was just taken."` (MongoDB duplicate key error code 11000).

---

#### Task 4.4 — Manual Test: Expert Not Found

**VALIDATE:**
```
http://localhost:5173/expert/000000000000000000000000
```
Expected: Loading spinner, then "Expert profile not found." message with "Return to Explore" button. Clicking the button navigates to `/`.

---

#### Task 4.5 — Manual Test: Phone Formatter Edge Cases

| Input action | Expected display in input |
|---|---|
| Clear everything including `+91 ` | `+91` (prefix re-asserted) |
| Type `9876543210` | `+91 9876543210` |
| Type `09876543210` (11 digits) | `+91 9876543210` (truncated to 10 after prefix) |
| Paste `+91 9876543210` | `+91 9876543210` (accepted as-is) |
| Paste `+44 7911123456` | `+91 7911123456` (prefix forced to +91) |

---

## 7. Testing Strategy

### Unit Tests (Recommended — not yet implemented)

**File:** `frontend/src/pages/ExpertDetail.test.jsx`

| Test | Description | Key Assertions |
|------|-------------|----------------|
| `isSlotInPast - future date` | For any date after today, all slots return `false` | `isSlotInPast('09:00')` with `selectedDate` = tomorrow → `false` |
| `isSlotInPast - today, past hour` | A slot at 09:00 when IST time is 14:00 returns `true` | Mock `Date.now()` to 14:30 IST |
| `isSlotInPast - today, exact minute` | A slot at 14:00 when IST time is 14:00:30 returns `true` | `nowMinute >= sMinute` boundary |
| `isSlotInPast - today, future slot` | A slot at 18:00 when IST time is 14:00 returns `false` | `nowHour < sHour` |
| `phone formatter - prefix protection` | Deleting `+91 ` re-adds `+91` | Simulate `onChange` with empty string |
| `phone formatter - space insertion` | Digits after `+91` get a space separator | Input `+919876543210` → stored `+91 9876543210` |
| `phone formatter - max length` | More than 10 digits after `+91` are truncated | Input 11 digits → stored only 10 |
| `handleBooking - no slot guard` | Submitting without `selectedSlot` does nothing | `createBooking` not called |
| `success state - redirect timer` | After `setSuccess(true)`, `navigate` called after 3s | Mock `setTimeout`, assert `navigate('/my-bookings')` |

**File:** `backend/src/controllers/bookingController.test.js`

| Test | Description | Key Assertions |
|------|-------------|----------------|
| `createBooking - success` | New booking is created and socket event emitted | `201` status, `Booking.create` called, `io.to().emit('slot_booked')` |
| `createBooking - conflict` | Existing non-cancelled booking blocks new one | `400` with `'This time slot is already booked.'` |
| `createBooking - race condition` | MongoDB `error.code === 11000` handled | `400` with `'Double booking detected.'` |
| `getBookedSlots - returns slot times` | Returns string array of booked slots | Array contains `slotTime` strings, excludes cancelled |
| `updateBookingStatus - time lock` | Cannot complete future session | `400` with time-lock error message |
| `updateBookingStatus - cancel emits slot_released` | Cancellation broadcasts socket event | `io.to().emit('slot_released')` called |

### Integration Tests (Recommended)

**File:** `backend/src/controllers/bookingController.integration.test.js`

| Test | Description |
|------|-------------|
| Full booking flow | POST booking → GET booked-slots for same date shows new slot → PATCH cancel → GET booked-slots shows slot removed |
| Concurrent booking (race) | Two simultaneous POSTs for same slot in a real Mongo instance — exactly one succeeds |

### Edge Cases to Verify

| Edge Case | Expected Behavior |
|-----------|-------------------|
| User navigates to `/expert/:id` with an invalid (non-ObjectId) ID | `findById` throws CastError → caught as `500` → "Expert profile not found" screen |
| User changes date while a previous `fetchBookedSlots` is in flight | React state update from the stale request may overwrite the new date's results — both effects run and the second one (for the new date) should win if it resolves last |
| `ui-avatars.com` itself is unreachable | The `onError` handler already pointed `src` to `ui-avatars.com`, so a second error would trigger `onError` again — but `e.target.onerror = null` prevents recursion; the broken image icon shows |
| Socket disconnects mid-session | `socket.on('slot_booked')` stops receiving events; user sees stale data. Mitigation: fetch fresh slots on reconnect (see Known Limitations) |
| User submits form at exact same time as backend slot is taken | Application-level `findOne` check may pass (both requests checked before either wrote), MongoDB unique index fires `11000` for the loser |
| Date picker browser timezone mismatch | `min` attribute computed in IST via offset prevents selecting past dates regardless of browser locale |
| Very long expert name | `ui-avatars.com` truncates long names to initials naturally; card layout uses `text-3xl` with `leading-tight` and wraps gracefully |

---

## 8. Validation Commands

```bash
# ─── Backend ──────────────────────────────────────────────────────────────────

# Start the backend server and verify startup
cd backend && node src/app.js
# Expected output: "Server running in development mode on port 5000"

# Verify GET /experts/:id endpoint
curl -s http://localhost:5000/experts/<valid-id> | python3 -m json.tool
# Expected: { "success": true, "data": { "name": "...", "category": "...", ... } }

# Verify GET /bookings/booked-slots/:expertId/:date
curl -s "http://localhost:5000/bookings/booked-slots/<expert-id>/2026-05-30" | python3 -m json.tool
# Expected: { "success": true, "data": [] } (or array of slot strings)

# Test booking creation
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "expert": "<expert-id>",
    "bookingDate": "2026-05-30",
    "slotTime": "15:00",
    "userName": "Test User",
    "userEmail": "test@example.com",
    "userPhone": "+919876543210",
    "notes": "Test booking"
  }' | python3 -m json.tool
# Expected: { "success": true, "data": { "_id": "...", "status": "Confirmed", ... } }

# ─── Frontend ─────────────────────────────────────────────────────────────────

# Install dependencies and start dev server
cd frontend && npm install && npm run dev
# Expected: "VITE vX.X.X  ready in Xms" with local URL

# Run ESLint
cd frontend && npm run lint
# Expected: No errors related to ExpertDetail.jsx

# Build for production
cd frontend && npm run build
# Expected: dist/ folder generated, no compilation errors

# ─── Route Check ──────────────────────────────────────────────────────────────

# Verify ExpertDetail route is registered
grep -n "expert/:id" frontend/src/App.jsx
# Expected line ~44: <Route path="/expert/:id" element={<ExpertDetail />} />

# Verify API service functions exist
grep -n "fetchExpertById\|fetchBookedSlots\|createBooking" frontend/src/services/api.js
# Expected: 3 matching export lines

# Verify socket connects to correct port
grep -n "localhost:5000" frontend/src/services/socket.js
# Expected: line 23

# Verify booking unique index in model
grep -n "unique" backend/src/models/Booking.js
# Expected: line 132 with unique: true
```

---

## 9. Acceptance Criteria

These map directly to PRD user stories.

### BK-01: Real-Time Slot Updates
- **Given** User A is viewing `/expert/:id` and User B books slot `14:00` on the same date
- **When** User B's booking is confirmed by the server
- **Then** User A's slot grid removes `14:00` from the available buttons (grayed out, "Booked" label) within 2 seconds, **without** a page refresh.

### BK-02: Atomic Booking (Double-Booking Prevention)
- **Given** User A and User B simultaneously `POST /bookings` for the same expert, date, and slot
- **When** both requests are processed
- **Then** exactly one returns `201 Created`; the other returns `400` with `"This time slot is already booked."` or `"Double booking detected."`. No duplicate booking document exists in MongoDB.

### LO-01: Indian Localization
- **Given** a user opens the Expert Detail page in any browser timezone
- **When** the page loads
- **Then** the date picker defaults to today's date in IST (UTC+5:30), and the phone input is pre-filled with `+91 `. All currency values are displayed as `₹X/hr`.

### Profile Display
- **Given** an expert with a valid `profileImage` URL
- **When** the page loads
- **Then** the expert's photo, name (overlay on image), category badge, bio, experience, hourly rate (₹), and rating (★ X.X) are all visible.

### Profile Fallback
- **Given** an expert with a broken or missing `profileImage`
- **When** the image fails to load
- **Then** the `onError` handler replaces it with a `ui-avatars.com` avatar generated from the expert's name, maintaining visual consistency.

### Booking Form Validation
- **Given** the user has not selected a time slot
- **When** the submit button is rendered
- **Then** the button displays "Select a Slot Above" and is `disabled` — the form cannot be submitted.

### Post-Booking Redirect
- **Given** the booking `POST` returns `201`
- **When** the success screen appears
- **Then** after exactly 3 seconds (`setTimeout 3000ms`), `navigate('/my-bookings')` is called and the user lands on the booking history page.

### Expert Not Found
- **Given** the URL contains an invalid or non-existent expert ID
- **When** `fetchExpertById` fails or returns `null`
- **Then** the user sees "Expert profile not found." with a "Return to Explore" button navigating to `/`.

---

## 10. Completion Checklist

### Frontend (`ExpertDetail.jsx`)
- [x] Route `/expert/:id` registered in `App.jsx`
- [x] `useParams()` extracts `id` correctly
- [x] IST-based `selectedDate` initialization
- [x] 7 state variables declared with correct initial values
- [x] `isSlotInPast()` implemented with UTC trick for IST hours
- [x] `timeSlots` array defined (13 slots, 09:00–22:00, no 13:00)
- [x] `useEffect #1`: expert fetch + socket room join + slot_booked/slot_released listeners
- [x] `useEffect #2`: booked slots fetch, re-runs on date change
- [x] Socket listener cleanup in effect return function
- [x] `handleBooking`: slot guard, isSubmitting flag, phone strip, success state, 3s redirect
- [x] Loading render state (Loader2 spinner)
- [x] Expert-not-found render state (navigate to `/`)
- [x] Success confirmation render state (CheckCircle + booking summary + spinner + redirect)
- [x] Left sidebar: sticky expert profile with photo, gradient overlay, category badge, name, bio, stats
- [x] Image primary URL + `onError` fallback to `ui-avatars.com`
- [x] `ui-avatars.com` fallback with `encodeURIComponent(expert.name)`
- [x] INR (₹) currency symbol for hourly rate
- [x] Back navigation button (ChevronLeft → navigate `/`)
- [x] Right column: date picker with IST `min` attribute
- [x] Right column: slot grid with `isBooked`, `isPassed`, `isDisabled` states
- [x] Slot buttons: disabled style, selected style, available/hover style
- [x] Slot buttons: "Booked"/"Passed" rotated overlay text
- [x] Phone input: pre-filled `+91 `, `onChange` formatter, `pattern`, `title`, `required`
- [x] Submit button: 3 display states (idle with slot, idle without slot, submitting)

### Backend
- [x] `GET /experts/:id` → `getExpertById` returns full expert document
- [x] `GET /bookings/booked-slots/:expertId/:date` → `getBookedSlots` returns `string[]`
- [x] `POST /bookings` → `createBooking` with conflict check + `Booking.create` + `io.emit('slot_booked')`
- [x] MongoDB `error.code === 11000` handled in `createBooking`
- [x] Booking schema compound unique partial index on `{expert, bookingDate, slotTime}` excluding Cancelled
- [x] Backend phone validation regex `/^\+91[0-9]{10}$/`

### Real-Time
- [x] `io.on('connection')` sets up `join_expert_room` handler in `app.js`
- [x] `io` instance set on `app` via `app.set('io', io)` for controller access
- [x] Socket transports locked to `['websocket']` in `socket.js`
- [x] `slot_booked` event emitted after successful booking
- [x] `slot_released` event emitted after booking cancellation

### Quality
- [x] `npm run lint` passes with no errors
- [x] `npm run build` succeeds (no TypeScript/Babel errors)
- [x] Manual smoke test: happy path booking flow
- [x] Manual test: real-time slot update across two tabs
- [x] Manual test: concurrent booking conflict returns `400`
- [x] Manual test: expert not found displays graceful error screen

---

## 11. Notes

### Design Decisions

#### DN-01: Single-Page Two-Step Flow vs. Multi-Step Wizard
**Decision:** Implement both slot selection and guest information on the same page scroll, rather than a true multi-step modal wizard.

**Rationale:** The booking flow has only two steps and relatively few form fields. A wizard introduces navigation complexity and back-button concerns. The single-scroll approach is faster for the user and simpler to implement. The visual separation between the "Choose Your Session" card and the "Guest Information" card provides sufficient UX clarity without a formal stepper component.

**Trade-off:** The user might fill in their details before selecting a slot, then try to submit. This is handled by disabling the submit button until `selectedSlot` is non-empty, showing "Select a Slot Above" as the button label.

#### DN-02: Hardcoded Time Slots vs. Dynamic Expert Availability
**Decision:** Use a static array of 13 hardcoded slots (09:00–22:00, no 13:00) rather than fetching expert-specific availability windows from the backend.

**Rationale:** Phase 1 MVP scope (`docs/ROADMAP.md`) does not include expert-managed calendars. All experts implicitly offer the same daily window. Hardcoding eliminates an additional API endpoint, a new database field on the Expert model, and a more complex availability management UI. The 13:00 gap serves as a universal lunch break.

**Trade-off:** Expert-specific availability is impossible. An expert who is only available in the evenings cannot configure that — their morning slots will appear as "Passed" only due to time (when today), but still available for booking on future dates. This is a known Phase 2 requirement.

#### DN-03: IST via UTC Offset vs. `Intl.DateTimeFormat`
**Decision:** Compute IST by adding `5.5 * 60 * 60 * 1000` (19,800,000 ms) to `Date.now()` and using `getUTCHours()` on the result.

**Rationale:** `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` is the "correct" modern API. However, it requires parsing a formatted string to extract individual date/time components, adding verbosity. The UTC offset approach is self-contained, does not depend on the browser having the `Asia/Kolkata` IANA timezone database entry, and is deterministic.

**Trade-off:** If India ever changes its timezone (historically unlikely), this hardcoded offset would be wrong. `Intl` would automatically pick up the new offset. For a Phase 1 India-specific app, this risk is negligible.

#### DN-04: `alert()` for Booking Error Feedback
**Decision:** Use `window.alert()` to display booking failure messages (e.g., "This time slot is already booked.").

**Rationale:** A toast/notification system (e.g., `react-hot-toast` or `react-toastify`) was not included in the frontend dependencies at the time of implementation. `alert()` is universally available, requires zero additional imports, and blocks UI until acknowledged — which is appropriate for a booking failure (the user must acknowledge before trying another slot).

**Trade-off:** `alert()` is visually inconsistent with the rest of the UI design language. It cannot be styled. On mobile, it interrupts the entire browser. This is the primary UX debt of this feature — see [Known Limitations](#13-known-limitations--future-improvements).

#### DN-05: 3-Second Redirect on Success
**Decision:** After booking confirmation, auto-redirect to `/my-bookings` after exactly 3000ms.

**Rationale:** Instant redirect would not give the user time to read the confirmation details (expert name, date, slot). A button-triggered redirect would require an additional user action after they've just completed a form submission. 3 seconds is the UX sweet spot: long enough to read the confirmation, short enough not to feel idle.

**Trade-off:** Power users who want to book multiple sessions with different experts cannot stay on the page — they must navigate back from `/my-bookings`. An alternative "Book Another Session" button on the success screen would address this without removing the auto-redirect.

#### DN-06: Socket `useEffect` Re-runs on `selectedDate` Change
**Decision:** Include `selectedDate` in the dependency array of `useEffect #1` (the socket listener effect), causing the effect to re-run every time the user changes the date.

**Rationale:** The `slot_booked` handler inside the effect closes over `selectedDate`:
```js
socket.on('slot_booked', (data) => {
  if (data.bookingDate === selectedDate) { ... }  // <-- stale closure problem
```
If `selectedDate` were not in the dependency array, the listener would always compare against the initial date (stale closure). Adding `selectedDate` to the dependency array causes the effect to clean up the old listener and re-register with the current date in the closure — solving the stale reference.

**Trade-off:** Every date change causes: (1) old listeners removed, (2) `socket.join()` emitted again (harmless — idempotent), (3) new listeners registered. The duplicate `join` is a minor inefficiency. Alternatively, the `slot_booked` handler could be made into a `useCallback` and the `selectedDate` referenced via a `ref` instead of a closure — but this adds complexity for a negligible performance gain.

---

## 12. Decision Log

| ID | Date | Decision | Made By | Rationale Summary |
|----|------|----------|---------|-------------------|
| DL-01 | 2026-05-24 | Use UTC offset trick for IST over `Intl.DateTimeFormat` | Dev Team | Simpler, no IANA dependency, deterministic for India-only app |
| DL-02 | 2026-05-24 | Hardcode 13 time slots, no expert-specific availability windows | Dev Team | Phase 1 scope; dynamic calendars deferred to Phase 2 |
| DL-03 | 2026-05-24 | Lock phone input to `+91` prefix; no country selector | Dev Team | App is India-specific per PRD LO-01; country selector adds UX complexity |
| DL-04 | 2026-05-24 | Use `alert()` for booking error display | Dev Team | No toast library in dependencies; acceptable for MVP |
| DL-05 | 2026-05-24 | 3000ms auto-redirect after successful booking | Dev Team | Provides UX feedback window without requiring manual navigation |
| DL-06 | 2026-05-24 | `socket.off(event)` without handler reference in cleanup | Dev Team | Component is the sole consumer of these events; no risk of removing other handlers |
| DL-07 | 2026-05-24 | Store `bookingDate` as `String` type in MongoDB schema | Dev Team | Avoids MongoDB UTC-midnight Date normalization issues with date-only values; ISO string `YYYY-MM-DD` is unambiguous |
| DL-08 | 2026-05-24 | `status` defaults to `'Confirmed'` on booking creation | Dev Team | Skip `Pending` state for MVP; all bookings are instantly confirmed (no manual expert acceptance flow) |

---

## 13. Known Limitations & Future Improvements

### Limitations

| ID | Limitation | Severity | Phase |
|----|-----------|----------|-------|
| LIM-01 | `alert()` for error feedback is visually inconsistent and cannot be styled | Medium | Phase 1 |
| LIM-02 | The `min` date on the date picker does not auto-advance if the user leaves the page open past IST midnight | Low | Phase 1 |
| LIM-03 | Socket disconnect does not trigger a re-fetch of booked slots; user may see stale availability | Medium | Phase 1 |
| LIM-04 | Hardcoded `localhost:5000` in `api.js` and `socket.js` — not environment-variable driven | Medium | Phase 1 |
| LIM-05 | No pagination or infinite scroll on slot history in My Bookings (related redirect target) | Low | Phase 1 |
| LIM-06 | All experts share the same slot grid (09:00–22:00); expert-specific hours not possible | High | Phase 1 → Phase 2 |
| LIM-07 | No authentication — anyone can book on behalf of any email; no email verification | High | Phase 1 → Phase 2 |
| LIM-08 | `useEffect #1` dependency on `selectedDate` causes double `socket.join()` on date change | Low | Phase 1 |
| LIM-09 | Concurrent `fetchBookedSlots` calls (on rapid date switching) may resolve out of order, leaving stale slot data | Low | Phase 1 |
| LIM-10 | Phone number pattern validates display format (`+91 XXXXXXXXXX`) but the backend expects storage format (`+91XXXXXXXXXX`) — two different regexes must stay in sync | Medium | Phase 1 |

### Future Improvements

#### FUT-01: Replace `alert()` with Inline Toast Notifications
Install `react-hot-toast` or build a `<Toast>` component. Replace `alert(err.response?.data?.error || 'Booking failed')` in `handleBooking` with `toast.error(...)`. This keeps the user on the page without a browser dialog interruption.

#### FUT-02: Socket Reconnect Re-fetch
In `socket.js` or within the component, listen for the `connect` event (fired on reconnect) and trigger a fresh `fetchBookedSlots()` call to resync state after a disconnection:
```js
socket.on('connect', () => {
  getBooked(); // re-fetch on reconnect
});
```

#### FUT-03: Environment Variable for Base URL
Move `'http://localhost:5000'` to a Vite environment variable:
```
# frontend/.env
VITE_API_BASE_URL=http://localhost:5000
```
```js
// api.js
const API = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });
// socket.js
const socket = io(import.meta.env.VITE_API_BASE_URL, { ... });
```

#### FUT-04: Expert-Specific Availability Windows
Add an `availableSlots: [{ day: String, slots: [String] }]` field to the Expert model. Replace the hardcoded `timeSlots` array with a per-expert fetch. This enables experts to define custom working hours.

#### FUT-05: JWT Authentication
Add a middleware guard on `POST /bookings` that requires a valid Bearer token. The `userEmail`, `userName`, and `userPhone` could then be pre-filled from the JWT claims, removing the guest form burden from repeat users.

#### FUT-06: Cancellation of `fetchBookedSlots` on Rapid Date Switching
Use an `AbortController` inside `useEffect #2` to cancel in-flight requests when the date changes rapidly:
```js
useEffect(() => {
  const controller = new AbortController();
  const getBooked = async () => {
    try {
      const { data } = await fetchBookedSlots(id, selectedDate, { signal: controller.signal });
      setBookedSlots(data.data);
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  };
  getBooked();
  return () => controller.abort();
}, [id, selectedDate]);
```

#### FUT-07: "Book Another Session" Button on Success Screen
Add a button to the success confirmation screen that calls `setSuccess(false)` and `setSelectedSlot('')`, returning the user to the booking form with a fresh state — enabling sequential bookings without navigating to My Bookings.

#### FUT-08: Slot Duration Display
Display session duration (currently 1 hour implied by hourly rate) in the slot button or as a tooltip. This prepares the UI for when variable-duration sessions (30 min, 2 hours) are introduced in Phase 2.

#### FUT-09: Automated Test Suite
Implement the test files outlined in [Section 7](#7-testing-strategy) using Vitest (frontend) and Jest + Supertest (backend). Add `"test": "vitest"` to `frontend/package.json` and `"test": "jest"` to `backend/package.json`.

---

*Document Version: 1.0.0*
*Created: 2026-05-24*
*Author: SkillSync Engineering*
*Feature Status: ✅ Implemented (Phase 1 MVP)*
