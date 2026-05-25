# Priority Tagging Guide (MoSCoW)

Apply one tag to every requirement. Tags drive prioritisation decisions during development and scope changes.

---

## Tags

| Tag | Meaning | Ship without it? |
|-----|---------|-----------------|
| `MUST HAVE` | Non-negotiable. Feature is broken or unsafe without it. | No |
| `SHOULD HAVE` | High value. Strong reason needed to exclude it. | Only under constraint |
| `MAY HAVE` | Desirable. Include if time and scope allow. | Yes |
| `COULD HAVE` | Nice to have. Low priority, deferred if needed. | Yes |
| `CAN HAVE` | Future consideration. Document now, implement later. | Yes — intentionally deferred |

---

## Rules

- Every requirement gets exactly one tag — no untagged requirements
- Stability and crash-risk items are always `MUST HAVE`, no exceptions
- If you're unsure between `MUST HAVE` and `SHOULD HAVE`, ask: "Would the feature be unsafe, broken, or non-compliant without this?" If yes → `MUST HAVE`
- Tags can be updated as scope or priorities change, but changes must be recorded in the section with a brief reason
- `CAN HAVE` is not the same as "we'll probably never do this" — use it deliberately for planned future work

---

## Common mistakes

- **Overusing `MUST HAVE`**: If everything is must-have, nothing is prioritised. Reserve it for genuinely non-negotiable items.
- **Using `COULD HAVE` as a dumping ground**: If a requirement matters, give it `MAY HAVE` or higher. `COULD HAVE` is for low-confidence future ideas.
- **Forgetting to tag non-functional requirements**: Performance, security, and reliability items need tags too.
