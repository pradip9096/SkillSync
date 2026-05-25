---
name: feature-requirement-spec
description: >
  Manages a single master requirement specification document covering all features across all projects.
  Use this skill whenever a feature is being added, modified, or reviewed — even if the user doesn't
  explicitly mention "requirements" or "spec". Triggers include: starting work on a feature, identifying
  missing or broken behaviour, reviewing what a feature should do, checking if a feature was previously
  defined, or asking why something was built a certain way. Also triggers when stability or crash issues
  are reported, since these must be traced back to a requirement gap.
compatibility: Designed for Claude Code (or similar CLI agent environments with filesystem access)
---

# Feature Requirement Spec

Maintains a **single master document** (`MASTER_SPEC.md`) that holds requirement specifications for
every feature across all projects. This is the source of truth for what each feature must do, why,
and to what standard.

## Workflow

### Before starting any feature work

1. Check if `MASTER_SPEC.md` exists in the project root.
   - If not, generate it from the template: `assets/spec-template.md`
   - Copy the template, then proceed to step 2
2. Find the section for the feature being worked on.
   - If the section exists → read it fully before writing any code
   - If it doesn't exist → create the section now using the structure in `references/section-guide.md`
3. Confirm requirements are complete and tagged before implementation begins. If anything is unclear or missing, flag it explicitly — do not silently proceed.

### During implementation

- If a requirement is found to be broken, misaligned, or missing mid-implementation: **stop, update the spec first, then continue**
- When a similar feature already has a section, reference it rather than duplicating content
- If a crash or stability issue is encountered, it must be added to the relevant feature section tagged `MUST HAVE` before any other work continues

### After completing a feature

- Update the feature's section to reflect what was actually built, including any decisions made during implementation
- `MASTER_SPEC.md` must always reflect current state, not just initial intent

## Gotchas

- Never start implementation without a finalized spec entry — a partially filled section is not finalized
- Stability is a hard requirement. Crashes and unknown bugs in commercial use are `MUST HAVE` fixes, not optional
- Do not rename or split `MASTER_SPEC.md` into per-feature files — one document, all features
- If the spec and the code conflict, flag the conflict and resolve it before proceeding in either direction

## Reference files

- `references/section-guide.md` — Structure and fields for a single feature section
- `references/tagging-guide.md` — MoSCoW priority tag definitions and usage rules
- `assets/spec-template.md` — Full template for generating a new `MASTER_SPEC.md`
