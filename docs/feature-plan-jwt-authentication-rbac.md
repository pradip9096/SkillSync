# Feature Plan: JWT Authentication & Role-Based Access Control (RBAC)

**Project:** SkillSync — Real-Time Expert Session Booking System  
**Document Version:** 1.0  
**Created:** 2026-05-24  
**Author:** Architecture Team  
**Status:** 📝 Planned (Awaiting Approval)  

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Feature Metadata](#2-feature-metadata)
3. [Context References](#3-context-references)
4. [Patterns Followed](#4-patterns-followed)
5. [Architecture & Data Flow](#5-architecture--data-flow)
6. [Implementation Plan](#6-implementation-plan)
7. [Testing Strategy](#7-testing-strategy)
8. [Validation Commands](#8-validation-commands)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Completion Checklist](#10-completion-checklist)
11. [Decision Log](#11-decision-log)
12. [Known Limitations & Future Improvements](#12-known-limitations--future-improvements)

---

## 1. Feature Overview

### Description
Introduce secure credentials-based registration/login, session token management using **JSON Web Tokens (JWT)**, and **Role-Based Access Control (RBAC)** across the SkillSync stack. This shifts the application from an anonymous guest-booking model to a secure multi-role platform accommodating **Clients**, **Experts**, and **Admins**.

### User Story
* **As a Visitor**, I want to register a credentials-based account with my name, email, password, and phone number so that I can securely log in later.
* **As a Client**, I want to see only my own history under My Bookings, and be authorized to create bookings.
* **As an Expert**, I want to log in to view my upcoming sessions and manage my availability, ensuring only I can edit my slots.
* **As an Admin**, I want system-wide administrative rights to manage all users and view all platform bookings.

### Problem Statement
The current MVP has no security layer:
1. **No authentication:** Anyone can view, complete, or cancel bookings in `My Bookings` simply by typing an email address.
2. **No role segregation:** Users cannot log in as an "Expert" to configure their availability. The system does not differentiate between clients, experts, and administrators.
3. **API Exposure:** The backend endpoints `/bookings` (create, update status, populate) and `/experts` are entirely public, posing a high risk of data manipulation and spamming.

### Solution Statement
Implement a vertical security stack:
* **Storage Engine Level:** Create a `User` model, encrypting passwords with `bcryptjs`. Link `Booking` and `Expert` schemas to the `User` model via Mongoose ObjectId references.
* **API Level:** Implement `/auth/register` and `/auth/login` endpoints. Protect sensitive routes with `authMiddleware.js` verifying JWTs inside request headers. Restrict endpoints using a `restrictTo(...roles)` authorization middleware.
* **UI State Level:** Set up an `AuthContext` to manage the authenticated state and Axios header interceptors. Secure frontend paths using a `<ProtectedRoute>` component.

---

## 2. Feature Metadata

| Property            | Value                                                  |
|---------------------|--------------------------------------------------------|
| **Feature Type**    | Core Infrastructure / Security / Access Control        |
| **Complexity**      | High                                                   |
| **Priority**        | Must Have (Phase 2 Roadmap)                            |
| **PRD Reference**   | Section "Phase 2: Security & Platform Management"      |
| **Risk Level**      | High — handles security credentials and endpoint locks  |
| **Affected Systems**| Full Stack (Mongoose Models, Backend Controllers/Routes, Frontend State Context, Routing Guards, Navbar) |
| **Database Impact** | New `users` collection; Schema extensions on `bookings` and `experts` collections |

### Dependencies

| Dependency   | Version   | Purpose                                         |
|--------------|-----------|-------------------------------------------------|
| `bcryptjs`   | `^2.4.3`  | Password hashing and verification               |
| `jsonwebtoken`| `^9.0.2`  | Token generation and verification               |

---

## 3. Context References

### Relevant Existing Files

| File | Role in Feature | Key Lines |
|------|----------------|-----------|
| `backend/package.json` | Manifest to add `bcryptjs` and `jsonwebtoken` dependencies | L14–20 |
| `backend/src/app.js` | Mounts the auth routes and links authorization middleware | L94–102 |
| `backend/src/models/Booking.js` | Schema to update, refactoring guest fields to link to User ObjectIds | L10–40 |
| `backend/src/models/Expert.js` | Schema to update, linking expert profiles to corresponding User credentials | L10–35 |
| `frontend/src/services/api.js` | Axios client to configure with header authorization interceptors | L10–30 |
| `frontend/src/App.jsx` | Route configuration to wrap in AuthProvider and inject ProtectedRoute guards | L30–50 |
| `frontend/src/components/Navbar.jsx` | Persistent header to show auth controls (Login/Register, Role badge, Logout) | L40–70 |

### New Files to Create

| File | Role |
|------|------|
| `backend/src/models/User.js` | Mongoose schema and model for authenticated accounts |
| `backend/src/middleware/authMiddleware.js` | Express middlewares for route protection and RBAC role checks |
| `backend/src/controllers/authController.js` | Registration and login request handlers |
| `backend/src/routes/authRoutes.js` | Registration and login endpoint router mounting |
| `frontend/src/context/AuthContext.jsx` | Global React authentication context and local token storage manager |
| `frontend/src/components/ProtectedRoute.jsx` | Routing guard wrapper to restrict access based on auth state and roles |
| `frontend/src/pages/Login.jsx` | Secure login interface page |
| `frontend/src/pages/Register.jsx` | Secure signup interface page with phone validation |

---

## 4. Patterns Followed

### Module System
* **Backend:** CommonJS modules (`require` / `module.exports`).
* **Frontend:** ES modules (`import` / `export`).

### Security Patterns
* **Password Hashing:** Always hash passwords with `bcryptjs` inside the Mongoose pre-save hook.
* **Token Issuance:** Include token expiration (e.g. `30d` or `24h`) in the JWT payload.
* **Axios Interceptors:** Conditionally append the JWT to headers *only* when the token exists on the client.

---

## 5. Architecture & Data Flow

```
   [ Client / Browser ]                [ Express Router ]            [ Controllers / Models ]
            │                                  │                                │
            │ ── 1. POST /login ──────────────>│                                │
            │                                  │ ── 2. authController.login ───>│
            │                                  │                                │ ── 3. Verify credentials & hash ──
            │ <── 4. Return User + JWT ────────│                                │ <─────────────────────────────────
            │                                  │                                │
   [ Save JWT in localStore ]                  │                                │
            │                                  │                                │
            │ ── 5. GET /bookings (with JWT) ─>│                                │
            │                                  │ ── 6. authMiddleware.protect ─>│ (Checks token validity)
            │                                  │                                │ ── 7. restrictTo('Client') ───────
            │                                  │                                │                                  │
            │ <── 8. Return bookings data ─────│<───────────────────────────────│<──────────────────────────────────
```

---

## 6. Implementation Plan

### Phase 1 — Foundation: Models & Helpers
* **Backend setup:** Install `bcryptjs` and `jsonwebtoken` in `backend/`.
* **User Schema:** Create `User.js` with password hashing middleware and `matchPassword` instance method.
* **Link Models:** Update `Booking.js` and `Expert.js` to reference the `User` model.

### Phase 2 — Core: Authentication API & Middleware
* **Auth Controller:** Write registration and login handlers inside `authController.js`.
* **JWT Middlewares:** Implement token extraction, verification (`protect`), and role guards (`restrictTo`).
* **Route Mounting:** Create `authRoutes.js` and wire them into `app.js`.

### Phase 3 — Integration: Frontend State & Guards
* **Auth Context:** Create `AuthContext.jsx` to coordinate state, log in, sign up, and log out methods.
* **Request Interceptor:** Configure Axios to append the auth headers.
* **Route Guards:** Create `<ProtectedRoute>` to handle authenticated route boundaries.

### Phase 4 — Testing & Visual Polishing
* **Sign Up / Login Forms:** Design pages using modern CSS styles with feedback banners.
* **Navbar & Badges:** Update navigation to display auth states, role badges, and logout controls.
* **Run Build Verification:** Verify zero errors across linters and bundle checkers.

---

## 7. Testing Strategy

### Unit Tests
* Validate `User` password encryption and hashing hooks.
* Verify user creation triggers.

### Integration Tests
* **Auth Flow:** Register ➔ Verify user in DB ➔ Log in ➔ Receive JWT token.
* **Protected Routes:** Make requests with missing/invalid/expired token header ➔ Verify `401 Unauthorized`.
* **RBAC Enforcement:** Try to access Admin dashboard as a Client ➔ Verify `403 Forbidden`.

### Edge Cases
* Submitting duplicate emails.
* Missing fields during registration.
* Accessing time-locked actions across different user contexts.

---

## 8. Validation Commands

### Level 1: Syntax & Style
```bash
cd frontend && npm run lint
```

### Level 2: Build Verification
```bash
cd frontend && npm run build
```

### Level 3: Integration Tests (Manual API Validation)
```bash
# Register User
curl -X POST http://localhost:5000/auth/register -H "Content-Type: application/json" -d '{"name":"Test User","email":"test@example.com","password":"password123","phone":"+919876543210"}'

# Login User
curl -X POST http://localhost:5000/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}'
```

---

## 9. Acceptance Criteria

- [ ] New registration saves encrypted user passwords in MongoDB.
- [ ] Registered user can successfully authenticate and receive a JWT.
- [ ] Authorization header is verified by backend middlewares before returning route resources.
- [ ] Frontend stores tokens securely and auto-redirects anonymous requests to `/login`.
- [ ] Navbar and pages render correct layout based on user role (`Client`, `Expert`, `Admin`).
- [ ] No regression in the core booking flow or localization components.

---

## 10. Completion Checklist

- [ ] Backend auth dependencies installed.
- [ ] Models updated and verified.
- [ ] Middleware and endpoints mounted on backend.
- [ ] Context provider and protected components mounted on frontend.
- [ ] Login and registration pages styled.
- [ ] Lint checks passed with zero errors.
- [ ] Build script succeeded.

---

## 11. Decision Log

| Date | Decision | Made By | Rationale |
|---|---|---|---|
| 2026-05-24 | Use localStorage for token storage | Architecture Team | Easiest starting point for single-domain client-side Vite applications. Can be upgraded to HttpOnly cookies for XSS mitigation in a later sprint. |
| 2026-05-24 | Hashing on model pre-save hook | Architecture Team | Encapsulates credential encryption inside schema domain; prevents raw password exposure regardless of save controller path. |

---

## 12. Known Limitations & Future Improvements

1. **Token Expiry Management:** Token refresh logic is not implemented; token expires abruptly after standard duration. Future work will introduce refresh tokens.
2. **Password Recovery:** There is no "Forgot Password" flow or email verification. This is deferred to Phase 3.
3. **Session Revocation:** JWTs are stateless; once signed, they cannot be blacklisted. Future hardening can introduce a database-backed token blocklist.
