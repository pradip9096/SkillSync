# Standardizing the Sequential Flow of Document Generation

To effectively standardize the sequential flow of document generation across all future projects and eliminate the "reinventing the wheel" phase, we must transition from viewing documents as static text to viewing them as **executable workflows**.

The innovative methodology required here is known as **Agentic Playbooks (or Docs-as-Code Orchestration)**.

Here is the exact strategy and methodology to implement this across all future initiatives:

## 1. The Core Strategy: The "Agentic Playbook" Template

Instead of manually deciding what documents to write for every new project, we should create a reusable GitHub/Git repository template (e.g., `ai-project-template`).

This template comes pre-loaded with a `.agent/workflows/` directory containing our standardized sequences. They are numbered so the sequential flow is undeniable:

*   `01-generate-prd.md` (Ingests business idea → Outputs `PRD.md`)
*   `02-generate-architecture.md` (Ingests PRD → Outputs `SYSTEM_DESIGN.md`)
*   `03-plan-feature.md` (Ingests PRD & Design → Outputs `.agents/plans/feature-x.md`)
*   `04-generate-roadmap.md` (Outputs `ROADMAP.md`)

**Why this works:** When a new project starts, simply clone the template. The AI agent or human developer starts at `01` and executes the pipeline sequentially down to `04`.

## 2. The Master Orchestrator Document (The SOP)

A comprehensive document must be created to encapsulate this workflow. This should be named **`PLAYBOOK.md`** or **`AI_SOP.md`** and placed at the root of the template repository.

This document shouldn't just be a list of rules; it should be an **Input-Process-Output (IPO) map**.
For example, it explicitly states:

> *"**Step 2: Architecture.** Do not begin technical planning until `PRD.md` is approved. Input the PRD into the `02-generate-architecture.md` prompt. The required output is a `SYSTEM_DESIGN.md` file containing a database schema and tech stack definition."*

## 3. Innovative Tools & Methodologies to Enhance This

To truly modernize and automate this flow, implement the following tools:

*   **Scaffolding Tools (Cookiecutter, Yeoman, or Plop.js):**
    Instead of copying folders manually, run a single terminal command like `npx create-ai-project`. The tool asks three questions (Project Name, Description, Target Audience) and automatically generates the entire repository structure, pre-filling the `PRD.md` template and generating the SOPs specifically tailored for that project context.
*   **Makefile or NPM Scripts Orchestration:**
    Build the sequence directly into the project's build tools.
    For example, running `make generate-docs` could trigger a script that explicitly verifies that a `PRD.md` exists before allowing the AI to run the `plan-feature.md` script. It enforces the sequential flow at a systemic level.
*   **Architecture Decision Records (ADRs):**
    Adopt the ADR methodology. Whenever a pivot or new feature is planned, a lightweight markdown file (e.g., `001-use-jwt-auth.md`) is generated. This creates a chronological, standardized history of *why* decisions were made, replacing chaotic documentation with a strict, append-only ledger of decisions.

## Conclusion

To stop re-evaluating the approach on every project, build a **Master Project Template**. Place the `PLAYBOOK.md` (the SOP) at the root, and place sequential, machine-readable instructions (like the PRD generator and `plan-feature.md` files) in an `.agent/` folder.

This transforms the documentation process from an unpredictable human chore into a highly predictable, automated manufacturing line.
