---
name: prime
description: >
  Builds comprehensive understanding of any codebase by systematically analyzing
  its structure, documentation, and recent activity. Use at the start of any session
  involving an unfamiliar project, when asked to "get up to speed", "understand the
  codebase", "load context", "prime yourself", or before making changes to a repository
  you haven't worked in before. Also use when switching branches or returning to a
  project after a significant gap.
compatibility: Requires git. Works with any language, framework, or project type.
---

# Prime: Load Project Context

Systematically build understanding of the current codebase before taking action.
Complete all steps in order. Do not skip steps — gaps in context lead to incorrect assumptions.

## Steps

### 1. Map the structure

```bash
git ls-files | head -200
```

Then get a directory overview. Use whatever tree utility is available (`tree`, `find`, `ls -R`),
limiting depth to 3 levels and excluding build artifacts and dependency folders.

### 2. Read project documentation

In priority order — stop when you have enough context, but always attempt the first two:

1. Any global rules or agent instructions file (e.g. `CLAUDE.md`, `AGENTS.md`, `.cursorrules`)
2. Root `README`
3. Architecture or design docs if present (`docs/`, `ADR/`, `architecture.md`, etc.)

### 3. Identify and read key files

Use the structure from step 1 to locate — don't guess blindly:

- **Entry point**: the file where execution starts (varies by language and project type)
- **Dependency manifest**: the file that declares dependencies (varies by ecosystem)
- **Core configuration**: environment, build, or runtime config files

Read the entry point and dependency manifest. Skim config files unless something looks non-standard.

### 4. Check current state

```bash
git log --oneline -10
git status
```

## Output

Provide a concise summary covering:

- **What it is**: purpose and type of application
- **Stack**: languages, frameworks, key libraries
- **Structure**: how the codebase is organised and why
- **Current state**: active branch, recent focus, anything that looks unusual or needs attention

Keep it scannable. Prioritise observations that would affect how you approach tasks in this project.
If anything is ambiguous or missing, say so — don't fill gaps with assumptions.
