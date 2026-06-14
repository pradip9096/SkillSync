# Phase 2 Implementation Plan: Structural Refactor

---

# Section 1 — Document Metadata

## 1.1 Metadata

| Field | Value |
|---|---|
| **Title** | Phase 2 Implementation Plan: Structural Refactor |
| **Document ID** | DOC-PLAN-002 |
| **Purpose** | Defines the formal engineering execution strategy for breaking down monolithic controllers into a scalable, testable 3-tier architecture. |
| **Audience** | Backend Engineers, QA Leads, Software Architects |
| **Owner** | Lead Architect |
| **Version** | 1.0.1 |
| **Status** | Published |
| **Last Updated** | 2026-06-14 |
| **Related Documents** | `roadmap-bug-anti-pattern-remediation.md`, `DOC-SDS-001`, `DOC-TEST-001` |
| **Compliance Classification** | High |
| **Risk Level** | High — requires sweeping code movements. |
| **Business Criticality** | Critical |
| **Retention Policy** | Retained until all phases are complete and the final V&V report is approved. |

## Table of Contents

- [Phase 2 Implementation Plan: Structural Refactor](#phase-2-implementation-plan-structural-refactor)
- [Section 1 — Document Metadata](#section-1--document-metadata)
  - [1.1 Metadata](#11-metadata)
- [Section 2 — Document Content](#section-2--document-content)
  - [2.1 Overview](#21-overview)
  - [2.2 Problem Statement](#22-problem-statement)
  - [2.3 Purpose](#23-purpose)
  - [2.4 Goal](#24-goal)
  - [2.5 Objectives](#25-objectives)
  - [2.6 Scope](#26-scope)
  - [2.7 Definitions](#27-definitions)
  - [2.8 Main Content](#28-main-content)
    - [2.8.1 Implementation Strategy (3-Tier Layering)](#281-implementation-strategy-3-tier-layering)
    - [2.8.2 Execution Backlog (Target Remediations)](#282-execution-backlog-target-remediations)
    - [2.8.3 Exit Criteria & Validation](#283-exit-criteria--validation)
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

This document outlines the engineering strategy for executing Phase 2 of the remediation roadmap. It details how the monolithic backend controllers will be refactored into a structured 3-tier architecture comprising Delivery (Controllers), Domain (Services), and Persistence (Repositories) layers.

## 2.2 Problem Statement

The current backend architecture relies heavily on the "Fat Controller" anti-pattern (`AP-001`). Controllers are tightly coupled, managing HTTP request routing, complex business logic validation, transaction scopes, and direct Mongoose database queries simultaneously. This violates the Single Responsibility Principle, making automated testing nearly impossible without fragile, full-system database mocks.

## 2.3 Purpose

To implement **Phase 2 (Structural Refactor)** as dictated by the Implementation Roadmap (`DOC-PLAN-001`). This phase restructures the Express application into a clean 3-tier layered architecture, enabling isolated unit testing and preparing the codebase for Phase 3 (Concurrency Fixes).

## 2.4 Goal

To successfully separate business logic, data persistence, and HTTP routing across the backend application without breaking existing API contracts.

## 2.5 Objectives

1. Create a `src/services/` layer to encapsulate all business logic.
2. Create a `src/repositories/` layer to abstract all Mongoose ODM interactions.
3. Refactor all controllers in `src/controllers/` to act solely as HTTP transport handlers.
4. Establish a unit testing baseline across the new Service layer using mocked repositories.

## 2.6 Scope

**In-Scope:**
- Refactoring all route handlers in `src/controllers/` to delegate logic to a new `src/services/` directory.
- Abstracting Mongoose ODM interactions to a `src/repositories/` directory.

**Out-of-Scope:**
- Fixing race conditions or introducing Redis (reserved for Phase 3).
- Altering the frontend UI or client applications.

## 2.7 Definitions

| Term | Definition |
|---|---|
| **Fat Controller** | An anti-pattern where an MVC controller handles business logic and data access directly instead of delegating to dedicated layers. |
| **Service Layer** | An architectural pattern that encapsulates the application's core business logic and transaction boundaries. |
| **Repository Pattern** | An architectural pattern that acts as an in-memory collection, mediating between the domain logic and the data mapping layers. |

## 2.8 Main Content

### 2.8.1 Implementation Strategy (3-Tier Layering)

The refactor will be executed iteratively, targeting one functional domain (e.g., Booking, Authentication, Expert Listing) at a time to minimize blast radius.

**Tier 1: Delivery Layer (Controllers)**
*   **Responsibility:** HTTP protocol translation.
*   **Action:** Strip all business logic from `src/controllers/*.js`. Controllers will now only extract `req.body`, `req.params`, pass them to a Service, and format the `res.status().json()` output.

**Tier 2: Domain Layer (Services)**
*   **Responsibility:** Business Rules and Transaction Coordination.
*   **Action:** Create `src/services/`. This layer will calculate the 2-hour late cancellation penalties, enforce role restrictions, coordinate Razorpay webhook idempotency, and bundle Database updates into transaction objects.

**Tier 3: Persistence Layer (Repositories)**
*   **Responsibility:** Data Mapping and Abstraction.
*   **Action:** Create `src/repositories/`. Extract raw `Model.find()`, `Model.aggregate()`, and `Model.create()` calls into centralized, reusable repository functions (e.g., `BookingRepository.findActiveSession()`). 

### 2.8.2 Execution Backlog (Target Remediations)

Mapped directly from the Requirements Traceability Matrix and Implementation Roadmap:

| Defect ID | Description | Remediation Task |
|---|---|---|
| **AP-001** | Fat Controllers | Extract core logic from `bookingController.js` and `expertDashboardController.js` into distinct Service classes. |
| **AP-007** | Tight DB Coupling | Wrap Mongoose calls inside `ExpertRepository` and `BookingRepository` classes. |
| **AP-008** | Incomplete Unit Testing | Enable Jest unit tests by mocking the new isolated Services without requiring MongoDB instances. |
| **AP-002** | Monolithic Scheduling | Extract Agenda.js job scheduling triggers out of controllers and into the Service layer workflow. |
| **BP-028** | Duplicated Query Logic | Centralize complex lookup aggregations (e.g., Expert directory searches) into a single Repository method to eliminate duplicate bugs. |

### 2.8.3 Exit Criteria & Validation

To exit Phase 2 and advance to Phase 3, the following conditions must be met:

1.  **Code Coverage:** Unit tests (via Jest) must achieve >80% coverage on all files within `src/services/` by utilizing mocked Repositories.
2.  **Static Analysis:** Execution of `TC-001` (3-tier Architecture Static Analysis) must pass, demonstrating zero direct Mongoose `require()` statements inside the `src/controllers/` layer.
3.  **Regression Baseline:** The Integration Test Sandbox (`TC-004`) from Phase 1 must continue to pass at 100%, proving that the structural refactoring did not break the underlying HTTP security contracts.

## 2.9 References

1. **ISO/IEC/IEEE 42010:2022 (Systems and software engineering — Architecture description):** Mandates strict "Separation of Concerns" (SoC) based on stakeholder viewpoints (testability and maintainability).
2. **Martin Fowler: Patterns of Enterprise Application Architecture (PoEAA):** Service Layer Pattern and Repository Pattern.

## 2.10 Assumptions

- The existing test suite (Phase 1) provides sufficient coverage to act as a regression safety net for the HTTP boundaries.

## 2.11 Dependencies

- Depends on Phase 1 completion (API Security Boundaries).
- Relies on Jest for isolated unit testing in the Service layer.

## 2.12 Constraints

- Zero downtime deployments are not required, but API contracts with the frontend must remain strictly unchanged.

## 2.13 Prerequisites

- The Phase 1 Integration Test Sandbox (`TC-004`) must be passing reliably.

## 2.14 Known Limitations

- Unit testing repositories directly requires database connections; this phase will prioritize testing the Service layer with mocked repositories.

## 2.15 Change Log

### [1.0.1] - 2026-06-14
| Field | Value |
|---|---|
| **Type** | MAJOR |
| **Author** | Antigravity AI Agent |
| **Category** | Changed |
| **Description** | Fully restructured the document to ensure absolute compliance with `DOC-SPEC-001` (Document Specification), adding all mandatory sections, fixing metadata keys, and including a Table of Contents. |

### [1.0.0] - 2026-06-13
| Field | Value |
|---|---|
| **Type** | MAJOR |
| **Author** | Antigravity AI Agent |
| **Category** | Added |
| **Description** | Initial draft of the Phase 2 Implementation Plan. |
