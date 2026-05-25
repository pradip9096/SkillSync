---
name: integration-test-sandbox
description: >
  Automates the creation, execution, and cleanup of mock integration tests inside a sandbox context
  to verify backend validation rules and controller behavior.
compatibility: Designed for CLI agent environments with Node.js and MongoDB access
---

# Integration Test Sandbox Skill

This skill provides a standard workflow for writing, executing, and cleaning up lightweight, database-connected integration tests to verify backend business logic (such as validation gates, authorization checks, and scheduling conflict rules) without running a full API server.

---

## Workflow

### 1. Identify Test Requirements
Before writing any operational test script:
* Determine which controllers (e.g. `createBooking`, `rateExpert`) and schemas require verification.
* Identify the environment configuration (typically loaded from `backend/.env` or using defaults).
* Map out the test cases (including authenticated states, guest states, and valid/invalid inputs).

### 2. Draft the Test Runner Script
Create a temporary script inside the workspace artifacts directory (e.g., `<appDataDir>/brain/<conversation-id>/scratch/test_<feature_name>.js`) following these criteria:
* **Path Resolution Safety:** Push the project's absolute `node_modules` path onto the module loading array to avoid resolution errors:
  ```javascript
  module.paths.push('/home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/node_modules');
  ```
* **Absolute Imports:** Use absolute paths for requiring schemas and controllers:
  ```javascript
  const User = require('/home/pradip/Software_Developement/Real-Time-Expert-Session-Booking-System/backend/src/models/User');
  ```
* **Mock Express Interface:** Create mock requests (`req`) containing:
  * `body: { ... }`
  * `headers: {}` (to prevent crashes when checking authorizations)
  * `user: <populated-mock-user-object-or-null>`
  * `app: { get: (name) => <mock-socket-io-client> }` (for real-time emit tests)
* **Response Capture:** Create a mock response (`res`) that stores status codes and captures JSON payload payloads:
  ```javascript
  let resStatus = null;
  let resJson = null;
  const res = {
    status: (code) => {
      resStatus = code;
      return { json: (data) => { resJson = data; } };
    }
  };
  ```

### 3. Execution & Assertions
* Execute the test runner: `node <test_path>.js`.
* Check output logs to verify that each test case returns the expected HTTP status and JSON response body.
* Fail the test suite if any assertion yields unexpected values.

### 4. Cleanup and Persistence
* **Database Isolation:** Ensure the script cleans up (deletes) any created test records from collections on run completion.
* **Exit Codes:** Return exit code `0` on successful runs, and `1` on validation failures.
