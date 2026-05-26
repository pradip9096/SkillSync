---
name: feature-requirement-spec
description: >
  Manages a single master requirement specification document (MASTER_SPEC.md) covering
  all features across all projects. Use this skill whenever a feature is being added,
  modified, or reviewed — even if the user doesn't explicitly mention "requirements" or
  "spec". Triggers include: starting work on a feature, identifying missing or broken
  behaviour, reviewing what a feature should do, checking if a feature was previously
  defined, or asking why something was built a certain way. Also triggers when stability
  or crash issues are reported, since these must be traced back to a requirement gap.
compatibility: Designed for CLI agent environments (Claude Code CLI, Gemini CLI, Codex CLI)
  and interactive AI assistants (Claude, GPT-4, Gemini) with filesystem access.
audience: humans and AI agents
---

# Feature Requirement Spec

Maintains a **single master document** (`MASTER_SPEC.md`) that holds requirement
specifications for every feature across all projects. This is the source of truth
for what each feature must do, why, and to what standard.

Do NOT create a separate requirements file. Do NOT split MASTER_SPEC.md into
per-feature files. One document, all features, forever growing.

---

## Workflow

### Step 0: Check MASTER_SPEC.md first (always)

Before any feature work begins:

1. Open `MASTER_SPEC.md` and scan the Index table.
2. Search for the feature name or a functionally equivalent feature.
   - If a section exists with `Status: Complete` → read it fully before writing any code.
   - If a section exists with `Status: Draft` or `In Progress` → confirm all 15 blocks
     are present. If any are missing, fill them first. Do not write code until spec is finalized.
   - If a section exists with `Status: Generic Blueprint` → clone the section, rename it
     with the current project context, set Status to `In Progress`. Adapt API paths, flows,
     and ACs to the current project. Do not use Generic Blueprint paths verbatim.
   - If no section exists → create the section using `assets/spec-template.md`.
     Fill all 15 blocks. Do not write code until spec is finalized.

### Step 1: Before starting any feature work

1. Check if `MASTER_SPEC.md` exists in the project root.
   - If not, generate it from the template: `assets/spec-template.md`
   - Copy the template, then proceed to step 2
2. Find the section for the feature being worked on (see Step 0).
3. Confirm requirements are complete and tagged before implementation begins.
   Run the **Output Validation Checklist** below. If anything fails → fix the spec first.

### Step 2: During implementation

- If a requirement is found to be broken, misaligned, or missing mid-implementation:
  **stop, update the spec first, then continue**
- When a similar feature already has a section, reference it rather than duplicating content
- If a crash or stability issue is encountered:
  1. Find the feature's section in `MASTER_SPEC.md`
  2. Add the bug to `Known Bugs / Stability Risks` tagged `MUST HAVE`
  3. Update Status to `Needs Review`
  4. Fix the bug
  5. Update Known Bugs entry to "Resolved on <date>"
  6. Add a Spec Change Log entry

### Step 3: After completing a feature

- Update the feature's section to reflect what was actually built
- Add a Spec Change Log entry with date and summary of what changed
- `MASTER_SPEC.md` must always reflect current state, not just initial intent

### Cross-Project Rule

When starting a new project:
1. Carry `MASTER_SPEC.md` to the new project root unchanged.
2. Update the front matter: set `active-project` to the new project name.
3. Review Index: identify `Generic Blueprint` sections relevant to the new project.
4. Clone and adapt them. Do not re-specify features already covered.
5. Add sections only for genuinely new feature types not already in the document.
6. All `CAN HAVE` requirements from prior projects become candidates for `COULD HAVE`
   or higher in the new project.

---

## Agent Decision Tree

Explicit if/then rules for the 6 most common scenarios:

```
IF asked to implement a feature:
  → Run Step 0. Check MASTER_SPEC.md Index first.
  IF section exists AND Status is Complete:
    → Read it fully. Confirm requirements unchanged before writing any code.
  IF section exists AND Status is Draft or In Progress:
    → Run Output Validation Checklist. If any item fails → fill missing blocks first.
  IF section exists AND Status is Generic Blueprint:
    → Clone section. Set Status to In Progress. Adapt API paths, flows, ACs to this project.
  IF no section exists:
    → Create section from spec-template.md. Fill all 15 blocks. Do not code until finalized.

IF a crash or unknown bug is reported:
  → Find relevant feature section in MASTER_SPEC.md.
  → Add to Known Bugs / Stability Risks tagged MUST HAVE.
  → Set Status to Needs Review.
  → Fix the bug. Then mark entry as Resolved with date.
  → Add Spec Change Log entry.

IF spec and code conflict:
  → Do not resolve silently. Flag the conflict explicitly.
  → Ask: "Which is authoritative — the spec or the current code?"
  → Update the losing side to match the winning side.
  → Log the resolution in the feature's Spec Change Log.

IF starting a new project:
  → Carry MASTER_SPEC.md forward. Update front matter active-project.
  → Check Index for relevant Generic Blueprints. Clone and adapt.
  → Add new sections only for genuinely new feature types.

IF a feature section is partially filled:
  → It is Draft regardless of any Status field value.
  → Do not begin implementation. Complete all 15 blocks first.

IF asked to create a new requirements document:
  → Do NOT create a new file. All specs belong in MASTER_SPEC.md.
  → Add a new section to MASTER_SPEC.md using the template.
```

---

## Output Validation Checklist

Run this before setting any spec section Status to anything other than `Draft`.
All items must pass.

```
[ ] Document front matter version matches current MASTER_SPEC.md version field
[ ] All 15 section blocks are present and non-empty
[ ] Every functional requirement has exactly one MoSCoW tag
[ ] Every functional requirement has a Rationale line
[ ] Every non-functional requirement has exactly one MoSCoW tag
[ ] Every non-functional requirement has a Rationale line
[ ] User Interaction Flow covers at least one success path and one failure path
[ ] API Specifications include auth scope for each endpoint
[ ] Minimum 2 Acceptance Criteria items present (numbered AC X.1, AC X.2 ...)
[ ] Non-Goals has at least 1 explicit item stating what the feature does NOT do
[ ] Dependencies names specific features or services (not blank or "N/A" unless truly none)
[ ] Testing Strategy mentions at least one automated check and one manual check
[ ] Known Bugs is either populated with MUST HAVE items or explicitly says "None identified."
[ ] Spec Change Log has at least 1 entry with date and summary
[ ] Status and Last Updated fields are current
```

---

## Definition of Complete

A feature section is **finalized** — and implementation may begin — only when:
- All 15 blocks are present and non-empty
- The Output Validation Checklist passes (all 15 items checked)
- A Spec Change Log entry exists

A partially filled section is `Draft` regardless of the Status field value.

---

## Gotchas

- Never start implementation without a finalized spec entry
- Stability is a hard requirement. Commercial crashes are `MUST HAVE` fixes, not optional
- Do not rename or split `MASTER_SPEC.md` into per-feature files
- Do not create a second requirements document — extend MASTER_SPEC.md
- If the spec and the code conflict, flag it and resolve before proceeding
- `STANDARD_FEATURE_CATALOG.md` is deprecated — do not add content there

---

## Reference Files

- `references/section-guide.md` — Structure and fields for all 15 blocks in a feature section
- `references/tagging-guide.md` — MoSCoW priority tag definitions, usage rules, cross-project guidance
- `assets/spec-template.md` — Full 15-block template for adding a new feature section
