# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SkillSync** is a real-time expert session booking platform (Node.js/Express backend + React/Vite frontend) with Socket.io for live availability, MongoDB Atlas for persistence, and Redis for scaling WebSocket state.

## Commands

### Start Everything
```bash
./start.sh          # kills ports 5000/5173, then starts backend (nodemon) + frontend (vite) concurrently
```

### Backend (from `backend/`)
```bash
npm run dev         # nodemon src/app.js — port 5000
npm run start       # node src/app.js

# Tests
npm test                        # all tests (runInBand, jest.setup.js)
npm run test:unit               # src/__tests__/ only
npm run test:integration        # tests/integration/ only (runInBand)

# Run a single test file
npx jest src/__tests__/unit/controllers/bookingController.test.js
npx jest tests/integration/booking.integration.test.js --runInBand
```

### Frontend (from `frontend/`)
```bash
npm run dev         # vite dev server — port 5173
npm run build       # production build
npm run lint        # eslint
```

## Architecture

### Backend (`backend/src/`)

Layered architecture: `routes → controllers → services → repositories → models`

- **`app.js`** — Express + Socket.io init, JWT auth on socket handshake, Redis adapter wired here
- **`routes/`** — Express routers; each domain has its own file (`authRoutes`, `bookingRoutes`, `expertRoutes`, etc.)
- **`controllers/`** — Request/response handling, input validation via Zod schemas (`schemas/`)
- **`services/`** — Business logic: `BookingService.js` owns the two-phase concurrency logic; `reminderScheduler.js` runs Agenda.js background jobs
- **`repositories/`** — All Mongoose queries isolated here (`BookingRepository`, `AvailabilityRepository`, `ExpertRepository`, `UserRepository`)
- **`models/`** — Mongoose schemas with compound unique partial indexes (critical for conflict-free booking on `Availability`)
- **`middleware/`** — Auth (JWT), error handler, rate limiting, mongo-sanitize wrappers
- **`config/`** — `db.js` (MongoDB connection), `logger.js` (pino), `config.js` (env assertion)

**Key concurrency design:** Booking conflict prevention uses two layers — a pre-check query in `BookingService` plus a compound unique partial index on the `Availability` model. All multi-document writes use `session.withTransaction()` (ACID).

**Real-time:** Socket.io rooms are per-expert. When a slot is booked/cancelled, the server emits to the expert's room so all connected clients update immediately.

**MCP integration:** `scripts/mcp-database-inspector.js` — run with `npm run mcp:db`.

### Frontend (`frontend/src/`)

- **`context/` / `contexts/`** — React contexts for auth state and socket connection
- **`services/api.js`** — Axios instance with JWT interceptors; all HTTP calls go here
- **`pages/`** — Route-level components
- **`components/`** — Reusable UI; `VideoRoom/` for WebRTC session UI
- **`hooks/`** — Custom hooks (React Query queries/mutations, socket listeners)

React Query v5 handles server state caching. Socket.io client connects on login and tears down on logout.

### Testing Layout

```
backend/
  src/__tests__/unit/        # unit tests (controllers, services, utils)
  tests/integration/         # integration tests — hit real MongoDB (configured in jest.setup.js)
  tests/load/                # k6 load test scripts
  tests/performance/
```

Integration tests require a running MongoDB; check `tests/jest.setup.js` for env setup.

### Environment Variables

Backend requires at minimum: `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`. See `backend/src/config/config.js` for the full assertion list — the server will throw on startup if any required var is missing.

## Key Constraints

- **India-specific:** Currency is `₹` (INR), times in IST, phone numbers are `+91` 10-digit.
- **Express v5** is in use — async error propagation differs from v4 (no `next(err)` needed for async throws).
- **Husky + lint-staged** runs `scripts/lint-mermaid.sh` on `.md` files at commit time. Mermaid diagrams in docs must be valid.
