# Feature: India-Specific Localization (IST, INR, +91)

> The following plan is complete and reflects the **as-implemented** state of this feature.
> Before extending any localization logic, re-read every mandatory file listed under
> **CONTEXT REFERENCES** and validate understanding with the commands in **VALIDATION COMMANDS**.

Pay special attention to the naming of existing utilities and helpers. The IST offset constant
(`5.5 * 60 * 60 * 1000`) appears in three separate locations—always update them in lockstep.

---

## Feature Description

SkillSync is an India-first expert session booking platform. Every time-sensitive operation in
the stack must operate in **Indian Standard Time (IST, UTC+05:30)**; every price display must
use the **Indian Rupee symbol (₹, U+20B9)**; every phone number collected from users must
conform to **India's +91 dialling format** and be stored without whitespace so it matches the
backend regex exactly.

This feature documents, explains, and preserves all seven concrete localization touch-points
already implemented across three files:

| # | Touch-Point | Layer | File |
|---|---|---|---|
| 1 | IST date initialisation for the date-picker | Frontend | `ExpertDetail.jsx` |
| 2 | IST past-slot detection guard | Frontend | `ExpertDetail.jsx` |
| 3 | IST session-past check in `MyBookings` | Frontend | `MyBookings.jsx` |
| 4 | IST time-lock enforcement in status update handler | Backend | `bookingController.js` |
| 5 | IST time-lock inside Mongoose pre-save hook | Backend | `Booking.js` |
| 6 | INR currency symbol in listing card | Frontend | `ExpertCard.jsx` |
| 7 | INR currency symbol in detail sidebar + +91 phone formatting | Frontend | `ExpertDetail.jsx` |
| 8 | +91 phone number regex validation | Backend | `Booking.js` |

---

## User Story

```
As an Indian user of SkillSync
I want the application to speak my local context natively — correct time, correct currency,
correct phone format — without any manual configuration
So that scheduling sessions feels natural, prices are immediately understandable, and my phone
number is accepted on the first try
```

*PRD reference: User Story LO-01, `docs/SkillSync_PRD.md` line 63.*

---

## Problem Statement

JavaScript's `Date` object is timezone-naïve on both server and client: `new Date()` produces
a UTC-based instant whose textual representation depends on the **host's system clock
timezone**. In development or CI the host is often UTC, in production on a cloud VM it could
be any offset. Without explicit IST anchoring:

1. **Date-picker default** could initialise to yesterday or tomorrow depending on whether the
   user's browser is ahead of or behind IST.
2. **Past-slot detection** would grey out different slots for users in different cities.
3. **"Mark as Completed" button** in `MyBookings` could become active before the session
   actually starts.
4. **Backend time-lock** preventing premature `Completed` status updates would be anchored
   to server UTC, not IST, allowing completion ~5.5 h before the actual session end.

Currency confusion is simpler: without an explicit Rupee symbol, numeric prices (`3500`) give
no indication of denomination to the user.

Phone numbers without mandatory `+91` prefix would fail backend regex silently, giving the
user a confusing server error instead of an inline field hint.

---

## Solution Statement

Rather than adding a heavy date library (`date-fns-tz`, `moment-timezone`, `luxon`) the team
chose to solve the problem **surgically** using only JavaScript builtins:

- **Manual UTC+5:30 offset** — add `5.5 * 60 * 60 * 1000` ms to the current UTC epoch to
  synthesise an IST Date in JavaScript's memory, then read back hours/minutes via
  `.getUTCHours()` / `.getUTCMinutes()` (the UTC-trick described fully in Notes).
- **ISO 8601 timezone suffix** — construct backend Date objects with the string literal
  `T${time}:00+05:30`, which is universally supported by V8's `Date` constructor and produces
  a UTC-equivalent instant from which `Date.now()` comparisons are safe.
- **`Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'`** — used in `MyBookings.jsx`
  `isSessionPast()` as a complementary approach that reads IST date-parts without any offset
  arithmetic, showing that both patterns are valid and contextually appropriate.
- **Hardcoded ₹ Unicode glyph** — embedded directly in JSX for simplicity.
- **Phone formatter + strip-on-submit** — enforces a display format of `+91 XXXXXXXXXX`,
  strips the space before the API call, and backs the whole thing up with an HTML5 `pattern`
  attribute and a Mongoose `match` regex.

---

## Feature Metadata

| Property | Value |
|---|---|
| **Feature Type** | New Capability (India-market MVP requirement) |
| **Estimated Complexity** | Low — no new endpoints, no schema migrations; all changes are isolated to existing files |
| **Primary Systems Affected** | `ExpertDetail.jsx`, `ExpertCard.jsx`, `MyBookings.jsx`, `Booking.js`, `bookingController.js` |
| **Dependencies (Runtime)** | None added — deliberately zero new npm packages |
| **PRD Priority** | *Must Have* — listed as Phase 1 MVP in `docs/SkillSync_PRD.md` line 23 |
| **Related PRD Section** | Non-Functional Spec §6 "Localization" (`docs/SkillSync_PRD.md` line 77) |

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING OR EXTENDING

- [`frontend/src/pages/ExpertDetail.jsx`](../frontend/src/pages/ExpertDetail.jsx) (lines 36–42) —
  IST-aware `useState` initialiser for `selectedDate`. This is the **canonical** example of
  the manual UTC-offset pattern in this codebase.
- [`frontend/src/pages/ExpertDetail.jsx`](../frontend/src/pages/ExpertDetail.jsx) (lines 60–77) —
  `isSlotInPast()` helper; demonstrates the **UTC-trick**: calling `.getUTCHours()` on a
  manually offset Date.
- [`frontend/src/pages/ExpertDetail.jsx`](../frontend/src/pages/ExpertDetail.jsx) (lines 303–307) —
  `min=` IIFE for the date-picker HTML attribute; also uses the UTC-offset pattern.
- [`frontend/src/pages/ExpertDetail.jsx`](../frontend/src/pages/ExpertDetail.jsx) (lines 267, 410–420, 176) —
  INR symbol, +91 phone formatter onChange handler, and phone strip-on-submit.
- [`frontend/src/pages/MyBookings.jsx`](../frontend/src/pages/MyBookings.jsx) (lines 58–84) —
  `isSessionPast()` helper; uses `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` —
  the **alternative IST approach** using locale APIs instead of manual offset arithmetic.
- [`frontend/src/components/ExpertCard.jsx`](../frontend/src/components/ExpertCard.jsx) (line 82) —
  `₹{expert.hourlyRate}/hr` — the INR display in the listing card.
- [`backend/src/models/Booking.js`](../backend/src/models/Booking.js) (lines 33–39) —
  Mongoose `userPhone` field with `match: [/^\+91[0-9]{10}$/]`.
- [`backend/src/models/Booking.js`](../backend/src/models/Booking.js) (lines 78–99) —
  `parseISTSessionTime()` helper and `pre('save')` time-lock hook.
- [`backend/src/models/Booking.js`](../backend/src/models/Booking.js) (lines 106–122) —
  `pre('findOneAndUpdate')` time-lock hook (mirrors the save hook for update paths).
