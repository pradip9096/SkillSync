# Feature: Expert Directory & Listing

> The following plan is a comprehensive, production-grade implementation reference. Before touching any file, re-read the **CONTEXT REFERENCES** section and validate that all patterns still match the live codebase.

---

## Feature Description

The **Expert Directory & Listing** is the primary discovery interface of the SkillSync platform. It is the first user-facing page a Knowledge Seeker reaches after the Home landing page and serves as the gateway to the entire booking flow.

The page renders a responsive, animated grid of `ExpertCard` components. Each card summarises an expert's name, category badge, star rating, years of experience, and hourly rate in INR (₹). A sticky top navigation bar provides persistent access; a debounced text-search field and a category dropdown filter act in concert to narrow the visible result set by delegating all filtering work to the MongoDB backend, rather than performing in-browser array manipulation.

On load, and on every subsequent filter change, the component issues a `GET /experts` request with `search` and `category` query parameters and replaces its local `experts` state with the fresh payload. Four explicit UI states are rendered: **Loading** (animated `Loader2` spinner), **Error** (red `AlertCircle` banner), **Results** (card grid), and **Empty** (friendly empty-state banner).

The feature was the first fully-functional page in the MVP and establishes the canonical React state + Axios service layer patterns that all subsequent pages (`ExpertDetail`, `MyBookings`) mirror.

---

## User Story

```
As a Knowledge Seeker (prospective client)
I want to browse all available experts, search by name, and filter by professional category
So that I can quickly identify the most relevant expert for my specific need and navigate to
their profile to book a session.
```

**Related PRD User Stories:**
- **EX-01** – Category filter updates listing instantly (docs/SkillSync_PRD.md, line 45)

---

## Problem Statement

When users visit SkillSync they have no mechanism to discover *which* experts are available or *what* specialisations those experts cover. Without a directory:

1. **Discovery is impossible** — there is no entry point into the booking flow.
2. **Scale is unmanageable** — as the expert count grows, an unfiltered full-list dump would be unusable without search and filter controls.
3. **Performance would degrade** — client-side filtering of a large dataset causes unnecessary data transfer and UI thrashing.
4. **Inconsistent data is a risk** — without schema-enforced category values, filter labels would mismatch stored data (e.g. "tech" vs "Technology").

---

## Solution Statement

Implement a full-stack search, filter, and display pipeline with three layers:

1. **Database layer (`Expert` Mongoose schema)** — enforce a strict `enum` for `category` and provide an indexed `name` field so MongoDB regex queries are efficient.
2. **API layer (`getExperts` controller)** — accept `search` (case-insensitive regex), `category` (exact enum match), `page`, and `limit` query params; return a `{ success, count, total, pages, data }` envelope.
3. **UI layer (`ExpertListing` + `ExpertCard`)** — manage `useState`/`useEffect` lifecycle, debounce user input by 500 ms to limit API call frequency, render four exhaustive UI states (loading, error, results, empty), and display each expert as a polished card with staggered CSS entrance animation.

---

## Feature Metadata

| Field | Value |
|---|---|
| **Feature Type** | New Capability (first user-facing discovery page of MVP) |
| **Estimated Complexity** | Medium |
| **Primary Systems Affected** | Backend: `Expert` model, `expertController`, `expertRoutes`, `app.js` · Frontend: `ExpertListing.jsx`, `ExpertCard.jsx`, `api.js`, `App.jsx` |
| **Dependencies (Backend)** | `mongoose`, `express`, `dotenv`, `cors` |
| **Dependencies (Frontend)** | `react`, `react-dom`, `react-router-dom`, `axios`, `lucide-react`, `tailwindcss` |
| **Phase** | MVP Phase 1 |
| **PRD Priority** | Must Have |
| **PRD Reference** | `docs/SkillSync_PRD.md` lines 33, 45–49 |

---

## CONTEXT REFERENCES

### Relevant Codebase Files — IMPORTANT: READ THESE BEFORE IMPLEMENTING

| File | Lines | Why |
|---|---|---|
| `backend/src/models/Expert.js` | 1–68 (full file) | Canonical Mongoose schema — defines all field names, types, `enum` values, and validators; the single source of truth for `category` labels used in the frontend filter dropdown. |
| `backend/src/controllers/expertController.js` | 17–70 | `getExperts` function — shows the full query-building pattern: extract params → build `query` object → conditional regex for `search` → conditional exact match for `category` → paginate with `skip/limit` → sort by `createdAt: -1` → return envelope. Mirror this for any future list endpoint. |
| `backend/src/controllers/expertController.js` | 79–102 | `getExpertById` function — 404 guard pattern; the model for every single-resource GET endpoint in the project. |
| `backend/src/controllers/expertController.js` | 111–141 | `rateExpert` — rolling average formula: `((currentAvg * count) + newRating) / (count + 1)`. Referenced for the `POST /experts/:id/rate` route wired to the same router file. |
| `backend/src/routes/expertRoutes.js` | 1–34 (full file) | Route registration pattern using CommonJS `require` and `module.exports`; shows how to group GET and POST routes on a shared base path mounted in `app.js`. |
| `backend/src/app.js` | 94–101 | Route mounting — `app.use('/experts', expertRoutes)` is the exact line that binds this feature's routes to the running Express server. |
| `backend/src/app.js` | 41–50 | Socket.io setup and `app.set('io', io)` — understanding this is essential because booking confirmation (a downstream feature) broadcasts via `io`; expert listing itself does NOT use sockets, but the Socket.io room pattern (`join_expert_room`) is the bridge to the real-time booking layer. |
| `backend/src/config/db.js` | 1–36 (full file) | Database connection pattern — `connectDB` is async and `await`-ed in `startServer`; any seed or test utility must also call `mongoose.connect(process.env.MONGO_URI)` before reading/writing. |
| `backend/src/seeds/expertSeeder.js` | 1–106 (full file) | Seed data structure — the 6 sample experts cover all 6 enum categories and demonstrate that `profileImage` is intentionally omitted (defaults to `https://placehold.co/150`), proving the fallback avatar path is not a bug. |
| `frontend/src/pages/ExpertListing.jsx` | 1–154 (full file) | The page component itself — reference for the 5-state hook pattern (`experts`, `loading`, `error`, `search`, `category`), the debounce implementation inside `useEffect`, the four render branches, and the Tailwind responsive grid classes. |
| `frontend/src/components/ExpertCard.jsx` | 1–102 (full file) | The reusable card — note the `onError` callback for the `<img>` tag that swaps to the `ui-avatars.com` initials URL; the `animationDelay` inline style; and the `Link to={/expert/${expert._id}}` navigation target. |
| `frontend/src/services/api.js` | 11–32 | Axios instance creation (`baseURL: 'http://localhost:5000'`) and the `fetchExperts(params)` export — the canonical service layer pattern for all HTTP calls in this frontend. |
| `frontend/src/App.jsx` | 36–48 | Route definitions — `<Route path="/experts" element={<ExpertListing />} />` is the registration line that makes this page reachable at `/experts`. |
| `frontend/src/components/Navbar.jsx` | 46–56 | "Explore" nav link — uses `useLocation()` to conditionally apply `text-blue-600 bg-blue-50` active styles when the pathname is `/experts`. Demonstrates the active-link highlighting pattern. |
| `frontend/src/index.css` | 11–38 | Custom Tailwind utilities — `animate-fade-in` (0.5s fadeIn), `animate-slide-up` (0.6s slide from 20px), and delay helpers (`delay-100`, `delay-200`, `delay-300`). The `ExpertCard` uses `animate-slide-up` plus inline `animationDelay` for the stagger effect. |

### New Files Created by This Feature

| File | Role |
|---|---|
| `backend/src/models/Expert.js` | Mongoose schema and model (CommonJS `module.exports`) |
| `backend/src/controllers/expertController.js` | Three async handler functions (`getExperts`, `getExpertById`, `rateExpert`) |
| `backend/src/routes/expertRoutes.js` | Express Router with three route bindings |
| `backend/src/seeds/expertSeeder.js` | One-shot database population utility |
| `frontend/src/pages/ExpertListing.jsx` | Page component managing search, filter, and display states |
| `frontend/src/components/ExpertCard.jsx` | Reusable expert summary card with image fallback and animation |

