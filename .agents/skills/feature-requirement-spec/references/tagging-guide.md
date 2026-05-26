# Priority Tagging Guide (MoSCoW)

Apply exactly one tag to every requirement — functional and non-functional.
Tags drive prioritisation decisions during development and scope changes.

Audience: humans and AI agents (Claude Code CLI, Gemini CLI, Codex CLI, Claude, GPT-4, Gemini).

---

## Tags

| Tag | Meaning | Ship without it? | Cross-Project Note |
|---|---|---|---|
| `MUST HAVE` | Non-negotiable. Feature is broken, unsafe, or non-compliant without it. | No | Always carries forward to new projects unchanged |
| `SHOULD HAVE` | High value. Strong reason needed to exclude it. | Only under constraint | Usually carries forward; reassess per project |
| `MAY HAVE` | Desirable if time and scope allow. | Yes | Carries forward as `COULD HAVE` in the next project |
| `COULD HAVE` | Low priority in the current project. Include if effort is low. | Yes | Becomes `CAN HAVE` if not shipped in this project |
| `CAN HAVE` | Intentionally deferred to a future project. Document now, implement later. | Yes — intentionally | Becomes `COULD HAVE` or higher in the next project |

---

## Rules

- Every requirement gets exactly one tag — no untagged requirements
- Stability and crash-risk items are always `MUST HAVE`, no exceptions
- If unsure between `MUST HAVE` and `SHOULD HAVE`, ask:
  "Would the feature be unsafe, broken, or non-compliant without this?"
  If yes → `MUST HAVE`. If no → `SHOULD HAVE`.
- Tags can be updated as scope or priorities change, but changes must be
  recorded in the feature's Spec Change Log with a brief reason
- `CAN HAVE` is not "we will probably never do this" — it is a deliberate
  deferral to a future project with intent to implement

---

## Cross-Project Tag Lifecycle

As MASTER_SPEC.md travels across projects, tag levels shift:

```
Project 1          → Project 2          → Project 3
CAN HAVE           → COULD HAVE         → MAY HAVE or SHOULD HAVE
COULD HAVE         → MAY HAVE           → SHOULD HAVE
MAY HAVE           → SHOULD HAVE        → MUST HAVE (if still not shipped)
```

Agent rule: when adapting a Generic Blueprint for a new project, review all
`CAN HAVE` and `COULD HAVE` items from the prior project. Re-evaluate their
priority for the current project context.

---

## Common Mistakes

- **Overusing `MUST HAVE`**: If everything is must-have, nothing is prioritised.
  Reserve it for genuinely non-negotiable items.
- **Using `COULD HAVE` as a dumping ground**: If a requirement matters, give it
  `MAY HAVE` or higher. `COULD HAVE` is for low-confidence current-project work.
- **Forgetting non-functional requirements**: Performance, security, and reliability
  items need tags too — do not leave them untagged.
- **Never using `CAN HAVE`**: Future-project features should be captured now.
  Leaving them out means re-discovering them from scratch in the next project.
