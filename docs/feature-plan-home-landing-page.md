# Feature: Home Landing Page

> The following plan is complete and documents the already-implemented feature. Before making any extensions or modifications, validate all codebase patterns and task sanity against the current state of the source files listed below.
>
> Pay special attention to the routing hierarchy (`/` vs `/experts`), the flex layout chain, and the exact Lucide icon names used. Import from the right files.

---

## Feature Description

The **Home Landing Page** feature introduces a dedicated, visually polished entry point for the SkillSync application at the root route (`/`). Prior to this feature, navigating to `/` rendered `ExpertListing` directly — there was no brand identity, no value proposition, and no guided user journey.

The feature delivers two distinct page sections:

1. **Hero Section** — A full-viewport, indigo-branded banner (`bg-indigo-600`) with the SkillSync headline (`"Expert Advice, Zero Conflicts."`), a supporting tagline, and a primary CTA button (`Browse Experts`) that performs a client-side navigation to `/experts`.
2. **Feature Highlights Section** — A three-column responsive grid showcasing SkillSync's core value propositions, each represented by a Lucide icon, a bold heading, and a short description.

Alongside the page component itself, this feature required two surgical changes to existing files:

- **`App.jsx`**: The root route `/` was reassigned from `<ExpertListing />` to `<Home />`. A new `/experts` route was registered for `<ExpertListing />`. The root `<div>` class was upgraded from `min-h-screen` to `min-h-screen flex flex-col` to support the full-height hero layout.
- **`Navbar.jsx`**: The `Explore` navigation link was updated from `to="/"` to `to="/experts"`, and its active-state condition was updated from `pathname === '/'` to `pathname === '/experts'`.

The feature is **purely frontend** — no backend API endpoints, no database schema changes, no Socket.io events were added.

---

## User Story

```
As a first-time visitor to SkillSync
I want to land on a professional, branded home page that communicates the platform's value
So that I understand what SkillSync does and am motivated to browse available experts
```

---

## Problem Statement

Before this feature, the root URL `/` of the SkillSync application rendered `ExpertListing` — a functional but context-free directory of experts. This created three distinct problems:

1. **No brand identity at entry** — A user arriving at the site for the first time had no headline, tagline, or call to action. They were dropped directly into a list, which felt abrupt and unprofessional.
2. **Routing ambiguity** — Using `/` for the expert directory made it semantically incorrect. The root route of any web application carries the implicit meaning of "home" or "welcome". Placing the expert directory there mixed two distinct user intents: discovering the product vs. browsing experts.
3. **Layout inflexibility** — The `min-h-screen` class on the root `<div>` in `App.jsx` prevented child pages from using `flex-grow` to fill remaining viewport height (below the Navbar). This blocked the hero section design, which requires the indigo background to extend to the bottom of the visible screen.

---

## Solution Statement

The solution introduces a purpose-built `Home.jsx` page component and applies two minimal, surgical updates to the routing and layout:

1. **Create `frontend/src/pages/Home.jsx`** — A stateless functional component with no side effects, no API calls, and no state. It renders two semantic `<section>` elements within a `flex flex-col flex-grow` wrapper. The hero section uses `flex-grow` to consume all remaining vertical space below the Navbar. The CTA uses React Router's `<Link>` component to navigate to `/experts` without a full page reload.

2. **Update `App.jsx`** — Register `<Home />` at `/` and `<ExpertListing />` at `/experts`. Add `flex flex-col` to the root `<div>` so that `Home`'s `flex-grow` propagates correctly through the layout tree.

3. **Update `Navbar.jsx`** — Redirect the `Explore` link from `/` to `/experts` and update the active-state highlight logic accordingly.

No new npm dependencies are introduced. Lucide React (`lucide-react`) is already a production dependency at version `^1.14.0`.

---

## Feature Metadata

| Property | Value |
|---|---|
| **Feature Type** | New Capability + Routing Refactor |
| **Estimated Complexity** | Low |
| **Primary Systems Affected** | `frontend/src/pages/`, `frontend/src/App.jsx`, `frontend/src/components/Navbar.jsx` |
| **Backend Changes** | None |
| **New Dependencies** | None (`lucide-react` already installed) |
| **Breaking Changes** | The `/` route no longer renders `ExpertListing` — any hardcoded `/` links expecting the expert directory must be updated |
| **Routing Side-Effects** | Audited — only the `Navbar.jsx` `Explore` link pointed to `/`; `ExpertDetail.jsx` back-button to `/` is correct UX (navigates home, not to expert list) |

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE MODIFYING

