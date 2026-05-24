# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **JWT Authentication & RBAC (Phase 2):**
  - Added backend `User` schema with automated password hashing via `bcryptjs` and credential verification.
  - Implemented JWT token generation and validation middleware (`authMiddleware`).
  - Added REST endpoints for `/auth/register` and `/auth/login`, including strict validations to block public admin account creation.
  - Added `userSeeder.js` utility to bootstrap initial system admin users.
  - Created client-side `AuthContext` to persist user login state and handle JWT auth headers in Axios requests.
  - Implemented frontend `Login` and `Register` pages with a role dropdown selector (Client or Expert).
  - Protected sensitive frontend routes (like `My Bookings`) using the `<ProtectedRoute>` guard.
- **Feature Documentation:** Generated 8 comprehensive Feature Plan markdown files under the `docs/` directory.
- **Anatomy Blueprint:** Created `docs/feature-plan-anatomy.txt` defining the visual component hierarchy template for future planning documents.
- **Home Landing Page:** Implemented `Home.jsx` with a hero section and feature highlights; updated navigation routes so the root path `/` renders the Home page and `/experts` renders the directory listing.
- **India-Specific Localization:** Added Indian Rupee (`₹`) currency symbol, automatic `+91` phone number formatting, HTML5 number patterns, and timezone-aware IST scheduling constraints.
- **Smart Image Fallbacks:** Implemented a two-level client-side fallback system on `ExpertCard` and `ExpertDetail` using `ui-avatars.com` with infinite-loop prevention.
- **CI/CD & Lint Hardening:** Resolved all frontend ESLint warnings and errors, verifying a clean production build with Vite.
- **SkillSync PRD & Roadmap:** Defined product requirements (`docs/SkillSync_PRD.md`) and strategic milestones (`docs/ROADMAP.md`).
