# Phase 1 Implementation Plan: Security & Boundaries

---

# Section 1 — Document Metadata

## 1.1 Metadata

| Field | Value |
|---|---|
| **Title** | Phase 1 Implementation Plan: Security & Boundaries |
| **Document ID** | DOC-PLAN-PH1-001 |
| **Purpose** | Provides the tactical execution steps, assignments, and deployment procedures required to remediate the critical security vulnerabilities defined in Phase 1 of the Remediation Roadmap. |
| **Audience** | Software Engineers, DevOps Engineers, QA Testers. |
| **Owner** | Lead Backend Engineer |
| **Version** | 1.0.0 |
| **Status** | Published |
| **Last Updated** | 2026-06-13 |
| **Related Documents** | DOC-PLAN-001 (Roadmap), DOC-RES-004 (SRS), DOC-SDS-001 (SDS), DOC-TEST-001 (Test Plan) |
| **Compliance Classification** | ITIL 4 Release & Deployment Management, ISO/IEC/IEEE 15289:2019 |
| **Risk Level** | High — Involves modifying core authentication endpoints and deployment secret injection. |
| **Business Criticality** | Critical |
| **Retention Policy** | Retained until Phase 1 deployment is verified in production. |

---

## Table of Contents

- [Section 1 — Document Metadata](#section-1--document-metadata)
- [Section 2 — Document Content](#section-2--document-content)
  - [2.1 Overview](#21-overview)
  - [2.2 Problem Statement](#22-problem-statement)
  - [2.3 Purpose](#23-purpose)
  - [2.4 Goal](#24-goal)
  - [2.5 Objectives](#25-objectives)
  - [2.6 Scope](#26-scope)
  - [2.7 Definitions](#27-definitions)
  - [2.8 Main Content: Execution & Deployment Plan](#28-main-content-execution--deployment-plan)
    - [2.8.1 Governance & Roles](#281-governance--roles)
    - [2.8.2 Execution Tasks (Build Phase)](#282-execution-tasks-build-phase)
    - [2.8.3 Validation & Testing (Test Phase)](#283-validation--testing-test-phase)
    - [2.8.4 Deployment Strategy (ITIL 4 Alignment)](#284-deployment-strategy-itil-4-alignment)
    - [2.8.5 Back-Out / Rollback Procedures](#285-back-out--rollback-procedures)
  - [2.9 References](#29-references)
  - [2.10 Assumptions](#210-assumptions)
  - [2.11 Dependencies](#211-dependencies)
  - [2.12 Constraints](#212-constraints)
  - [2.13 Prerequisites](#213-prerequisites)
  - [2.14 Known Limitations](#214-known-limitations)
  - [2.15 Change Log](#215-change-log)

---

# Section 2 — Document Content

## 2.1 Overview

This document serves as the tactical Execution and Deployment Plan for "Phase 1: Security & Boundaries." Following ITIL 4 Release and Deployment Management practices and structured via ISO/IEC/IEEE 15289:2019, it translates the high-level roadmap (`DOC-PLAN-001`) into specific engineering tasks, test requirements, and rollback procedures.

## 2.2 Problem Statement

High-level architectures and roadmaps do not provide the granular instruction set required by developers to modify code safely. Without a tactical implementation plan, engineers risk missing acceptance criteria, misconfiguring environments, or deploying without an adequate rollback strategy.

## 2.3 Purpose

To instruct the engineering team on *who* will execute *what* code changes, *how* those changes will be validated, and *when/how* DevOps will deploy them to production.

## 2.4 Goal

To successfully execute and deploy all remediations assigned to Phase 1 (BP-002, BP-003, BP-013, BP-018, BP-019) with zero production downtime and 100% test pass rates.

## 2.5 Objectives

1. Assign specific codebase files and architecture patterns (from SDS §2.8.3) to execution tasks.
2. Define the exact QA exit criteria linked to Test Plan `TC-004`.
3. Separate the "Release" (business approval) from the "Deployment" (technical execution) per ITIL 4 best practices.
4. Establish clear back-out (rollback) procedures.

## 2.6 Scope

**In-Scope:**
- Development tasks for:
  - `BP-002`: Razorpay Key Leak Mitigation.
  - `BP-003`: Request Body Validation (Zod).
  - `BP-013`: Frontend Secret Hardcoding.
  - `BP-018`: JWT Secret Fallback Vulnerability.
  - `BP-019`: Authentication Rate Limiting.

**Out-of-Scope:**
- Architectural refactoring (Phase 2), Concurrency fixes (Phase 3), or any `AP` anti-patterns.

## 2.7 Definitions

| Term | Definition |
|---|---|
| **ITIL 4** | Information Technology Infrastructure Library framework; distinguishes between Release Management and Deployment Management. |
| **DTO** | Data Transfer Object; used here to serialize output and strip sensitive fields. |
| **Rollback / Back-Out** | The procedure to restore the system to its previous stable state if a deployment fails. |

## 2.8 Main Content: Execution & Deployment Plan

### 2.8.1 Governance & Roles
*   **Release Manager (Product Owner):** Approves the deployment window and final business sign-off.
*   **Deployment Engineer (DevOps):** Executes the CI/CD pipeline and manages environment variables.
*   **Backend Developer:** Executes Tasks 1, 2, 4, and 5.
*   **Frontend Developer:** Executes Task 3.
*   **QA Engineer:** Executes Validation & Testing.

### 2.8.2 Execution Tasks (Build Phase)

**Task 1: Implement API Request Validation (Ref: BP-003, SDS §2.8.3)**
*   **Assignee:** Backend Developer
*   **Action:** Install `zod`. Create `backend/src/middleware/validateRequest.js`. Define schemas for `POST /bookings`, `POST /auth/login`, and `POST /auth/register` enforcing length and type boundaries.
*   **Target Files:** `backend/src/routes/bookingRoutes.js`, `backend/src/routes/authRoutes.js`.

**Task 2: Implement Output DTO Serializer (Ref: BP-002, SDS §2.8.3)**
*   **Assignee:** Backend Developer
*   **Action:** Create `backend/src/utils/serializers.js`. Implement `serializeBookingDTO` that explicitly drops the `RAZORPAY_KEY_ID` field from the Mongoose document. Apply this to `getBookingsByEmail`.
*   **Target Files:** `backend/src/controllers/bookingController.js`.

**Task 3: Remove Hardcoded Frontend Secrets (Ref: BP-013)**
*   **Assignee:** Frontend Developer
*   **Action:** Remove `rzp_test_SvdMCegXvNbj2a` from the codebase. Replace with `import.meta.env.VITE_RAZORPAY_KEY_ID`.
*   **Target Files:** `frontend/src/pages/MyBookings.jsx`.

**Task 4: Enforce JWT Secret Presence (Ref: BP-018)**
*   **Assignee:** Backend Developer
*   **Action:** Modify JWT generation to throw a fatal error if `process.env.JWT_SECRET` is undefined, removing any fallback strings.
*   **Target Files:** `backend/src/middleware/authMiddleware.js`, `backend/src/controllers/authController.js`.

**Task 5: Implement Authentication Rate Limiting (Ref: BP-019)**
*   **Assignee:** Backend Developer
*   **Action:** Install `express-rate-limit`. Apply a 10 requests / 15-minute limit to all routes in `authRoutes.js`.
*   **Target Files:** `backend/src/routes/authRoutes.js`.

### 2.8.3 Validation & Testing (Test Phase)
*   **Exit Criteria:** All tasks must pass **TC-004 (Security Boundaries Validation)** as defined in `DOC-TEST-001`.
*   **Specific QA Steps:**
    1. Submit malformed JSON to `/bookings`. Assert `400 Bad Request` from Zod.
    2. Call `getBookingsByEmail`. Assert `RAZORPAY_KEY_ID` is `undefined` in response body.
    3. Attempt 11 logins. Assert the 11th returns `429 Too Many Requests`.

### 2.8.4 Deployment Strategy (ITIL 4 Alignment)
*   **Method:** Standard Blue-Green Deployment (or rolling restart via PM2).
*   **Pre-Deployment Configuration (CRITICAL):**
    *   DevOps must inject `VITE_RAZORPAY_KEY_ID` into the frontend build environment.
    *   DevOps must verify `JWT_SECRET` is populated in the backend production environment.
*   **Execution Time:** Low-traffic window (e.g., Tuesday 02:00 AM IST).

### 2.8.5 Back-Out / Rollback Procedures
*   **Trigger Condition:** If the backend fails to boot (e.g., due to missing JWT_SECRET), or if legitimate users cannot log in due to overly aggressive rate-limiting.
*   **Procedure:**
    1. Revert the Git repository to the previous commit hash (pre-Phase 1).
    2. Re-trigger the CI/CD deployment pipeline.
    3. No database rollback is required, as Phase 1 involves no schema mutations.

## 2.9 References

- ISO/IEC/IEEE 15289:2019 (Content of life-cycle information items)
- ITIL 4 Foundation (Release & Deployment Management Practices)
- `DOC-PLAN-001` (Roadmap)
- `DOC-SDS-001` (SDS)

## 2.10 Assumptions

- The DevOps team has access to the production environment to inject the new required environment variables (`VITE_RAZORPAY_KEY_ID`).

## 2.11 Dependencies

- Task 3 (Frontend) depends on DevOps successfully configuring the environment variables during the CI build process.

## 2.12 Constraints

- The deployment must not occur until the QA team formally signs off on the V&V Report for `TC-004`.

## 2.13 Prerequisites

- The backend developer must have the `zod` and `express-rate-limit` npm packages approved for use.

## 2.14 Known Limitations

- Rate limiting in Phase 1 relies on in-memory storage (default for `express-rate-limit`), which will be upgraded to Redis storage during Phase 3.

## 2.15 Change Log

### [1.0.0] - 2026-06-13
| Field | Value |
|---|---|
| **Type** | MAJOR |
| **Author** | Antigravity AI Agent |
| **Category** | Added |
| **Description** | Initial release of the Phase 1 Implementation Plan, structuring deployment tasks according to ITIL 4 standards. |
