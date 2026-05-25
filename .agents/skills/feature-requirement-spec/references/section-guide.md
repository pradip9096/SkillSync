# Feature Section Structure

Each feature in `MASTER_SPEC.md` follows this structure. All fields are required unless marked optional.

---

## `## Feature: <Feature Name>`

### Overview
One or two sentences describing what this feature does and why it exists.

### Functional Requirements
List each behaviour the feature must exhibit. Each item must have a priority tag.

Format:
```
- [TAG] <Requirement description>
  Rationale: <Why this is required and what breaks without it>
```

Example:
```
- [MUST HAVE] User session must expire after 30 minutes of inactivity
  Rationale: Security compliance requirement. Without this, unauthorised access risk increases significantly.

- [SHOULD HAVE] Session expiry warning shown 2 minutes before timeout
  Rationale: Improves user experience by preventing unexpected logouts during active work.
```

### Non-Functional Requirements
Performance, reliability, security, and other quality constraints.

Format: same as functional requirements.

### Edge Cases
Known boundary conditions and how the feature should handle them.

```
- When <condition>, the feature must <expected behaviour>
```

### Best Practices
Implementation guidance specific to this feature. Only include what the agent wouldn't already know.

### Known Bugs / Stability Risks  *(optional, add when relevant)*
Any crash-risk behaviour, known instability, or commercial-use issues.
All items here must be tagged `MUST HAVE` and resolved before shipping.

### Status
One of: `Draft` | `In Progress` | `Complete` | `Needs Review`

### Last Updated
Date the section was last modified.

---

## Notes

- Keep each section self-contained. Another developer should be able to read it without context from other sections.
- Reference related features by name if requirements overlap: `See: Feature: <Name>`
- Do not copy requirements from another section — reference instead to avoid drift.
