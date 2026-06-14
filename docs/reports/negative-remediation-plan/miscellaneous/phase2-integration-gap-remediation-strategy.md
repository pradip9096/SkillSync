# Phase 2: Integration Gap Remediation Strategy

**Document Version:** 1.0.0
**Date:** June 9, 2026
**Target Objective:** Elevate Integration Test Suite Statement Coverage from `76.84%` to `>85%` (Minimum Standard Quality Profile).
**Focus:** Eradicating unhandled `try/catch` paths and MongoDB complex state transitions.

---

## 1. Remediation Blueprint overview
Based on the `phase2-integration-coverage-gap-analysis.md` report, this plan systematically outlines the exact tests, methodologies, and architectural maneuvers required to eliminate the remaining negative edge-case gaps. 

We will adopt a **Path 1 (Retroactive Remediation)** methodology, isolating each target gap before proceeding to End-to-End browser validation.

---

## 2. Action Plan: Service Layer Resiliency
**Target:** `src/services/reminderScheduler.js`
**Current Coverage:** 38.05%
**Target Coverage:** > 85.00%

### Proposed Test Additions (`tests/integration/negative/scheduler.negative.test.js`):
1. **Cron Job Collision Testing:** Attempt to dispatch a cron task while the scheduler lock is synthetically held. Assert the scheduler gracefully yields instead of crashing.
2. **Payload Corruption Handling:** Feed a corrupted database ObjectID into the scheduling queue to trigger a lookup failure. Assert the `.catch(error)` block consumes the error, logs it securely, and prevents a total `Node.js` Process `exit(1)`.
3. **Third-Party API Simulation:** Use `jest.mock('../../src/services/emailService.js')` to simulate an SMTP connection timeout when the scheduler attempts to fire. Validate that the scheduler retries or gracefully abandons without crashing the main thread.

---

## 3. Action Plan: Application Layer Fault Injection
**Targets:** `src/controllers/*.js` (Specifically `bookingController.js` and `authController.js`)
**Current Coverage:** ~79.90%
**Target Coverage:** > 90.00%

### Proposed Test Additions (`tests/integration/negative/controller.faults.test.js`):
1. **Database Disconnect Simulation:** 
   - *Method:* Use `jest.spyOn(mongoose.Model, 'create').mockRejectedValue(new Error('MongoNetworkError'))`.
   - *Objective:* Forcefully trigger the `catch(error) { res.status(500) }` blocks across the primary controllers.
   - *Assertion:* Ensure the Express API returns a clean, sanitized `500 Server Error` JSON payload without leaking stack traces to the client.
2. **Transaction Rollback Enforcement (Double Faults):**
   - *Method:* Trigger a failure *during* an ACID rollback (e.g. `session.abortTransaction` throws).
   - *Assertion:* Ensure the application catches the catastrophic failure cleanly.

---

## 4. Action Plan: Data Layer State Boundary Defenses
**Target:** `src/models/Booking.js`
**Current Coverage:** 57.14% (Lines 132, 136, 147-159 missed)
**Target Coverage:** 100.00%

### Proposed Test Additions (`tests/integration/negative/booking.schema.test.js`):
1. **Illegal State Mutation (Completed -> Pending):**
   - Attempt to apply an illegal `save()` operation mutating a finished booking backward in time. Validate the `pre('save')` schema hooks block this action with a `ValidationError`.
2. **Double-Cancellation Ghosting:**
   - Attempt to trigger the deep cancellation hooks on a Booking that is *already* cancelled. Force the execution path down to lines 147-159 to ensure DB consistency remains untouched.
3. **Malformed Payment Integrity:**
   - Seed a Booking with an invalid `stripeSessionId` format right before it triggers a save hook.

---

## 5. Action Plan: Infrastructure Extinction Paths
**Target:** `src/config/db.js`
**Current Coverage:** 50.00%

### Proposed Test Additions (`tests/unit/config/db.negative.test.js`):
1. **Fatal Shutdown Isolation:**
   - *Method:* We will isolate `process.exit` by mocking the global `process` object.
   - *Execution:* Attempt to call `connectDB()` with a malformed `MONGO_URI`.
   - *Assertion:* Validate that `process.exit(1)` is explicitly invoked by the script to protect the server from running in a zombie state without a database.

---

## 6. Execution Protocol
This remediation plan will be executed in a dedicated pull request / integration branch (`fix/phase-2-coverage-gaps`). Once all Action Plans (2 through 5) are implemented, a final `jest --coverage` report will be generated. The exit criteria is strictly `>=85%` statement coverage globally.
