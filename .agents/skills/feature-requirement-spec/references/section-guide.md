# Feature Section Structure

Each feature in `MASTER_SPEC.md` follows this structure. All 15 blocks are required.
A section missing any block is considered `Draft` regardless of the Status field value.

Audience: humans and AI agents (Claude Code CLI, Gemini CLI, Codex CLI, Claude, GPT-4, Gemini).

---

## Block 1: `## Feature: <Feature Name>`

The heading is the feature's canonical name. Use the same name in the Index table.
For Generic Blueprints, prefix with "[Generic Blueprint]" in the heading.

---

## Block 2: `### Overview`

One or two sentences: what this feature does and why it exists.
Agent rule: if you cannot write this in two sentences, the feature scope is too large — split it.

---

## Block 3: `### Functional Requirements`

List each behaviour the feature must exhibit. Every item must have a MoSCoW tag and a Rationale.

Format:
```
- [TAG] Requirement description.
  Rationale: Why this is required and what breaks without it.
```

Example:
```
- [MUST HAVE] Backend must reject bookings where userEmail matches the expert's credential email.
  Rationale: Prevents self-booking via email even for unauthenticated API requests.

- [SHOULD HAVE] Submit button text must change to "Self-Booking Disabled" on own profile.
  Rationale: Clear visual confirmation of the disabled state without requiring user to read a banner.

- [CAN HAVE] Admin override to allow exceptions to the self-booking restriction.
  Rationale: Edge case for demonstration or testing environments.
```

---

## Block 4: `### Non-Functional Requirements`

Performance, reliability, security, and quality constraints.
Format: same as Functional Requirements (TAG + Rationale).

---

## Block 5: `### User Interaction Flow`

Step-by-step user paths and system state transitions.
Must include at least one success path and one failure path.

Format:
```
[Actor] -> Action -> [System Response]
  |-- Success --> next state / outcome
  |-- Failure --> error state + user-visible feedback
```

Agent rule: trace the path from the user's first click to the final system state.
Include what the user sees on both success and failure.

---

## Block 6: `### API Specifications`

List every HTTP endpoint this feature touches.

Format:
```
* `HTTP_METHOD /api/v1/path`
  Input: { field: type, ... }
  Validation: [key rules checked server-side]
  Output: { field: type, ... }
  Auth: [Public | role required]
```

If the feature has no API endpoints (e.g. display-only): write
"No new endpoints. This feature operates at the display layer only."

---

## Block 7: `### Edge Cases`

Known boundary conditions and how the feature handles them.

Format:
```
- When <condition>, the feature must <expected behaviour>.
```

Minimum: 1 edge case. If no edge cases exist, write "No edge cases identified."

---

## Block 8: `### Best Practices`

Implementation guidance specific to this feature.
Only include what the agent or developer would not already know from standard practice.

Format: bullet list of actionable guidance.

---

## Block 9: `### Acceptance Criteria`

Numbered, testable conditions that confirm the feature works correctly.
Each AC must be verifiable by a human or automated test without ambiguity.

Format:
```
* **AC X.1:** [Specific, testable condition.]
* **AC X.2:** [Boundary or failure case condition.]
```

Numbering convention: X is the feature number in the Index (1, 2, 3...). Items are .1, .2, .3...
Minimum: 2 AC items per feature.

Agent rule: an AC is valid only if it can be verified without subjective judgment.
"The UI looks good" is not a valid AC. "The submit button displays 'Self-Booking Disabled'" is.

---

## Block 10: `### Non-Goals`

What this feature explicitly does NOT do. Prevents scope creep.

Format:
```
- This feature does NOT [explicit exclusion].
```

Minimum: 1 item. If no exclusions apply, write:
"No explicit exclusions for this feature."

Agent rule: when in doubt, add an exclusion. Non-Goals are the fastest way to prevent an agent
from doing adjacent work that was not requested.

---

## Block 11: `### Dependencies`

Other features or external services this feature depends on.

Format:
```
- Feature: [Feature Name] — [why this feature depends on it]
- Service: [Library/Service Name] — [what it provides]
```

If no dependencies: write "No cross-feature dependencies."

---

## Block 12: `### Testing Strategy`

How to verify the feature works. Must include at least one automated check and one manual check.

Format:
```
- Unit: [what to test and what utility/function to target]
- Integration: [end-to-end scenario and assertion]
- Manual: [what a human verifies in the UI or via API tool (Postman, curl)]
```

---

## Block 13: `### Known Bugs / Stability Risks`

Any crash-risk behaviour, known instability, or commercial-use issues.

All items must be tagged `MUST HAVE` and include resolution status.

Format:
```
- [MUST HAVE - Resolved YYYY-MM-DD] Description of the bug, root cause, and fix applied.
- [MUST HAVE - Open] Description of active bug. Must be resolved before shipping.
```

If no bugs: write "None identified."

Agent rule: stability is a hard requirement. If you encounter a crash during implementation,
stop work and add the bug here before continuing. Crashes in commercial use are never optional fixes.

---

## Block 14: `### Spec Change Log`

Timestamped history of spec changes. Helps agents and humans understand why requirements evolved.

Format:
```
| Date | Author | Summary of Change |
|---|---|---|
| YYYY-MM-DD | [human name or agent] | [what changed in this spec and why] |
```

Minimum: 1 entry (the initial creation entry).

Agent rule: every time you modify a spec section, add a Change Log entry.
Do not edit previous entries — append only.

---

## Block 15: `### Status` and `### Last Updated`

```
### Status
`Draft` | `In Progress` | `Complete` | `Needs Review` | `Generic Blueprint`

### Last Updated
YYYY-MM-DD
```

Status definitions:
- `Draft`: spec written, implementation not started
- `In Progress`: currently being built
- `Complete`: built, verified, spec reflects current state
- `Needs Review`: code has diverged from spec; reconciliation needed
- `Generic Blueprint`: reusable pattern not tied to a specific project

---

## Notes

- Keep each section self-contained. A developer or agent should be able to read it without
  needing context from other sections.
- Reference related features by name in Dependencies: `See: Feature: <Name>`
- Do not copy requirements from another section — reference instead to avoid drift.
- A section missing any of the 15 blocks is `Draft` regardless of the Status field.
