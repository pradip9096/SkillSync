# Feature Plan: Real-Time Slot Availability Updates (Socket.io)

> **Project:** SkillSync — Real-Time Expert Session Booking System  
> **Feature ID:** RT-001  
> **Document Version:** 1.0.0  
> **Status:** ✅ Implemented  
> **Created:** 2026-05-24  
> **Last Updated:** 2026-05-24  
> **Author:** Engineering Team

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Feature Metadata](#2-feature-metadata)
3. [Context References](#3-context-references)
4. [Patterns Followed](#4-patterns-followed)
5. [Architecture & Event Flow](#5-architecture--event-flow)
6. [Implementation Plan](#6-implementation-plan)
7. [Testing Strategy](#7-testing-strategy)
8. [Validation Commands](#8-validation-commands)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Completion Checklist](#10-completion-checklist)
11. [Notes: Design Decisions & Trade-offs](#11-notes-design-decisions--trade-offs)
12. [Decision Log](#12-decision-log)
13. [Known Limitations & Future Improvements](#13-known-limitations--future-improvements)

---

## 1. Feature Overview

### Description

The **Real-Time Slot Availability Updates** feature ensures that when any user books or cancels an expert session slot, every other user currently viewing that same expert's profile page sees the slot's availability change **instantly** — without manually refreshing the page.

This is the core differentiator of SkillSync. It replaces the traditional "stale data" problem inherent in REST-only architectures with a live, push-based notification system powered by **Socket.io WebSocket rooms**.

### User Story (PRD Reference: BK-01)

> **As a Knowledge Seeker**, I want to see time slots disappear in real-time if booked by someone else, so that I do not attempt to book an unavailable slot.

**Acceptance Criteria (Gherkin):**
```
GIVEN the user is actively viewing Expert A's profile and available slots
WHEN another user successfully books one of Expert A's slots
THEN the viewing user's UI updates immediately via WebSocket 
     to reflect the slot as "Booked" without requiring a manual page refresh
```

### Problem Statement

In a traditional REST architecture, a user loads an expert's profile page and retrieves the list of booked slots at that moment. However, if another user books a slot 30 seconds later, the first user's page still shows that slot as available. The first user then selects the now-taken slot, submits the booking form, and receives a confusing server-side error. This creates a **poor user experience** and increases the perceived failure rate of the application.

The additional risk is **double-booking**: two users simultaneously viewing the same slot and both clicking "Book" within milliseconds of each other. While the database-level unique index prevents actual double booking from succeeding, without real-time UI updates, one user will get a booking error with no advance warning.

### Solution Statement

The solution uses **Socket.io rooms** — a lightweight, server-managed pub/sub channel — to broadcast slot state changes to targeted subsets of connected clients. Each expert's profile corresponds to a named room, identified by that expert's MongoDB `ObjectId`. When a user navigates to an expert profile, the client joins that expert's room. When a booking or cancellation is persisted in MongoDB, the backend emits a targeted event **only to that expert's room**, updating the UI state of all viewers simultaneously.

This two-pronged approach (Socket.io for real-time push + MongoDB unique index for atomic collision prevention) delivers **zero-conflict scheduling with sub-500ms UI feedback**.

---

## 2. Feature Metadata

| Property | Value |
|---|---|
| **Feature Type** | Real-Time Infrastructure / UX Enhancement |
| **Complexity** | High |
| **Phase** | Phase 1 — MVP |
| **Priority** | Must Have (PRD Section 4) |
| **Risk Level** | Medium (network-dependent, stateful connections) |
| **Performance Target** | < 500ms slot status propagation to all connected viewers |
| **Concurrency Safety** | Enforced at DB layer via partial compound unique index |

### Affected Systems

| System | Scope | Impact |
|---|---|---|
| `backend/src/app.js` | Socket.io server bootstrap & room management | Core — owns the `io` instance |
| `backend/src/controllers/bookingController.js` | Event emission on booking/cancellation | Core — triggers all real-time events |
| `frontend/src/services/socket.js` | Singleton socket client | Core — single point of connection |
| `frontend/src/pages/ExpertDetail.jsx` | Room join + event listener integration | Core — consumes real-time events |
| `backend/src/models/Booking.js` | Partial unique index for concurrency safety | Supporting — the atomicity backstop |
| `backend/src/routes/bookingRoutes.js` | HTTP API endpoints that trigger emissions | Supporting |

### External Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `socket.io` (backend) | ^4.x | WebSocket server, room management |
| `socket.io-client` (frontend) | ^4.x | WebSocket client library |
| `http` (Node.js built-in) | — | Wraps Express app into HTTP server |
| `mongoose` | ^7.x | MongoDB ODM; provides the `ObjectId` used as room name |

---

## 3. Context References

### Relevant Existing Files

| File | Lines | Relevance |
|---|---|---|
| `backend/src/app.js` | 32–75 | HTTP server creation, Socket.io init, CORS config, room event handlers |
| `backend/src/controllers/bookingController.js` | 51–57 | `slot_booked` emission inside `createBooking` |
| `backend/src/controllers/bookingController.js` | 163–173 | `slot_released` emission inside `updateBookingStatus` |
| `backend/src/models/Booking.js` | 129–135 | Partial compound unique index (anti-double-booking backstop) |
| `frontend/src/services/socket.js` | 1–28 | Singleton Socket.io client, WebSocket-only transport |
| `frontend/src/pages/ExpertDetail.jsx` | 100–138 | `useEffect` block with socket room join and event listeners |
| `frontend/src/pages/ExpertDetail.jsx` | 319–351 | Slot rendering logic; `bookedSlots` array drives `isDisabled` state |
| `frontend/src/services/api.js` | 52–53 | `fetchBookedSlots` — initial HTTP fetch on date change |

### New Files Created by This Feature

This feature did not require any new files; all implementation was integrated into the files listed above. The feature's "birth" came in multiple commits (see `log.md` timeline entries for 2026-05-10).

### Related Documentation

| Document | Path | Relevance |
|---|---|---|
| Product Requirements Document | `docs/SkillSync_PRD.md` | User stories BK-01, BK-02; NFR performance targets |
| Strategic Roadmap | `docs/ROADMAP.md` | Phase 1 MVP goals; Socket.io listed as complete |
| Project Changelog | `log.md` | Detailed implementation timeline with exact timestamps |
| AGENTS.md | `AGENTS.md` | Module conventions, coding style guide |
| GEMINI.md | `GEMINI.md` | Socket.io architectural guidance |

---

## 4. Patterns Followed

### Module System

- **Backend:** CommonJS (`require` / `module.exports`) — all backend files follow this pattern without exception.
- **Frontend:** ES Modules (`import` / `export`) — all frontend files (Vite + React) use this pattern.

### Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| React components/pages | PascalCase | `ExpertDetail`, `MyBookings` |
| React service functions | lower camelCase | `fetchBookedSlots`, `createBooking` |
| Socket.io event names | `snake_case` | `join_expert_room`, `slot_booked`, `slot_released` |
| Backend controller functions | lower camelCase | `createBooking`, `updateBookingStatus` |
| MongoDB models | PascalCase | `Booking`, `Expert` |

### Error Handling Pattern

All backend controllers use `try/catch` blocks with meaningful HTTP status codes:
- `400 Bad Request` — validation failures, double-booking detection
- `404 Not Found` — booking or expert not found
`500 Internal Server Error` — unhandled server-side errors

Socket.io emissions are made **after** the database write succeeds. If the DB write fails, no socket event is emitted, preventing phantom UI updates.

```js
// PATTERN: Emit only after confirmed DB success
const booking = await Booking.create({ ... }); // DB write first
const io = req.app.get('io');
io.to(expert).emit('slot_booked', { bookingDate, slotTime }); // emit second
```

### Logging Pattern

```js
// Backend: console.log for Socket.io connection lifecycle
console.log('A user connected:', socket.id);
console.log(`User joined room for expert: ${expertId}`);
console.log('User disconnected');

// Backend: console.error for controller catch blocks
console.error('Error in createBooking:', error);
console.error('API Error:', error);
```

All socket-related logs use descriptive messages that include the socket ID or expert ID for traceability.

### React `useEffect` Pattern

The Socket.io integration follows the **subscribe-on-mount, cleanup-on-unmount** React pattern:

```jsx
useEffect(() => {
  // SETUP: join room and register listeners
  socket.emit('join_expert_room', id);
  socket.on('slot_booked', handler);
  socket.on('slot_released', handler);

  // CLEANUP: deregister listeners to prevent memory leaks
  return () => {
    socket.off('slot_booked');
    socket.off('slot_released');
  };
}, [id, selectedDate]); // re-run when expert or date changes
```

### io Instance Access Pattern

The `io` instance is stored on the Express app object via `app.set('io', io)` in `app.js` (line 50), and retrieved in controllers via `req.app.get('io')`. This avoids circular imports between `app.js` and controller files.

```js
// app.js — store once
app.set('io', io);

// bookingController.js — retrieve on demand (no import needed)
const io = req.app.get('io');
```

---

## 5. Architecture & Event Flow

### System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENTS                           │
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │   User A         │         │   User B          │              │
│  │ /expert/:id      │         │ /expert/:id       │              │
│  │ ExpertDetail.jsx │         │ ExpertDetail.jsx  │              │
│  │                  │         │                   │              │
│  │ socket.emit(     │         │ socket.emit(       │              │
│  │  join_expert_room│)        │  join_expert_room │)             │
│  └────────┬─────────┘         └────────┬──────────┘             │
└───────────┼──────────────────────────-─┼────────────────────────┘
            │  WebSocket (ws://)          │  WebSocket (ws://)
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NODE.JS / EXPRESS SERVER                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Socket.io Server                        │   │
│  │                                                            │   │
│  │  io.on('connection', socket => {                           │   │
│  │    socket.on('join_expert_room', expertId => {             │   │
│  │      socket.join(expertId);  // adds to Room               │   │
│  │    });                                                     │   │
│  │  });                                                       │   │
│  │                                                            │   │
│  │  Room: "68abc123..." ──> [User A socket, User B socket]   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               bookingController.js                         │   │
│  │                                                            │   │
│  │  createBooking()        updateBookingStatus()              │   │
│  │    ├─ Booking.findOne() ─ conflict check                  │   │
│  │    ├─ Booking.create()  ─ persist to MongoDB              │   │
│  │    └─ io.to(expertId)     ├─ booking.status = 'Cancelled' │   │
│  │         .emit(            │   await booking.save()        │   │
│  │          'slot_booked',   └─ io.to(expertId)              │   │
│  │          {date, slot})         .emit(                     │   │
│  │                                 'slot_released',           │   │
│  │                                 {date, slot})             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               MongoDB (Atlas)                              │   │
│  │  Booking Collection                                        │   │
│  │  Compound Partial Unique Index:                            │   │
│  │    { expert:1, bookingDate:1, slotTime:1 }                 │   │
│  │    where status != 'Cancelled'                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Complete Event Lifecycle: Booking Flow

```
User A (Viewer)                 User B (Booker)            Server
      │                               │                       │
      │  1. GET /experts/:id (HTTP)   │                       │
      │──────────────────────────────────────────────────────>│
      │<──────────────────────────────────────────────────────│ Expert data
      │                               │                       │
      │  2. socket.emit('join_expert_room', expertId)         │
      │──────────────────────────────────────────────────────>│
      │                               │  socket.join(expertId)│
      │                               │                       │
      │  3. GET /bookings/booked-slots/:id/:date (HTTP)       │
      │──────────────────────────────────────────────────────>│
      │<──────────────────────────────────────────────────────│ ["10:00","14:00"]
      │                               │                       │
      │  [UI: 10:00 AM slot = green]  │                       │
      │                               │                       │
      │              User B books 10:00 AM slot               │
      │                               │                       │
      │                               │  POST /bookings       │
      │                               │──────────────────────>│
      │                               │          Booking.findOne() -- no conflict
      │                               │          Booking.create()  -- persisted
      │                               │          io.to(expertId).emit('slot_booked', {date, "10:00"})
      │                               │<──────────────────────│ {success:true, data:{...}}
      │                               │                       │
      │  4. socket event: 'slot_booked' {bookingDate, "10:00"}│
      │<──────────────────────────────────────────────────────│
      │                               │                       │
      │  if (data.bookingDate === selectedDate):               │
      │    setBookedSlots(prev => [...prev, "10:00"])         │
      │                               │                       │
      │  [UI: 10:00 AM slot = grey/Booked — NO PAGE REFRESH]  │
```

### Complete Event Lifecycle: Cancellation Flow

```
User A (Viewer)              User C (Owner/Canceller)        Server
      │                               │                       │
      │  [UI: 10:00 AM = Booked]      │                       │
      │                               │                       │
      │                    User C cancels their 10:00 AM booking
      │                               │                       │
      │                               │  PATCH /bookings/:id/status {status:"Cancelled"}
      │                               │──────────────────────>│
      │                               │          booking.status = 'Cancelled'
      │                               │          await booking.save()
      │                               │          io.to(expertId).emit('slot_released', {date, "10:00"})
      │                               │<──────────────────────│ {success:true}
      │                               │                       │
      │  5. socket event: 'slot_released' {bookingDate, "10:00"}
      │<──────────────────────────────────────────────────────│
      │                               │                       │
      │  if (data.bookingDate === selectedDate):               │
      │    setBookedSlots(prev => prev.filter(s => s !== "10:00"))
      │                               │                       │
      │  [UI: 10:00 AM = green/Available — NO PAGE REFRESH]   │
```

### Socket.io Room Lifecycle

```
ROOM: "68abc123def456789012abcd"  (Expert ObjectId)
│
├── Client connects to ws://localhost:5000
│     → socket.id = "xK9mP2..."
│
├── ExpertDetail mounts for /expert/68abc123def456789012abcd
│     → socket.emit('join_expert_room', '68abc123def456789012abcd')
│     → Server: socket.join('68abc123def456789012abcd')
│     → Room now has 1 member
│
├── Second client views same expert
│     → Room now has 2 members
│
├── Booking event fires
│     → io.to('68abc123def456789012abcd').emit('slot_booked', payload)
│     → ONLY room members receive this event
│     → Users viewing Expert B are NOT affected
│
├── ExpertDetail unmounts (navigate away)
│     → socket.off('slot_booked')
│     → socket.off('slot_released')
│     → Socket.io auto-removes client from room on disconnect
│
└── Browser tab closes
      → Socket disconnects
      → Room membership automatically cleaned up by Socket.io
```

---

## 6. Implementation Plan

The implementation is organized into four phases. Since this feature is already implemented, each phase is documented as-built with exact file/line references.

---

### Phase 1: Foundation — HTTP-to-WebSocket Server Bridge

**Goal:** Upgrade the Express HTTP server to support WebSocket connections and make the Socket.io instance globally accessible to controllers.

---

#### TASK 1.1 — Wrap Express App in Native HTTP Server

**File:** `backend/src/app.js`  
**Lines:** 32

**IMPLEMENT:**
```js
// Before: Express app alone (cannot handle WebSockets)
// const app = express();
// app.listen(PORT);

// After: Express app wrapped in native http.Server
const http = require('http');
const server = http.createServer(app);
// server.listen(PORT) — used later
```

**PATTERN:** The native Node.js `http.Server` is the base adapter that both Express (HTTP) and Socket.io (WebSocket upgrade) attach to. This is the standard Socket.io v4 integration pattern.

**IMPORTS:**
```js
const http = require('http'); // Node.js built-in, no npm install needed
```

**GOTCHA:** If you call `app.listen(PORT)` instead of `server.listen(PORT)`, Socket.io will attach to Express's internal HTTP server, which works but cannot be cleanly shared. Always use the explicit `http.createServer(app)` pattern.

**VALIDATE:**
```bash
# Server starts without error on port 5000
cd backend && node src/app.js
# Expected: "Server running in development mode on port 5000"
```

---

#### TASK 1.2 — Initialize Socket.io Server with CORS

**File:** `backend/src/app.js`  
**Lines:** 41–47

**IMPLEMENT:**
```js
const { Server } = require('socket.io');

const io = new Server(server, {
  cors: {
    origin: "*",         // Dev: allow all. Prod: restrict to frontend domain
    methods: ["GET", "POST", "PATCH"],
    credentials: true
  }
});
```

**PATTERN:** `socket.io` is destructured as `{ Server }` (named export) to differentiate from `http.Server`. CORS is mandatory because the frontend (Vite dev server, typically `localhost:5173`) is a different origin from the backend (`localhost:5000`).

**IMPORTS:**
```js
const { Server } = require('socket.io'); // npm install socket.io
```

**GOTCHA:** The `credentials: true` option in Socket.io CORS requires `origin` to be a specific domain (not `"*"`) in production. With `"*"` and `credentials: true`, browsers may reject the connection in stricter environments. In production, replace `"*"` with `process.env.FRONTEND_URL`.

**GOTCHA:** The `methods` array must include all HTTP methods used in the Socket.io handshake. The polling transport uses `GET` and `POST`; the WebSocket upgrade uses `GET`. `PATCH` is included here to match the Express CORS configuration, but is not strictly required for Socket.io itself.

**VALIDATE:**
```bash
# Upgrade WebSocket connection from browser dev tools
# Network tab → WS → should see 101 Switching Protocols
```

---

#### TASK 1.3 — Inject io Instance onto Express App Object

**File:** `backend/src/app.js`  
**Line:** 50

**IMPLEMENT:**
```js
// Store io on the Express app so controllers can access it
// via req.app.get('io') — no circular imports required
app.set('io', io);
```

**PATTERN:** Express's `app.set(key, value)` / `app.get(key)` is a built-in key-value store on the application instance. This is the idiomatic pattern for sharing application-wide singletons (like `io`) with controllers without creating circular `require` dependencies.

**GOTCHA:** Do NOT `require('./app')` inside a controller to get `io`. This creates a circular dependency (`app.js` → `bookingRoutes.js` → `bookingController.js` → `app.js`). The `req.app.get('io')` pattern elegantly avoids this because `req.app` is already the running Express application instance passed down by the framework.

**VALIDATE:**
```js
// In any controller, verify the instance is accessible:
const io = req.app.get('io');
console.log(typeof io); // Should log: "object"
console.log(io.sockets); // Should log the socket.io namespace object
```

---

#### TASK 1.4 — Register Core Socket.io Connection Events

**File:** `backend/src/app.js`  
**Lines:** 56–75

**IMPLEMENT:**
```js
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Room join handler — client calls this on ExpertDetail mount
  socket.on('join_expert_room', (expertId) => {
    socket.join(expertId);
    console.log(`User joined room for expert: ${expertId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    // No manual room leave needed — Socket.io auto-cleans on disconnect
  });
});
```

**PATTERN:** The `connection` event fires once per client connection. Each subsequent `socket.on(...)` inside it is scoped to that specific client. Room membership is entirely managed by Socket.io; no manual cleanup is needed on disconnect.

**GOTCHA:** The `expertId` received from the client is a raw string (the MongoDB ObjectId). There is currently **no validation** that this string is a valid ObjectId or that it corresponds to an existing expert document. This means a malicious client could join an arbitrary room name. This is acceptable for MVP but should be validated in production (see [Known Limitations](#13-known-limitations--future-improvements)).

**VALIDATE:**
```bash
# Open two browser tabs to the same expert profile
# Backend console should show:
# "A user connected: xK9mP2..."
# "User joined room for expert: 68abc123def456789012abcd"
# "A user connected: yR3nQ7..."
# "User joined room for expert: 68abc123def456789012abcd"
```

---

### Phase 2: Core — Server-Side Event Emission

**Goal:** Emit targeted Socket.io events from controller functions immediately after successful database operations.

---

#### TASK 2.1 — Emit `slot_booked` Event on Successful Booking Creation

**File:** `backend/src/controllers/bookingController.js`  
**Lines:** 56–57

**IMPLEMENT:**
```js
const createBooking = async (req, res) => {
  try {
    const { expert, userName, userEmail, userPhone, bookingDate, slotTime, notes } = req.body;

    // Step 1: Conflict check (application-level guard)
    const existingBooking = await Booking.findOne({
      expert,
      bookingDate,
      slotTime,
      status: { $ne: 'Cancelled' }
    });
    if (existingBooking) {
      return res.status(400).json({ success: false, error: 'This time slot is already booked.' });
    }

    // Step 2: Persist to MongoDB (DB-level guard: partial unique index)
    const booking = await Booking.create({ expert, userName, userEmail, userPhone, bookingDate, slotTime, notes });

    // Step 3: ONLY after confirmed DB write, emit to expert's room
    const io = req.app.get('io');
    io.to(expert).emit('slot_booked', { bookingDate, slotTime });
    // NOTE: 'expert' here is the raw string ObjectId from req.body.
    // It matches the room name set in socket.join(expertId) on the client.

    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error in createBooking:', error);
    // Step 4: Handle race condition at DB level (duplicate key error)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Double booking detected. This slot was just taken.' });
    }
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

**PATTERN:** Strict ordering: **Validate → Persist → Emit → Respond**. The socket emission is intentionally placed after `Booking.create()` and before `res.status(201)` to ensure that clients in the room are notified before the booking user's UI transitions to the success screen.

**GOTCHA:** The `expert` field in `req.body` is the string form of the MongoDB `ObjectId` (e.g., `"68abc123def456789012abcd"`). This is the same value used as the Socket.io room name (from `socket.join(expertId)`). They match because the client sends `expert: id` where `id` comes from `useParams()` in the URL `/expert/:id`, which is the same `ObjectId` string stored in the database.

**GOTCHA:** If `Booking.create()` throws a duplicate key error (`error.code === 11000`), the emit block is **never reached** because the error is caught. This is the correct behavior: we never emit a `slot_booked` event for a booking that didn't actually succeed in the database.

**VALIDATE:**
```bash
# POST a booking via curl
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"EXPERT_ID","userName":"Test","userEmail":"t@t.com","userPhone":"+911234567890","bookingDate":"2026-06-01","slotTime":"10:00"}'
# Expected: 201 Created + all viewers of that expert see 10:00 AM turn grey
```

---

#### TASK 2.2 — Emit `slot_released` Event on Booking Cancellation

**File:** `backend/src/controllers/bookingController.js`  
**Lines:** 163–173

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

    // Time-lock validation for 'Completed' status (non-socket concern)
    if (normalizedStatus === 'Completed') { /* ... time-lock logic ... */ }

    booking.status = normalizedStatus;
    await booking.save();

    // Emit slot_released ONLY when status is Cancelled
    if (normalizedStatus === 'Cancelled') {
      const io = req.app.get('io');
      io.to(booking.expert.toString()).emit('slot_released', {
        bookingDate: booking.bookingDate,
        slotTime: booking.slotTime
      });
      // NOTE: booking.expert is a mongoose ObjectId — must call .toString()
      // to convert to the string used as the room name.
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
```

**PATTERN:** The `slot_released` event fires only for `Cancelled` status, not for `Completed`. A completed session slot is correctly treated as "occupied in history" and should not be made available for new bookings.

**GOTCHA:** `booking.expert` is a Mongoose `ObjectId` object, not a string. Using `io.to(booking.expert)` (without `.toString()`) will not match the string-based room name set by `socket.join(expertId)`. **Always call `.toString()`** on ObjectId values before using them as Socket.io room identifiers.

**GOTCHA:** The `slot_released` payload (`bookingDate`, `slotTime`) comes from the **existing booking document**, not from `req.body`. This ensures the event always contains the original booking's data, even if a client somehow sends incorrect data in the PATCH request body. The booking document is the source of truth.

**VALIDATE:**
```bash
# PATCH a booking to Cancelled
curl -X PATCH http://localhost:5000/bookings/BOOKING_ID/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Cancelled"}'
# Expected: 200 OK + all viewers of that expert see the slot turn green
```

---

### Phase 3: Integration — Frontend Client

**Goal:** Connect the React frontend to the Socket.io server, join the correct expert room, and reactively update local UI state based on received events.

---

#### TASK 3.1 — Create Singleton Socket.io Client

**File:** `frontend/src/services/socket.js`  
**Lines:** 1–28

**IMPLEMENT:**
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  upgrade: false
});

export default socket;
```

**PATTERN:** The socket is instantiated once at module load time and exported as a singleton. Because ES modules are cached after the first `import`, every file that `import socket from '../services/socket'` gets the **same socket instance** — no new connection is created.

**IMPORTS:**
```bash
# Already installed via package.json:
npm install socket.io-client
```

**GOTCHA:** If the socket were created inside a component function or a `useEffect`, a new WebSocket connection would be created every time the component mounts. With singleton export, the connection is made **once** when the app loads (or when any component first imports this module), and all components share it.

**GOTCHA:** `transports: ['websocket'], upgrade: false` forces the connection to go directly to WebSocket, skipping the Socket.io default behavior of starting with HTTP long-polling and then upgrading. This was added to fix a connectivity error encountered in development (see `log.md`: 2026-05-10 05:06 PM). The tradeoff is that environments that don't support WebSocket (very rare) will fail to connect, whereas polling would degrade gracefully.

**GOTCHA:** The URL `http://localhost:5000` is hardcoded. In production, this must read from an environment variable (e.g., `import.meta.env.VITE_SOCKET_URL`).

**VALIDATE:**
```js
// In browser console after app loads:
import socket from './services/socket';
console.log(socket.connected); // Should be: true
console.log(socket.id);        // Should be a string like "xK9mP2..."
```

---

#### TASK 3.2 — Join Expert Room and Register Event Listeners in ExpertDetail

**File:** `frontend/src/pages/ExpertDetail.jsx`  
**Lines:** 100–138

**IMPLEMENT:**
```jsx
import socket from '../services/socket';

const ExpertDetail = () => {
  const { id } = useParams(); // Expert ObjectId from URL: /expert/:id
  const [bookedSlots, setBookedSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(/* IST today */);

  useEffect(() => {
    // --- Data Fetch ---
    const getExpertData = async () => { /* ... fetchExpertById(id) ... */ };
    getExpertData();

    // --- Socket.io Integration ---

    // 1. Join this expert's room
    socket.emit('join_expert_room', id);

    // 2. Listen: another user booked a slot
    socket.on('slot_booked', (data) => {
      // Guard: only update if the event is for the currently viewed date
      if (data.bookingDate === selectedDate) {
        setBookedSlots((prev) => [...prev, data.slotTime]);
      }
    });

    // 3. Listen: another user cancelled their booking, freeing the slot
    socket.on('slot_released', (data) => {
      if (data.bookingDate === selectedDate) {
        setBookedSlots((prev) => prev.filter(slot => slot !== data.slotTime));
      }
    });

    // 4. Cleanup: remove listeners when component unmounts or deps change
    return () => {
      socket.off('slot_booked');
      socket.off('slot_released');
    };
  }, [id, selectedDate]); // Dependencies: re-run when expert or date changes
```

**PATTERN:** Two `useEffect` hooks are intentionally separate:
1. **Expert Data + Socket Setup** (depends on `[id, selectedDate]`) — runs when the expert ID or selected date changes.
2. **Booked Slots Fetch** (depends on `[id, selectedDate]`) — re-fetches from REST API when date changes.

This separation ensures socket listeners are always in sync with `selectedDate` (because the effect re-runs with the new value) while keeping concerns distinct.

**GOTCHA:** The `selectedDate` dependency in `useEffect` is critical. Without it, the `slot_booked` handler would close over the **stale initial value** of `selectedDate` (a JavaScript closure issue). When the user changes the date, the old listeners would still compare `data.bookingDate` against the **original** selected date. Adding `selectedDate` to the dependency array forces the effect to re-run (re-registering fresh listeners) whenever the date changes.

**GOTCHA:** `socket.off('slot_booked')` in the cleanup function removes **all** listeners for the `'slot_booked'` event on this socket. Since there is only one component using these listeners in this app, this is safe. In a more complex app with multiple components listening to the same event, you should use `socket.off('slot_booked', specificHandlerReference)` to remove only the specific listener function.

**GOTCHA:** `socket.emit('join_expert_room', id)` is called every time `id` or `selectedDate` changes. Socket.io's `socket.join()` on the server is idempotent — joining a room you're already in has no negative effect and does not create a duplicate membership.

**VALIDATE:**
```js
// In browser console on ExpertDetail page:
// Trigger a booking via curl from terminal
// Expected: browser console shows React re-render
// Expected: the booked slot button becomes disabled
```

---

#### TASK 3.3 — Drive Slot Button UI from `bookedSlots` State

**File:** `frontend/src/pages/ExpertDetail.jsx`  
**Lines:** 319–351

**IMPLEMENT:**
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
        ${isDisabled
          ? 'bg-gray-100 text-gray-300 cursor-not-allowed grayscale'
          : selectedSlot === slot.value
            ? 'bg-blue-600 text-white shadow-2xl shadow-blue-400 scale-105'
            : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-blue-500'
        }
      `}
    >
      <span>{slot.label}</span>
      {isDisabled && (
        <span className="absolute ...">
          {isBooked ? 'Booked' : 'Passed'}
        </span>
      )}
    </button>
  );
})}
```

**PATTERN:** The slot button grid is a pure derivation of `bookedSlots` state. When the socket event calls `setBookedSlots`, React re-renders this component, and the `isBooked` check on each slot reflects the updated state. This is the standard React **unidirectional data flow** pattern: socket event → state update → re-render.

**VALIDATE:**
- Open two browser tabs to the same expert profile
- Book a slot from Tab 2
- Observe Tab 1 immediately shows the slot as grey/disabled

---

#### TASK 3.4 — Secondary REST Fetch for Initial Slot State on Date Change

**File:** `frontend/src/pages/ExpertDetail.jsx`  
**Lines:** 143–156

**IMPLEMENT:**
```jsx
// Separate useEffect: fetch initial booked slots via REST when date changes
useEffect(() => {
  const getBooked = async () => {
    try {
      const { data } = await fetchBookedSlots(id, selectedDate);
      setBookedSlots(data.data); // Reset slots from authoritative REST response
    } catch (err) {
      console.error(err);
    }
  };
  getBooked();
}, [id, selectedDate]);
```

**PATTERN:** This REST fetch serves as the **initial hydration** of slot state. The socket listeners handle incremental updates after the initial load. When the date changes, this effect fires first to reset `bookedSlots` to the ground truth from the database, then the socket listeners continue to apply incremental changes on top.

**GOTCHA:** The REST fetch and the socket listener are independent. If the user changes the date while a `slot_booked` event arrives simultaneously, a brief inconsistency might occur. However, since the REST fetch happens immediately on date change and populates authoritative state, any transient inconsistency resolves within milliseconds. This is an acceptable MVP trade-off (see [Known Limitations](#13-known-limitations--future-improvements)).

---

### Phase 4: Database Concurrency Backstop

**Goal:** Ensure that even in worst-case race conditions where two requests arrive simultaneously and both pass the application-level conflict check, only one booking is actually written.

---

#### TASK 4.1 — Partial Compound Unique Index on Booking Model

**File:** `backend/src/models/Booking.js`  
**Lines:** 129–135

**IMPLEMENT:**
```js
bookingSchema.index(
  { expert: 1, bookingDate: 1, slotTime: 1 },  // Compound key
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'Cancelled' } } // Partial filter
  }
);
```

**PATTERN:** A **partial unique index** enforces uniqueness only for documents matching the filter expression. Documents where `status === 'Cancelled'` are excluded from the index, allowing a slot to be re-booked after cancellation (the cancelled booking record remains in the collection for history, but doesn't block new bookings).

**GOTCHA:** Standard compound unique index (without `partialFilterExpression`) would permanently block re-booking of a cancelled slot because the cancelled document still occupies the index space. The partial filter is essential for the "cancelled slots can be re-booked" requirement.

**GOTCHA:** The index only prevents duplicate documents at the database write layer. The application-level `Booking.findOne()` check in `createBooking` runs first and handles the majority of duplicates with a user-friendly error message. The index is the backstop for true race conditions (millisecond-level simultaneous requests). When the index triggers, MongoDB throws error code `11000`, which is caught and returned as `"Double booking detected. This slot was just taken."`.

**VALIDATE:**
```bash
# Attempt to create two bookings for the same slot simultaneously
# Tool: Apache Bench or curl with &
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"ID","bookingDate":"2026-06-01","slotTime":"10:00",...}' &
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"ID","bookingDate":"2026-06-01","slotTime":"10:00",...}' &
wait
# Expected: One 201, one 400 with "Double booking detected" or "slot is already booked"
```

---

## 7. Testing Strategy

> **Note:** No automated test framework is currently configured in the project. The following defines the complete test specification that should be implemented when testing is added.

### 7.1 Unit Tests

#### Test Suite: `bookingController.test.js`

**Test 1.1 — `slot_booked` event emitted after successful booking creation**
```js
// Mock: Booking.findOne resolves null (no conflict)
// Mock: Booking.create resolves with booking object
// Mock: req.app.get('io') returns mocked io with .to().emit() spy
// Assert: io.to(expertId).emit('slot_booked', { bookingDate, slotTime }) was called exactly once
// Assert: io is not called if Booking.create throws
```

**Test 1.2 — `slot_booked` NOT emitted when conflict exists**
```js
// Mock: Booking.findOne resolves existing booking (conflict)
// Assert: io.to().emit() was NOT called
// Assert: response is 400 with "slot is already booked"
```

**Test 1.3 — `slot_booked` NOT emitted on DB error (11000)**
```js
// Mock: Booking.findOne resolves null (passes check)
// Mock: Booking.create throws {code: 11000}
// Assert: io.to().emit() was NOT called
// Assert: response is 400 with "Double booking detected"
```

**Test 1.4 — `slot_released` emitted on cancellation**
```js
// Mock: Booking.findById resolves booking with expert ObjectId
// Mock: booking.save resolves successfully
// Assert: io.to(booking.expert.toString()).emit('slot_released', { bookingDate, slotTime }) called once
```

**Test 1.5 — `slot_released` NOT emitted for Completed status**
```js
// Mock: status = 'Completed', session time in the past
// Assert: io.to().emit() was NOT called
// Assert: booking.status updated to 'Completed'
```

**Test 1.6 — `.toString()` called on booking.expert before emit**
```js
// Mock: booking.expert = new mongoose.Types.ObjectId()
// Assert: io.to() called with the string representation, not the ObjectId object
```

#### Test Suite: `socket.test.js` (Frontend)

**Test 2.1 — Socket module exports a single instance**
```js
import socket1 from '../services/socket';
import socket2 from '../services/socket';
expect(socket1).toBe(socket2); // Strict reference equality
```

**Test 2.2 — Socket connects with websocket transport**
```js
expect(socket.io.opts.transports).toEqual(['websocket']);
expect(socket.io.opts.upgrade).toBe(false);
```

### 7.2 Integration Tests

#### Test Suite: `booking.integration.test.js`

**Test 3.1 — End-to-end slot_booked emission**
```js
// 1. Start real test server with Socket.io
// 2. Connect two socket clients: viewer and booker
// 3. Viewer emits 'join_expert_room' with expertId
// 4. Booker POSTs /bookings with the same expertId, date, slot
// 5. Assert: viewer's socket receives 'slot_booked' with matching {bookingDate, slotTime}
// 6. Assert: event received within 500ms (performance target from PRD)
```

**Test 3.2 — End-to-end slot_released emission**
```js
// 1. Create a booking in DB directly
// 2. Connect viewer socket, join expert room
// 3. PATCH /bookings/:id/status with {status: 'Cancelled'}
// 4. Assert: viewer socket receives 'slot_released' with matching payload
```

**Test 3.3 — Room isolation — Expert A booking does not affect Expert B viewer**
```js
// 1. Viewer A joins room for expertA
// 2. Viewer B joins room for expertB
// 3. POST booking for expertA
// 4. Assert: Viewer A receives 'slot_booked'
// 5. Assert: Viewer B does NOT receive 'slot_booked'
```

**Test 3.4 — Double booking race condition prevention**
```js
// 1. Use Promise.all to fire two simultaneous POST /bookings for same slot
// 2. Assert: Exactly one resolves to 201
// 3. Assert: Exactly one resolves to 400
// 4. Assert: MongoDB has exactly one Booking document for that slot
// 5. Assert: Exactly one 'slot_booked' event was emitted
```

### 7.3 Edge Case Tests

| Edge Case | Expected Behavior |
|---|---|
| User joins expert room, loses network, reconnects | Client should re-fetch booked slots via REST on reconnect; socket resumes room membership automatically (Socket.io reconnection is built-in) |
| User changes selected date while `slot_booked` event arrives | `if (data.bookingDate === selectedDate)` guard discards the stale event; REST fetch on date change provides correct state |
| Booking created for a date other than the viewer's selected date | `slot_booked` event has `bookingDate: "2026-06-05"`; viewer's `selectedDate` is `"2026-06-01"`; event is silently ignored |
| User navigates away from ExpertDetail to ExpertListing | Cleanup function runs: `socket.off('slot_booked')`, `socket.off('slot_released')`; no stale listeners accumulate |
| User navigates back to the same ExpertDetail | `useEffect` re-runs; room rejoined (idempotent), fresh listeners registered |
| Cancellation of a booking whose slot is not in the viewer's `bookedSlots` state | `prev.filter(slot => slot !== data.slotTime)` returns unchanged array; React skips re-render (no state change) |
| Server restarts while clients are connected | Socket.io client reconnects automatically (built-in exponential backoff); clients re-emit `join_expert_room` on reconnect if `autoConnect: true` (default) |
| Two `slot_booked` events for the same slot received | `setBookedSlots(prev => [...prev, data.slotTime])` will add the slot twice; `bookedSlots.includes(slot.value)` will still return `true`; UI is unaffected but state has a duplicate. Should be addressed with `Set`-based deduplication (see Known Limitations). |

---

## 8. Validation Commands

### Start Services

```bash
# Terminal 1: Start MongoDB (if local; skip for Atlas)
mongod

# Terminal 2: Start Backend
cd backend && node src/app.js
# Expected: "Server running in development mode on port 5000"
# Expected: "MongoDB Connected: <hostname>" (from connectDB)

# Terminal 3: Start Frontend
cd frontend && npm run dev
# Expected: "Local: http://localhost:5173/"
```

### Validate Backend Socket.io is Running

```bash
# Test the HTTP health endpoint
curl http://localhost:5000/
# Expected: "API is running..."

# Test Socket.io is accepting connections (polling transport check)
curl "http://localhost:5000/socket.io/?EIO=4&transport=polling"
# Expected: Some encoded response starting with "0{" (Socket.io handshake)
```

### Validate Booking Creates Socket Event (Manual)

```bash
# 1. Open browser to http://localhost:5173/expert/EXPERT_ID
# 2. Open browser devtools → Network → Filter: WS
# 3. Click the WebSocket connection to see frames
# 4. Run:
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "expert": "REPLACE_WITH_EXPERT_OBJECTID",
    "userName": "Test User",
    "userEmail": "test@example.com",
    "userPhone": "+911234567890",
    "bookingDate": "2026-06-01",
    "slotTime": "10:00",
    "notes": "Test booking"
  }'
# Expected: 201 response from curl
# Expected: Browser UI shows 10:00 AM slot as "Booked"
# Expected: WS frames panel shows incoming '42["slot_booked",{...}]' message
```

### Validate Cancellation Creates Socket Event

```bash
# Get a booking ID from the DB or from the previous POST response
curl -X PATCH http://localhost:5000/bookings/BOOKING_ID/status \
  -H "Content-Type: application/json" \
  -d '{"status": "Cancelled"}'
# Expected: 200 response
# Expected: Browser UI shows previously-booked slot as available (green)
```

### Validate Room Isolation

```bash
# 1. Open Tab A: http://localhost:5173/expert/EXPERT_A_ID
# 2. Open Tab B: http://localhost:5173/expert/EXPERT_B_ID
# 3. POST a booking for EXPERT_A_ID
# Expected: Tab A slot turns grey
# Expected: Tab B is unaffected
```

### Validate Double Booking Prevention

```bash
# Run two concurrent booking requests for the same slot
curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"ID","userName":"A","userEmail":"a@a.com","userPhone":"+911234567890","bookingDate":"2026-06-01","slotTime":"11:00","notes":""}' &
curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"ID","userName":"B","userEmail":"b@b.com","userPhone":"+911234567890","bookingDate":"2026-06-01","slotTime":"11:00","notes":""}' &
wait
# Expected: One response is 201, the other is 400
```

### Validate No Stale Listeners (Navigate Away and Back)

```js
// In browser console:
// 1. Navigate to /expert/:id
// 2. Check: socket._callbacks — should see slot_booked handler
// 3. Navigate to /experts (component unmounts)
// 4. Check: socket._callbacks — slot_booked handler should be gone
// 5. Navigate back to /expert/:id
// 6. Check: socket._callbacks — exactly ONE handler for slot_booked (not two)
```

### Lint Check

```bash
cd frontend && npm run lint
# Expected: No ESLint errors related to hooks (react-hooks/exhaustive-deps)
# Note: selectedDate in useEffect dependency array must be correct
```

---

## 9. Acceptance Criteria

The following criteria map directly to user stories and PRD specifications:

### Functional Criteria

| # | Criterion | Verification |
|---|---|---|
| AC-1 | When User A books a slot for Expert X, all other users viewing Expert X's profile see that slot become disabled within 500ms **without** manually refreshing | Manual E2E test with two browser tabs |
| AC-2 | When User A cancels a booking for Expert X, all other users viewing Expert X's profile see that slot become available within 500ms **without** manually refreshing | Manual test via PATCH + observe Tab 2 |
| AC-3 | A `slot_booked` or `slot_released` event for Expert A does **not** affect users viewing Expert B | Room isolation test (see Validation section) |
| AC-4 | Two simultaneous booking requests for the same expert/date/slot result in exactly one `201 Created` and one `400 Bad Request` | Concurrent curl test |
| AC-5 | The `slot_booked` event only updates the UI if `data.bookingDate === selectedDate` | Test by booking for Date B while viewer is on Date A |
| AC-6 | Navigating away from `ExpertDetail` and back does not result in duplicate socket event listeners | Console inspection / listener count check |
| AC-7 | The Socket.io singleton (`socket.js`) does not create multiple WebSocket connections during normal navigation | Network tab: only one WS connection visible |

### Non-Functional Criteria

| # | Criterion | Source |
|---|---|---|
| NFR-1 | Slot status propagation latency < 500ms | PRD Section 6, `log.md` Requirements |
| NFR-2 | Zero double bookings under concurrent load | PRD BK-02, `log.md` Requirements |
| NFR-3 | No memory leaks from unremoved event listeners | `useEffect` cleanup validation |
| NFR-4 | WebSocket-only transport (no polling fallback) | `socket.js` config |
| NFR-5 | CORS in production must restrict `origin` from `"*"` to the frontend domain | Code review / deployment check |

---

## 10. Completion Checklist

### Backend

- [x] `http.createServer(app)` used instead of `app.listen()`
- [x] Socket.io `Server` initialized with correct CORS settings
- [x] `app.set('io', io)` called to make `io` accessible in controllers
- [x] `io.on('connection', ...)` event handler registered
- [x] `socket.on('join_expert_room', ...)` handler calls `socket.join(expertId)`
- [x] `socket.on('disconnect', ...)` handler logged
- [x] `createBooking` controller emits `slot_booked` after `Booking.create()` succeeds
- [x] `updateBookingStatus` controller emits `slot_released` only on `Cancelled` status
- [x] `booking.expert.toString()` used before passing ObjectId to `io.to()`
- [x] `error.code === 11000` handled gracefully in `createBooking`
- [x] Partial compound unique index defined on `Booking` model

### Frontend

- [x] `socket.js` creates singleton Socket.io client with `transports: ['websocket']`
- [x] `ExpertDetail` imports socket from `../services/socket`
- [x] `socket.emit('join_expert_room', id)` called in `useEffect` on mount
- [x] `socket.on('slot_booked', handler)` registered with `selectedDate` guard
- [x] `socket.on('slot_released', handler)` registered with `selectedDate` guard
- [x] Both listeners removed via `socket.off()` in `useEffect` cleanup
- [x] `[id, selectedDate]` in `useEffect` dependency array (prevents stale closures)
- [x] `bookedSlots` state drives `isDisabled` on slot buttons
- [x] Separate `useEffect` for REST-based initial slot fetch on date change
- [x] ESLint passes with no hook warnings

### Documentation

- [x] Feature plan document created at `docs/feature-plan-realtime-slot-updates.md`
- [x] Implementation recorded in `log.md` with timestamps
- [x] PRD user story BK-01 addressed

---

## 11. Notes: Design Decisions & Trade-offs

### Decision 1: Socket.io Rooms (not Namespaces) for Expert Isolation

**Context:** Socket.io offers two mechanisms for grouping clients: **namespaces** (like `/expert-a`, `/expert-b`) and **rooms** (arbitrary string labels within a namespace).

**Decision:** Use rooms within the default namespace (`/`).

**Rationale:**
- Rooms are dynamic — they can be created and destroyed at runtime without any server configuration. A new expert can be added to MongoDB and immediately have a working real-time room.
- Namespaces require server-side setup for each namespace path. With 50+ experts, pre-configuring 50+ namespaces is infeasible.
- Room names (MongoDB ObjectIds) are unique, globally addressing each expert's viewer group.
- Performance: rooms and namespaces have equivalent broadcast performance for this scale.

**Trade-off:** All experts share the same Socket.io namespace connection. In a very high-scale system (thousands of concurrent rooms), separate namespaces per expert category could reduce memory overhead per socket — but this optimization is premature for the current MVP scope.

---

### Decision 2: Singleton Socket Instance vs. Per-Component Connection

**Context:** The socket client could be created per-component (inside `ExpertDetail`) or as a module-level singleton.

**Decision:** Singleton exported from `frontend/src/services/socket.js`.

**Rationale:**
- A single WebSocket connection can handle unlimited message types/rooms. Creating one per component is wasteful.
- ES module caching guarantees singleton behavior across the entire app.
- Easier to debug — one connection, one socket ID, one set of logs.
- Consistent with the Socket.io documentation's recommended approach.

**Trade-off:** Since all components share one socket, `socket.off('slot_booked')` without a specific handler reference would remove ALL `slot_booked` listeners across the app. Currently, only `ExpertDetail` listens to these events, so this is safe. If a future component also listens to `slot_booked`, named handler references must be used in cleanup.

---

### Decision 3: WebSocket-Only Transport (`upgrade: false`)

**Context:** Socket.io defaults to starting with HTTP long-polling and upgrading to WebSocket after the handshake. This can sometimes cause connection issues in environments with strict proxy or CORS handling.

**Decision:** Force `transports: ['websocket'], upgrade: false`.

**Rationale:**
- This issue was encountered in development (see `log.md` 2026-05-10 05:06 PM): Socket.io connectivity was failing during the polling phase due to CORS handling of the XHR polling requests.
- Forcing WebSocket-only eliminated the transport negotiation phase and resolved the connection error immediately.
- WebSocket is supported by all modern browsers (Chrome, Firefox, Safari, Edge).
- Eliminates the double-connection latency of polling-then-upgrade.

**Trade-off:** If deployed behind a proxy (like Nginx) that doesn't properly handle WebSocket upgrades, the connection will fail entirely. The polling fallback would have degraded gracefully. **Mitigation:** Ensure Nginx (or any reverse proxy) has WebSocket proxying configured: `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`

---

### Decision 4: `app.set('io', io)` vs. Dependency Injection vs. Module Export

**Context:** The `io` instance needs to be available in `bookingController.js`. Three approaches exist:
1. `app.set('io', io)` + `req.app.get('io')` in controllers
2. Direct module export: `module.exports = { io }` from `app.js`
3. Pass `io` as a parameter when creating routes

**Decision:** Option 1: `app.set` / `req.app.get`.

**Rationale:**
- Option 2 (module export from `app.js`) creates a circular dependency: `app.js` imports routes, routes import controllers, controllers import `app.js`.
- Option 3 (parameter injection) requires modifying route factory functions and thread `io` through the routing layer, adding boilerplate.
- Option 1 is the idiomatic Express pattern for sharing app-wide instances, costs nothing, and keeps controller files clean.

**Trade-off:** `req.app.get('io')` couples controllers to the Express request object, which makes unit testing slightly harder (must mock `req.app.get`). This is a well-known minor inconvenience of the Express pattern.

---

### Decision 5: `selectedDate` Guard in Socket Listener

**Context:** The `slot_booked` event payload includes `{ bookingDate, slotTime }`. A user might have the date picker set to June 1st while a booking occurs for June 5th.

**Decision:** Add `if (data.bookingDate === selectedDate)` guard before updating state.

**Rationale:**
- Without the guard, booking a June 5th slot would add `"10:00"` to `bookedSlots` even when the user is viewing June 1st, incorrectly marking June 1st's 10 AM as booked.
- Simple string equality check (both values are `YYYY-MM-DD` format) is reliable and fast.
- The guard is also why `selectedDate` must be in the `useEffect` dependency array.

**Trade-off:** None significant. This is the correct behavior.

---

### Alternatives Considered

#### Alternative A: HTTP Long-Polling

**Description:** Client polls `GET /bookings/booked-slots/:expertId/:date` every N seconds.

**Why Rejected:**
- Introduces 1–N second latency in slot updates (vs. <500ms with WebSocket).
- Generates constant server load even when nothing has changed.
- PRD non-functional requirement explicitly states <500ms propagation latency.
- More backend requests means higher MongoDB load under concurrent viewers.

#### Alternative B: Server-Sent Events (SSE)

**Description:** Server streams events to the browser using the `EventSource` API (HTTP/1.1 persistent connection, server-to-client only).

**Why Rejected:**
- SSE is unidirectional (server → client only). The "join room" handshake requires the client to tell the server which expert it's viewing, which necessitates a bidirectional channel or a separate REST endpoint.
- Socket.io's room system elegantly handles the "subscription management" problem that SSE would require custom solutions for.
- Socket.io is already in the stack (listed in GEMINI.md and PRD as the designated solution).

#### Alternative C: GraphQL Subscriptions

**Description:** Use a GraphQL layer with WebSocket-based subscriptions.

**Why Rejected:**
- Significant additional complexity (Apollo Server, GraphQL schema design).
- The application already uses a REST API. Introducing GraphQL only for real-time updates creates architectural inconsistency.
- Overkill for two event types (`slot_booked`, `slot_released`).

#### Alternative D: Redis Pub/Sub with Socket.io Adapter

**Description:** For multi-node deployments, use `@socket.io/redis-adapter` to broadcast events across multiple Node.js instances.

**Why Not Implemented Yet:**
- The current single-node deployment makes Redis unnecessary.
- This is the correct scaling path when horizontal scaling is required (Phase 4+).
- See [Known Limitations](#13-known-limitations--future-improvements).

---

## 12. Decision Log

| Date | Decision | Rationale | Decided By |
|---|---|---|---|
| 2026-05-10 | Use Socket.io rooms (not namespaces) for expert isolation | Rooms are dynamic; namespaces require server-side config per expert | Engineering Team |
| 2026-05-10 | Store `io` on `app` via `app.set('io', io)` | Avoids circular imports; idiomatic Express pattern | Engineering Team |
| 2026-05-10 | Singleton socket export from `socket.js` | Prevents duplicate WebSocket connections across the app | Engineering Team |
| 2026-05-10 | Force `transports: ['websocket'], upgrade: false` | Fixed dev connectivity error caused by polling CORS issues | Engineering Team (log: 05:06 PM) |
| 2026-05-10 | Emit `slot_booked` AFTER `Booking.create()`, not before | Guarantees no ghost events for failed bookings | Engineering Team |
| 2026-05-10 | Partial unique index (`$ne: 'Cancelled'`) on Booking model | Allows slot re-booking after cancellation while preserving history | Engineering Team |
| 2026-05-10 | Call `.toString()` on `booking.expert` before `io.to()` | Mongoose ObjectId ≠ string; must convert for room name matching | Engineering Team |
| 2026-05-10 | `selectedDate` in `useEffect` dependency array | Prevents stale closure bug in socket listener | Engineering Team |
| 2026-05-10 | `slot_released` only for `Cancelled`, not `Completed` | Completed sessions should remain "occupied" in history | Engineering Team |
| 2026-05-10 | `origin: "*"` in dev CORS config | Simplifies development; production must restrict | Engineering Team |

---

## 13. Known Limitations & Future Improvements

### Limitation 1: Hardcoded Backend URL in `socket.js`

**Current State:** `http://localhost:5000` is hardcoded in `frontend/src/services/socket.js` line 23.

**Impact:** Deploying the frontend to a different environment (staging, production) will fail to connect to the backend.

**Recommended Fix:**
```js
// frontend/src/services/socket.js
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  transports: ['websocket'],
  upgrade: false
});
```
Add `VITE_SOCKET_URL=https://api.skillsync.com` to `frontend/.env.production`.

---

### Limitation 2: CORS Wildcard in Production

**Current State:** `origin: "*"` in `backend/src/app.js` line 43.

**Impact:** Any website can establish a WebSocket connection to the backend, creating a potential CSRF-like attack vector.

**Recommended Fix:**
```js
// backend/src/app.js
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ["GET", "POST", "PATCH"],
    credentials: true
  }
});
```
Add `FRONTEND_URL=https://skillsync.com` to `backend/.env`.

---

### Limitation 3: No Room Join Validation (expertId)

**Current State:** The server calls `socket.join(expertId)` with any string received from the client without validation.

**Impact:** A malicious client could join room names like `"admin"` or `"__all__"`, potentially receiving unintended events (if such room names are ever used).

**Recommended Fix:**
```js
socket.on('join_expert_room', async (expertId) => {
  // Validate expertId is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(expertId)) return;
  // Optionally verify the expert exists
  const expert = await Expert.findById(expertId).lean();
  if (!expert) return;
  socket.join(expertId);
});
```

---

### Limitation 4: Duplicate Entries in `bookedSlots` State

**Current State:** If two `slot_booked` events fire for the same slot (e.g., due to network retry), `setBookedSlots(prev => [...prev, data.slotTime])` adds the slot time twice.

**Impact:** Minor — `bookedSlots.includes()` still returns `true` correctly, so the UI is unaffected. However, the state array contains duplicates.

**Recommended Fix:**
```js
socket.on('slot_booked', (data) => {
  if (data.bookingDate === selectedDate) {
    setBookedSlots(prev => 
      prev.includes(data.slotTime) ? prev : [...prev, data.slotTime]
    );
  }
});
```

---

### Limitation 5: No Socket Reconnection Handling

**Current State:** If a user's WebSocket disconnects and reconnects (e.g., brief network interruption), the socket automatically reconnects (Socket.io default). However, the client does **not** automatically re-emit `join_expert_room`, so room membership is lost and the client will miss subsequent events.

**Impact:** Medium — a reconnected user sees stale slot state until they manually refresh or change the date.

**Recommended Fix:**
```js
// Add to ExpertDetail useEffect or socket.js
socket.on('reconnect', () => {
  socket.emit('join_expert_room', currentExpertId);
  // Re-fetch booked slots via REST to resync state
  fetchBookedSlots(id, selectedDate).then(...);
});
```

---

### Limitation 6: No Horizontal Scaling Support (Single Node Only)

**Current State:** The `io` instance is in-memory on a single Node.js process. If the backend is deployed across multiple instances (e.g., via PM2 cluster mode or Kubernetes), each instance has its own `io`. A booking processed by Instance A only emits to clients connected to Instance A, not to clients connected to Instance B.

**Impact:** Critical in production multi-node deployments — some viewers will miss events.

**Recommended Fix:** Use `@socket.io/redis-adapter` to share events across all instances:
```js
// npm install @socket.io/redis-adapter ioredis
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('ioredis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

---

### Limitation 7: No Authentication on Socket Events

**Current State:** Any connected client can emit `join_expert_room` with any expert ID. There is no JWT or session validation.

**Impact:** Acceptable in Phase 1 (MVP has no authentication). In Phase 2 (JWT implementation from PRD/Roadmap), socket events must be authenticated.

**Recommended Fix (Phase 2):**
```js
// Use Socket.io middleware to verify JWT on connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!verifyJWT(token)) return next(new Error('Unauthorized'));
  next();
});
```

---

### Future Improvements (Roadmap Alignment)

| Improvement | Phase | Priority |
|---|---|---|
| Environment-variable driven socket URL | Immediate | Critical |
| Restrict CORS `origin` to frontend domain | Immediate | Critical |
| Socket reconnection + room re-join handler | Phase 2 | High |
| Room join validation (ObjectId check) | Phase 2 | Medium |
| Redis adapter for horizontal scaling | Phase 4 | Medium |
| JWT auth on socket connections | Phase 2 | High |
| Replace `socket.off` with named handler refs (future multi-listener safety) | Phase 2 | Low |
| Deduplication in `bookedSlots` state updates | Next sprint | Low |

---

*End of Feature Plan: RT-001 — Real-Time Slot Availability Updates (Socket.io)*

---

> **Document Maintenance:** This document should be updated whenever the Socket.io integration is modified (e.g., adding new events, changing room strategy, adding authentication). Update the Decision Log with the date, change, and rationale. Update the Completion Checklist to reflect new requirements.
