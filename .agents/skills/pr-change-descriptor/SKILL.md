---
name: pr-change-descriptor
description: >
  Scans codebase changes and structures comprehensive developer-facing walkthroughs,
  acceptance checklists, and manual test validation results.
compatibility: Designed for CLI agent environments with Git and filesystem access
---

# PR Change Descriptor Skill

This skill outlines a standard template and workflow for documenting implemented software changes, verification checks, and tests so that code reviews are efficient and transparent.

---

## Workflow

### 1. Codebase Scan
* Prior to wrapping up a task, execute `git status` and `git diff` to identify the list of created and modified files.
* Map these modifications back to the requirements specified in the project specifications.

### 2. Generate Walkthrough Document
Create or update a `walkthrough.md` file in the conversation artifacts directory following this structure:
* **Feature Summary:** A high-level description of what the change does and why it was introduced.
* **Component Breakdown:** Grouped list of changes:
  * Highlight new files with a `[NEW]` indicator.
  * Highlight changed files with a `[MODIFY]` indicator.
  * Provide a brief list of what changed inside each file, referencing line numbers or functions.
  * Always use absolute clickable markdown links to reference the files in the workspace (e.g. `[bookingController.js](file:///absolute/path/to/modifiedfile)`).
* **Verification & Testing Results:**
  * Document commands executed for automated tests (such as linter and production compile/build checks).
  * Document manual testing steps (inputs used, account credentials, and output states observed).

### 3. Log Clean Commits
* Organize git stages so only core files are committed (avoiding node_modules or system log changes).
* Write short, imperative commit messages summarizing the core enhancement (e.g., `Prevent expert self-booking` or `Enforce session completion time-lock`).
