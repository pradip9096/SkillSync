# System Resiliency & Job Recovery Implementation Plan

---

# Section 1 — Document Metadata

## 1.1 Metadata

| Field | Value |
|---|---|
| **Title** | System Resiliency & Job Recovery Implementation Plan |
| **Document ID** | DOC-RES-002 |
| **Purpose** | Defines the technical implementation steps to achieve webhook idempotency and graceful job recovery for the platform. |
| **Audience** | Backend Engineers, Site Reliability Engineers, and System Architects. |
| **Owner** | Lead Backend Engineer |
| **Version** | 0.1.0 |
| **Status** | Draft |
| **Last Updated** | 2026-06-12 |
| **Related Documents** | DOC-RES-001 |
| **Compliance Classification** | NIST SP 800-160 Vol. 1 Rev. 1, ISO/IEC/IEEE 12207:2017 |
| **Risk Level** | High |
| **Business Criticality** | Critical |
| **Retention Policy** | Retained for the lifetime of the application. Disposal requires formal decommission approval. |

---

# Section 2 — Document Content

## 2.1 Overview

This implementation plan provides the technical blueprint for realizing the requirements defined in the System Resiliency Specification (DOC-RES-001). It details the architectural changes required in the Node.js backend to ensure Razorpay webhooks are processed idempotently and Agenda background jobs recover gracefully during process termination.

## 2.2 Problem Statement

The backend currently lacks transactional boundaries capable of safely discarding duplicate webhook deliveries from external gateways. Furthermore, unhandled operating system termination signals cause the immediate death of the Node.js process, stranding active Agenda background jobs in a locked, unrecoverable state until their lock timeouts expire.

## 2.3 Purpose

The purpose of this document is to instruct engineering teams on the exact code-level patterns and database schemas necessary to implement the resiliency requirements. This ensures alignment with international systems engineering standards.

## 2.4 Goal

The single intended outcome of this plan is the successful deployment of idempotency mechanisms for the Razorpay webhook endpoint and a graceful shutdown sequence for the Express server and Agenda job queue.

## 2.5 Objectives

1. Create the `ProcessedWebhook` Mongoose model with a unique constraint on the event identifier.
2. Update the webhook controller to catch duplicate key errors and return a success status.
3. Implement a coordinated shutdown sequence capturing termination signals to safely stop Agenda, close the HTTP server, and disconnect the database.

## 2.6 Scope

**In-Scope:**
- `ProcessedWebhook` schema definition and implementation.
- Refactoring `/api/webhooks/razorpay` to use the idempotency check.
- Addition of graceful shutdown handlers in the Node.js server entry point.

**Out-of-Scope:**
- Infrastructure-level orchestration configurations.
- Database replication setups.

## 2.7 Definitions

| Term | Definition |
|---|---|
| **SIGTERM** | A generic signal used to cause program termination, acting as the default signal sent by process managers to request a graceful shutdown. |
| **11000 Error** | The standard MongoDB error code for a duplicate key violation on a unique index. |
| **Idempotency-Key** | A unique identifier sent by a client to guarantee that a request is processed exactly once. |

## 2.8 Assumptions

- The Razorpay API consistently provides a unique event identifier in the webhook JSON payload.
- The hosting environment sends `SIGTERM` and waits for a grace period before issuing `SIGKILL`.

## 2.9 Dependencies

- Mongoose (MongoDB ODM)
- Agenda (Job Queuing library)
- Node.js `process` module
- Razorpay API

## 2.10 Constraints

- The graceful shutdown sequence must complete within the orchestrator's grace period.
- Webhook idempotency checks must not add significant latency to the response time.

## 2.11 Prerequisites

- The reader requires access to the backend repository and local testing environments.
- The reader requires an understanding of Node.js event emitters and Promise-based cleanup sequences.

## 2.12 Main Content

### 2.12.1 Alignment with Engineering Standards

This implementation plan synthesizes authoritative guidelines to ensure robust system engineering:

- **NIST SP 800-160 Vol. 1 Rev. 1 & Vol. 2 Rev. 1 (Engineering Trustworthy Secure Systems):**
  This standard mandates cyber resiliency constructs, specifically the ability to withstand and recover from adverse conditions. By implementing graceful shutdown sequences, the system treats process termination as an anticipated lifecycle event, directly supporting the NIST survivability principles.

- **IETF Draft (Idempotency-Key HTTP Header):**
  The `draft-ietf-httpapi-idempotency-key-header` represents the industry consensus for fault-tolerant HTTP APIs. The implementation follows this pattern by treating the Razorpay event ID as the functional equivalent of the `Idempotency-Key`, ensuring safe retries without unintended side effects.

- **ISO/IEC/IEEE 12207:2017 (Software life cycle processes):**
  In alignment with the Technical Processes defined by ISO 12207, this implementation prioritizes process outcomes over rigid procedural tasks, integrating the resiliency patterns directly into the existing deployment topology.

### 2.12.2 Implementation Step 1: Webhook Idempotency

It is obligatory that the backend records every processed webhook to prevent duplicate execution.

1. **Create the Schema:**
   The system shall define a `ProcessedWebhook` Mongoose schema featuring an `eventId` field of type String with a `unique: true` index. The system shall include an `expiresAt` TTL index of 30 days to prevent infinite collection growth.

2. **Update the Webhook Controller:**
   The system shall extract the event identifier upon receiving a webhook payload from Razorpay.
   The system shall attempt to create a new `ProcessedWebhook` document using the identifier.
   If the database throws a duplicate key error (`11000`), the system shall log the duplicate attempt, abort further processing, and immediately return a `200 OK` response.
   If the creation succeeds, the system shall proceed with updating the booking status.

### 2.12.3 Implementation Step 2: Agenda Job Recovery & Graceful Shutdown

It is obligatory that the backend captures termination signals and cleanly shuts down background tasks.

1. **Configure Agenda Locks:**
   The system shall configure Agenda with a `defaultLockLifetime` of 10 minutes (600000 ms) upon initialization to ensure stalled locks expire.

2. **Implement the Graceful Shutdown Handler:**
   The system shall attach listeners to the `SIGTERM` and `SIGINT` OS signals.
   The shutdown handler shall execute the cleanup sequence sequentially:
   - The system shall invoke `agenda.stop()` to wait for active jobs to finish and prevent new jobs from starting.
   - The system shall close the HTTP server to stop accepting new requests.
   - The system shall gracefully terminate the Mongoose database connection.
   - The system shall invoke process exit upon successful cleanup.

## 2.13 Known Limitations

- The TTL index on `ProcessedWebhook` implies that if a webhook is retried after 30 days, the system treats it as a new event.
- Active Agenda jobs that take longer than the OS shutdown grace period will be forcefully terminated.

## 2.14 References

- NIST SP 800-160 Volume 1, Revision 1: Engineering Trustworthy Secure Systems
- NIST SP 800-160 Volume 2, Revision 1: Developing Cyber-Resilient Systems
- IETF Draft: The Idempotency-Key HTTP Header Field
- ISO/IEC/IEEE 12207:2017 Systems and software engineering — Software life cycle processes
- SkillSync System Resiliency Specification (DOC-RES-001)

## 2.15 Change Log

### [0.1.0] - 2026-06-12
| Field | Value |
|---|---|
| **Type** | MINOR |
| **Author** | Antigravity AI |
| **Category** | Added |
| **Description** | Initial draft created based on DOC-RES-001 and industry best practices. |