- [`backend/src/controllers/bookingController.js`](../backend/src/controllers/bookingController.js) (lines 135–157) —
  `updateBookingStatus` controller's explicit IST time-lock check before `booking.save()`.
- [`backend/src/models/Expert.js`](../backend/src/models/Expert.js) (line 58) —
  `hourlyRate: { type: Number }` — confirms the field is a plain Number; the ₹ symbol is
  purely a display concern, not stored in the DB.
- [`docs/SkillSync_PRD.md`](./SkillSync_PRD.md) (lines 63–68, 77–78) —
  User story LO-01 and the Localization non-functional requirement.

### New Files Created by This Feature

*None* — all localization is embedded in existing files. There is no dedicated
`localization.js` utility (see Notes § "Why No Utility Module?" for the rationale and the
guidance on when to create one).

### Relevant Documentation — READ BEFORE EXTENDING

- [MDN: Date constructor with timezone strings](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date#parameters)
  — Confirms that `new Date('YYYY-MM-DDTHH:mm:ss+05:30')` is ECMA-262 §20.4.1.15 compliant
  and produces the correct UTC epoch in all V8 versions Node ≥14 and modern browsers.
- [MDN: `Intl.DateTimeFormat.prototype.formatToParts()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts)
  — Used in `MyBookings.jsx:isSessionPast()`. Shows how to destructure individual date-time
  components (year, month, day, hour, minute) in a given timezone.
- [IANA Timezone Database — Asia/Kolkata](https://www.iana.org/time-zones)
  — Confirms that `Asia/Kolkata` has been permanently at UTC+05:30 since 1945 with no DST
  transitions, making the fixed `+05:30` suffix and the `5.5h` constant eternally correct.
- [MDN: HTML `<input type="date">` min attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date#min)
  — Explains that `min` must be `YYYY-MM-DD`; the IIFE on line 303–307 of `ExpertDetail.jsx`
  produces exactly this format.
- [MDN: HTML `pattern` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/pattern)
  — Used with `\+91\s[0-9]{10}` on the phone input. Note that `\s` matches exactly one
  space, which aligns with the display format `+91 XXXXXXXXXX`.
- [Mongoose: Schema `match` validator](https://mongoosejs.com/docs/schematype.html#schematype-options)
  — Describes how the `match` array `[regex, message]` works; used for `userPhone`.
- [Unicode Chart U+20B9 INDIAN RUPEE SIGN](https://www.fileformat.info/info/unicode/char/20b9/index.htm)
  — The ₹ glyph; supported in all modern browsers and Node without any polyfill.

---

## Patterns to Follow

### Naming Conventions

- React page files: PascalCase with `.jsx` extension — `ExpertDetail.jsx`, `MyBookings.jsx`.
- React component files: PascalCase with `.jsx` extension — `ExpertCard.jsx`.
- Backend model files: PascalCase with `.js` extension — `Booking.js`, `Expert.js`.
- Backend controller files: camelCase + `Controller.js` suffix — `bookingController.js`.
- Helpers inside files: camelCase verb-noun — `isSlotInPast`, `isSessionPast`,
  `parseISTSessionTime`.
- IST offset constant: written inline as `5.5 * 60 * 60 * 1000` (not extracted to a named
  constant yet — see Notes for trade-off discussion).

### Error Handling Pattern

**Backend controllers** return structured JSON:
```js
// Success
res.status(200).json({ success: true, data: <payload> });
// Failure
res.status(400).json({ success: false, error: '<human-readable message>' });
```

**Mongoose hook errors** throw plain `new Error('...')` — Mongoose propagates these as
validation errors; the controller's `catch` block catches and returns `status(500)`.

**Frontend** reads the error message via `err.response?.data?.error` (optional chaining
guards against network-level failures where `err.response` is undefined):
```js
// ExpertDetail.jsx line 182
alert(err.response?.data?.error || 'Booking failed');
```

### IST UTC-Offset Pattern (Manual)

```js
// Always write it this way — do NOT shorten to 19800000 (loses readability)
const now = new Date();
const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
// Read IST hours/minutes via UTC accessors on the shifted object:
const istHour = istNow.getUTCHours();
const istMinute = istNow.getUTCMinutes();
// Read IST date string:
const istDateStr = istNow.toISOString().split('T')[0]; // 'YYYY-MM-DD'
```

*Canonical reference: `ExpertDetail.jsx` lines 38–41 (date init) and lines 62–72 (`isSlotInPast`).*

### IST Intl Pattern (Locale API)

```js
// Used in MyBookings.jsx lines 60-65 — more verbose but requires no manual math
const options = {
  timeZone: 'Asia/Kolkata',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', hour12: false
};
const formatter = new Intl.DateTimeFormat('en-US', options);
const parts = formatter.formatToParts(new Date());
const now = {};
parts.forEach(p => { if (p.type !== 'literal') now[p.type] = parseInt(p.value); });
// now.year, now.month, now.day, now.hour, now.minute — all in IST
```

### IST ISO-8601 Suffix Pattern (Backend)

```js
// Used in Booking.js line 79 and bookingController.js line 139
const sessionTime = new Date(`${bookingDate}T${slotTime}:00+05:30`);
// bookingDate: 'YYYY-MM-DD'  slotTime: 'HH:mm'
// e.g. new Date('2026-06-15T14:00:00+05:30') → correct UTC epoch
```

### Logging Pattern

Backend uses `console.error` with a human-readable prefix:
```js
console.error('Error in createBooking:', error);   // bookingController.js line 64
console.error('API Error:', error);                // bookingController.js lines 110, 178
```
Frontend uses `console.error(err)` inside catch blocks without prefixes.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation (Schema & Data Contract)

The phone number format contract must be established in the Mongoose schema first because
every other layer (controller validation, frontend formatter, HTML pattern) derives from it.

**Goal:** Declare that `userPhone` in the `Booking` collection must be exactly
`+91` followed by 10 digits, no spaces, no dashes.

**Outcome:** All booking documents stored in MongoDB will have a uniform phone format that
can be safely displayed, searched, or forwarded to any Indian SMS/telco API.

### Phase 2: Core Implementation

#### 2A — Backend IST Time-Lock

Two independent guards (controller + Mongoose hooks) prevent a booking from being marked
`Completed` before the session has started. The controller guard runs first on the HTTP path;
the Mongoose hook is the last line of defence if the controller is bypassed (e.g., a direct
Mongoose call from a future admin script).

**Helper `parseISTSessionTime`** (`Booking.js` line 78) centralises the ISO-8601+05:30
construction to avoid duplication between the two hooks.

#### 2B — Frontend IST Date & Slot Logic

Three separate locations in `ExpertDetail.jsx` all perform IST date arithmetic:

1. `useState` initialiser (runs once on mount) — sets the date-picker's initial value.
2. `min=` IIFE (evaluated on every render) — prevents the browser date-picker from allowing
   past dates.
3. `isSlotInPast()` (called for every slot on every render) — greys out slots that have
   already passed for today's date.

A fourth IST computation exists in `MyBookings.jsx` (`isSessionPast()`) using the
`Intl.DateTimeFormat` approach for the "Mark as Completed" button gating.

#### 2C — INR Currency Display

Pure JSX interpolation — `₹{expert.hourlyRate}/hr`. No computation required. The glyph is
embedded at two render sites: `ExpertCard.jsx` (listing) and `ExpertDetail.jsx` (detail
sidebar).

#### 2D — +91 Phone Formatting & Validation

Three cooperating layers:

| Layer | Mechanism | Location |
|---|---|---|
| Display format | `onChange` formatter that normalises input to `+91 XXXXXXXXXX` | `ExpertDetail.jsx` lines 410–420 |
| Default value | `useState` initial value `'+91 '` | `ExpertDetail.jsx` line 47 |
| Client validation | HTML5 `pattern="\+91\s[0-9]{10}"` + `title` | `ExpertDetail.jsx` lines 407–408 |
| Submit normalisation | `.replace(/\s/g, '')` strips the display space | `ExpertDetail.jsx` line 176 |
| Server validation | Mongoose `match: [/^\+91[0-9]{10}$/]` | `Booking.js` lines 36–39 |

### Phase 3: Integration

The localization feature integrates silently. No new routes, no new middleware, no new
environment variables. Integration points are:

- `POST /bookings` — receives `userPhone` without whitespace; validated by Mongoose.
- `PATCH /bookings/:id/status` — triggers the IST time-lock check in `updateBookingStatus`.
- Socket `slot_booked` / `slot_released` events — not directly affected, but correctly
  filtered against `selectedDate` which is always an IST-derived string.

### Phase 4: Testing & Validation

No automated test framework is currently configured (`backend/package.json` line 8 has a
placeholder test script). Manual validation steps cover all seven touch-points. When tests
are added, the priority order is: backend unit tests for `parseISTSessionTime`, Mongoose hook
tests, then frontend component tests for `isSlotInPast` and `isSessionPast`.

---

## STEP-BY-STEP TASKS

> **Status: COMPLETED** — all tasks below are already implemented. This section serves as a
> reference map for future developers extending or debugging the feature.

---

### TASK 1 — UPDATE `backend/src/models/Booking.js`: Phone Validation Regex

- **IMPLEMENT**: Add `match` validator to the `userPhone` field in `bookingSchema` enforcing
  the regex `/^\+91[0-9]{10}$/`. This rejects any phone number not starting with `+91` or
  not having exactly 10 subsequent digits.
- **PATTERN**: Follows the existing `userEmail` `match` pattern directly above it at lines
  26–31 — same `[regex, humanMessage]` tuple structure.
- **IMPORTS**: None — uses built-in Mongoose SchemaType options.
- **GOTCHA**: The regex uses no whitespace. A value `+91 9876543210` (with a space) will
  **fail** this regex. The frontend formatter must strip spaces with `.replace(/\s/g, '')`
  before submitting (see Task 5). If you add any other input surface that collects phones,
  remember to strip spaces there too.
- **VALIDATE**:
  ```bash
  cd backend && node -e "
  const B = require('./src/models/Booking');
  const doc = new B({ userPhone: '+91 9876543210' });
  doc.validate().catch(e => console.log('EXPECTED ERROR:', e.errors.userPhone.message));
  "
  ```
  Expected output: `EXPECTED ERROR: Please add a valid Indian phone number starting with +91`

---

### TASK 2 — UPDATE `backend/src/models/Booking.js`: `parseISTSessionTime` Helper

- **IMPLEMENT**: Define a module-scoped arrow function `parseISTSessionTime(bookingDate, slotTime)`
  that constructs `new Date(\`\${bookingDate}T\${slotTime}:00+05:30\`)` and returns `null`
  if `isNaN(session.getTime())`.
- **PATTERN**: The ISO-8601 timezone suffix `+05:30` is the key insight. V8's Date parser
  interprets this as UTC+5:30 and internally stores the UTC epoch, meaning `Date.now()`
  comparisons are always apples-to-apples.
- **IMPORTS**: None — pure JavaScript `Date`.
- **GOTCHA**: `bookingDate` must be `YYYY-MM-DD` and `slotTime` must be `HH:mm` (24-hour,
  zero-padded). If either is malformed, `isNaN` catches it and the function returns `null`.
  Always check for `null` before using the return value.
- **VALIDATE**:
  ```bash
  cd backend && node -e "
  const sessionOk = new Date('2026-12-25T14:00:00+05:30');
  const sessionBad = new Date('invalid-dateT99:99:00+05:30');
  console.log('OK epoch:', sessionOk.getTime());      // large number
  console.log('Bad NaN?', isNaN(sessionBad.getTime())); // true
  "
  ```

---

### TASK 3 — UPDATE `backend/src/models/Booking.js`: `pre('save')` Time-Lock Hook

- **IMPLEMENT**: Register `bookingSchema.pre('save', async function())`. Inside, check
  `this.isModified('status') && this.status === 'Completed'`. Call `parseISTSessionTime`
  with `this.bookingDate` and `this.slotTime`. If result is `null` throw
  `new Error('Invalid booking date or slot time.')`. If `Date.now() < session.getTime()`
  throw `new Error('Time-lock violation: Session has not started yet.')`.
- **PATTERN**: Standard Mongoose pre-save middleware pattern; `this` refers to the document.
- **IMPORTS**: Uses `parseISTSessionTime` defined in the same file (Task 2).
- **GOTCHA**: This hook only fires on `document.save()` calls, **not** on `findOneAndUpdate`.
  That is why Task 4 adds a separate `pre('findOneAndUpdate')` hook. Both guards are
  necessary because different code paths in the codebase use different Mongoose operations.
- **VALIDATE**:
  ```bash
  cd backend && node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  const Booking = require('./src/models/Booking');
  mongoose.connect(process.env.MONGO_URI).then(async () => {
    // Find any confirmed booking and try to force-complete it early
    const b = await Booking.findOne({ status: 'Confirmed' });
    if (!b) { console.log('No confirmed booking found — seed first'); process.exit(); }
    b.status = 'Completed';
    try { await b.save(); console.log('ERROR: Should have thrown!'); }
    catch(e) { console.log('PASS — Hook fired:', e.message); }
    mongoose.disconnect();
  });
  "
  ```

---

### TASK 4 — UPDATE `backend/src/models/Booking.js`: `pre('findOneAndUpdate')` Time-Lock Hook

- **IMPLEMENT**: Register `bookingSchema.pre('findOneAndUpdate', async function())`. Extract
  `status` from `this.getUpdate()` checking both `update.status` and `update.$set.status`.
  If `status === 'Completed'`, similarly extract `bookingDate` and `slotTime` from the update
  object, call `parseISTSessionTime`, and throw if time has not passed.
- **PATTERN**: Mirrors Task 3 but uses `this.getUpdate()` instead of `this` because the
  `this` context in a query middleware refers to the Query, not the Document.
- **IMPORTS**: Uses `parseISTSessionTime` from Task 2.
- **GOTCHA**: This hook only fires when the update payload itself contains `bookingDate` and
  `slotTime`. If those fields are missing from the update (e.g., a partial update that only
  sets `status`), the guard silently skips. The controller-level check (Task 5) covers this
  case by first loading the full document.
- **VALIDATE**: Same pattern as Task 3 but using `findOneAndUpdate`.

---

### TASK 5 — UPDATE `backend/src/controllers/bookingController.js`: IST Time-Lock in `updateBookingStatus`

- **IMPLEMENT**: In `updateBookingStatus`, after loading `booking` from the database but
  before saving, if `normalizedStatus === 'Completed'`:
  1. Construct `sessionTime = new Date(\`\${booking.bookingDate}T\${booking.slotTime}:00+05:30\`)`.
  2. Validate `!isNaN(sessionMs)`.
  3. Compare `Date.now() < sessionMs` → return `400` with a clear IST-specific message
     (include the literal string `" IST"` so the user knows what timezone is being applied).
- **PATTERN**: `bookingController.js` lines 135–157. Uses same ISO-8601 suffix pattern as
  `Booking.js` but inline (no helper function call — minor inconsistency, acceptable since
  the controller has access to the full booking document and can inline the logic).
- **IMPORTS**: None new — uses native `Date`.
- **GOTCHA**: Always call `String(status || '').trim()` to guard against `undefined` or
  whitespace-padded status values arriving from the client before the comparison (line 135).
  Never do `status === 'Completed'` directly on the raw `req.body.status` value.
- **VALIDATE**:
  ```bash
  # With the backend running:
  # 1. Find a booking ID for a future-dated session via GET /bookings?email=<email>
  # 2. Attempt to mark it Completed:
  curl -s -X PATCH http://localhost:5000/bookings/<BOOKING_ID>/status \
    -H "Content-Type: application/json" \
    -d '{"status":"Completed"}' | python3 -m json.tool
  # Expected: {"success":false,"error":"Time-lock violation: This session is scheduled for ..."}
  ```

---

### TASK 6 — UPDATE `frontend/src/pages/ExpertDetail.jsx`: IST Date Initialiser

- **IMPLEMENT**: Pass a lazy initialiser function (not a value) to `useState` for
  `selectedDate`. Inside the function: construct `istNow`, call `.toISOString().split('T')[0]`.
- **PATTERN**: `ExpertDetail.jsx` lines 36–42. The lazy `() => { ... }` form is required to
  avoid re-running the initialiser on every render.
- **IMPORTS**: None — browser/Node built-in `Date`.
- **GOTCHA**: `new Date().toISOString()` always returns the UTC date string. At 00:30 IST
  (which is 19:00 UTC the previous day), `toISOString()` would give yesterday's date. Adding
  5.5h before calling `toISOString()` fixes this. Never use `new Date().toISOString()` alone
  for IST date rendering.
- **VALIDATE**:
  ```bash
  # Simulate a date near midnight. Run in browser console or Node:
  node -e "
  const utcMidnight = new Date('2026-06-15T18:45:00Z'); // 00:15 IST next day
  const withoutIST = utcMidnight.toISOString().split('T')[0];
  const istNow = new Date(utcMidnight.getTime() + 5.5 * 60 * 60 * 1000);
  const withIST = istNow.toISOString().split('T')[0];
  console.log('Without IST fix:', withoutIST); // 2026-06-15 (WRONG — still 15th in UTC)
  console.log('With IST fix:', withIST);       // 2026-06-16 (CORRECT — already 16th in IST)
  "
  ```

---

### TASK 7 — UPDATE `frontend/src/pages/ExpertDetail.jsx`: Date-Picker `min` Attribute

- **IMPLEMENT**: Set the `min` prop of `<input type="date">` to an IIFE that performs the
  same IST offset calculation as Task 6. This prevents the browser's native date picker
  from offering dates in the past.
- **PATTERN**: `ExpertDetail.jsx` lines 303–307.
- **IMPORTS**: None.
- **GOTCHA**: This IIFE runs on **every render**. It is acceptable because date arithmetic is
  cheap (~1µs). Do NOT extract it to a `useMemo` unless profiling shows it as a bottleneck.
  The `min` value is a static string for today's date, so stale values (from a tab left open
  overnight) are an acceptable edge case — the backend always re-validates.
- **VALIDATE**:
  Open `http://localhost:5173/expert/<any-id>`. Click the date input. Confirm that no
  dates before today's IST date are selectable.

---

### TASK 8 — UPDATE `frontend/src/pages/ExpertDetail.jsx`: `isSlotInPast()` Helper

- **IMPLEMENT**: Write `isSlotInPast(slotTime)`:
  1. Compute `istNow` with the UTC-offset pattern.
  2. Derive `todayStr = istNow.toISOString().split('T')[0]`.
  3. If `selectedDate !== todayStr` return `false` immediately (future/past dates cannot have
     "just passed" slots in the present tense).
  4. Parse `slotTime` into `[sHour, sMinute]`.
  5. Read `nowHour = istNow.getUTCHours()` and `nowMinute = istNow.getUTCMinutes()`.
  6. Return `true` if `nowHour > sHour`, or `nowHour === sHour && nowMinute >= sMinute`.
- **PATTERN**: `ExpertDetail.jsx` lines 60–77.
- **IMPORTS**: None.
- **GOTCHA (THE UTC-TRICK EXPLAINED)**: After executing
  `const istNow = new Date(now.getTime() + 5.5*3600*1000)`, the object `istNow` still holds
  a standard JavaScript Date — it has no concept of timezones. Its internal epoch is
  `UTC_epoch + 5.5h_in_ms`. When you call `.getUTCHours()` on it, JavaScript returns
  `(epoch / 3600000) % 24` in UTC — but since you already added 5.5h to the epoch, the
  "UTC hour" of the shifted object is actually the IST hour. This is not a hack; it's a
  deliberate exploitation of the epoch arithmetic. The alternative (`.getHours()`) would
  return the browser's *local* hour, which is incorrect in non-IST browsers.
- **VALIDATE**:
  ```bash
  # In browser console on the ExpertDetail page, at any time:
  # Check a slot that should be in the past (e.g., 09:00 if it is currently 15:00 IST)
  # The slot button should show diagonal "Passed" text and be non-clickable.
  # Check a slot in the future — it should be selectable.
  ```

---

### TASK 9 — UPDATE `frontend/src/pages/MyBookings.jsx`: `isSessionPast()` Using Intl API

- **IMPLEMENT**: Write `isSessionPast(date, time)` using `Intl.DateTimeFormat` with
  `timeZone: 'Asia/Kolkata'`. Call `formatToParts(new Date())`, build a `now` object, then
  do a hierarchical comparison: year → month → day → hour → minute.
- **PATTERN**: `MyBookings.jsx` lines 58–84. This is the **Intl approach** — different from
  the manual offset pattern but equally valid for this use-case because it requires breaking
  the current timestamp into individual date components.
- **IMPORTS**: None — `Intl` is a global in all modern browsers and Node ≥12.
- **GOTCHA**: `Intl.DateTimeFormat` with `hour12: false` can return hour `24` for midnight in
  some locale implementations (en-US returns `0` correctly, but be aware of this edge case if
  you ever change the locale string). Also `formatToParts` returns `month` as a 1-indexed
  integer string matching the natural month number — no need to add 1 as you would with
  `getMonth()`.
- **VALIDATE**:
  Open `http://localhost:5173/my-bookings`. Search for an email that has a `Confirmed`
  booking in the future. The "Mark as Completed" button must be **disabled** (greyed out).
  Find or create a booking in the past and confirm the button is **enabled**.

---

### TASK 10 — UPDATE `frontend/src/components/ExpertCard.jsx`: INR Symbol

- **IMPLEMENT**: Replace any bare `{expert.hourlyRate}` rate display with `₹{expert.hourlyRate}/hr`.
- **PATTERN**: `ExpertCard.jsx` line 82.
- **IMPORTS**: None — `₹` is a Unicode character in a JSX string literal.
- **GOTCHA**: The `hourlyRate` field is a `Number` in `Expert.js` line 58. Mongoose returns
  it as a JS number. React coerces numbers to strings in JSX interpolation, so no explicit
  `.toString()` is needed. However, if the field is ever `undefined` (e.g., from a malformed
  seed document), it renders as `₹undefined/hr`. Add a guard `{expert.hourlyRate ?? '—'}`
  when defensive rendering is needed.
- **VALIDATE**:
  ```bash
  cd frontend && npm run lint
  # Then open http://localhost:5173/ and confirm all expert cards show ₹XXX/hr
  ```

---

### TASK 11 — UPDATE `frontend/src/pages/ExpertDetail.jsx`: INR Symbol in Detail Sidebar

- **IMPLEMENT**: In the "Hourly Rate" stat block, display `₹{expert.hourlyRate}/hr`.
- **PATTERN**: `ExpertDetail.jsx` line 267.
- **IMPORTS**: None.
- **GOTCHA**: Same as Task 10. Additionally, this block uses `text-blue-700` Tailwind class —
  do not change the styling when updating the currency symbol.
- **VALIDATE**:
  Open any expert's detail page at `http://localhost:5173/expert/<id>`. The rate in the left
  sidebar must show `₹` prefix with `/hr` suffix.

---

### TASK 12 — UPDATE `frontend/src/pages/ExpertDetail.jsx`: `formData` Default Phone

- **IMPLEMENT**: Initialise `formData.userPhone` to `'+91 '` (with a trailing space) in the
  `useState` call.
- **PATTERN**: `ExpertDetail.jsx` line 47.
- **IMPORTS**: None.
- **GOTCHA**: The trailing space is intentional — it means the cursor is positioned after
  the space when the user types, so they immediately begin entering their 10-digit number
  without having to move the cursor. Do not remove it. The formatter in Task 13 will handle
  subsequent keystrokes correctly regardless of this initial space.
- **VALIDATE**:
  Open any expert's detail page. Scroll to "Guest Information". The Phone Number field must
  already display `+91 ` when the page loads (no user interaction needed).

---

### TASK 13 — UPDATE `frontend/src/pages/ExpertDetail.jsx`: Phone `onChange` Formatter

- **IMPLEMENT**: In the phone `<input>` `onChange` handler:
  1. Strip all whitespace: `let val = e.target.value.replace(/\s/g, '')`.
  2. Ensure `+91` prefix: if `!val.startsWith('+91')` then `val = '+91' + val.replace(/^\+?9?1?/, '')`.
  3. Truncate to 13 chars (`+91` = 3 chars + 10 digits): `let displayVal = val.slice(0, 13)`.
  4. Re-insert display space after country code: if `displayVal.length > 3` then
     `displayVal = displayVal.slice(0, 3) + ' ' + displayVal.slice(3)`.
  5. `setFormData({...formData, userPhone: displayVal})`.
- **PATTERN**: `ExpertDetail.jsx` lines 410–420.
- **IMPORTS**: None.
- **GOTCHA**: Step 2's `val.replace(/^\+?9?1?/, '')` is a normalisation regex that strips a
  partial `+91` prefix the user might have typed before the guard re-prepends a full `+91`.
  It handles cases like the user deleting the `+` and retyping `91...`. Without this, double
  prefixes like `+91+91...` could appear. Test by manually backspacing over the prefix and
  retyping.
- **VALIDATE**:
  ```bash
  # Manual UI test sequence:
  # 1. Load ExpertDetail page
  # 2. Type '9876543210' — should display '+91 9876543210'
  # 3. Try to type an 11th digit — should be capped, no change
  # 4. Clear field and paste '+91 9876543210' — should remain formatted
  # 5. Delete the '+' and retype — field should self-heal to '+91 ...'
  ```

---

### TASK 14 — UPDATE `frontend/src/pages/ExpertDetail.jsx`: HTML5 Phone `pattern` + `title`

- **IMPLEMENT**: Add `pattern="\+91\s[0-9]{10}"` and
  `title="Please enter a 10-digit number after the +91 prefix"` to the phone `<input>`.
- **PATTERN**: `ExpertDetail.jsx` lines 407–408.
- **IMPORTS**: None.
- **GOTCHA**: The HTML `pattern` attribute is matched against the **entire** field value (it
  implicitly anchors at start and end like `^...$`). The pattern `\+91\s[0-9]{10}` expects
  exactly: literal `+`, literal `9`, literal `1`, exactly one whitespace, then exactly 10
  digits. This matches the display format `+91 9876543210` perfectly. However, if a browser
  auto-fills the field in a different format, the built-in validation will block submission.
  The formatter in Task 13 ensures the display format is always correct, so auto-fill edge
  cases are mitigated.
- **VALIDATE**:
  In browser, clear the phone field, type invalid content (`abc`), and click "Secure My
  Appointment". The browser's native tooltip must appear with the `title` message.

---

### TASK 15 — UPDATE `frontend/src/pages/ExpertDetail.jsx`: Strip Phone Space on Submit

- **IMPLEMENT**: In `handleBooking`, when calling `createBooking`, spread `formData` but
  override `userPhone` with `formData.userPhone.replace(/\s/g, '')`.
- **PATTERN**: `ExpertDetail.jsx` line 176.
- **IMPORTS**: None.
- **GOTCHA**: This is the **critical bridge** between the frontend display format
  (`+91 9876543210`) and the backend regex (`/^\+91[0-9]{10}$/`). If this strip is missing,
  every booking attempt will fail with a Mongoose validation error.
- **VALIDATE**:
  ```bash
  # After stripping, value sent to POST /bookings must be '+919876543210' (no space).
  # Verify in browser Network tab: inspect the POST request body JSON.
  # The 'userPhone' field must NOT contain a space.
  curl -s -X POST http://localhost:5000/bookings \
    -H "Content-Type: application/json" \
    -d '{
      "expert": "<VALID_EXPERT_ID>",
      "userName": "Test User",
      "userEmail": "test@example.com",
      "userPhone": "+919876543210",
      "bookingDate": "2026-12-31",
      "slotTime": "10:00"
    }' | python3 -m json.tool
  # Expected: {"success":true,"data":{...}}
  ```

---

## TESTING STRATEGY

> No automated test framework is currently configured in this project. The backend
> `package.json` (line 8) has `"test": "echo \"Error: no test specified\" && exit 1"`.
> The tasks below define the tests to write when a framework is added.

### Unit Tests (Backend)

**File to create**: `backend/src/tests/localization.test.js`
**Framework recommendation**: Jest (add `npm install --save-dev jest` to `backend`)

```js
// parseISTSessionTime tests
describe('parseISTSessionTime', () => {
  it('returns correct epoch for valid IST date-time', () => {
    // 2026-06-15 14:00 IST = 2026-06-15 08:30:00 UTC
    const d = parseISTSessionTime('2026-06-15', '14:00');
    expect(d.getTime()).toBe(new Date('2026-06-15T08:30:00Z').getTime());
  });
  it('returns null for invalid date string', () => {
    expect(parseISTSessionTime('not-a-date', '14:00')).toBeNull();
  });
  it('returns null for invalid time string', () => {
    expect(parseISTSessionTime('2026-06-15', '99:99')).toBeNull();
  });
});

// userPhone regex tests
describe('Booking schema phone validation', () => {
  it('accepts +91 followed by 10 digits', () => {
    // Use mongoose doc validation
  });
  it('rejects +91 with 9 digits', () => { ... });
  it('rejects +91 with space before digits', () => { ... });
  it('rejects number without +91 prefix', () => { ... });
});
```

### Unit Tests (Frontend)

**File to create**: `frontend/src/tests/localization.test.jsx`
**Framework recommendation**: Vitest + @testing-library/react

```js
// isSlotInPast tests — mock Date to control IST time
describe('isSlotInPast', () => {
  it('returns false when selectedDate is not today in IST', () => { ... });
  it('returns true when slot hour < current IST hour and date is today', () => { ... });
  it('returns false when slot hour > current IST hour and date is today', () => { ... });
  it('returns true when slot hour === current IST hour and slot minute <= current IST minute', () => { ... });
});

// Phone formatter tests
describe('+91 phone formatter', () => {
  it('prepends +91 if missing', () => { ... });
  it('limits total length to 14 chars (+91 space + 10 digits)', () => { ... });
  it('strips space on submit', () => { ... });
});
```

### Integration Tests

**Scope**: End-to-end booking flow with IST awareness.

1. **Phone validation integration**: Submit `POST /bookings` with `+91 9876543210` (with
   space) — must fail with `400`. Submit with `+919876543210` — must succeed with `201`.

2. **Time-lock integration**: Find an existing confirmed booking dated in the future. Submit
   `PATCH /bookings/:id/status` with `{"status":"Completed"}` — must return `400` with the
   IST-specific error message. Set `bookingDate` to yesterday and `slotTime` to `09:00` and
   repeat — must succeed with `200`.

3. **Date-picker min attribute**: Automated with Playwright/Cypress — assert that the
   date-picker's `min` attribute equals today's date in `YYYY-MM-DD` format in IST.

### Edge Cases

| Scenario | Expected Behaviour |
|---|---|
| User in UTC timezone views ExpertDetail at 23:45 UTC (= 05:15 IST next day) | `selectedDate` initialises to the IST date (next day), not UTC date (today) |
| User clicks "09:00" slot at 08:59 IST | Slot is available; `isSlotInPast` returns `false` |
| User clicks "09:00" slot at 09:00 IST exactly | Slot is greyed out; `isSlotInPast` returns `true` (inclusive `>=`) |
| Booking with `slotTime: 'invalid'` tries to become `Completed` | Mongoose hook returns `null` from `parseISTSessionTime` and throws `'Invalid booking date or slot time.'` |
| User types `00000000000` (zeros) into phone field | Accepted by formatter and backend regex — no semantic validation of real Indian numbers |
| Phone field receives auto-fill value `9876543210` (no prefix) | Formatter re-prepends `+91 ` → `+91 9876543210` |
| `hourlyRate` is `0` for an expert | Renders as `₹0/hr` — acceptable and correct |

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
# Frontend — ESLint (react-hooks + react-refresh plugins enabled via eslint.config.js)
cd frontend && npm run lint

# Backend — Node.js syntax check (no ESLint configured in backend; use node --check)
node --check backend/src/models/Booking.js
node --check backend/src/controllers/bookingController.js
```

### Level 2: Unit Tests (Planned — placeholder commands)

```bash
# Backend (once Jest is added)
cd backend && npm test

# Frontend (once Vitest is added)
cd frontend && npx vitest run
```

### Level 3: Integration Tests (Manual — see tasks above)

```bash
# Full stack must be running:
cd backend && node src/app.js &
cd frontend && npm run dev &

# Phone validation (must fail with space):
curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"<ID>","userName":"T","userEmail":"t@t.com","userPhone":"+91 9999999999","bookingDate":"2026-12-31","slotTime":"10:00"}' \
  | python3 -m json.tool
# Expected: {"success":false,"error":"Booking validation failed: userPhone: Please add a valid Indian phone number..."}

# Phone validation (must succeed without space):
curl -s -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -d '{"expert":"<ID>","userName":"T","userEmail":"t@t.com","userPhone":"+919999999999","bookingDate":"2026-12-31","slotTime":"10:00"}' \
  | python3 -m json.tool
# Expected: {"success":true,"data":{...,"userPhone":"+919999999999",...}}

# Time-lock (must fail for future booking):
curl -s -X PATCH http://localhost:5000/bookings/<BOOKING_ID>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Completed"}' \
  | python3 -m json.tool
# Expected: {"success":false,"error":"Time-lock violation: This session is scheduled for ... IST and cannot be completed yet."}
```

### Level 4: Manual UI Validation

| Test | Steps | Expected |
|---|---|---|
| IST date default | Open `http://localhost:5173/expert/<id>` | Date field shows today's IST date |
| IST min date | Open date-picker dropdown | Dates before today are greyed/disabled |
| IST past slots | View ExpertDetail at any time of day | Slots before current IST time show "Passed" overlay |
| INR listing | Open `http://localhost:5173/` | All expert cards show `₹XXX/hr` |
| INR detail | Open any expert detail page | Sidebar "Hourly Rate" shows `₹XXX/hr` |
| +91 default | Open booking form | Phone field pre-filled with `+91 ` |
| +91 formatter | Type `9876543210` in phone field | Displays `+91 9876543210` |
| +91 overflow | Type 11 digits after `+91 ` | 11th digit is rejected; field stays at 13 chars |
| +91 submit strip | Submit booking, check Network tab | `userPhone` in request body is `+91XXXXXXXXXX` (no space) |
| +91 invalid | Submit with `abc` in phone field | Browser tooltip: "Please enter a 10-digit number after the +91 prefix" |

### Level 5: IST Epoch Verification (Node CLI)

```bash
# Verify that the IST ISO-8601 string produces correct UTC epoch:
node -e "
const d = new Date('2026-06-15T14:00:00+05:30');
console.log('UTC epoch (ms):', d.getTime());
console.log('UTC hour:', d.getUTCHours());         // must be 8 (14-5.5=8.5, floor=8)
console.log('UTC minute:', d.getUTCMinutes());      // must be 30 (0.5h = 30min)
// So 14:00 IST = 08:30 UTC ✓
"

# Verify the manual offset trick for IST hour extraction:
node -e "
const now = new Date();
const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
const intlHour = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Kolkata',hour:'numeric',hour12:false}).format(now);
const manualHour = istNow.getUTCHours();
console.log('Intl IST hour:', intlHour);
console.log('Manual UTC-trick IST hour:', manualHour);
console.log('Match:', String(intlHour) === String(manualHour));   // must be true
"
```

---

## ACCEPTANCE CRITERIA

- [x] **AC-1**: The booking form's date-picker initialises to **today's IST date** on page
      load, regardless of the browser's local timezone or server timezone.
- [x] **AC-2**: The booking form's date-picker `min` attribute prevents selection of any
      date prior to today in IST.
- [x] **AC-3**: Time slots before the current IST time are visually disabled with a "Passed"
      label when the selected date is today in IST.
- [x] **AC-4**: Time slots on future dates are never marked as "Passed" regardless of the
      current IST time.
- [x] **AC-5**: The "Mark as Completed" button in MyBookings is disabled until the session's
      scheduled IST date-time has passed, confirmed via the `Intl.DateTimeFormat` check.
- [x] **AC-6**: `PATCH /bookings/:id/status` with `{"status":"Completed"}` for a future
      session returns HTTP `400` with an error message containing `"IST"`.
- [x] **AC-7**: The Mongoose `pre('save')` hook independently rejects marking a future
      session as `Completed`, throwing `'Time-lock violation: Session has not started yet.'`.
- [x] **AC-8**: `POST /bookings` with `userPhone: "+91 9876543210"` (with space) returns
      HTTP `400` with Mongoose validation error referencing `+91`.
- [x] **AC-9**: `POST /bookings` with `userPhone: "+919876543210"` (no space) returns HTTP
      `201` and the stored document has `userPhone: "+919876543210"`.
- [x] **AC-10**: Every expert card on the listing page (`ExpertCard.jsx`) displays the
      hourly rate as `₹{N}/hr`.
- [x] **AC-11**: The expert detail page sidebar displays the hourly rate as `₹{N}/hr`.
- [x] **AC-12**: The phone input field is pre-populated with `+91 ` on initial page render.
- [x] **AC-13**: Typing digits into the phone field formats them as `+91 XXXXXXXXXX` with
      input capped at 13 characters (`+91` + space + 10 digits).
- [x] **AC-14**: The phone `pattern` attribute triggers the browser's built-in validation
      tooltip when an invalidly formatted number is submitted.
- [x] **AC-15**: The booking payload sent to the backend always contains `userPhone` without
      whitespace, verified via Network inspector.
- [x] **AC-16**: No new npm packages are added to either `backend/package.json` or
      `frontend/package.json` as a result of this feature.
- [x] **AC-17**: `cd frontend && npm run lint` exits with code `0` (zero ESLint errors).

---

## COMPLETION CHECKLIST

- [x] All 15 tasks completed and each VALIDATE step confirmed
- [x] Backend phone regex blocks `+91 XXXXXXXXXX` (with space) and allows `+91XXXXXXXXXX`
- [x] Backend IST time-lock fires in both controller and Mongoose hooks
- [x] Frontend `isSlotInPast` uses `.getUTCHours()` on IST-shifted Date (not `.getHours()`)
- [x] Frontend `isSessionPast` in MyBookings uses `Intl.DateTimeFormat` with `Asia/Kolkata`
- [x] Both INR symbol locations (`ExpertCard.jsx:82`, `ExpertDetail.jsx:267`) display `₹`
- [x] Phone formatter caps input at 13 chars and normalises `+91` prefix
- [x] Phone value stripped of spaces before `createBooking` API call
- [x] `npm run lint` passes with zero errors in `frontend/`
- [x] Manual UI checklist fully verified (see Level 4 validation table)
- [x] Zero new runtime dependencies added to either package

---

## NOTES

### Design Decision 1: Manual IST Offset vs. a Timezone Library

**Decision**: Use `new Date(Date.now() + 5.5 * 60 * 60 * 1000)` instead of a library.

**Context**: Three well-known libraries exist for timezone-aware JavaScript date operations:
- `date-fns-tz` (~13 KB gzipped): wraps `Intl` API, tree-shakeable.
- `luxon` (~70 KB gzipped): self-contained, rich API.
- `moment-timezone` (~130 KB gzipped): deprecated, very heavy.

**Rationale for manual offset**:
1. **India has no DST**: `Asia/Kolkata` has been at UTC+05:30 permanently since 1945 with no
   daylight saving transitions ever (confirmed: IANA tzdata 2024a). A fixed constant
   `5.5 * 60 * 60 * 1000` will never need updating.
2. **Zero dependency cost**: The feature touches three files. Adding a library for three
   arithmetic operations is disproportionate. The bundle does not grow; startup time does not
   increase.
3. **Readability of intent**: `now.getTime() + (5.5 * 60 * 60 * 1000)` is self-documenting
   to any JavaScript developer. It is immediately obvious what is being calculated and why.
4. **Existing Intl global**: Where date-component extraction was needed (`MyBookings.jsx`),
   the built-in `Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata' })` was used
   instead of a library — same zero-dependency result with IANA tz database support
   maintained by the browser/Node runtime.

**Trade-off accepted**: If India ever observes DST (an extremely hypothetical scenario),
the constant would need a library replacement. This risk is negligible.

**When to reconsider**: If SkillSync expands to multi-timezone support (e.g., session with an
expert in another country), a library (`date-fns-tz` is recommended) should be introduced at
that point for all timezone handling.

---

### Design Decision 2: The UTC-Trick — Why `.getUTCHours()` Instead of `.getHours()`

**The Trick**:
```js
const now = new Date();
const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
const istHour = istNow.getUTCHours(); // ← Note: UTC accessor, not local accessor
```

**Why `.getHours()` is wrong**: `.getHours()` returns the hour in the **browser's local
timezone**. If a SkillSync user opens the site from a browser configured to UTC (common in
developer environments), `.getHours()` would give UTC hours, making IST slot detection
incorrect by 5.5 hours.

**Why `.getUTCHours()` is correct after the offset**: After adding `5.5h` to the epoch,
`istNow` is an object whose internal epoch is `(real_UTC_epoch + 5.5h_in_ms)`. Calling
`.getUTCHours()` on it computes `Math.floor((epoch / 3600000) % 24)` where `epoch` is the
shifted value — which is exactly the IST hour. The "UTC" label on the method refers to how
the epoch is interpreted, not what timezone the object represents. The object has no timezone
metadata; it is just a shifted number.

**Verification**:
```js
// At 09:00 IST (03:30 UTC):
const realNow = new Date('2026-06-15T03:30:00Z');
const istNow = new Date(realNow.getTime() + 5.5 * 3600 * 1000);
istNow.getUTCHours();   // → 9  ✓ (IST hour)
istNow.getHours();      // → 9  in IST browser, but 3 in UTC browser — UNRELIABLE
```

---

### Design Decision 3: ISO 8601 with `+05:30` Suffix for Backend Date Construction

**Decision**: `new Date(\`\${bookingDate}T\${slotTime}:00+05:30\`)` in both `Booking.js`
and `bookingController.js`.

**Alternatives considered**:
- `new Date(\`\${bookingDate}T\${slotTime}:00Z\`)` — wrong: interprets time as UTC, off by
  5.5 hours.
- `new Date(\`\${bookingDate} \${slotTime}\`)` — browser-dependent parsing, ECMA-262 spec
  calls this "implementation-defined". Avoid.
- Adding `5.5 * 3600 * 1000` after a UTC date — same result but less readable.

The `+05:30` suffix is part of the ECMA-262 §20.4.1.15 grammar for DateTimeString. All V8
versions from Node 12+ and all modern browsers parse it identically, producing the correct
UTC-epoch millisecond value. `Date.now()` then safely compares against this epoch.

---

### Design Decision 4: Hardcoded ₹ Symbol vs. `Intl.NumberFormat`

**Decision**: Embed `₹` as a Unicode literal directly in JSX.

**Alternative**: `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(expert.hourlyRate)`
which would render as `₹3,500.00`.

**Rationale for literal**:
1. The current design shows `₹3500/hr` — no decimals, no thousands separator. Using Intl
   would produce `₹3,500.00/hr` which is verbose for this compact card UI.
2. Two render sites only; the Intl overhead (object creation per render) is not warranted.
3. The ₹ glyph (U+20B9) is supported in all environments targeted by SkillSync — no
   polyfill needed.

**Future work**: When a "payment summary" screen is added (Phase 2), use
`Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` for proper formatting
with thousands separators and two decimal places.

---

### Design Decision 5: Display Format `+91 XXXXXXXXXX` vs. Storage Format `+91XXXXXXXXXX`

**Decision**: Two separate representations — a space-separated display format for UX,
and a compact storage format matching the Mongoose regex.

**Rationale**:
- `+91 9876543210` (with space) is how Indian phone numbers are conventionally written and
  displayed — it groups the country code from the subscriber number visually.
- `+91[0-9]{10}` (no space) is universally expected by telco APIs, SMS gateways, and
  WhatsApp Business API payloads — no downstream consumer should receive a space.
- The HTML5 `pattern="\+91\s[0-9]{10}"` (one literal `\s`) enforces the display format at
  the browser level, providing immediate feedback.
- `.replace(/\s/g, '')` on submit is the single point of responsibility for converting
  between the two formats.

---

### Why No Utility Module?

The localization logic is currently spread across files without a shared `localization.js`
utility. This is acceptable at the current scale (3 frontend files, 1 backend file). The
thresholds for extracting a shared utility are:

1. A fourth file needs IST logic, OR
2. The IST offset constant needs to change (requiring a multi-file find-replace), OR
3. A date formatting function needs to be reused in 3+ places.

When these thresholds are met, create:
- `frontend/src/utils/istTime.js` — exports `getISTNow()`, `isISTDateToday()`,
  `isSlotPast(date, time)`.
- `backend/src/utils/istTime.js` — exports `parseISTSessionTime(date, time)`.

Do not create these prematurely — YAGNI applies here.

---

### Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| `min` IIFE re-runs every render | Negligible (~1µs per render) | Acceptable; use `useMemo` only if profiling flags it |
| `isSlotInPast` runs for every slot on every render | 13 slots × ~2µs = ~26µs | Negligible at this scale |
| Stale `min` date if tab left open past midnight IST | User could see yesterday's date as minimum | Re-fetch on focus event in future; or add a `useEffect` that updates `selectedDate` on midnight |
| `userPhone` regex accepts non-existent Indian numbers (e.g., `+910000000000`) | No semantic mobile number validation | Acceptable for MVP; add Numverify or similar API in Phase 2 |
| `Expert.js` comment says "Rate charged per hour of session (USD)" (line 57) | Comment mismatch — rate is displayed as INR | Fix comment: change `(USD)` to `(INR)` in a separate housekeeping PR |
| `MyBookings.jsx` `currentTime` state updates every 10 seconds | `isSessionPast` re-evaluated on a 10s lag | Safe; 10s granularity is acceptable for a manual "Mark as Completed" action |

---

### Future Improvements

1. **Extract shared IST utils**: See "Why No Utility Module?" section above for criteria.
2. **`Intl.NumberFormat` for currency**: Adopt for any future payment/invoice screens.
3. **Midnight tab-open edge case**: Add a `visibilitychange` event listener that resets
   `selectedDate` when the tab regains focus, ensuring the date-picker is always showing
   the current IST date.
4. **Phone validation API**: Integrate Numverify, AbstractAPI or Twilio Lookup to reject
   non-existent Indian mobile numbers at booking time.
5. **Backend timezone config**: Consider setting `process.env.TZ = 'Asia/Kolkata'` in
   `backend/src/app.js` startup so that `new Date().toString()` log output always shows IST.
   This is purely cosmetic for logs and does NOT remove the need for explicit `+05:30` in
   Date constructors (explicit is always safer than implicit).

---

## DECISION LOG

| Date | Decision | Made By | Rationale |
|---|---|---|---|
| 2026-05-24 | Use manual UTC+5:30 offset instead of `date-fns-tz` | SkillSync Team | India has no DST; zero dependency cost; self-documenting arithmetic |
| 2026-05-24 | Use `.getUTCHours()` on IST-shifted Date for hour extraction | SkillSync Team | Eliminates browser-timezone dependency; more reliable than `.getHours()` |
| 2026-05-24 | Use ISO 8601 `+05:30` suffix for backend Date construction | SkillSync Team | ECMA-262 compliant; readable; produces correct UTC epoch in all V8 versions |
| 2026-05-24 | Hardcode ₹ Unicode glyph instead of `Intl.NumberFormat` | SkillSync Team | Simpler for compact card UI; no thousand separators needed at MVP stage |
| 2026-05-24 | Display space in phone (`+91 X`) but strip on submit | SkillSync Team | Matches Indian display convention; backend regex requires no space |
| 2026-05-24 | Dual time-lock guard (controller + Mongoose hook) | SkillSync Team | Defense-in-depth: controller fires on HTTP path; hook fires on any Mongoose save |
| 2026-05-24 | Use `Intl.DateTimeFormat` in `MyBookings.jsx` vs. manual offset | SkillSync Team | Date-part extraction (year/month/day) is cleaner with Intl; shows both patterns are valid in codebase |

---

*Document generated: 2026-05-24 | Author: SkillSync Engineering*
*Template: `.agent/commands/core_piv_loop/plan-feature.md`*
*PRD source: `docs/SkillSync_PRD.md`*