| File | Lines | Why It Matters |
|---|---|---|
| `frontend/src/App.jsx` | 1–55 (all) | Defines the routing tree and root layout `<div>`. The `flex flex-col` addition and the `/` → `<Home />` re-mapping live here. The layout class on line 31 is the critical enabler for the hero's full-height design. |
| `frontend/src/pages/Home.jsx` | 1–61 (all) | The new landing page. The `flex flex-col flex-grow` on line 7 and `flex-grow` on the hero `<section>` (line 9) together form the height-fill chain. Understand this before editing either file. |
| `frontend/src/components/Navbar.jsx` | 46–56 | The `Explore` link. After this feature, `to` is `/experts` and the active condition checks `pathname === '/experts'`. The logo link at line 34 correctly points to `/` (the home page) and was not changed. |
| `frontend/src/pages/ExpertDetail.jsx` | 225–231 | The back-button uses `navigate('/')`. After the routing change, this navigates to the Home page, which is **correct UX** — users who finish viewing an expert profile should return home, not to the expert directory. This was intentionally left as-is. |
| `frontend/src/pages/ExpertListing.jsx` | 75 | The component's own outer `<div>` uses `min-h-screen` — this is now safe since it is rendered under the `/experts` route. It was not modified. |
| `frontend/src/index.css` | 11–38 | Defines `.animate-fade-in`, `.animate-slide-up`, `.delay-100/200/300` utility classes. `Home.jsx` does **not** currently use these, but any future section additions should use them for consistency. |
| `frontend/src/main.jsx` | 24–28 | Application root. Mounts `<App />` wrapped in `<StrictMode>`. No changes were needed here. |

### New Files Created

| File | Purpose |
|---|---|
| `frontend/src/pages/Home.jsx` | The landing page component — hero section + feature highlights grid. Stateless; no hooks, no API calls. |
| `docs/feature-plan-home-landing-page.md` | This document — the implementation plan and architectural record. |

### Relevant Documentation — Read Before Extending

