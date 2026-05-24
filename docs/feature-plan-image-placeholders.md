# Feature Plan: Smart Image Placeholders & Fallbacks

> **Project:** SkillSync — Real-Time Expert Session Booking System  
> **Feature ID:** FP-004  
> **Author:** SkillSync Engineering  
> **Created:** 2026-05-24  
> **Status:** ✅ Implemented  
> **Scope:** Frontend Only (`frontend/`)

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Feature Metadata](#2-feature-metadata)
3. [Context & References](#3-context--references)
4. [Patterns Followed](#4-patterns-followed)
5. [Implementation Plan](#5-implementation-plan)
6. [Testing Strategy](#6-testing-strategy)
7. [Validation Commands](#7-validation-commands)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [Completion Checklist](#9-completion-checklist)
10. [Notes, Design Decisions & Trade-offs](#10-notes-design-decisions--trade-offs)
11. [Decision Log](#11-decision-log)
12. [Known Limitations & Future Improvements](#12-known-limitations--future-improvements)

---

## 1. Feature Overview

### Feature Name
**Smart Image Placeholders & Fallbacks** — A two-level, runtime-safe profile image fallback system for expert profiles.

### User Story
> As a **user browsing expert profiles**, I want to always see a meaningful, branded avatar for each expert—even when no profile image has been configured or when an image URL is broken—so that the application looks professional and polished regardless of data quality.

### Problem Statement
Expert records stored in MongoDB carry a `profileImage` field with a Mongoose-level default of `https://placehold.co/150`. This creates two distinct failure modes that both result in a degraded user experience:

1. **Missing/null URL** — Seed data or manually created records may have no `profileImage` value at all (null, undefined, or empty string). The React `<img>` `src` attribute receives a falsy value, rendering a broken image icon or an empty gray box.

2. **Broken URL** — A record may have a non-null URL (including the generic `https://placehold.co/150` default) that resolves to a generic placeholder, a `404`, or a CDN failure. The image renders as a browser broken-image icon with no context about *whose* profile is displayed.

In both cases, the UI breaks trust: a broken-image icon on a professional expert booking platform signals poor quality. The existing `placehold.co/150` default is technically valid but produces a gray box with no identity signal, making all "missing" experts look identical and contextually anonymous.

### Solution Statement
Implement a **two-level, client-side fallback chain** that generates a personalized, branded avatar for every expert whose image is unavailable, using the [`ui-avatars.com`](https://ui-avatars.com/) API:

- **Level 1 (Render-time guard):** A JavaScript short-circuit expression in the `src` attribute (`expert.profileImage || avatarUrl`) ensures that if `profileImage` is falsy, the browser never attempts to load a broken URL—it goes straight to the avatar.
- **Level 2 (Load-time guard):** An `onError` event handler on the `<img>` element intercepts any network-level failure (404, CDN timeout, CORS block) for a URL that *was* present, and swaps `e.target.src` to the avatar URL before the browser can display a broken-image icon.

The generated avatar is personalized (shows the expert's initials), branded (uses the app's indigo palette: `background=e0e7ff`, `color=4f46e5`), and correctly sized for each usage context (256 px for cards, 512 px for the detail page).

---

## 2. Feature Metadata

| Property            | Value                                               |
|---------------------|-----------------------------------------------------|
| **Feature Type**    | UI Enhancement / Resilience / Defensive Coding      |
| **Complexity**      | Low                                                 |
| **Risk Level**      | Low (no backend, no database, no state changes)     |
| **Affected Systems**| Frontend only                                       |
| **Backend Changes** | None                                                |
| **New Files**       | None                                                |
| **Modified Files**  | `frontend/src/components/ExpertCard.jsx`, `frontend/src/pages/ExpertDetail.jsx` |
| **Dependencies**    | External: `ui-avatars.com` (third-party CDN)        |
| **New npm Packages**| None                                                |
| **Reversibility**   | Fully reversible — changes are isolated to `<img>` tags |
| **Roadmap Phase**   | Phase 1 — MVP Foundation (`docs/ROADMAP.md` line 22) |

---

## 3. Context & References

### 3.1 Relevant Existing Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `backend/src/models/Expert.js` | Mongoose schema defining the `profileImage` field and its generic default | Lines 47–51 |
| `frontend/src/components/ExpertCard.jsx` | Card component rendering expert summary on the listing page grid | Lines 43–51 |
| `frontend/src/pages/ExpertDetail.jsx` | Full-page expert profile with sticky sidebar containing the large hero image | Lines 239–247 |
| `frontend/src/pages/ExpertListing.jsx` | Renders the `ExpertCard` grid; consumes `fetchExperts` from the API service | Lines 136–140 |
| `frontend/src/services/api.js` | Axios service layer; `fetchExperts` and `fetchExpertById` supply the `expert` object | Lines 32, 42 |
| `frontend/src/App.jsx` | Route definitions wiring `/experts` → `ExpertListing` and `/expert/:id` → `ExpertDetail` | Lines 41, 44 |
| `frontend/src/index.css` | Global Tailwind animations (`animate-slide-up`, `animate-fade-in`) used in host components | Lines 11–38 |

### 3.2 New Files Created
None. This feature is implemented entirely by modifying existing `<img>` elements.

### 3.3 External Service Documentation
- **ui-avatars.com API:** `https://ui-avatars.com/api/?name=<encoded_name>&background=<hex>&color=<hex>&size=<px>`
  - `name`: URL-encoded full name; the service extracts up to two initials automatically.
  - `background`: Background fill color in hex (without `#`). Used: `e0e7ff` (Tailwind `indigo-100`).
  - `color`: Text/initials color in hex (without `#`). Used: `4f46e5` (Tailwind `indigo-600`).
  - `size`: Square pixel dimension of the generated PNG. Used: `256` (card) and `512` (detail page).
  - Service is free, no API key required, no rate limiting documented for typical usage.

### 3.4 Brand Colour Reference (Tailwind CSS)
| Token | Hex | Usage |
|-------|-----|-------|
| `indigo-100` | `#e0e7ff` | Avatar background — matches card category badge backgrounds |
| `indigo-600` | `#4f46e5` | Avatar text/initials — matches primary action buttons and links |

These values are consistent with the Tailwind classes used elsewhere in `ExpertCard.jsx` (`bg-blue-600`, `text-blue-600`) and `ExpertDetail.jsx` (`bg-blue-600`, `text-blue-400`), maintaining a coherent indigo-blue brand palette.

---

## 4. Patterns Followed

### 4.1 Naming Conventions
- **Components:** PascalCase (`ExpertCard`, `ExpertDetail`) — consistent with `AGENTS.md`.
- **Props:** `expert.profileImage` — camelCase, matching the Mongoose schema field name.
- **Event handlers:** Anonymous inline arrow functions for `onError`; the pattern matches existing inline handlers in `ExpertDetail.jsx` (e.g., `onChange` on form fields).

### 4.2 Module System
- `frontend/` uses **ES Modules** (`import`/`export`) per `AGENTS.md`. No new imports are required for this feature — it uses only native browser APIs (`encodeURIComponent`, `HTMLImageElement.onerror`).

### 4.3 Error-Handling Pattern
The `onError` handler follows the **defensive null-assignment pattern**:
```jsx
onError={(e) => {
  e.target.onerror = null;   // Step 1: Disarm the handler to prevent re-entry
  e.target.src = fallbackUrl; // Step 2: Swap to guaranteed fallback
}}
```
This is the canonical browser-safe technique for `<img>` error recovery. Setting `onerror` to `null` *before* mutating `src` eliminates the risk of an infinite retry loop if the fallback URL itself is unreachable.

### 4.4 Inline Conditional Expression Pattern
The `src` prop uses a **short-circuit OR expression**, which is standard React JSX:
```jsx
src={expert.profileImage || `template-literal-fallback`}
```
This evaluates `expert.profileImage` for truthiness. Values that resolve to the fallback: `null`, `undefined`, `""` (empty string), `0`, `false`. Note: the schema default `"https://placehold.co/150"` is a non-empty string and therefore truthy — it will pass through to the `<img>` src and only be caught by `onError` if the network request fails.

### 4.5 Logging Pattern
No console logging is added. Per the codebase pattern, `console.error` is used only in async catch blocks (see `ExpertDetail.jsx` lines 108, 151). Image `onError` events are silent UI fallbacks, not application errors requiring logging.

### 4.6 JSX Indentation & Formatting
All added/modified JSX uses **2-space indentation**, consistent with the rest of `ExpertCard.jsx` and `ExpertDetail.jsx`.

---

## 5. Implementation Plan

### Phase 1 — Foundation: Understand the Data Shape

#### Task 1.1 — Audit the `profileImage` field in the Mongoose Schema

**IMPLEMENT:**
Examine `backend/src/models/Expert.js` lines 47–51 to understand the existing default value and field type.

```js
// backend/src/models/Expert.js — Lines 47–51
profileImage: {
  type: String,
  default: 'https://placehold.co/150'
}
```

**PATTERN:**
The field is `type: String` with no `required` validator. This means MongoDB will:
- Use `'https://placehold.co/150'` for documents inserted without specifying `profileImage`.
- Store `null` or `undefined` if a document is inserted with an explicit null override (e.g., via a seed script that sets `profileImage: null`).
- Return the actual URL string for documents seeded with real or fake image URLs.

**GOTCHA:**
The Mongoose default only applies at insert time via the ODM. If a document was inserted directly via `mongosh` or a migration without going through the Mongoose model, the field may be absent (`undefined` when read). The frontend `||` fallback covers all three states: `null`, `undefined`, and `''`.

**VALIDATE:**
No code change required in this phase. Audit only.

---

#### Task 1.2 — Identify all `<img>` elements rendering `expert.profileImage`

**IMPLEMENT:**
Search for all locations that render the expert's profile image in the frontend.

- `frontend/src/components/ExpertCard.jsx` — Line 44: renders `expert.profileImage` in a `h-56` (224px) container.
- `frontend/src/pages/ExpertDetail.jsx` — Line 240: renders `expert.profileImage` in a `h-80` (320px) sticky sidebar image.

No other components (`Navbar.jsx`, `MyBookings.jsx`, `Home.jsx`) render `expert.profileImage`.

**PATTERN:**
Check using:
```bash
grep -rn "profileImage" frontend/src/
```

**GOTCHA:**
`MyBookings.jsx` renders booking records but not expert profile images (it shows booking status, date, time, and expert name as text only). Confirm this before assuming coverage is complete.

**VALIDATE:**
```bash
grep -rn "profileImage\|expert\.name.*img\|<img" frontend/src/ | grep -v node_modules
```

---

### Phase 2 — Core: Implement the Two-Level Fallback

#### Task 2.1 — Update `ExpertCard.jsx` — Level 1 and Level 2 Fallback

**FILE:** `frontend/src/components/ExpertCard.jsx`  
**LOCATION:** Lines 43–51 (the `<img>` element inside the `div.relative.h-56` image container)

**IMPLEMENT:**
Replace the original `<img>` tag (which had a bare `src={expert.profileImage}`) with the two-level fallback version:

```jsx
// frontend/src/components/ExpertCard.jsx — Lines 43–51
<img 
  src={expert.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=256`}
  alt={expert.name}
  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
  onError={(e) => {
    e.target.onerror = null;
    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=256`;
  }}
/>
```

**PATTERN:**
- `size=256`: The image container is `h-56` (224px) at natural screen sizes. 256px source gives ~1.14× natural density, providing crisp rendering on standard DPI screens and acceptable quality on 2× Retina without the bandwidth cost of 512.
- `object-cover`: Ensures the avatar (which is square) fills the rectangular card container without letterboxing. The `ui-avatars.com` PNG is always square, so the top/bottom of the avatar may be cropped for tall containers — this is acceptable for initials-based images since the letters are centered.
- `transition-transform duration-700 group-hover:scale-110`: Preserved from the original markup. The avatar image participates in the hover scale animation identically to a real photo.

**IMPORTS:**
No new imports. `encodeURIComponent` is a global browser/Node built-in.

**GOTCHA — Infinite Loop Prevention:**
```jsx
// WRONG — omitting onerror = null
onError={(e) => {
  e.target.src = fallbackUrl; // If fallbackUrl also fails, onError fires again → infinite loop
}}

// CORRECT — null-out the handler first
onError={(e) => {
  e.target.onerror = null;    // Disarm handler before mutating src
  e.target.src = fallbackUrl; // Safe: if this also fails, nothing happens
}}
```
The browser fires `onError` each time an `<img>` fails to load. By setting `e.target.onerror = null` before changing `src`, we ensure that even if `ui-avatars.com` is unreachable, the handler does not fire again — the image simply shows the browser's native broken-image icon as a last resort.

**GOTCHA — `encodeURIComponent` is mandatory:**
Expert names in the SkillSync seed data include spaces (e.g., `"Rajesh Kumar"`, `"Dr. Priya Sharma"`), dots, and hyphens. Without encoding, the URL would be malformed:
```
// BAD — space breaks URL parsing
https://ui-avatars.com/api/?name=Dr. Priya Sharma&background=e0e7ff
                                    ^--- space terminates the value

// GOOD — encoded
https://ui-avatars.com/api/?name=Dr.%20Priya%20Sharma&background=e0e7ff
```
`encodeURIComponent` converts spaces → `%20`, dots → `.` (safe, no encoding needed), commas → `%2C`, etc.

**VALIDATE:**
After implementing, load `http://localhost:5173/experts`. Each expert card should show either their real photo or the branded indigo avatar with their initials.

---

#### Task 2.2 — Update `ExpertDetail.jsx` — Level 1 and Level 2 Fallback

**FILE:** `frontend/src/pages/ExpertDetail.jsx`  
**LOCATION:** Lines 239–247 (the `<img>` element inside the `div.relative` wrapper in the sticky left sidebar)

**IMPLEMENT:**
Replace the existing `<img>` element with the two-level fallback version, using `size=512` instead of `size=256`:

```jsx
// frontend/src/pages/ExpertDetail.jsx — Lines 239–247
<img 
  src={expert.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=512`}
  alt={expert.name} 
  className="w-full h-80 object-cover" 
  onError={(e) => {
    e.target.onerror = null;
    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=512`;
  }}
/>
```

**PATTERN:**
- `size=512`: The container is `h-80` (320px). At 512px source resolution, the image renders at ~1.6× density, providing sharp, crisp initials on standard DPI displays and acceptable quality on 2× Retina. Using 256px here would result in visibly pixelated initials at this larger display size.
- `w-full h-80 object-cover`: The sidebar card is `rounded-[2rem]` with `overflow-hidden` applied at the parent `div`. The `object-cover` ensures the avatar square fills the full width regardless of the sidebar's responsive width.
- The gradient overlay `div` (`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent`) at line 248 sits *above* the `<img>` in the DOM and remains unaffected by this change — it provides the dark-to-transparent overlay that makes the expert's name and category badge legible when overlaid on the image.

**IMPORTS:**
No new imports.

**GOTCHA — Size Matters for Perceived Quality:**
The `ExpertDetail` sidebar is rendered inside a 12-column grid (`lg:col-span-4`). On a 1440px viewport this is approximately 480px wide, but `h-80` clamps the height to 320px. The image must fill 320px height at `object-cover`. A 256px source PNG displayed at 320px height would be stretched and appear blurry. Using `size=512` gives a comfortable buffer.

**GOTCHA — Gradient Overlay Interaction:**
The gradient overlay (`div.absolute.inset-0`) is stacked after the `<img>` in the DOM. When the avatar is displayed instead of a real photo, the indigo-on-light-indigo avatar (light background) combined with a `from-black/60` gradient at the bottom will still render the expert's name and category badge as white text against a darkened bottom strip. This looks intentional and professional — the gradient was designed to work regardless of image content.

**VALIDATE:**
Navigate to `http://localhost:5173/expert/<any-id>`. The left sidebar should show either the expert's photo or a large, clear branded avatar (512px source, displayed at ~320px height).

---

### Phase 3 — Integration: Verify Cross-Component Consistency

#### Task 3.1 — Verify Avatar URL Parameter Parity

**IMPLEMENT:**
Both components must use identical query parameters for `background` and `color`, differing only in `size`. A mismatch would produce inconsistently styled avatars across the app.

**PATTERN:**
Cross-check the two avatar URLs side-by-side:

| Parameter    | `ExpertCard.jsx` (Line 44) | `ExpertDetail.jsx` (Line 240) |
|--------------|---------------------------|-------------------------------|
| `name`       | `encodeURIComponent(expert.name)` | `encodeURIComponent(expert.name)` |
| `background` | `e0e7ff` | `e0e7ff` |
| `color`      | `4f46e5` | `4f46e5` |
| `size`       | `256` | `512` |

**GOTCHA:**
If the avatar in `ExpertCard` shows indigo initials but the one in `ExpertDetail` shows a different color, it means the `background`/`color` values diverged during editing. Always verify both files after making changes to either.

**VALIDATE:**
```bash
grep -n "ui-avatars.com" frontend/src/components/ExpertCard.jsx
grep -n "ui-avatars.com" frontend/src/pages/ExpertDetail.jsx
```
Both lines should differ only in `size=256` vs `size=512`.

---

#### Task 3.2 — Confirm `MyBookings.jsx` Does Not Need Changes

**IMPLEMENT:**
Open `frontend/src/pages/MyBookings.jsx` and verify that no `<img>` element renders `expert.profileImage` or any expert image URL.

**PATTERN:**
`MyBookings.jsx` (19,671 bytes, 477+ lines) displays booking records fetched via `fetchBookingsByEmail`. The booking document in MongoDB (`backend/src/models/Booking.js`) stores `expert` as an ObjectID reference, not an embedded object. The MyBookings page renders the expert's *name* (likely populated via `.populate('expert', 'name')`) as text, but not the image.

**VALIDATE:**
```bash
grep -n "profileImage\|ui-avatars\|<img" frontend/src/pages/MyBookings.jsx
```
Expected result: zero matches (or only unrelated `<img>` tags without `profileImage`).

---

#### Task 3.3 — Confirm No CSS or Tailwind Changes Are Required

**IMPLEMENT:**
The fallback avatar from `ui-avatars.com` is a standard PNG image. No CSS changes are needed — the existing Tailwind classes (`object-cover`, `w-full`, `h-full`, `h-80`) handle layout and sizing for both real photos and generated avatars identically.

**PATTERN:**
The `bg-gray-200` class on the parent container in `ExpertCard.jsx` (line 42: `<div className="relative h-56 bg-gray-200 overflow-hidden">`) provides a gray background that shows while the image loads. This is a natural loading placeholder and remains in place. For the avatar URL (which loads quickly), the gray flash is imperceptible.

**VALIDATE:**
No action. Confirm by visual inspection in the browser.

---

### Phase 4 — Testing: Validate All Failure Scenarios

#### Task 4.1 — Test Level 1 Fallback: Null/Empty `profileImage`

**IMPLEMENT:**
Temporarily modify the seed data or use browser DevTools to simulate an expert with a null/falsy `profileImage`.

**PATTERN:**
Using MongoDB shell or Mongo Compass:
```js
// Set one expert's profileImage to null to test Level 1 fallback
db.experts.updateOne({ name: "Rajesh Kumar" }, { $set: { profileImage: null } })
```
After reseeding or reloading, navigate to the expert listing. The card for "Rajesh Kumar" should show `RK` in an indigo circle, not a broken image.

**VALIDATE:**
1. `expert.profileImage` is `null` → `null || avatarUrl` evaluates to `avatarUrl`.
2. The `<img src>` is set to the avatar URL from the start — `onError` is never triggered.
3. Undo: `db.experts.updateOne({ name: "Rajesh Kumar" }, { $unset: { profileImage: "" } })`

---

#### Task 4.2 — Test Level 2 Fallback: Broken URL

**IMPLEMENT:**
Temporarily set an expert's `profileImage` to a URL guaranteed to 404:
```js
db.experts.updateOne({ name: "Priya Sharma" }, { $set: { profileImage: "https://example.com/nonexistent-photo.jpg" } })
```

**PATTERN:**
Navigate to the expert listing. "Priya Sharma"'s card should briefly show the `bg-gray-200` background (while the broken URL is attempted), then immediately swap to the branded avatar with "PS" initials. The transition should be near-instantaneous on a local network.

**VALIDATE:**
1. `expert.profileImage` is `"https://example.com/nonexistent-photo.jpg"` → truthy → `src` is set to this URL.
2. Network request fails (404 or network error) → `onError` fires.
3. `e.target.onerror = null` — handler is disarmed.
4. `e.target.src` is set to the avatar URL.
5. Avatar loads successfully.

---

#### Task 4.3 — Test Level 2 Fallback: `placehold.co` Default

**IMPLEMENT:**
Ensure that an expert with the Mongoose default value `"https://placehold.co/150"` has its `onError` fall back correctly if `placehold.co` is unreachable.

**PATTERN:**
Using browser DevTools > Network > Block Request URL, block `*.placehold.co`. Reload the page. Cards with the `placehold.co` default should fall back to the branded avatar.

**VALIDATE:**
In Chrome DevTools:
1. Open DevTools → Network tab → right-click any `placehold.co` request → "Block request URL".
2. Reload the page.
3. All experts using the `placehold.co` default should render the branded indigo avatar.
4. Remove the block to restore normal behavior.

---

#### Task 4.4 — Test Infinite Loop Prevention

**IMPLEMENT:**
Verify that `e.target.onerror = null` prevents an infinite loop when both the original URL and the fallback avatar URL are blocked.

**PATTERN:**
Using browser DevTools > Network, block both `*.placehold.co` AND `*.ui-avatars.com`. Reload the page.

**VALIDATE:**
1. Both `placehold.co` and `ui-avatars.com` requests fail.
2. `onError` fires once: `e.target.onerror = null` → `e.target.src = avatarUrl`.
3. `avatarUrl` also fails — but because `onerror` is now `null`, no second `onError` fires.
4. The browser shows its native broken-image icon as the ultimate last resort.
5. **Crucially:** No infinite error loop, no memory leak, no console spam. Open the Console tab — there should be zero JavaScript errors, only network-level 404 messages.

---

#### Task 4.5 — Test `encodeURIComponent` with Special Names

**IMPLEMENT:**
Verify that experts with complex names produce valid, parseable avatar URLs.

**PATTERN:**
Test cases to cover manually or via browser address bar:

| Expert Name | Expected Encoded URL Segment | Expected Initials |
|---|---|---|
| `Rajesh Kumar` | `Rajesh%20Kumar` | `RK` |
| `Dr. Priya Sharma` | `Dr.%20Priya%20Sharma` | `DP` |
| `A. Martinez` | `A.%20Martinez` | `AM` |
| `李明` (CJK characters) | `%E6%9D%8E%E6%98%8E` | Depends on service |

Paste each full URL into the browser address bar and confirm a valid PNG avatar is returned.

**VALIDATE:**
```
https://ui-avatars.com/api/?name=Dr.%20Priya%20Sharma&background=e0e7ff&color=4f46e5&size=256
```
This URL should return a 256×256 PNG with the letters "DP" in indigo on a light indigo background.

---

#### Task 4.6 — Test Detail Page Avatar at Large Size

**IMPLEMENT:**
Navigate to the `ExpertDetail` page for an expert with a null `profileImage`. Verify the avatar is sharp and not pixelated at the `h-80` (320px) display size.

**PATTERN:**
The `size=512` avatar displayed at 320px gives a 1.6× pixel density — sufficient for standard DPI screens. On 2× Retina (640px CSS = 1280px physical), the 512px source will still be slightly upscaled, but initials-based PNGs with simple geometry degrade gracefully.

**VALIDATE:**
1. Open the expert detail page.
2. Use browser DevTools > Elements to inspect the `<img>` element — confirm `src` contains `size=512`.
3. Visually verify the initials are crisp, not blurry.

---

## 6. Testing Strategy

### 6.1 Unit Tests (Future)
No automated test framework is currently configured (per `AGENTS.md`). If tests are added, prioritize:

```
// Proposed: frontend/src/components/__tests__/ExpertCard.test.jsx
describe('ExpertCard — Image Fallback Behavior', () => {
  it('renders avatar URL when profileImage is null', () => {
    const expert = { name: 'Test User', profileImage: null, ... };
    render(<ExpertCard expert={expert} index={0} />);
    const img = screen.getByRole('img');
    expect(img.src).toContain('ui-avatars.com');
    expect(img.src).toContain('Test%20User');
  });

  it('renders avatar URL when profileImage is empty string', () => {
    const expert = { name: 'Test User', profileImage: '', ... };
    render(<ExpertCard expert={expert} index={0} />);
    expect(screen.getByRole('img').src).toContain('ui-avatars.com');
  });

  it('renders profileImage URL when profileImage is a valid string', () => {
    const expert = { name: 'Test User', profileImage: 'https://valid.com/photo.jpg', ... };
    render(<ExpertCard expert={expert} index={0} />);
    expect(screen.getByRole('img').src).toBe('https://valid.com/photo.jpg');
  });

  it('swaps src to avatar URL on onError event', () => {
    const expert = { name: 'Test User', profileImage: 'https://broken.com/photo.jpg', ... };
    render(<ExpertCard expert={expert} index={0} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(img.src).toContain('ui-avatars.com');
    expect(img.onerror).toBeNull(); // Confirm handler was disarmed
  });
});
```

Test framework recommendation: **Vitest** (native Vite integration) + **@testing-library/react**.

### 6.2 Integration Tests (Future)
```
// Proposed: test the full expert listing render with mocked API data
it('expert listing renders branded avatars for all experts with null profileImage', async () => {
  server.use(
    rest.get('/experts', (req, res, ctx) => res(ctx.json({
      data: [{ _id: '1', name: 'Jane Doe', profileImage: null, ... }]
    })))
  );
  render(<ExpertListing />);
  const img = await screen.findByRole('img');
  expect(img.src).toContain('Jane%20Doe');
});
```

### 6.3 Edge Cases to Cover

| Scenario | Expected Behavior |
|---|---|
| `profileImage = null` | Level 1 fires; avatar URL used as initial `src` |
| `profileImage = undefined` | Level 1 fires; avatar URL used as initial `src` |
| `profileImage = ""` (empty string) | Level 1 fires; avatar URL used as initial `src` |
| `profileImage = "https://placehold.co/150"` (default) | Level 1 passes; `onError` fires if host unreachable |
| `profileImage = "https://broken.example.com/img.jpg"` | Level 1 passes; `onError` fires; avatar URL swapped in |
| Both original URL and `ui-avatars.com` unreachable | One `onError` fires, then `onerror = null` prevents loop; browser native broken icon shown |
| Expert name with spaces (e.g., `"Rajesh Kumar"`) | `encodeURIComponent` encodes to `Rajesh%20Kumar`; valid URL |
| Expert name with period (e.g., `"Dr. Priya"`) | `encodeURIComponent` encodes `.` as `.` (unchanged); valid URL |
| Expert name is empty string `""` | `encodeURIComponent("")` → `""`; ui-avatars.com returns a default placeholder |
| Expert name contains `&` (e.g., `"R&D Lead"`) | `encodeURIComponent("R&D Lead")` → `"R%26D%20Lead"`; correct — `&` must not be unencoded in a query value |
| `ExpertCard` on mobile (< 640px viewport) | `h-56` container; avatar fills correctly via `object-cover` |
| `ExpertDetail` on mobile (lg:col-span-4 collapses to full width) | `h-80` remains; avatar at `size=512` fills 100% width cleanly |

---

## 7. Validation Commands

```bash
# 1. Confirm the feature files exist and have the correct content
grep -n "ui-avatars.com" frontend/src/components/ExpertCard.jsx
grep -n "ui-avatars.com" frontend/src/pages/ExpertDetail.jsx

# 2. Confirm onError and onerror = null are present in both files
grep -n "onerror" frontend/src/components/ExpertCard.jsx
grep -n "onerror" frontend/src/pages/ExpertDetail.jsx

# 3. Confirm encodeURIComponent is used (not a raw string concatenation)
grep -n "encodeURIComponent" frontend/src/components/ExpertCard.jsx
grep -n "encodeURIComponent" frontend/src/pages/ExpertDetail.jsx

# 4. Confirm no other component references profileImage without a fallback
grep -rn "profileImage" frontend/src/ | grep -v "node_modules"

# 5. Run ESLint on modified files (no new lint errors should be introduced)
cd frontend && npm run lint -- --max-warnings 0

# 6. Start the development server and do a manual visual pass
cd frontend && npm run dev
# Then visit: http://localhost:5173/experts
# And: http://localhost:5173/expert/<any-valid-id>

# 7. Verify the avatar URL resolves correctly in a browser/curl
curl -I "https://ui-avatars.com/api/?name=Rajesh%20Kumar&background=e0e7ff&color=4f46e5&size=256"
# Expected: HTTP/1.1 200 OK, Content-Type: image/png

# 8. Verify size=512 is used in ExpertDetail and size=256 in ExpertCard
grep -n "size=" frontend/src/components/ExpertCard.jsx      # Should show: size=256
grep -n "size=" frontend/src/pages/ExpertDetail.jsx          # Should show: size=512

# 9. Build the frontend to confirm no compilation errors
cd frontend && npm run build
# Expected: vite build completes with no errors
```

---

## 8. Acceptance Criteria

### AC-1: Null/Undefined `profileImage` — Branded Avatar Displayed
**Given** an expert document in MongoDB where `profileImage` is `null`, `undefined`, or `""`,  
**When** the user views the expert listing page (`/experts`),  
**Then** the `ExpertCard` for that expert displays a square avatar showing the expert's initials in indigo text (`#4f46e5`) on a light indigo background (`#e0e7ff`), with no broken-image icon.

### AC-2: Broken URL — `onError` Fallback to Avatar
**Given** an expert document where `profileImage` is set to a URL that returns a non-200 status (e.g., 404, 500) or times out,  
**When** the browser attempts to load the image,  
**Then** the `onError` handler fires exactly once, the `src` is replaced with the branded avatar URL, and the avatar is displayed in both `ExpertCard` and `ExpertDetail` without any visible broken-image icon.

### AC-3: No Infinite Loop on Double Failure
**Given** an expert with a broken `profileImage` URL AND `ui-avatars.com` is also unreachable (network blocked),  
**When** the `onError` fires for the first time,  
**Then** `e.target.onerror` is set to `null` before `e.target.src` is changed, and no second `onError` event is triggered. The browser shows its native broken-image icon (last resort) and no JavaScript errors appear in the browser console.

### AC-4: Valid `profileImage` — Real Photo Displayed
**Given** an expert document where `profileImage` is a valid, accessible URL,  
**When** the expert listing and detail pages load,  
**Then** the expert's actual photo is displayed, not the avatar fallback.

### AC-5: Avatar is Personalized and Brand-Consistent
**Given** any expert whose avatar is displayed (due to AC-1 or AC-2),  
**When** the avatar is rendered,  
**Then**:
- The avatar shows the expert's initials (e.g., `"Rajesh Kumar"` → `RK`).
- The background color is `#e0e7ff` (indigo-100).
- The text/initials color is `#4f46e5` (indigo-600).
- On `ExpertCard`, the source resolution is 256×256 px.
- On `ExpertDetail` sidebar, the source resolution is 512×512 px.

### AC-6: Expert Names with Special Characters Encode Correctly
**Given** an expert name containing spaces, periods, commas, or other non-URL-safe characters,  
**When** the avatar URL is constructed,  
**Then** `encodeURIComponent(expert.name)` is used to produce a valid URL with no unencoded special characters in the query value.

### AC-7: No Backend Changes Required
**Given** the implementation is complete,  
**When** the backend is inspected,  
**Then** `backend/src/models/Expert.js` remains unchanged (the `placehold.co/150` schema default is unmodified), and no new backend routes, controllers, or middleware have been added.

### AC-8: ESLint Passes
**Given** the changes to `ExpertCard.jsx` and `ExpertDetail.jsx`,  
**When** `npm run lint` is executed from the `frontend/` directory,  
**Then** no new lint errors or warnings are introduced.

---

## 9. Completion Checklist

### Implementation
- [x] `ExpertCard.jsx` — `src` attribute updated with Level 1 `||` fallback (`size=256`)
- [x] `ExpertCard.jsx` — `onError` handler added with `e.target.onerror = null` guard
- [x] `ExpertDetail.jsx` — `src` attribute updated with Level 1 `||` fallback (`size=512`)
- [x] `ExpertDetail.jsx` — `onError` handler added with `e.target.onerror = null` guard
- [x] Both components use identical `background=e0e7ff` and `color=4f46e5` parameters
- [x] `encodeURIComponent(expert.name)` used in both components (not raw string concatenation)
- [x] Backend files untouched — `Expert.js` schema unchanged
- [x] No new npm packages added

### Testing
- [ ] Visual pass: expert listing shows branded avatars for null-image experts
- [ ] Visual pass: expert detail page shows branded avatar for null-image experts at large size
- [ ] Network block test: `onError` fallback activates for broken URLs
- [ ] Network block test: no infinite loop when both URLs are blocked
- [ ] Special name test: `encodeURIComponent` produces valid URLs for names with spaces/periods
- [ ] ESLint: `npm run lint` passes with no new errors
- [ ] Build check: `npm run build` completes without errors

### Documentation
- [x] Feature plan written to `docs/feature-plan-image-placeholders.md`
- [ ] `CHANGELOG.md` updated with entry for this feature
- [ ] `docs/ROADMAP.md` line 22 checked off (`- [x] Image Placeholders`)

---

## 10. Notes, Design Decisions & Trade-offs

### 10.1 Why `ui-avatars.com` Over `placehold.co`

| Criterion | `placehold.co/150` (old default) | `ui-avatars.com` (chosen) |
|---|---|---|
| **Personalization** | None — identical gray box for all experts | Expert's initials — unique per expert |
| **Brand alignment** | None — neutral gray | Configurable to match app palette |
| **Professional appearance** | Poor — signals "no image loaded" | Good — looks intentionally designed |
| **HTTP request needed** | Yes | Yes |
| **API key required** | No | No |
| **Zero JS overhead** | Yes | Yes |

### 10.2 Why a Two-Level Fallback Instead of One

A single-level fallback using only `onError` would fail for cases where `profileImage` is `null` or `undefined` — these falsy values cannot produce a network request to intercept. A single-level fallback using only `src={value || fallback}` would fail to handle cases where a URL is present but broken (the `src` would be set to the broken URL and `onError` would still fire with no handler to recover it). The two-level design covers the full truth table:

| `profileImage` value | Truthy? | `onError` needed? | Level used |
|---|---|---|---|
| `null` | No | No | Level 1 only |
| `undefined` | No | No | Level 1 only |
| `""` | No | No | Level 1 only |
| `"https://placehold.co/150"` | Yes | Only if host down | Level 2 only |
| `"https://valid-photo.com/img.jpg"` | Yes | No (it loads) | Neither |
| `"https://broken-cdn.com/img.jpg"` | Yes | Yes | Level 2 only |

### 10.3 Why Inline `onError` vs. a Custom React Hook

A reusable hook (e.g., `useImageFallback(src, name)`) would reduce duplication between `ExpertCard.jsx` and `ExpertDetail.jsx`. However:
- There are only **two call sites** — the threshold for extraction is typically three or more.
- Inline `onError` is immediately legible at the point of use without requiring a reader to jump to another file.
- The avatar URL construction is simple (one template literal) and does not benefit from abstraction at this scale.

**Future consideration:** If a third component needs the same fallback (e.g., `MyBookings.jsx` adds expert photos), extract to `frontend/src/hooks/useImageFallback.js`.

### 10.4 Why `encodeURIComponent` Instead of `encodeURI`

`encodeURI` is designed for encoding an entire URI and deliberately leaves characters like `&`, `=`, `?`, `#`, and `/` unencoded (because they have structural meaning in a URI). Expert names could theoretically contain `&` (e.g., `"R&D Lead"`). If passed to `encodeURI`, the `&` would remain unencoded and break the query string by introducing a spurious parameter separator. `encodeURIComponent` encodes everything that is not an unreserved character, making it safe for use in query parameter *values*.

### 10.5 The `e.target.onerror = null` Assignment: Why Not `removeEventListener`?

The `onError` prop in React is equivalent to setting `HTMLElement.onerror` (the IDL attribute), not using `addEventListener`. Since it is a direct property assignment (not an event listener), the correct way to remove it is to set it to `null`, not `removeEventListener`. Setting `onerror = null` is synchronous, happens in the same tick as the `src` mutation, and guarantees the handler cannot be called again for subsequent load failures.

### 10.6 Pixel Density Rationale

| Context | Container Height | Avatar `size` | Ratio | Notes |
|---|---|---|---|---|
| `ExpertCard` | 224px (`h-56`) | 256px | 1.14× | Adequate for standard DPI; minor upscale on 2× Retina |
| `ExpertDetail` | 320px (`h-80`) | 512px | 1.60× | Sharp on standard DPI; acceptable on 2× Retina |

An alternative would be to use `size=128` for both to reduce bandwidth. Rejected: initials would appear blurry at 224px display size. Using `size=256` for ExpertDetail was also considered but rejected due to visible blurring at 320px display height on standard DPI screens.

---

## 11. Decision Log

| # | Date | Decision | Rationale | Decided By |
|---|---|---|---|---|
| 1 | 2026-05-24 | Use `ui-avatars.com` as the avatar generator | Free, no API key, zero JS bundle cost, highly configurable | Engineering |
| 2 | 2026-05-24 | Use `background=e0e7ff` and `color=4f46e5` | Matches app's Tailwind indigo palette; avatars look intentionally branded | Engineering |
| 3 | 2026-05-24 | Use `size=256` for ExpertCard, `size=512` for ExpertDetail | Proportional to display size; balances quality vs. bandwidth | Engineering |
| 4 | 2026-05-24 | Set `e.target.onerror = null` before changing `src` | Canonical infinite loop prevention for `<img>` onError handlers | Engineering |
| 5 | 2026-05-24 | Use `encodeURIComponent` for name encoding | Safer than `encodeURI`; handles `&`, `=`, and other query-breaking characters in names | Engineering |
| 6 | 2026-05-24 | Do not change backend `Expert.js` schema default | Frontend-only feature; schema default irrelevant since frontend overrides it | Engineering |
| 7 | 2026-05-24 | Do not extract a reusable hook | Only two call sites; premature abstraction adds indirection without value | Engineering |
| 8 | 2026-05-24 | Reject `react-avatar` library | Adds a dependency; `ui-avatars.com` achieves the same with zero JS overhead | Engineering |
| 9 | 2026-05-24 | Reject inline SVG approach | More complex; does not handle `onError` for broken-but-present URLs | Engineering |
| 10 | 2026-05-24 | Reject CSS-only initials (styled div) | Requires two render paths (image vs. div), extracting initials in JS, and managing background colors separately | Engineering |

---

## 12. Known Limitations & Future Improvements

### 12.1 External CDN Dependency Risk

**Limitation:** `ui-avatars.com` is a third-party, publicly-accessible service with no SLA. If the service is:
- **Down (502/503):** Both Level 1 and Level 2 will produce broken images (since the avatar URL itself fails and `onerror = null` prevents the loop). The browser shows its native broken-image icon.
- **Slow:** Image loads are delayed, producing a brief `bg-gray-200` placeholder flash (existing behavior — acceptable).
- **Rate-limited:** Unlikely at typical usage volumes, but possible for high-traffic production deployments.

**Mitigation (Future):** Self-host an avatar generator. Options include:
- A serverless function (e.g., Vercel Edge Function) that generates SVG avatars from initials — zero external dependency.
- Cache `ui-avatars.com` responses via a service worker or a CDN-level cache.
- Use a Canvas-based in-browser avatar generator (e.g., a tiny utility function) to render initials as a data URI, eliminating any network request.

### 12.2 `placehold.co/150` Schema Default Still Present

**Limitation:** `backend/src/models/Expert.js` line 50 still defines `default: 'https://placehold.co/150'`. While the frontend overrides this with a better fallback, the database still stores `placehold.co` URLs for any expert seeded without a `profileImage`. This is wasteful — the URL is stored and transmitted over the API but immediately overridden.

**Improvement (Future):** Update the Mongoose default to `null` or `''`:
```js
profileImage: {
  type: String,
  default: null   // Frontend handles all fallback logic
}
```
This makes the schema honest about the "no image" state and reduces the false confidence of having a "valid" URL that actually returns a generic placeholder.

### 12.3 No Accessibility Testing for Avatar Alt Text

**Limitation:** Both `<img>` elements use `alt={expert.name}`, which is correct for accessibility — screen readers will announce the expert's name. However, when an avatar is displayed instead of a real photo, a screen reader might announce "Image: Rajesh Kumar" without any indication that it is an initials avatar, not a real photo. This is a minor UX consideration.

**Improvement (Future):** Use a more descriptive `alt` when the fallback is active:
```jsx
alt={expert.profileImage ? expert.name : `${expert.name} (initials avatar)`}
```

### 12.4 No Loading State for Image

**Limitation:** There is no `loading="lazy"` attribute or explicit loading skeleton for the `<img>` elements. On slow connections, the `bg-gray-200` background shows while images load — this is implicit lazy behavior at the browser level but not explicitly controlled.

**Improvement (Future):** Add `loading="lazy"` to `ExpertCard` images (below-the-fold cards) and optionally a Tailwind `animate-pulse` skeleton on the parent div while the image URL is resolving. This is a separate feature concern.

### 12.5 No Cache for Avatar URLs

**Limitation:** Each page load requests fresh avatar URLs from `ui-avatars.com`. Since the avatar URL is deterministic (same name → same URL → same image), the browser's HTTP cache will handle this efficiently after the first visit. However, across sessions (cleared cache, incognito), the requests repeat.

**Improvement (Future):** If self-hosting, cache avatar SVGs by name in `localStorage` or IndexedDB to avoid repeated external requests on return visits.

### 12.6 Potential Improvement: React Hook Extraction

Once a third component (e.g., a redesigned `MyBookings.jsx` that shows expert avatars) requires the same pattern, the logic should be extracted:

```js
// frontend/src/hooks/useImageWithFallback.js
export const buildAvatarUrl = (name, size = 256) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e0e7ff&color=4f46e5&size=${size}`;

export const handleImageError = (name, size = 256) => (e) => {
  e.target.onerror = null;
  e.target.src = buildAvatarUrl(name, size);
};
```

Usage:
```jsx
import { buildAvatarUrl, handleImageError } from '../hooks/useImageWithFallback';

<img
  src={expert.profileImage || buildAvatarUrl(expert.name, 256)}
  alt={expert.name}
  onError={handleImageError(expert.name, 256)}
/>
```

This extraction point should be deferred until the third call site exists to avoid premature abstraction.

---

*End of Feature Plan — Smart Image Placeholders & Fallbacks*  
*Document version: 1.0 | Last updated: 2026-05-24*