### Files Modified to Integrate This Feature

| File | Change |
|---|---|
| `backend/src/app.js` | Added `app.use('/experts', expertRoutes)` at line 100 |
| `frontend/src/App.jsx` | Added `import ExpertListing` and `<Route path="/experts" element={<ExpertListing />} />` |
| `frontend/src/services/api.js` | Added `fetchExperts(params)` and `fetchExpertById(id)` exports |
| `frontend/src/components/Navbar.jsx` | Added "Explore" `<Link to="/experts">` with active-state styling |
| `frontend/src/index.css` | Added `animate-fade-in`, `animate-slide-up`, and delay utility classes |

### Relevant Documentation — READ BEFORE IMPLEMENTING

| Resource | Section | Why |
|---|---|---|
| [Mongoose Query Docs](https://mongoosejs.com/docs/queries.html) | `Model.find()`, `limit()`, `skip()`, `sort()` | Confirms the chaining API used in `getExperts`; pagination relies on `.limit(Number(limit)).skip(skip)` — note the explicit `Number()` cast because `req.query` values are always strings. |
| [Mongoose Schema Validation](https://mongoosejs.com/docs/validation.html) | `enum` validator, custom error messages | Explains the `enum: ['Technology', ...]` pattern and the `[true, 'Please add a name']` message-tuple syntax on line 14 of `Expert.js`. |
| [React `useEffect` + Cleanup](https://react.dev/reference/react/useEffect#stopping-fetching-when-component-unmounts) | Effect cleanup and debounce | The cleanup `return () => clearTimeout(delayDebounceFn)` on line 71 of `ExpertListing.jsx` is essential — without it, a fast-typing user triggers multiple overlapping fetches and potentially updates state on an unmounted component. |
| [Axios Instance Docs](https://axios-http.com/docs/instance) | `axios.create({ baseURL })` | Explains why `API.get('/experts', { params })` sends `search` and `category` as URL query parameters automatically. |
| [React Router `<Link>`](https://reactrouter.com/en/main/components/link) | `to` prop, dynamic segments | Used in `ExpertCard` for the `View Profile & Book` CTA: `to={/expert/${expert._id}}` maps to the `<Route path="/expert/:id">` in `App.jsx`. |
| [Tailwind CSS Grid](https://tailwindcss.com/docs/grid-template-columns) | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | The responsive card grid breakpoints used in `ExpertListing.jsx` line 136. |
| [lucide-react Icons](https://lucide.dev/icons/) | `Search`, `Filter`, `Loader2`, `AlertCircle`, `Star`, `Briefcase`, `Award` | All icons used across `ExpertListing.jsx` and `ExpertCard.jsx`; must be individually named imports — no default export. |
| [ui-avatars.com API](https://ui-avatars.com/) | Query string params | `name`, `background`, `color`, `size` — used to generate initials-based avatars as the `onError` fallback in `ExpertCard.jsx` line 49. |

---

## Patterns to Follow

### 1. Module System Split

The project uses **two different module systems** — never mix them:

```js
// ✅ Backend (CommonJS)
const Expert = require('../models/Expert');
module.exports = { getExperts, getExpertById };

// ✅ Frontend (ES Modules)
import { fetchExperts } from '../services/api';
export default ExpertListing;
```

> **GOTCHA**: Writing `import` in a backend `.js` file or `require()` in a frontend `.jsx` file will break at runtime. The backend uses `"type"` omitted from `package.json` (defaults to CommonJS), while the frontend Vite config uses `"type": "module"`.

### 2. API Response Envelope Pattern

Every controller response — success or failure — uses the same `{ success, ... }` envelope. Never return raw data arrays or plain strings:

```js
// ✅ Success (list)
res.status(200).json({ success: true, count: experts.length, total, pages, data: experts });

// ✅ Success (single)
res.status(200).json({ success: true, data: expert });

// ✅ Not found
res.status(404).json({ success: false, error: 'Expert not found' });

// ✅ Server error
res.status(500).json({ success: false, error: 'Server Error' });
```

Frontend consumers unwrap data as: `const { data } = await fetchExperts(...); setExperts(data.data);` — the outer `data` is the Axios response body, the inner `.data` is the array inside the envelope.

### 3. Controller Error Handling Pattern

Every controller is an `async (req, res) => {}` arrow function wrapped in `try/catch`. The catch block always `console.error`s and sends a 500:

```js
// backend/src/controllers/expertController.js lines 63-69
} catch (error) {
  console.error('API Error:', error);
  res.status(500).json({ success: false, error: 'Server Error' });
}
```

### 4. React State + Effect + Debounce Pattern

The lifecycle pattern established in `ExpertListing.jsx` (lines 26–72) is canonical for all data-fetching pages:

```jsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [filterA, setFilterA] = useState('');

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data } = await apiService({ filterA });
      setData(data.data);
      setError(null);
    } catch (err) {
      setError('User-friendly error message.');
    } finally {
      setLoading(false);
    }
  };
  const timer = setTimeout(fetchData, 500); // debounce
  return () => clearTimeout(timer);          // cleanup
}, [filterA]);
```

### 5. Four-State Render Pattern

Every listing page renders exactly four mutually exclusive states — no `&&` shortcuts:

```jsx
{loading ? <LoadingSpinner /> : error ? <ErrorBanner /> : data.length > 0 ? <Grid /> : <EmptyState />}
```

### 6. Naming Conventions

| Context | Convention | Example |
|---|---|---|
| React pages | PascalCase `.jsx` | `ExpertListing.jsx`, `ExpertDetail.jsx` |
| React components | PascalCase `.jsx` | `ExpertCard.jsx`, `Navbar.jsx` |
| Service functions | lower camelCase | `fetchExperts`, `fetchExpertById` |
| Backend controllers | lower camelCase | `getExperts`, `getExpertById`, `rateExpert` |
| Backend route files | camelCase + `Routes` suffix | `expertRoutes.js`, `bookingRoutes.js` |
| CSS animation utilities | kebab-case with `animate-` prefix | `animate-fade-in`, `animate-slide-up` |

### 7. Image Fallback Pattern

Always provide an `onError` handler on `<img>` tags to prevent broken image icons:

```jsx
// frontend/src/components/ExpertCard.jsx lines 43-51
<img
  src={expert.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=256`}
  alt={expert.name}
  onError={(e) => {
    e.target.onerror = null; // prevent infinite loop
    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=256`;
  }}
/>
```

Setting `e.target.onerror = null` before assigning `.src` is critical — without it, if the fallback URL also fails, you get an infinite error loop.

### 8. Staggered Animation Pattern

To achieve the waterfall card entrance, pass `index` as a prop and apply it as an inline `animationDelay` style on the card root, combined with the `animate-slide-up` utility class:

```jsx
// frontend/src/components/ExpertCard.jsx lines 35-38
<div
  className="... animate-slide-up"
  style={{ animationDelay: `${index * 100}ms` }}
>
```

The `animate-slide-up` class is defined in `frontend/src/index.css` (lines 16–18) as a `slideUp` keyframe animation running for 0.6s. The inline `animationDelay` overrides the start time per card.

### 9. Pagination Query Pattern

The `getExperts` controller converts `page` and `limit` to numbers explicitly to avoid string arithmetic:

```js
// backend/src/controllers/expertController.js lines 20, 45, 48-51
const { page = 1, limit = 10, search, category } = req.query;
const skip = (page - 1) * limit;
const experts = await Expert.find(query)
  .limit(Number(limit))
  .skip(skip)
  .sort({ createdAt: -1 });
```

> **GOTCHA**: `req.query` always delivers strings. `'10' * '1'` accidentally works due to JS coercion but `(page - 1) * limit` can produce NaN in edge cases. Use `Number()` explicitly on `limit` in `.limit()`.

### 10. Logging Pattern

Backend uses `console.error` for errors only; there is no structured logging library. Pattern is:

```js
console.error('API Error:', error);           // in catch blocks
console.log(`MongoDB Connected: ${host}`);    // in startup only
```

Do NOT use `console.log` in request handlers for normal operations — it creates noise in production.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation — Database Schema & Backend Infrastructure

Establish the data contract before writing any API or UI code. The Expert schema is the ground truth for every layer above it.

**Goal**: A running MongoDB collection with enforced shape, populated with seed data, and a verified database connection.

**Tasks:**
- Define the Mongoose `expertSchema` with all required fields, validators, enum constraints, and timestamps.
- Export the `Expert` model using CommonJS.
- Verify the `connectDB` utility reads from `process.env.MONGO_URI` in `backend/.env`.
- Write and run the `expertSeeder.js` script to verify schema acceptance of all 6 sample records.

---

### Phase 2: Core Implementation — API Endpoints

Build the three REST endpoints that expose expert data to consumers.

**Goal**: `GET /experts`, `GET /experts/:id`, and `POST /experts/:id/rate` are all reachable and return well-formed JSON envelopes.

**Tasks:**
- Implement `getExperts` with conditional `$regex` search and category filter, pagination, and sorting.
- Implement `getExpertById` with a 404 guard.
- Implement `rateExpert` with rolling average formula.
- Wire all three to the Express Router in `expertRoutes.js`.
- Mount the router in `app.js` at `/experts`.

---

### Phase 3: Integration — Frontend Service Layer & Routing

Connect the React application to the API and register the new page in the router.

**Goal**: Navigating to `http://localhost:5173/experts` renders the `ExpertListing` page with live data from the backend.

**Tasks:**
- Create the Axios instance in `api.js` and export `fetchExperts` and `fetchExpertById`.
- Register the `ExpertListing` route in `App.jsx`.
- Add the "Explore" link to `Navbar.jsx` with active-state highlighting.
- Define the custom CSS animation utilities in `index.css`.
- Implement the `ExpertCard` component with all display fields, image fallback, and staggered animation.
- Implement the `ExpertListing` page with all five state hooks, debounced effect, and four-state render tree.

---

### Phase 4: Testing & Validation

Verify correctness at each layer with executable commands and manual UI walkthroughs.

**Goal**: All API endpoints return expected payloads for happy paths and error scenarios; UI correctly transitions between all four render states.

**Tasks:**
- Run `curl` or REST client requests against each endpoint with varied parameters.
- Manually test the debounce behaviour (type fast, verify only one API call fires after 500 ms).
- Test the `onError` image fallback by temporarily setting `profileImage` to a broken URL.
- Test empty state by filtering to a category with no seeded experts (there are none — only one expert per category is seeded, so filtering multiple categories then removing seed records creates an empty state).
- Verify responsive grid layout at 375 px, 768 px, and 1280 px viewport widths.
- Run ESLint to confirm no React Hooks rule violations.

---

## STEP-BY-STEP TASKS

> Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1 — CREATE `backend/src/models/Expert.js`

- **IMPLEMENT**: Define `expertSchema` using `mongoose.Schema`. Required fields: `name` (String, trim), `category` (String, enum of 6 values), `experience` (Number), `description` (String), `hourlyRate` (Number). Optional with defaults: `rating` (Number, min 1, max 5, default 4.5), `numReviews` (Number, default 0), `profileImage` (String, default `'https://placehold.co/150'`). Enable `{ timestamps: true }` as the second argument.
- **PATTERN**: `backend/src/models/Expert.js` lines 10–65 — exact implementation already in place; use as the reference for any new model.
- **IMPORTS**: `const mongoose = require('mongoose');`
- **GOTCHA**: The `enum` array — `['Technology', 'Finance', 'Health', 'Marketing', 'Design', 'Business']` — must be identical (same casing) in the schema, the frontend `categories` array in `ExpertListing.jsx` (line 35), and the seeder data. A mismatch silently fails the Mongoose validator, returning a 500 instead of saving the document.
- **GOTCHA**: The `required` field for `category` uses the shorthand `required: true`, not the message-tuple form used on `name`. Be consistent with whichever form you adopt — the tuple `[true, 'message']` gives better error messages in API responses.
- **VALIDATE**: `node -e "const m = require('./backend/src/models/Expert'); console.log(m.schema.paths);"` — should print all defined field paths without throwing.

---

### TASK 2 — CREATE `backend/src/config/db.js`

- **IMPLEMENT**: Export `connectDB` — an async function that calls `mongoose.connect(process.env.MONGO_URI)`, logs `conn.connection.host` on success, and calls `process.exit(1)` on failure. Load `dotenv` at the top.
- **PATTERN**: `backend/src/config/db.js` lines 20–32 (full implementation already present).
- **IMPORTS**: `const mongoose = require('mongoose'); const dotenv = require('dotenv');`
- **GOTCHA**: `dotenv.config()` must be called before any `process.env` access. If `db.js` is required before `dotenv` is loaded elsewhere, `MONGO_URI` will be `undefined` and the connection will fail silently or throw a malformed URI error.
- **VALIDATE**: `cd backend && MONGO_URI=<your_atlas_uri> node -e "require('./src/config/db')()"` — should print `MongoDB Connected: <cluster-host>` within 3 seconds.

---

### TASK 3 — CREATE `backend/src/seeds/expertSeeder.js`

- **IMPLEMENT**: Load `dotenv` with an explicit `path` argument pointing to `../../.env` (relative to the seeds directory). Import `Expert` and `Booking` models. Define the 6 sample expert objects (one per category). In the `seedData` async function: `mongoose.connect` → `Expert.deleteMany()` → `Booking.deleteMany()` → `Expert.insertMany(experts)` → `process.exit()`. Wrap in `try/catch` with `process.exit(1)` on error.
- **PATTERN**: `backend/src/seeds/expertSeeder.js` lines 14–15 for the explicit dotenv path; lines 86–96 for the delete-then-insert pattern.
- **IMPORTS**: `const mongoose = require('mongoose'); const dotenv = require('dotenv'); const Expert = require('../models/Expert'); const Booking = require('../models/Booking'); const path = require('path');`
- **GOTCHA**: The seeder calls `Booking.deleteMany()` in addition to `Expert.deleteMany()`. This is intentional — seeding new experts creates new MongoDB `_id` values, which would orphan any existing bookings. Always clear both collections together. If `Booking` model is not yet created when this runs for the first time, comment out the `Booking.deleteMany()` line temporarily.
- **GOTCHA**: `dotenv.config({ path: path.join(__dirname, '../../.env') })` — the `__dirname` of `expertSeeder.js` is `backend/src/seeds/`. Two levels up (`../../`) reaches `backend/`. Ensure `backend/.env` exists with `MONGO_URI` set.
- **VALIDATE**: `cd backend && node src/seeds/expertSeeder.js` — should print:
  ```
  Existing data removed (Experts & Bookings)...
  Experts seeded successfully!
  ```

---

### TASK 4 — CREATE `backend/src/controllers/expertController.js` — `getExperts`

- **IMPLEMENT**: Export `getExperts` as an async function. Destructure `{ page = 1, limit = 10, search, category }` from `req.query`. Build `query = {}`. If `search` is truthy, add `query.name = { $regex: search, $options: 'i' }`. If `category` is truthy, add `query.category = category`. Calculate `skip = (page - 1) * limit`. Execute `Expert.find(query).limit(Number(limit)).skip(skip).sort({ createdAt: -1 })`. Concurrently call `Expert.countDocuments(query)` for the total. Respond with `{ success: true, count, total, pages: Math.ceil(total / limit), data: experts }`.
- **PATTERN**: `backend/src/controllers/expertController.js` lines 17–70 (full `getExperts` implementation).
- **IMPORTS**: `const Expert = require('../models/Expert');`
- **GOTCHA**: `$options: 'i'` makes the regex case-insensitive. Without this flag, searching "james" would not find "James Wilson". The `$regex` approach means there is no index-accelerated prefix search (MongoDB cannot use a B-tree index on a non-anchored regex). For the current MVP scale (< 1,000 experts), this is acceptable. A future improvement is a full-text index with `$text` / `$search`.
- **GOTCHA**: `Number(limit)` is required in `.limit()`. If `limit` is the string `"10"`, Mongoose's internal cast handles it, but explicit conversion prevents unexpected behaviour if you later pass programmatic values.
- **GOTCHA**: When both `search` and `category` are provided, both keys are added to the same `query` object — MongoDB implicitly `AND`s them. This is the desired behaviour (filter by category AND search by name simultaneously).
- **VALIDATE**: After seeding, run:
  ```bash
  curl "http://localhost:5000/experts?search=james&category=Technology"
  ```
  Expected: `{"success":true,"count":1,"total":1,"pages":1,"data":[{"name":"James Wilson",...}]}`

---

### TASK 5 — CREATE `backend/src/controllers/expertController.js` — `getExpertById`

- **IMPLEMENT**: Export `getExpertById` as an async function. Call `Expert.findById(req.params.id)`. If `!expert`, return `res.status(404).json({ success: false, error: 'Expert not found' })`. Otherwise return `res.status(200).json({ success: true, data: expert })`.
- **PATTERN**: `backend/src/controllers/expertController.js` lines 79–102.
- **IMPORTS**: Same `Expert` require as Task 4 — both functions live in the same file.
- **GOTCHA**: Mongoose's `findById` will throw a `CastError` (caught by the `catch` block and returned as 500) if the `id` param is not a valid MongoDB ObjectId string (e.g., a 24-character hex string). This is correct behaviour for malformed IDs, but you should be aware that a request to `/experts/invalid-string` returns 500, not 400. A future improvement is to add an `isValidObjectId` guard before calling `findById`.
- **VALIDATE**:
  ```bash
  # Using a real _id from the seed output:
  curl "http://localhost:5000/experts/<REAL_ID>"
  # Expected: {"success":true,"data":{...}}

  curl "http://localhost:5000/experts/nonexistentid000000000000"
  # Expected: {"success":false,"error":"Server Error"} (CastError → 500)
  ```

---

### TASK 6 — CREATE `backend/src/controllers/expertController.js` — `rateExpert`

- **IMPLEMENT**: Export `rateExpert`. Extract `{ rating }` from `req.body`. Find expert by `req.params.id`. 404 guard if not found. Apply rolling average: `const currentTotal = expert.rating * expert.numReviews; expert.numReviews += 1; expert.rating = (currentTotal + rating) / expert.numReviews;`. Call `await expert.save()`. Respond with the updated expert.
- **PATTERN**: `backend/src/controllers/expertController.js` lines 111–141.
- **IMPORTS**: Same file as Tasks 4 & 5 — add to the `module.exports` object at the bottom.
- **GOTCHA**: This uses a rolling average — Mongoose does NOT store individual ratings. This means the average cannot be recalculated from first principles after the fact. It also means a user can rate the same expert multiple times, inflating `numReviews` and drifting the average. The current MVP does not guard against this — it is a known limitation tracked in the Decision Log.
- **GOTCHA**: `expert.save()` triggers Mongoose validators again. If `rating` is outside the schema's `min: 1, max: 5` bounds, `save()` will reject with a `ValidationError`, caught by the `catch` block and returned as 500. A future improvement is to validate `rating` in the controller before writing.
- **VALIDATE**:
  ```bash
  curl -X POST "http://localhost:5000/experts/<REAL_ID>/rate" \
    -H "Content-Type: application/json" \
    -d '{"rating": 5}'
  # Expected: {"success":true,"data":{..., "rating":4.95, "numReviews":1}}
  ```

---

### TASK 7 — CREATE `backend/src/routes/expertRoutes.js`

- **IMPLEMENT**: Create an Express `Router`. Require `{ getExperts, getExpertById, rateExpert }` from `../controllers/expertController`. Register: `router.get('/', getExperts)`, `router.get('/:id', getExpertById)`, `router.post('/:id/rate', rateExpert)`. Export with `module.exports = router`.
- **PATTERN**: `backend/src/routes/expertRoutes.js` lines 1–34 (full file).
- **IMPORTS**: `const express = require('express'); const router = express.Router();`
- **GOTCHA**: Route ordering matters in Express. `router.get('/:id', ...)` is a wildcard — if you add a literal path like `router.get('/featured', ...)` AFTER `/:id`, the literal route will never be reached (Express will match `/featured` as `/:id` with `id='featured'`). Always place literal routes BEFORE dynamic `:id` routes.
- **GOTCHA**: `router.post('/:id/rate', ...)` will not conflict with `router.get('/:id', ...)` because they use different HTTP methods. Express route matching is method + path combined.
- **VALIDATE**:
  ```bash
  # From the backend directory:
  node -e "const r = require('./src/routes/expertRoutes'); console.log(r.stack.map(l => l.route?.path))"
  # Expected: [ '/', '/:id', '/:id/rate' ]
  ```

---

### TASK 8 — UPDATE `backend/src/app.js` — Mount Expert Routes

- **IMPLEMENT**: In `app.js`, after requiring `bookingRoutes`, require `expertRoutes` (`const expertRoutes = require('./routes/expertRoutes');`) and mount it: `app.use('/experts', expertRoutes);`.
- **PATTERN**: `backend/src/app.js` lines 96–101 (already in place — verify the order of mounts).
- **IMPORTS**: No new packages — Express and its middleware are already initialised.
- **GOTCHA**: The route mount order does not affect functionality here since `/experts` and `/bookings` share no path prefixes. However, the `app.use(express.json())` and `app.use(cors())` middleware (lines 78–81) MUST appear before the route mounts so that request bodies are parsed and CORS headers are set before handler logic runs.
- **GOTCHA**: `app.set('io', io)` at line 50 makes the Socket.io server instance accessible in any controller via `req.app.get('io')`. This pattern is used by `bookingController` to emit `slot_booked` and `slot_released` events. `expertController` does NOT use sockets — expert listing is stateless REST.
- **VALIDATE**:
  ```bash
  cd backend && node src/app.js &
  sleep 2
  curl http://localhost:5000/experts
  # Expected: JSON with { success: true, count: 6, ... }
  kill %1
  ```

---

### TASK 9 — UPDATE `frontend/src/services/api.js` — Add Expert Service Functions

- **IMPLEMENT**: Create an Axios instance: `const API = axios.create({ baseURL: 'http://localhost:5000' });`. Export named functions: `export const fetchExperts = (params) => API.get('/experts', { params });` and `export const fetchExpertById = (id) => API.get('/experts/${id}');`. Also export the instance as `export default API`.
- **PATTERN**: `frontend/src/services/api.js` lines 11–42 (Axios instance + first two exports).
- **IMPORTS**: `import axios from 'axios';`
- **GOTCHA**: Passing `params` as the second argument to `API.get()` (`{ params }`) causes Axios to serialise the object into URL query string automatically: `fetchExperts({ search: 'james', category: 'Technology' })` becomes `GET /experts?search=james&category=Technology`. Do NOT manually concatenate query strings.
- **GOTCHA**: The `baseURL` is hardcoded to `http://localhost:5000`. This works for local development but must be replaced with an environment variable (`import.meta.env.VITE_API_URL`) before any deployment. This is a known limitation — see the Future Improvements section.
- **GOTCHA**: If `params.search` is an empty string `''`, Axios will still include `search=` in the query string. The backend `getExperts` controller guards against this correctly — `if (search)` is falsy for an empty string — but it sends unnecessary URL noise. A future improvement is to strip empty-string params before calling the API.
- **VALIDATE**:
  ```bash
  cd frontend && npm run lint
  # Should report no errors in api.js
  ```

---

### TASK 10 — UPDATE `frontend/src/index.css` — Add Animation Utilities

- **IMPLEMENT**: Inside `@layer utilities`, define `.animate-fade-in` with `animation: fadeIn 0.5s ease-out forwards` and `.animate-slide-up` with `animation: slideUp 0.6s ease-out forwards`. Add delay helpers: `.delay-100 { animation-delay: 100ms; }`, `.delay-200`, `.delay-300`. Define the corresponding `@keyframes fadeIn` (opacity 0→1) and `@keyframes slideUp` (opacity 0→1, translateY 20px→0) at the bottom of the file.
- **PATTERN**: `frontend/src/index.css` lines 11–38 (exact implementation).
- **IMPORTS**: None — this is a CSS file; it is imported globally by `main.jsx` via `import './index.css'`.
- **GOTCHA**: Animations defined in `@layer utilities` can be overridden by Tailwind's responsive/state prefixes. If you wrap them in `@layer base` or put them outside any layer, specificity may conflict with Tailwind's generated classes. Always use `@layer utilities` for custom utility classes.
- **GOTCHA**: The `forwards` fill mode in `animation: slideUp 0.6s ease-out forwards` is critical — without it, cards snap back to their initial invisible state after the animation completes.
- **GOTCHA**: The `animate-slide-up` class sets `opacity: 0` as its starting keyframe state (`from { opacity: 0; }`). If a card renders before the animation class is applied (e.g., during SSR), it briefly shows as invisible. This is acceptable in the current client-side-only React setup.
- **VALIDATE**:
  ```bash
  cd frontend && npm run build
  # Should complete with 0 errors. The dist/assets/*.css file should
  # contain 'slideUp' and 'fadeIn' keyframe definitions.
  grep -r "slideUp" frontend/dist/assets/*.css
  ```

---

### TASK 11 — CREATE `frontend/src/components/ExpertCard.jsx`

- **IMPLEMENT**: Create a functional component `ExpertCard({ expert, index })`. Render a root `<div>` with Tailwind classes `group bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-500 border border-gray-100 hover:-translate-y-2 animate-slide-up` and the inline style `{ animationDelay: `${index * 100}ms` }`. Inside, render: (1) an image section with a `<div className="relative h-56 bg-gray-200 overflow-hidden">` containing the `<img>` with the `onError` fallback and a rating badge overlay using `Star` from lucide-react. (2) A content section with the category `<span>` badge, expert name `<h3>`, description `<p className="line-clamp-2">`, and a stats row with `Award` (experience) and `Briefcase` (hourly rate in ₹). (3) A footer section with a `<Link to={/expert/${expert._id}}>View Profile & Book</Link>` styled as a full-width blue button.
- **PATTERN**: `frontend/src/components/ExpertCard.jsx` lines 33–101 (full component).
- **IMPORTS**: `import React from 'react'; import { Link } from 'react-router-dom'; import { Star, Briefcase, Award } from 'lucide-react';`
- **GOTCHA**: `expert.rating.toFixed(1)` (line 55 of ExpertCard.jsx) will throw a TypeError if `rating` is `undefined` or `null`. In the current implementation, `rating` always has the schema default of `4.5`, so this is safe. However, if you ever allow partial expert documents, add a guard: `{(expert.rating ?? 0).toFixed(1)}`.
- **GOTCHA**: The `line-clamp-2` Tailwind utility on the description paragraph requires the `@tailwindcss/line-clamp` plugin OR Tailwind CSS v3.3+, which includes it natively. Verify `tailwind.config.js` version compatibility.
- **GOTCHA**: The `group` class on the root div enables the `group-hover:scale-110` effect on the image. The `group-focus-within:text-blue-500` class in `ExpertListing.jsx` (line 92) uses the same mechanism for the search icon — these are parent–child CSS group utilities native to Tailwind.
- **VALIDATE**:
  ```bash
  cd frontend && npm run lint
  # Specifically, verify no 'react/prop-types' warnings for 'expert' and 'index'
  ```
  Then navigate to `http://localhost:5173/experts` and visually confirm:
  - Cards stagger their entrance animations (open DevTools → Network → Slow 3G to observe).
  - Hovering a card lifts it (`-translate-y-2`) and deepens the shadow.
  - The image section zooms (`scale-110`) on hover.

---

### TASK 12 — CREATE `frontend/src/pages/ExpertListing.jsx`

- **IMPLEMENT**: Create the `ExpertListing` functional component with five `useState` hooks: `experts` (array, default `[]`), `loading` (boolean, default `true`), `error` (string or null, default `null`), `search` (string, default `''`), `category` (string, default `''`). Define `categories` as a constant array of the same 6 strings as the backend enum. Implement a `useEffect` with `[search, category]` as the dependency array. Inside the effect, define an async `getExperts` function that calls `fetchExperts({ search, category })`, sets state, and handles errors. Wrap the call in a 500 ms `setTimeout` and return the cleanup function. In JSX, render: (1) a hero header section with animated heading; (2) a filters row with the search `<input>` (controlled via `search`/`setSearch`) and the category `<select>` (controlled via `category`/`setCategory`) — both have the `Filter` and `Search` lucide icons; (3) the four-state conditional: loading spinner → error banner → card grid → empty state.
- **PATTERN**: `frontend/src/pages/ExpertListing.jsx` lines 24–153 (full page component).
- **IMPORTS**: `import React, { useState, useEffect } from 'react'; import { fetchExperts } from '../services/api'; import ExpertCard from '../components/ExpertCard'; import { Search, Filter, Loader2, AlertCircle } from 'lucide-react';`
- **GOTCHA**: The `useEffect` has `[search, category]` in its dependency array. This causes re-execution on every state change, including the initial mount. The `setLoading(true)` inside `getExperts` means users briefly see a spinner even on category re-filters. This is intentional — it prevents showing stale data while the new results load. A future improvement is to distinguish between initial load and filter change with a separate `isRefreshing` flag.
- **GOTCHA**: The debounce (`setTimeout`) applies to BOTH search AND category changes. Category changes are instant dropdown selections and do not benefit from debouncing the way text input does. A more precise implementation would only debounce `search` changes and react immediately to `category` changes. The current 500 ms delay on category filter is a minor UX friction but was accepted for simplicity.
- **GOTCHA**: `setExperts(data.data)` — the double `.data` is correct and not a typo. `data` is the Axios response body (the envelope), and `data.data` is the array of experts inside the envelope.
- **GOTCHA**: In React's `StrictMode` (enabled in `main.jsx`), effects run twice on mount in development to help detect side effects. This means two API calls fire on first load in dev mode. This is expected behaviour and does not occur in production (`npm run build`).
- **VALIDATE**:
  ```bash
  # Start both servers then:
  cd frontend && npm run dev
  # Open http://localhost:5173/experts
  # Verify: 6 cards load (if seeded), search for "james" → 1 card, 
  # select "Finance" → 1 card, clear both → 6 cards.
  ```

---

### TASK 13 — UPDATE `frontend/src/App.jsx` — Register Expert Listing Route

- **IMPLEMENT**: Import `ExpertListing` from `'./pages/ExpertListing'`. Add `<Route path="/experts" element={<ExpertListing />} />` inside the `<Routes>` block.
- **PATTERN**: `frontend/src/App.jsx` lines 15, 41 (existing import and route already in place).
- **IMPORTS**: `import ExpertListing from './pages/ExpertListing';`
- **GOTCHA**: The route `path="/experts"` is an exact match in React Router v6 by default (unlike v5, where `exact` was required). There is no risk of it matching `/experts/some-id` because `/expert/:id` (note: singular "expert") is a separate route at a different path.
- **GOTCHA**: Route order inside `<Routes>` matters — React Router v6 uses the most-specific match, but it's best practice to order routes from most specific to least specific to avoid ambiguity.
- **VALIDATE**:
  ```bash
  cd frontend && npm run lint
  # Verify ExpertListing is imported and used (no 'no-unused-vars' warning)
  ```
  Navigate to `http://localhost:5173/experts` — the page should render without a white screen or 404.

---

### TASK 14 — UPDATE `frontend/src/components/Navbar.jsx` — Add Explore Link

- **IMPLEMENT**: In `Navbar.jsx`, import `useLocation` from `react-router-dom`. Call `const location = useLocation()` inside the component. Add a `<Link to="/experts">` with conditional `className` that applies `text-blue-600 bg-blue-50 shadow-sm` when `location.pathname === '/experts'`, otherwise `text-gray-500 hover:text-blue-600 hover:bg-gray-50`.
- **PATTERN**: `frontend/src/components/Navbar.jsx` lines 25, 47–56 (full "Explore" link implementation).
- **IMPORTS**: `import { Link, useLocation } from 'react-router-dom';`
- **GOTCHA**: `useLocation()` must be called inside a component that is rendered within a `<Router>` context. `Navbar` is rendered inside `<Router>` in `App.jsx`, so this is safe. If you ever test `Navbar` in isolation (e.g., in Storybook), you must wrap it in `<MemoryRouter>`.
- **VALIDATE**:
  Navigate to `http://localhost:5173/experts` — the "Explore" link in the navbar should have the active blue style. Navigate to `http://localhost:5173/` — the style should revert to gray.

---

## TESTING STRATEGY

> Note: No automated test framework (Jest, Vitest, etc.) is currently configured in this project as of the MVP phase. The tests described below represent the TARGET state when a framework is added. The PRD acknowledges this and the AGENTS.md notes "no automated test framework is currently configured." All current validation is manual + `curl`.

### Unit Tests (Target: `backend/src/controllers/expertController.test.js`)

Test each of the three controller functions in isolation by mocking the `Expert` Mongoose model.

**`getExperts`:**
- Receives no query params → calls `Expert.find({})` with empty query.
- Receives `search=james` → builds `{ name: { $regex: 'james', $options: 'i' } }`.
- Receives `category=Technology` → builds `{ category: 'Technology' }`.
- Receives both → builds combined query with `AND` semantics.
- Receives `page=2&limit=5` → calculates `skip = 5`, calls `.limit(5)`.
- Database error → returns `{ success: false, error: 'Server Error' }` with status 500.

**`getExpertById`:**
- Valid ID found → returns `{ success: true, data: expert }` with status 200.
- Valid ID not found → returns `{ success: false, error: 'Expert not found' }` with status 404.
- Invalid ObjectId → `findById` throws CastError → returns 500.

**`rateExpert`:**
- Expert has `rating: 4.5, numReviews: 0` → submit `5` → new rating is `5.0`, `numReviews` is `1`.
- Expert has `rating: 4.5, numReviews: 10` → submit `3` → formula: `(4.5 * 10 + 3) / 11 = 4.363...`.
- Expert not found → returns 404.

**Target file location**: `backend/src/controllers/expertController.test.js`

**Add to `backend/package.json`** before running:
```json
"scripts": { "test": "jest --testEnvironment node" }
```

### Unit Tests (Target: `frontend/src/components/ExpertCard.test.jsx`)

Test the `ExpertCard` component using React Testing Library:

- Renders expert `name`, `category`, `rating`, `experience`, `hourlyRate` correctly.
- The `Link` element has `href` of `/expert/<_id>`.
- When `profileImage` is an empty string, `src` defaults to the `ui-avatars.com` URL.
- When `img` fires `onError`, `src` is swapped to the `ui-avatars.com` fallback.
- `animationDelay` style is `'300ms'` when `index=3`.
- Snapshot test for visual regression.

**Target file location**: `frontend/src/components/ExpertCard.test.jsx`

### Integration Tests (Target: Manual `curl` Suite)

Execute these commands in order against a running backend with seeded data:

```bash
# 1. List all experts (default page 1, limit 10)
curl -s "http://localhost:5000/experts" | python3 -m json.tool

# 2. Search by name (case-insensitive)
curl -s "http://localhost:5000/experts?search=elena" | python3 -m json.tool
# Expected count: 1 (Elena Rodriguez)

# 3. Filter by category
curl -s "http://localhost:5000/experts?category=Finance" | python3 -m json.tool
# Expected count: 1 (Michael Chen)

# 4. Combined search + category (matching)
curl -s "http://localhost:5000/experts?search=chen&category=Finance" | python3 -m json.tool
# Expected count: 1

# 5. Combined search + category (non-matching)
curl -s "http://localhost:5000/experts?search=chen&category=Health" | python3 -m json.tool
# Expected count: 0, data: []

# 6. Pagination: page 1, limit 3
curl -s "http://localhost:5000/experts?limit=3&page=1" | python3 -m json.tool
# Expected: count 3, total 6, pages 2

# 7. Pagination: page 2, limit 3
curl -s "http://localhost:5000/experts?limit=3&page=2" | python3 -m json.tool
# Expected: count 3, total 6, pages 2

# 8. Get single expert by ID
EXPERT_ID=$(curl -s "http://localhost:5000/experts" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['_id'])")
curl -s "http://localhost:5000/experts/$EXPERT_ID" | python3 -m json.tool
# Expected: success: true, data object

# 9. 404 for non-existent (valid format) ID
curl -s "http://localhost:5000/experts/000000000000000000000000" | python3 -m json.tool
# Expected: {"success": false, "error": "Expert not found"}
```

### Edge Cases

| Case | How to Test | Expected Outcome |
|---|---|---|
| Search with special regex characters (e.g., `search=Dr.`) | `curl "…?search=Dr."` | Returns experts with "Dr." in name; does NOT crash the server (Mongoose handles regex safely). |
| Category with invalid enum value | `curl "…?category=Pets"` | Returns empty list (`[]`), not a validation error — the category filter is a pass-through string; Mongoose `find({ category: 'Pets' })` simply returns 0 results. |
| `profileImage` is `null` in database | Set one expert's `profileImage` to `null` via MongoDB Compass, reload page | `ExpertCard` falls back to `ui-avatars.com` URL in the `src` attribute. |
| Network failure (backend not running) | Stop the backend, navigate to `/experts` | Red error banner renders: "Failed to fetch experts. Please try again later." |
| Empty database (no experts) | Drop the experts collection and reload | White empty-state card renders: "No matches found." |
| Rapid typing in search field | Type "james wilson" letter by letter quickly | Only ONE API call fires 500 ms after the final keystroke (verify in Network DevTools). |
| Page URL with no trailing slash | Navigate to `http://localhost:5173/experts` | Renders correctly (React Router v6 exact match). |

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
# ESLint on the entire frontend
cd frontend && npm run lint

# Manually verify no CommonJS syntax crept into frontend files
grep -rn "require(" frontend/src/
# Expected: 0 matches

# Manually verify no ES module syntax in backend source files
grep -rn "^import " backend/src/
# Expected: 0 matches (only JSDoc @param comments use the word "import")
```

### Level 2: Unit Tests (when configured)

```bash
# Backend (once Jest is configured)
cd backend && npm test -- --testPathPattern=expertController

# Frontend (once Vitest or Jest is configured)
cd frontend && npm test -- --testPathPattern=ExpertCard
```

### Level 3: Integration Tests

```bash
# Start the backend in a background terminal first:
cd backend && node src/app.js &
sleep 2

# Run seeder to ensure clean state:
node src/seeds/expertSeeder.js

# Execute all integration curl commands from the TESTING STRATEGY section
# Quick smoke test (all six seeded experts returned):
curl -s http://localhost:5000/experts | python3 -c "
import sys, json
body = json.load(sys.stdin)
assert body['success'] == True, 'success flag missing'
assert body['count'] == 6, f\"Expected 6 experts, got {body['count']}\"
print('✅ All 6 experts returned successfully')
"
```

### Level 4: Manual UI Validation

| Step | Action | Expected |
|---|---|---|
| 1 | Start backend and frontend; navigate to `http://localhost:5173/experts` | 6 cards load with staggered slide-up animation |
| 2 | Observe loading state | Blue `Loader2` spinner with pulsing glow and "INITIALIZING…" text appear for ~500 ms |
| 3 | Search "sarah" in the text field | After 500 ms debounce: only Dr. Sarah Mitchell's card renders |
| 4 | Clear search, select "Finance" from the dropdown | Only Michael Chen's card renders |
| 5 | Select "Business" from the dropdown | Only David Foster's card renders |
| 6 | Select "All Categories" and clear search | All 6 cards return |
| 7 | Hover a card | Card lifts (`-translate-y-2`) and shadow deepens; image scales up; background image zooms |
| 8 | Click "View Profile & Book" on any card | Navigates to `/expert/<_id>` (ExpertDetail page) |
| 9 | Resize viewport to 375px (mobile) | Cards stack vertically in single column |
| 10 | Resize to 768px (tablet) | 2-column card grid |
| 11 | Resize to 1280px (desktop) | 3-column card grid |
| 12 | Click "Explore" in Navbar | Active blue style appears on the link |
| 13 | Stop the backend server | Red error banner renders with AlertCircle icon |
| 14 | Type a non-matching search (e.g., "zzz") | Empty state banner: "No matches found. Try adjusting your filters or search terms." |

### Level 5: Build Verification

```bash
cd frontend && npm run build
# Expected: Build succeeds, no TypeScript/ESLint errors.
# Output dist/index.html should reference the ExpertListing route.

# Preview the production build:
cd frontend && npm run preview
# Navigate to http://localhost:4173/experts — page should function identically to dev mode.
```

---

## ACCEPTANCE CRITERIA

- [ ] **AC-1**: `GET /experts` returns a JSON body matching `{ success: true, count: N, total: N, pages: N, data: [...] }` with HTTP 200.
- [ ] **AC-2**: `GET /experts?search=<name>` returns only experts whose `name` field matches the search string case-insensitively; partial matches are included (e.g., `search=sa` matches "Dr. Sarah Mitchell").
- [ ] **AC-3**: `GET /experts?category=Technology` returns only experts with `category === 'Technology'`; experts of other categories are excluded.
- [ ] **AC-4**: Combined `?search=<x>&category=<y>` applies both filters with AND semantics.
- [ ] **AC-5**: `GET /experts?page=2&limit=3` skips the first 3 records and returns the next 3, with `pages: 2` in the response.
- [ ] **AC-6**: `GET /experts/:id` for a valid existing ID returns `{ success: true, data: { ...expertFields } }` with HTTP 200.
- [ ] **AC-7**: `GET /experts/:nonExistentId` returns `{ success: false, error: 'Expert not found' }` with HTTP 404.
- [ ] **AC-8**: `POST /experts/:id/rate` with `{ "rating": 5 }` updates the expert's `rating` using the rolling average formula and increments `numReviews` by 1.
- [ ] **AC-9**: The `/experts` frontend route renders the `ExpertListing` page — confirmed by the page-level heading "Find Your **Expert**" being visible in the DOM.
- [ ] **AC-10**: The search input debounces API calls — typing 5 characters in rapid succession results in exactly ONE network request to `/experts`, visible in browser DevTools → Network tab.
- [ ] **AC-11**: The category dropdown and search input work independently and in combination; results update correctly for every combination.
- [ ] **AC-12**: The loading state (spinner) is shown while any API request is in flight.
- [ ] **AC-13**: The error state (red banner with `AlertCircle` icon) is shown when the API request fails; the banner text is "Failed to fetch experts. Please try again later."
- [ ] **AC-14**: The empty state banner ("No matches found.") is shown when the API returns `data: []`.
- [ ] **AC-15**: Each `ExpertCard` displays: name, category badge, star rating (1 decimal), years of experience, hourly rate in ₹ (Indian Rupee symbol), a truncated description (2-line clamp), and a "View Profile & Book" CTA.
- [ ] **AC-16**: Expert images fall back to the `ui-avatars.com` initials avatar when `profileImage` is absent or broken; the `onError` handler prevents infinite error loops.
- [ ] **AC-17**: Cards animate with a staggered slide-up entrance; the Nth card has an `animationDelay` of `N * 100ms`.
- [ ] **AC-18**: The card grid is responsive: 1 column at `< 640px`, 2 columns at `≥ 640px` (`sm`), 3 columns at `≥ 1024px` (`lg`).
- [ ] **AC-19**: The "Explore" navbar link applies the active blue style (`text-blue-600 bg-blue-50`) exactly when `location.pathname === '/experts'`.
- [ ] **AC-20**: `npm run lint` in the `frontend/` directory exits with code 0 (zero lint errors).
- [ ] **AC-21**: `npm run build` in the `frontend/` directory completes successfully with no build errors.
- [ ] **AC-22**: The backend `node src/seeds/expertSeeder.js` script populates the database with exactly 6 sample experts covering all 6 enum categories.

---

## COMPLETION CHECKLIST

- [ ] `backend/src/models/Expert.js` — Schema defined with all fields, validators, enum, and timestamps.
- [ ] `backend/src/config/db.js` — `connectDB` async function with `process.exit(1)` on failure.
- [ ] `backend/src/seeds/expertSeeder.js` — Seeds 6 experts, clears both `experts` and `bookings` collections.
- [ ] `backend/src/controllers/expertController.js` — All three handler functions implemented and exported.
- [ ] `backend/src/routes/expertRoutes.js` — Three routes registered; Router exported.
- [ ] `backend/src/app.js` — `app.use('/experts', expertRoutes)` mounted; `express.json()` and `cors()` middleware applied BEFORE route mounts.
- [ ] `frontend/src/services/api.js` — Axios instance created; `fetchExperts` and `fetchExpertById` exported.
- [ ] `frontend/src/index.css` — `animate-fade-in`, `animate-slide-up`, and delay utilities defined.
- [ ] `frontend/src/components/ExpertCard.jsx` — All fields rendered; `onError` image fallback; staggered animation delay; `Link` to `/expert/:id`.
- [ ] `frontend/src/pages/ExpertListing.jsx` — Five state hooks; debounced effect with cleanup; four render states; search input and category dropdown controlled.
- [ ] `frontend/src/App.jsx` — `ExpertListing` imported and routed at `/experts`.
- [ ] `frontend/src/components/Navbar.jsx` — "Explore" `<Link>` with `useLocation` active-state styling.
- [ ] All `curl` integration tests pass.
- [ ] All Level 4 manual UI validation steps pass.
- [ ] `npm run lint` exits code 0 in `frontend/`.
- [ ] `npm run build` exits code 0 in `frontend/`.
- [ ] All 22 Acceptance Criteria marked as passing.
- [ ] Code reviewed for quality: no inline `TODO`s left unresolved, no `console.log` in request handlers.

---

## NOTES

### Design Decisions

#### Decision 1: Server-Side Filtering vs Client-Side Filtering

**Chosen approach**: All search and category filtering is performed by MongoDB on the backend.

**Rationale**: The most pragmatic argument is future scalability. With only 6 seeded experts the difference is imperceptible, but the platform's roadmap (see `docs/ROADMAP.md`) includes adding many more experts over time. Client-side filtering would require transferring the entire expert dataset on every page load — inefficient at scale. By keeping filtering on the server, the client always receives only the records it needs, and MongoDB's indexed regex queries are substantially faster than JavaScript array `.filter()` operations on large datasets.

**Alternative considered**: Load all experts on mount, then filter in-browser with `useState` + array `.filter()`. This would eliminate debouncing complexity and feel instantly responsive. Rejected because it couples the frontend to a specific data size and would require significant refactoring to re-introduce server-side filtering later.

---

#### Decision 2: Debounce at 500 ms

**Chosen approach**: A 500 ms `setTimeout` inside `useEffect`, cleared on every re-render via the cleanup function.

**Rationale**: 500 ms is the standard debounce interval for search inputs — it is long enough to avoid firing on every keystroke while a user types a full name, but short enough to feel responsive. The implementation avoids introducing a third-party debounce library (like `lodash.debounce`) in favour of native `setTimeout`/`clearTimeout`, keeping the dependency footprint minimal.

**Alternative considered**: Using `lodash.debounce` as a `useCallback`-wrapped function. This is more idiomatic but adds a dependency and a small amount of hook complexity. Rejected for MVP simplicity.

**Known limitation**: The same 500 ms debounce applies to both text input and dropdown selection. For the dropdown (a discrete choice, not continuous input), this delay is unnecessary friction. A more nuanced implementation would track which state changed and only debounce when `search` changes.

---

#### Decision 3: INR Currency (₹)

**Chosen approach**: The Rupee symbol `₹` is hardcoded in `ExpertCard.jsx` line 82.

**Rationale**: The PRD (line 31) explicitly mandates India-specific localization (IST timezone, INR currency, +91 phone format). The platform is built for the Indian market in Phase 1. Using `₹` is simpler than the `Intl.NumberFormat` API and avoids browser locale dependency.

**Alternative considered**: `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(hourlyRate)`. This produces "₹ 150.00" which is more formally correct but unnecessarily verbose for a card's compact layout. The simple template literal `₹${expert.hourlyRate}/hr` was chosen for clarity.

---

#### Decision 4: `ui-avatars.com` as Avatar Fallback

**Chosen approach**: When `profileImage` is absent or fails to load, `ExpertCard` dynamically constructs a `ui-avatars.com` URL using the expert's name to generate an initials-based avatar.

**Rationale**: The seed data intentionally omits `profileImage` for all 6 experts (relying on the schema default `'https://placehold.co/150'`). The `placehold.co` URL is a generic grey square — useful for layout testing but visually uninteresting. The `ui-avatars.com` fallback generates a coloured avatar with the expert's initials (e.g., "DR. SARAH MITCHELL" → "DS"), which is more informative and visually polished. The background (`e0e7ff` — light indigo) and foreground (`4f46e5` — Tailwind `indigo-600`) were chosen to match the application's blue-indigo colour palette.

**Alternative considered**: A static local SVG placeholder in `frontend/src/assets/`. This avoids external service dependency but requires maintaining an asset file and doesn't personalise the avatar.

**Known limitation**: `ui-avatars.com` is a third-party service. If it becomes unavailable, the `onError` handler creates an infinite loop unless `e.target.onerror = null` is set first (it is — see `ExpertCard.jsx` line 48).

---

#### Decision 5: Enum-Enforced Categories

**Chosen approach**: The `category` field on the `Expert` schema uses Mongoose's `enum` validator to restrict values to the six predefined strings.

**Rationale**: Without an enum, a category value of "tech" or "TECHNOLOGY" could be saved, causing the frontend filter (`category=Technology`) to return 0 results for records with the incorrect casing. Enum enforcement at the database layer makes the frontend dropdown's string literals the guaranteed valid values, creating a single consistent truth. This is documented in the "Key Design Decisions" section of the original feature brief.

**Alternative considered**: A separate `Category` model with its own MongoDB collection, referenced by ObjectId. This would allow categories to be dynamically added via an admin panel (Phase 2 roadmap item). Rejected for MVP because it adds a JOIN-like operation (`populate`) to every expert query and requires an Admin Panel UI (Phase 2 out of scope).

---

#### Decision 6: Sort Order (`createdAt: -1`)

**Chosen approach**: Experts are sorted by `createdAt` descending (newest first).

**Rationale**: This ensures that newly seeded or admin-added experts appear at the top, making new listings immediately visible without requiring users to scroll. The `timestamps: true` schema option generates `createdAt` and `updatedAt` automatically.

**Alternative considered**: Sort by `rating` descending to show the highest-rated experts first. This would be better UX for users seeking quality but risks consistently burying new (unrated) experts. A future improvement is a multi-field sort: `rating` primary, `createdAt` secondary.

---

#### Decision 7: Rolling Average for Rating

**Chosen approach**: The `rateExpert` controller computes a rolling average using `numReviews` and the current `rating` without storing individual ratings.

**Rationale**: Storing individual ratings would require a separate `Rating` or `Review` collection (or a `ratings` array sub-document on `Expert`), adding complexity. The rolling average formula `((avg * count) + newRating) / (count + 1)` is mathematically equivalent to storing and re-averaging all ratings, using only O(1) extra space per expert.

**Trade-off**: The rolling average cannot be "undone" (e.g., correcting a user's accidental rating). It also has no deduplication guard — the same user can submit multiple ratings, inflating `numReviews`. These are known limitations of the MVP approach, acceptable for Phase 1.

---

### Known Limitations

1. **No authentication on rating**: Any anonymous user can call `POST /experts/:id/rate` any number of times with any rating value. The rating average can be manipulated. Mitigation: JWT auth (Phase 2).

2. **No input validation on `rateExpert`**: The `rating` value in `req.body` is not validated before being used in arithmetic. A non-numeric `rating` (e.g., `"five"`) would produce `NaN` as the new average and save it to the database. Mitigation: Add Joi/Zod validation middleware.

3. **Hardcoded `baseURL`**: `frontend/src/services/api.js` hardcodes `http://localhost:5000`. This breaks in any environment other than local development. Mitigation: Use `import.meta.env.VITE_API_URL` with a `.env` file.

4. **No database index on `name`**: The `$regex` search on `name` performs a full collection scan. With 6 documents this is negligible, but at 10,000+ experts this becomes slow. Mitigation: Add `expertSchema.index({ name: 'text' })` and migrate to `$text` / `$search`.

5. **No CastError guard on `getExpertById`**: An invalid ObjectId (not a 24-char hex string) triggers a Mongoose `CastError`, which the `catch` block converts to a 500 response instead of a more informative 400. Mitigation: `if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json(...)`.

6. **Pagination not exposed in UI**: The backend supports `page` and `limit` query parameters and returns `pages` in the response, but `ExpertListing.jsx` does not render any pagination controls — it always requests page 1 with the default limit of 10. With 6 seeded experts this is fine. Mitigation: Add a pagination control component.

7. **Debounce applies to category changes**: As noted in Decision 2, the 500 ms debounce is unnecessary for dropdown selections.

8. **`StrictMode` double-fetch in development**: React 18 `StrictMode` causes effects to fire twice on mount. This means two `GET /experts` requests on initial load in development. Not a bug, but can be confusing when reading server logs.

---

### Future Improvements

| ID | Improvement | Phase | Priority |
|---|---|---|---|
| FI-01 | Full-text search using MongoDB `$text` index on `name` and `description` | Phase 2 | High |
| FI-02 | Pagination controls (Previous / Next / Page N) in `ExpertListing.jsx` | Phase 2 | High |
| FI-03 | Replace hardcoded `baseURL` with `import.meta.env.VITE_API_URL` | Phase 2 | High |
| FI-04 | Input validation middleware (Joi/Zod) on `rateExpert` and all POST endpoints | Phase 2 | High |
| FI-05 | `mongoose.Types.ObjectId.isValid()` guard in `getExpertById` | Phase 2 | Medium |
| FI-06 | Separate debounce for search vs immediate response for category filter | Phase 2 | Medium |
| FI-07 | Sort toggle UI (by rating, by experience, by price) in the listing page | Phase 3 | Medium |
| FI-08 | Expert profile image upload via Cloudinary or S3 | Phase 3 | Medium |
| FI-09 | Dynamic category list fetched from API instead of hardcoded array | Phase 3 | Low |
| FI-10 | Skeleton loading cards instead of spinner for improved perceived performance | Phase 3 | Low |
| FI-11 | `useCallback` memoisation of the debounced fetch function | Phase 3 | Low |
| FI-12 | Deduplication guard on `rateExpert` (one rating per user per expert) | Phase 2 (requires Auth) | High |

---

## DECISION LOG

| Date | Decision | Made By | Rationale Summary |
|---|---|---|---|
| 2026-05-10 | Server-side search/filter via MongoDB `$regex` | Architecture | Scalability; avoids full-dataset transfer |
| 2026-05-10 | 500 ms debounce for both search and category | Implementation | Simplicity over precision; avoids third-party debounce library |
| 2026-05-10 | INR (`₹`) hardcoded in ExpertCard | Implementation | PRD mandate; India-only Phase 1 |
| 2026-05-10 | `ui-avatars.com` avatar fallback | Implementation | More informative than generic grey square; palette-matched colours |
| 2026-05-10 | `enum` for category on Expert schema | Architecture | Prevents dirty data; makes frontend filters reliable |
| 2026-05-10 | Sort by `createdAt: -1` | Implementation | New experts visible immediately |
| 2026-05-10 | Rolling average for ratings, no individual rating storage | Architecture | O(1) space; MVP simplicity; acceptable for Phase 1 |
| 2026-05-10 | Migrated placeholder from `via.placeholder.com` to `placehold.co` | Bug Fix | `via.placeholder.com` became unreliable (`log.md` 2026-05-10 05:09 PM) |
| 2026-05-10 | `e.target.onerror = null` set before fallback `src` assignment | Bug Fix | Prevents infinite `onError` loop on double image failure |

---

*This document was generated on 2026-05-24 following the `plan-feature.md` template defined in `.agent/commands/core_piv_loop/plan-feature.md`. It reflects the state of the SkillSync codebase as of commit context available on that date.*