| Resource | Section | Why |
|---|---|---|
| [React Router v7 Docs — `<Link>`](https://reactrouter.com/en/main/components/link) | `<Link to>` | The CTA button uses `<Link>` for client-side navigation. Must **not** be replaced with `<a href>` which causes a full page reload and breaks SPA state. |
| [React Router v7 Docs — `useLocation`](https://reactrouter.com/en/main/hooks/use-location) | `pathname` | `Navbar.jsx` uses `useLocation().pathname` for active-link highlighting. Any new nav links must follow this same pattern. |
| [Lucide React — Getting Started](https://lucide.dev/guide/packages/lucide-react) | Installation + usage | All icons in this project are imported from `lucide-react`. The icons used in `Home.jsx` are: `Calendar`, `Users`, `Clock`. Verify icon names against the Lucide icon explorer before adding new ones. |
| [Tailwind CSS Docs — Flexbox](https://tailwindcss.com/docs/flex) | `flex`, `flex-col`, `flex-grow` | The layout chain that makes the hero fill the viewport is: `App div (flex flex-col)` → `Home div (flex flex-col flex-grow)` → `hero section (flex-grow)`. Understanding this chain is mandatory before modifying the layout. |
| [Tailwind CSS Docs — Colors](https://tailwindcss.com/docs/customizing-colors) | `indigo-*` palette | The hero uses `bg-indigo-600`, `text-indigo-200`, `text-indigo-100`, `bg-indigo-50`. The brand primary in the rest of the app is `blue-600`. The hero intentionally uses `indigo` for visual differentiation. |

---

## Patterns to Follow

### Naming Conventions

Following `AGENTS.md` conventions:

- **Page files**: PascalCase, `.jsx` extension → `Home.jsx` (matches `ExpertListing.jsx`, `ExpertDetail.jsx`, `MyBookings.jsx`)
- **Component files**: PascalCase, `.jsx` extension → no new components were added in this feature
- **Function/component name**: Matches filename exactly → `function Home()` in `Home.jsx`
- **Export style**: Default export at the bottom of the file → `export default Home;`
- **Import order**: External packages first (`react`, `react-router-dom`, `lucide-react`), then local modules. No local imports in `Home.jsx` (it is a leaf component with no sub-components).

### Component Architecture Pattern

`Home.jsx` follows the established **stateless page pattern** visible in the simpler parts of the codebase:

```jsx
// Pattern: Simple stateless page (no hooks, no API calls)
import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="flex flex-col flex-grow">
      {/* sections */}
    </div>
  );
}

export default Home;
```

Contrast with the stateful pattern in `ExpertListing.jsx` (lines 26–72) which uses `useState` + `useEffect` for data fetching. `Home.jsx` deliberately avoids this complexity.

### JSX Comment Pattern

All files use `{/* Comment text */}` for inline JSX comments that label major sections:

```jsx
{/* Hero Section */}
<section ...>

{/* Feature Highlights */}
<section ...>
```

This pattern is consistent across `App.jsx` (lines 30, 32, 35), `ExpertDetail.jsx`, and `Navbar.jsx`.

### Tailwind Responsive Pattern

Responsive breakpoints follow the Tailwind mobile-first convention used throughout the project:

```jsx
// Mobile → Tablet → Desktop progression
className="grid grid-cols-1 md:grid-cols-3 gap-8"
// ↑ 1 column on mobile, 3 columns on md+ (768px+)

className="text-4xl sm:text-5xl md:text-6xl"
// ↑ Progressive text scaling
```

The CTA button also follows the responsive padding pattern seen in `ExpertListing.jsx`:

```jsx
className="... md:py-4 md:text-lg md:px-10"
```

### Icon Usage Pattern

Icons from `lucide-react` are always sized with Tailwind width/height utilities and never inline styles:

```jsx
// Correct pattern (from ExpertCard.jsx line 77, Navbar.jsx line 67)
<Users className="w-6 h-6" />
<Clock className="w-6 h-6" />
<Calendar className="w-6 h-6" />

// Icon containers use fixed-size, centered flex divs
<div className="w-12 h-12 inline-flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4">
  <Users className="w-6 h-6" />
</div>
```

### Active Link Pattern (Navbar)

All navigation links check `location.pathname` for active-state styling using a ternary in the `className` prop:

```jsx
// Pattern from Navbar.jsx lines 49-53 (post-feature state)
className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
  location.pathname === '/experts'
    ? 'text-blue-600 bg-blue-50 shadow-sm'
    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
}`}
```

When adding new navbar links, always use `useLocation()` (already imported at line 12) and this ternary pattern.

### Error Handling Pattern

`Home.jsx` has **no error handling** — it is a pure static render with no API calls or async operations. This is correct and intentional. Error handling in this codebase lives in components that perform async operations (e.g., `ExpertListing.jsx` line 54–55 for fetch errors, `ExpertDetail.jsx` line 182 for booking errors).

### Logging Pattern

No `console.log` or `console.error` calls are appropriate in `Home.jsx` — it is a static component. Logging in this project is only used for caught exceptions in async effects (e.g., `ExpertDetail.jsx` line 109: `console.error(err)`).

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation — Layout Enablement

Before the `Home.jsx` component can be rendered correctly, the root layout must support flex-column growth. This is a one-line change to `App.jsx` that must happen first because `Home.jsx` relies on it.

**Problem**: The existing `<div className="min-h-screen bg-gray-50">` in `App.jsx` (line 31 pre-change) is a block-level container. Children that use `flex-grow` have nothing to grow into because the parent has no flex context.

**Fix**: Add `flex flex-col` to the root `<div>`:
```jsx
<div className="min-h-screen bg-gray-50 flex flex-col">
```

This establishes a vertical flex container. The `<Navbar />` takes its natural height. The `<Routes>` output (the page component) inherits the flex child role and can use `flex-grow` to fill the rest.

**Tasks:**
- Update `App.jsx` root `<div>` class to include `flex flex-col`

### Phase 2: Core Implementation — Home Page Component

Create `frontend/src/pages/Home.jsx` as a standalone, stateless functional component.

**Tasks:**
- Create the file with the standard page file-header comment block
- Implement the JSX structure: outer wrapper → hero section → highlights section
- Import `React`, `Link` from `react-router-dom`, and `{ Calendar, Users, Clock }` from `lucide-react`
- Apply the flex layout chain: `flex flex-col flex-grow` on the outer div; `flex-grow flex items-center` on the hero section
- Implement three feature highlight cards in a responsive 1/3-column grid
- Implement the CTA `<Link to="/experts">` button with hover + scale transition

### Phase 3: Integration — Routing and Navigation Updates

Connect the new page to the application's routing layer and update all affected navigation references.

**Tasks:**
- Update `App.jsx`: import `Home`, change the `/` route element from `<ExpertListing />` to `<Home />`, add the new `/experts` route for `<ExpertListing />`
- Update `Navbar.jsx`: change `Explore` link's `to` prop from `/` to `/experts` and update the active-state condition from `pathname === '/'` to `pathname === '/experts'`
- Audit all other `/` references in the codebase (result: `ExpertDetail.jsx` back-button correctly stays as `navigate('/')` — this now navigates to the home page, which is correct UX)

### Phase 4: Testing and Validation

Validate the feature across the full navigation surface of the application.

**Tasks:**
- Lint the three changed/created files
- Manually verify the four routes: `/`, `/experts`, `/expert/:id`, `/my-bookings`
- Verify the Navbar active-link highlight works correctly for `/experts` and `/my-bookings`
- Verify the logo link (`/`) navigates to the home page
- Verify the CTA button (`Browse Experts`) navigates to `/experts` without a full reload
- Verify the hero section fills remaining viewport height (no white gap below highlights on tall screens)
- Verify the feature highlights grid collapses to 1 column on mobile and expands to 3 on desktop

---

## STEP-BY-STEP TASKS

> Execute every task in order. Each task is atomic and independently testable.

---

### TASK 1: UPDATE `frontend/src/App.jsx` — Root Layout Class

- **IMPLEMENT**: Change the root `<div>` className on line 31 from `"min-h-screen bg-gray-50"` to `"min-h-screen bg-gray-50 flex flex-col"`. This is the critical prerequisite for the hero's full-height layout. Adding `flex` makes the div a flex container; adding `flex-col` stacks children vertically (Navbar on top, page content below).
- **PATTERN**: Standard Tailwind flex-column layout. Matches the `Home.jsx` wrapper pattern (`flex flex-col flex-grow`) which is the child side of this relationship.
- **IMPORTS**: No new imports required.
- **GOTCHA**: Do NOT add `flex-grow` to the root `<div>` itself — it already uses `min-h-screen` which covers full viewport height. The `flex flex-col` only enables downward flex propagation.
- **VALIDATE**: `cd frontend && npm run lint` — zero errors expected on this change alone.

---

### TASK 2: UPDATE `frontend/src/App.jsx` — Import and Route Definitions

- **IMPLEMENT**: Add `import Home from './pages/Home';` to the import block (line 14 in the current file, after the existing React Router import and before `ExpertListing`). Change the Route at line 38 from `element={<ExpertListing />}` to `element={<Home />}`. Add a new `<Route path="/experts" element={<ExpertListing />} />` on a new line after the `/` route (line 41 in the current file — it is already there in the current implementation).
- **PATTERN**: Route definition pattern — `<Route path="..." element={<ComponentName />} />` — seen at lines 38, 41, 44, 47 of `App.jsx`.
- **IMPORTS**: `import Home from './pages/Home';` — ES module default import, matches all other page imports in the file.
- **GOTCHA**: The route order matters in React Router v7. The `/` route must be defined before `/experts` to avoid unexpected prefix matching. In React Router v7 with `<Routes>`, this is handled by specificity, but maintaining the logical order (root first, then nested/sibling routes) prevents confusion. Also: do NOT use `<Route path="/*">` or `<Route index>` — the current flat route structure is intentional.
- **VALIDATE**:
  ```bash
  cd frontend && npm run dev
  # Navigate to http://localhost:5173/ — should render Home.jsx (hero + highlights)
  # Navigate to http://localhost:5173/experts — should render ExpertListing.jsx
  ```

---

### TASK 3: CREATE `frontend/src/pages/Home.jsx`

- **IMPLEMENT**: Create the file with the following structure:
  1. **File-header JSDoc block** — matching the pattern in `Navbar.jsx` (lines 1–9) and `ExpertListing.jsx` (lines 1–9). Fields: `@file`, `@description`, `Purpose`, `Inputs`, `Outputs`, `Side Effects`.
  2. **Imports** — `React` from `react`; `{ Link }` from `react-router-dom`; `{ Calendar, Users, Clock }` from `lucide-react`.
  3. **Component JSDoc block** — matching the pattern above the component function in `ExpertListing.jsx` (lines 16–23). Fields: `Purpose`, `Parameters`, `Return value`, `Side effects`.
  4. **`function Home()` declaration** — named function declaration (matches `ExpertListing` at line 24 uses `const ExpertListing = () =>` — either form is acceptable, but the named function declaration form is slightly preferred for debugging stack traces; both are present in the codebase).
  5. **Outer div**: `className="flex flex-col flex-grow"` — establishes the flex child that grows into the space created by `App.jsx`'s `flex flex-col`.
  6. **Hero `<section>`**: `className="bg-indigo-600 text-white py-20 flex-grow flex items-center"` — `flex-grow` makes this section consume all remaining height below the feature highlights section; `flex items-center` vertically centers the content.
  7. **Inner content container**: `className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"` — matches the max-width container pattern used in `ExpertListing.jsx` (line 76) and `Navbar.jsx` (line 29).
  8. **`<h1>`**: `className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl"` with text `"Expert Advice, "` and a `<span className="text-indigo-200">Zero Conflicts.</span>`.
  9. **`<p>` tagline**: `className="mt-6 max-w-2xl mx-auto text-xl text-indigo-100"`.
  10. **CTA button wrapper**: `<div className="mt-10 flex justify-center gap-4">`.
  11. **CTA `<Link>`**: `to="/experts"` with full Tailwind class string for the white button with indigo text, shadow, hover scale.
  12. **Highlights `<section>`**: `className="py-16 bg-white"`.
  13. **Three feature cards** inside a `grid grid-cols-1 md:grid-cols-3 gap-8`, each with: icon container div (`w-12 h-12 inline-flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4`), icon component, `<h3>`, `<p>`.
  14. **`export default Home;`** at the bottom.

- **PATTERN**:
  - Page file-header: `Navbar.jsx` lines 1–9
  - Max-width container: `ExpertListing.jsx` line 76 (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`)
  - Icon container: `ExpertDetail.jsx` lines 291–292 (shield icon container pattern)
  - Responsive grid: `ExpertDetail.jsx` line 295 (`grid grid-cols-1 md:grid-cols-2`) — Home.jsx uses `md:grid-cols-3`
  - `<Link>` for navigation: `ExpertCard.jsx` lines 89–94

- **IMPORTS**:
  ```jsx
  import React from 'react';
  import { Link } from 'react-router-dom';
  import { Calendar, Users, Clock } from 'lucide-react';
  ```

- **GOTCHA 1 — Flex Height Chain**: The hero's `flex-grow` ONLY works if three conditions are all true simultaneously:
  1. `App.jsx`'s root `<div>` has `flex flex-col` (Task 1)
  2. `Home`'s outer `<div>` has `flex flex-col flex-grow` (makes Home fill the flex child slot AND become a flex container itself)
  3. The hero `<section>` has `flex-grow` (consumes remaining space after the highlights section is rendered)
  If any one of these three is missing, the hero will not fill the viewport height correctly — it will only be as tall as its content.

- **GOTCHA 2 — `<Link>` not `<a>`**: The CTA button MUST use React Router's `<Link to="/experts">`, NOT `<a href="/experts">`. Using `<a>` triggers a full browser navigation, destroying all React state and re-fetching the page from the server. Since Vite serves a SPA, this works but causes an unnecessary page reload and breaks the instant navigation experience.

- **GOTCHA 3 — Icon Names**: Lucide React icon names are PascalCase and must match exactly. The three icons used are `Calendar`, `Users`, `Clock`. Do not confuse with similarly-named icons like `CalendarDays`, `UserRound`, `Timer` — those are different icons.

- **GOTCHA 4 — No State, No Effects**: `Home.jsx` must remain a pure static render. Do not add `useState`, `useEffect`, or any API calls. The page must render instantly (no loading state, no async dependencies).

- **VALIDATE**:
  ```bash
  cd frontend && npm run lint
  # Expected: 0 errors, 0 warnings on Home.jsx
  ```

---

### TASK 4: UPDATE `frontend/src/components/Navbar.jsx` — Explore Link

- **IMPLEMENT**: Change the `Explore` `<Link>` component (lines 47–56) in two places:
  1. The `to` prop: change from `to="/"` to `to="/experts"`
  2. The active-state condition in the `className` ternary: change from `location.pathname === '/'` to `location.pathname === '/experts'`

  The logo link at line 34 (`<Link to="/">`) must remain pointing to `/` — it is the "go home" link and is correct.

- **PATTERN**: The active-link ternary pattern is already in place for both `Explore` and `My History` links. Mirror the My History pattern (lines 60–65) exactly — only the `to` and `pathname` string change.

- **IMPORTS**: No new imports. `useLocation` is already imported at line 12 (`import { Link, useLocation } from 'react-router-dom';`).

- **GOTCHA**: The Navbar has TWO links: `Explore` and `My History`. Only `Explore` changes. The `My History` link at line 59 (pointing to `/my-bookings`) is unaffected. The logo link at line 34 (pointing to `/`) is also unaffected — it serves as the home button and correctly navigates to the new Home landing page.

- **VALIDATE**:
  ```bash
  cd frontend && npm run dev
  # 1. Navigate to / — Explore link in navbar should NOT be highlighted
  # 2. Navigate to /experts — Explore link SHOULD be highlighted (blue bg, blue text)
  # 3. Navigate to /my-bookings — My History link SHOULD be highlighted
  # 4. Click the SkillSync logo — should navigate to / (home page)
  ```

---

### TASK 5: AUDIT — Verify All Internal Route References

- **IMPLEMENT**: Perform a read-only audit of all files that contain the string `"/"` as a navigation target. The affected files and conclusions are:

  | File | Location | Target | Action |
  |---|---|---|---|
  | `Navbar.jsx` | Logo `<Link to="/">` | `/` → Home | **Keep** — correct, navigates home |
  | `Navbar.jsx` | Explore `<Link to="/experts">` | `/experts` → ExpertListing | **Already updated** in Task 4 |
  | `ExpertDetail.jsx` | Back button `navigate('/')` (line 226) | `/` → Home | **Keep** — correct UX: returning home from expert detail is the right behavior |
  | `ExpertDetail.jsx` | Error state button `navigate('/')` (line 199) | `/` → Home | **Keep** — correct: when expert not found, return home |
  | `ExpertDetail.jsx` | Success redirect `navigate('/my-bookings')` (line 180) | `/my-bookings` | **Unaffected** |
  | `ExpertCard.jsx` | `<Link to={/expert/${expert._id}}>` (line 90) | `/expert/:id` | **Unaffected** |

- **PATTERN**: Grep search: `grep -rn 'navigate\|<Link' frontend/src/`
- **IMPORTS**: N/A — read-only audit.
- **GOTCHA**: The back-button label in `ExpertDetail.jsx` says `"Back to Explore"` (line 230) even though it navigates to `/` (home). This is a minor copy inconsistency — it could be changed to `"Back to Home"` — but it was left as-is in this implementation to minimize scope. It is documented here as a known minor issue for future cleanup.
- **VALIDATE**:
  ```bash
  grep -rn "to=\"/\"" frontend/src/
  # Expected: Only Navbar.jsx logo link (to="/")

  grep -rn "navigate('/')" frontend/src/
  # Expected: ExpertDetail.jsx lines 199 and 226

  grep -rn "to=\"/experts\"" frontend/src/
  # Expected: Navbar.jsx Explore link AND Home.jsx CTA button
  ```

---

## TESTING STRATEGY

> Note: No automated test framework is currently configured in this project (`package.json` has no `test` script in the frontend). The following defines the manual testing protocol for this feature, plus the recommended automated test structure for when a framework is added.

### Manual Testing (Current — Required)

Execute all manual tests with the dev server running: `cd frontend && npm run dev`

**Route Rendering Tests:**

| Test | Steps | Expected Result |
|---|---|---|
| Home page renders at `/` | Navigate to `http://localhost:5173/` | Hero section with indigo background, headline, CTA button, and three feature highlight cards |
| Expert listing renders at `/experts` | Navigate to `http://localhost:5173/experts` | Expert listing page with search, filter, and expert cards |
| Expert detail still works | Click any expert card, then "View Profile & Book" | Expert detail page renders at `/expert/:id` |
| My bookings still works | Navigate to `/my-bookings` | My Bookings page renders correctly |

**Navigation Tests:**

| Test | Steps | Expected Result |
|---|---|---|
| CTA button navigates correctly | Click "Browse Experts" on home page | URL changes to `/experts`, ExpertListing renders, no full page reload |
| Navbar logo navigates home | On any page, click the SkillSync logo | Navigates to `/`, Home page renders |
| Explore link active state | Navigate to `/experts` | "Explore" link in navbar is highlighted (blue bg + blue text) |
| Explore link inactive on home | Navigate to `/` | "Explore" link in navbar is NOT highlighted |
| My History active state | Navigate to `/my-bookings` | "My History" link is highlighted |
| Back button from expert detail | On `/expert/:id`, click "Back to Explore" | Navigates to `/`, Home page renders |

**Layout Tests:**

| Test | Steps | Expected Result |
|---|---|---|
| Hero fills viewport height | On `/`, check that the indigo hero extends to the bottom of the visible screen area (below the Navbar, above any scroll) on a standard 1080p display | No white gap between the bottom of the feature highlights and the bottom of the viewport on large screens |
| Mobile responsive layout | Resize browser to 375px width | Feature highlights grid collapses to 1 column; headline scales down; CTA button remains readable |
| Tablet responsive layout | Resize browser to 768px width | Feature highlights grid shows 3 columns (md:grid-cols-3 kicks in at 768px) |

### Recommended Automated Tests (Future — When Jest/Vitest is Added)

**Unit Tests** (`frontend/src/pages/Home.test.jsx`):

```jsx
// Test: Home renders without crashing
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

test('renders Home without crashing', () => {
  render(<MemoryRouter><Home /></MemoryRouter>);
});

// Test: Hero headline is present
test('renders hero headline', () => {
  const { getByText } = render(<MemoryRouter><Home /></MemoryRouter>);
  expect(getByText(/Expert Advice/i)).toBeInTheDocument();
});

// Test: CTA button links to /experts
test('CTA button links to /experts', () => {
  const { getByText } = render(<MemoryRouter><Home /></MemoryRouter>);
  const ctaLink = getByText('Browse Experts').closest('a');
  expect(ctaLink).toHaveAttribute('href', '/experts');
});

// Test: Three feature highlight cards are rendered
test('renders three feature highlight cards', () => {
  const { getByText } = render(<MemoryRouter><Home /></MemoryRouter>);
  expect(getByText('Top Industry Experts')).toBeInTheDocument();
  expect(getByText('Real-Time Booking')).toBeInTheDocument();
  expect(getByText('Manage Your Schedule')).toBeInTheDocument();
});
```

**Integration Tests** (`frontend/src/App.test.jsx`):

```jsx
// Test: / renders Home, not ExpertListing
// Test: /experts renders ExpertListing
// Test: Navbar Explore link points to /experts (not /)
// Test: Clicking CTA navigates to /experts
```

### Edge Cases

| Edge Case | Concern | Status |
|---|---|---|
| User bookmarks `/` (old behavior) | Previously `/` was ExpertListing. Bookmarked users now see Home. | **Acceptable** — Home clearly offers a path to experts via CTA. No 404. |
| Direct navigation to `/experts` | No entry via home page. | **Works** — `/experts` route is registered and renders ExpertListing. |
| Browser back button from `/experts` | After navigating via CTA, browser back should return to `/`. | **Works** — React Router pushes to history stack on `<Link>` clicks. |
| Very tall screen (4K, ultrawide) | Hero `flex-grow` should fill without stretching the feature highlights. | **Works** — highlights section uses `py-16 bg-white` with fixed padding; only hero grows. |
| Very short screen (small mobile, < 568px) | Hero content may overflow vertically. | **Acceptable** — `py-20` on hero gives natural height; `items-center` keeps it centered. |
| No JavaScript | App is a React SPA — without JS, nothing renders. | **Known limitation** — inherent to the SPA architecture, not specific to this feature. |

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
# Run ESLint on the entire frontend (checks all three changed files)
cd frontend && npm run lint

# Expected output: No errors, no warnings
# If warnings appear on unused imports or React prop-types, address them before merging.
```

```bash
# Targeted lint on only the changed/created files
cd frontend && npx eslint src/pages/Home.jsx src/App.jsx src/components/Navbar.jsx

# Expected output: (0 problems total)
```

### Level 2: Build Verification

```bash
# Verify Vite can bundle the application without errors
cd frontend && npm run build

# Expected: dist/ folder created with no build errors
# Any unresolved import (e.g., wrong icon name from lucide-react) will surface here
```

### Level 3: No Automated Tests (Currently)

The frontend `package.json` does not define a `test` script. When a test framework is added, run:

```bash
cd frontend && npm test
```

### Level 4: Manual Validation

```bash
# Start dev server
cd frontend && npm run dev

# Open http://localhost:5173/ in browser
# Manual checklist:
# [ ] / renders the hero section (indigo background)
# [ ] / renders three feature highlight cards
# [ ] "Browse Experts" button navigates to /experts without page reload
# [ ] /experts renders ExpertListing with search and filter
# [ ] /expert/:id renders ExpertDetail (test with a real expert ID from the listing)
# [ ] /my-bookings renders MyBookings page
# [ ] Navbar "Explore" is active (highlighted) only when on /experts
# [ ] Navbar "My History" is active only when on /my-bookings
# [ ] SkillSync logo navigates to / (home page)
# [ ] Back button on ExpertDetail navigates to / (home page)
# [ ] Hero section fills viewport height on desktop (no white gap)
# [ ] Feature highlights grid is 3-column on desktop, 1-column on mobile
```

### Level 5: Production Preview

```bash
# Build and preview production bundle to verify no Vite-specific dev quirks
cd frontend && npm run build && npm run preview

# Open http://localhost:4173/ and repeat Level 4 manual checks
```

---

## ACCEPTANCE CRITERIA

- [x] Navigating to `/` renders `Home.jsx` (hero section + feature highlights) — no more direct expert listing
- [x] Navigating to `/experts` renders `ExpertListing.jsx` (same as `/` did before)
- [x] The "Browse Experts" CTA button on the home page navigates to `/experts` via client-side routing (no full page reload)
- [x] The Navbar `Explore` link points to `/experts` and is highlighted only when the current route is `/experts`
- [x] The SkillSync logo in the Navbar navigates to `/` (the home page)
- [x] The back-button on `ExpertDetail.jsx` navigates to `/` — the home page — which is correct UX
- [x] The hero section fills the remaining viewport height below the Navbar on desktop screens
- [x] The feature highlights grid is responsive: 1 column on mobile (`< 768px`), 3 columns on desktop (`≥ 768px`)
- [x] `Home.jsx` imports no new npm dependencies not already in `frontend/package.json`
- [x] Zero ESLint errors on `Home.jsx`, the updated `App.jsx`, and the updated `Navbar.jsx`
- [x] The Vite build completes with zero errors (`npm run build`)
- [x] All four existing routes (`/`, `/experts`, `/expert/:id`, `/my-bookings`) function correctly after the routing change
- [x] No regressions on the booking flow (select expert → view detail → book slot → success redirect to `/my-bookings`)

---

## COMPLETION CHECKLIST

- [x] Task 1 completed: `App.jsx` root div updated with `flex flex-col`
- [x] Task 2 completed: `App.jsx` imports `Home`, routes `/` to `<Home />`, routes `/experts` to `<ExpertListing />`
- [x] Task 3 completed: `frontend/src/pages/Home.jsx` created with hero section and feature highlights
- [x] Task 4 completed: `Navbar.jsx` Explore link updated to `/experts`
- [x] Task 5 completed: All internal navigation references audited and verified correct
- [x] Level 1 validation: `npm run lint` passes with zero errors
- [x] Level 2 validation: `npm run build` completes successfully
- [x] Level 4 validation: All manual route and layout tests pass
- [x] Acceptance criteria all met
- [x] No regressions in existing booking flow

---

## NOTES

### Design Decisions

#### 1. Why `/experts` Instead of `/browse` or `/directory`?

The route `/experts` was chosen for the expert directory because it is the most semantically aligned with REST-style URL conventions. The resource being listed is experts, so the plural noun form `/experts` is correct. Alternative candidates:

- `/browse` — Too vague. Browse what? The resource type is not expressed.
- `/directory` — Accurate but long and dated in feel.
- `/discover` — Marketing language, not a resource noun.
- `/experts` — Clear, correct, short, consistent with REST conventions like `/users`, `/products`.

The `/expert/:id` pattern for individual expert profiles (already in place pre-feature) also aligns naturally with `/experts` as the collection route.

#### 2. Why `flex-grow` on the Hero Section Instead of `min-h-[calc(100vh-80px)]`?

Two approaches were considered for making the hero fill the viewport:

**Option A — `flex-grow` (chosen)**:
```jsx
// App.jsx root div: flex flex-col
// Home.jsx outer div: flex flex-col flex-grow
// Hero section: flex-grow
```

**Option B — Fixed height calculation**:
```jsx
// Hero section: min-h-[calc(100vh-80px)]
```

`flex-grow` was chosen because:
- It is **responsive by nature** — if the Navbar height changes, the hero automatically compensates. No magic numbers.
- It is **semantically correct** — the hero is "the main content area", which should grow to fill available space.
- It **avoids the Tailwind JIT arbitrary value** `[calc(100vh-80px)]`. While Tailwind supports this, it introduces a hardcoded pixel value (80px Navbar height) that creates a maintenance dependency between `Navbar.jsx` and `Home.jsx`. If the Navbar height changes, the calc must be manually updated.
- It is **consistent with the design system** — using standard Tailwind utilities (`flex`, `flex-col`, `flex-grow`) over arbitrary values keeps the class surface predictable.

The trade-off: `flex-grow` requires three correctly-configured ancestor elements. If any ancestor loses its flex context, the hero collapses to its content height. This is mitigated by the fact that the layout is simple (only two levels: App → Home) and is documented in Task 3's GOTCHA.

#### 3. Why `indigo-*` for the Hero When the Rest of the App Uses `blue-*`?

The Navbar and most UI elements use `blue-600` as the primary brand color. The hero section deliberately uses `indigo-600` (a slightly more purple-toned blue). This was a deliberate aesthetic choice:

- The hero section is a **marketing surface** — it benefits from slightly richer, warmer color versus the functional blue used in navigation and buttons.
- `indigo-600` and `blue-600` are close enough to read as the same brand family without being identical — creating a visual hierarchy between "landing marketing" and "product UI".
- The icon containers in the feature highlights use `bg-indigo-100 text-indigo-600` to maintain visual coherence between the hero and the highlights section.

This creates a deliberate, small **two-tone brand palette**: marketing surfaces use `indigo`, functional UI uses `blue`.

#### 4. Why Is `Home.jsx` Stateless (No useState/useEffect)?

Landing pages should render instantly. Any async dependency (API call, localStorage read, auth check) introduces a loading state, which introduces visual flicker or a spinner — which undercuts the brand impression on first load.

The `Home.jsx` component was deliberately kept stateless to guarantee:
- **Instant render** — no async waterfalls before paint.
- **Zero loading states** — no spinner, no skeleton.
- **Maximum reliability** — a static component cannot fail due to network errors or race conditions.

If the home page is ever extended with dynamic content (e.g., "Featured Expert of the Week"), it should load that content with a progressive enhancement pattern — render the static shell first, then overlay the dynamic content once loaded — rather than blocking the initial render.

#### 5. Why Not Add a Footer to the Home Page?

A footer was considered but excluded from this implementation to keep the scope minimal. The hero's `flex-grow` design means the hero naturally expands to fill any remaining space — adding a footer would require reconfiguring the flex chain (the highlights section and footer would need to be accounted for). This is a well-defined future improvement that can be added without modifying the hero section if the flex chain is preserved.

### Trade-offs

| Trade-off | Decision | Rationale |
|---|---|---|
| Routing change breaks old bookmarks to `/` | Accepted | Old `/` was a functional page (ExpertListing), new `/` is a landing page. Users who bookmarked `/experts` intent now land on Home, which clearly shows a CTA to experts. Not a regression — a guided path. |
| Back button label "Back to Explore" now navigates to Home, not ExpertListing | Left as-is (minor inconsistency) | Changing the label to "Back to Home" is trivial but was kept out of scope. Documented in Task 5 audit. |
| No animation on Home.jsx sections | Accepted | `animate-fade-in` and `animate-slide-up` classes are available in `index.css` but were not applied. The hero is the first thing seen — a slow fade-in would delay perceived load. Instant render is preferable for a hero section. Future enhancement: add `animate-fade-in` to the highlights section only. |

### Alternatives Considered

1. **Server-Side Rendered (SSR) Landing Page**: Rejected. The project uses Vite as a SPA. Adding SSR would require migrating to a framework like Next.js or Remix, which is massively out of scope for a landing page.

2. **Separate Landing Domain**: Rejected. Using a marketing page at a different domain (e.g., `skillsync.com`) while serving the app at `app.skillsync.com` is a common pattern but inappropriate for a project at this stage.

3. **Modal/Splash Screen**: Rejected. Using a modal overlay on top of ExpertListing as an "intro screen" was considered and rejected because it is a UX anti-pattern — modals interrupt user flow rather than establishing brand context.

4. **Using `<a href="/experts">` for the CTA**: Rejected. See Task 3 GOTCHA 2. Using React Router's `<Link>` is mandatory for SPA navigation integrity.

---

## DECISION LOG

| ID | Decision | Date | Rationale | Alternatives Rejected |
|---|---|---|---|---|
| D-001 | Move expert directory from `/` to `/experts` | 2026-05-24 | Semantic correctness; `/` should be the brand home, not a resource listing | `/browse`, `/directory` (less clear) |
| D-002 | Use `flex flex-col flex-grow` for hero full-height layout | 2026-05-24 | Avoids hardcoded pixel values; auto-adapts to Navbar height changes | `min-h-[calc(100vh-80px)]` (maintenance burden) |
| D-003 | Keep `ExpertDetail.jsx` back-button pointing to `/` | 2026-05-24 | Navigating to Home after viewing an expert is correct UX; returning to the expert list would lose search/filter state | Change back-button to navigate(-1) (considered but -1 breaks direct navigation) |
| D-004 | Use `indigo-*` for hero, `blue-*` for app UI | 2026-05-24 | Creates two-tone brand palette; marketing vs. product UI visual distinction | Fully `blue-*` (too flat) |
| D-005 | Keep Home.jsx stateless (no hooks) | 2026-05-24 | Instant render, zero loading states, maximum reliability | Dynamic content fetching (adds loading complexity) |

---

## KNOWN LIMITATIONS AND FUTURE IMPROVEMENTS

### Known Limitations

1. **No accessibility audit performed**: The hero `<h1>` is present (good for screen readers), but no ARIA landmarks or `aria-label` attributes have been added to the `<section>` elements. Future work: add `aria-label="Hero"` and `aria-label="Feature Highlights"` to the two sections.

2. **Back-button label inconsistency**: `ExpertDetail.jsx` line 230 displays "Back to Explore" but navigates to `/` (Home). Should be "Back to Home" post this routing change. Minor UX polish item.

3. **No route-level code splitting**: `Home.jsx` is imported statically in `App.jsx`. For a larger app, `React.lazy()` + `<Suspense>` would reduce the initial bundle. Not needed at current project scale.

4. **Hero copy is not internationalized**: The headline and tagline are hardcoded English strings. No i18n framework is in place in this project.

### Future Improvements

| Improvement | Priority | Notes |
|---|---|---|
| Add section animations | Low | Apply `animate-fade-in` to the highlights section (not the hero — instant render preferred for hero) |
| Add a footer | Medium | A footer with links (About, Contact, Terms) would complete the landing page. The flex chain must be updated: the footer becomes a flex child of the `Home` outer div, between the hero and highlights sections or after both. |
| Add a "How It Works" section | Medium | A numbered steps section between hero and highlights explaining the 3-step process (Search → Select → Book) |
| Add featured/spotlight experts | Medium | A horizontally scrolling strip of 3–4 `ExpertCard` components fetched from the API. This would be the first stateful addition to `Home.jsx` — use the loading pattern from `ExpertListing.jsx` lines 119–147. |
| Anchor scroll from CTA | Low | Instead of routing to `/experts`, the CTA could scroll to an embedded expert grid on the home page itself — converting the landing page into a single-page application experience. |
| SEO meta tags | Medium | Add `<title>`, `<meta name="description">`, and Open Graph tags for the home page. Requires either a `<head>` management library (e.g., `react-helmet-async`) or Vite plugin configuration. |
