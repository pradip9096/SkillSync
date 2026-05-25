---
name: timezone-safety-auditor
description: >
  Audits, validates, and standardizes date, time, and scheduling operations to prevent timezone drift,
  specifically supporting localization standards (like India Standard Time UTC+5:30).
compatibility: Designed for CLI agent environments with Javascript / Node.js source files
---

# Timezone Safety Auditor Skill

This skill enforces best practices and validations for scheduling-related codebase features, ensuring that time, dates, and slots are treated consistently without timezone-related offset shift bugs.

---

## Guidelines

### 1. Database Serialization Standards
* All timestamps and dates stored in the database should be normalized. For full timestamps, use UTC.
* For scheduling slots, store dates as `YYYY-MM-DD` strings, and time slots as `HH:MM` strings (24-hour layout) to avoid raw milliseconds shifts across servers in different timezones.

### 2. Time-Lock Validation Rules (IST Standard)
* When validating whether an event is in the past, or if a status can be modified, calculate offsets using the regional timezone context (Asia/Kolkata UTC+5:30).
* **Backend Validation Pattern:**
  ```javascript
  const nowMs = Date.now();
  // Always append the target offset (+05:30) to force parsing in regional time
  const sessionTime = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  const sessionMs = sessionTime.getTime();
  if (nowMs < sessionMs) { /* Target time has not arrived yet */ }
  ```
* **Frontend Validation Pattern:**
  Use reliable timezone parsing tools or timezone formatting:
  ```javascript
  const isSlotInPast = (slotTime) => {
    const now = new Date();
    // Offset standard date by 5.5 hours to compute local IST elements
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = istNow.toISOString().split('T')[0];
    
    if (selectedDate < todayStr) return true;
    if (selectedDate > todayStr) return false;
    
    const [sHour, sMinute] = slotTime.split(':').map(Number);
    const nowHour = istNow.getUTCHours();
    const nowMinute = istNow.getUTCMinutes();
    
    if (nowHour > sHour) return true;
    if (nowHour === sHour && nowMinute >= sMinute) return true;
    return false;
  };
  ```

### 3. Verification Rules
* Verify that date pickers contain appropriate `min` properties if booking/blocking in the past is prohibited.
* Verify that UI button click events verify `isSlotInPast` or `isSessionPast` and render clean disabled states (labeled `"Passed"` or `"Locked"`).
