<!-- AGENT INSTRUCTION:
  1. Before using this template, check MASTER_SPEC.md Index for an existing section
     for this feature type. If a Generic Blueprint exists, clone and adapt it instead.
  2. Fill ALL 15 blocks below before setting Status to anything other than Draft.
  3. Run the Output Validation Checklist in SKILL.md before finalizing.
  4. Add a row to the Index table after creating this section.
-->

---

## Feature: <Feature Name>

### Overview
*What this feature does and why it exists. One to two sentences.*

### Functional Requirements

- [MUST HAVE] *Requirement statement.*
  Rationale: *Why this is required and what breaks without it.*

- [SHOULD HAVE] *Requirement statement.*
  Rationale: *Why this matters.*

- [COULD HAVE] *Lower priority requirement.*
  Rationale: *Why it is desirable but not blocking.*

- [CAN HAVE] *Future-project consideration.*
  Rationale: *Documented now for future implementation.*

### Non-Functional Requirements

- [MUST HAVE] *Performance / security / reliability constraint.*
  Rationale: *Why this constraint exists.*

### User Interaction Flow

```
[Actor] -> Action -> [System Response]
  |-- Success --> outcome
  |-- Failure --> error state + user-visible feedback
```

### API Specifications

* `HTTP_METHOD /api/v1/path`
  Input: { field: type }
  Validation: [key server-side rules]
  Output: { field: type }
  Auth: [Public | role required]

### Edge Cases

- When *condition*, the feature must *expected behaviour*.

### Best Practices

* *Implementation guidance specific to this feature.*

### Acceptance Criteria

* **AC X.1:** *Specific, testable condition verifiable by automated test or manual check.*
* **AC X.2:** *Boundary or failure case condition.*

### Non-Goals

- This feature does NOT *[explicit exclusion]*.

### Dependencies

- Feature: *[Name]* — *[why this feature depends on it]*
- Service: *[Library/Service]* — *[what it provides]*

### Testing Strategy

- Unit: *[what function/utility to test and what to assert]*
- Integration: *[end-to-end scenario and expected API response]*
- Manual: *[what a human verifies in the UI or via Postman/curl]*

### Known Bugs / Stability Risks

*None identified.*

### Spec Change Log

| Date | Author | Summary |
|---|---|---|
| YYYY-MM-DD | Agent/Human | Initial spec created. |

### Status
`Draft`

### Last Updated
*YYYY-MM-DD*
