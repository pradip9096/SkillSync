# GitHub Issues and Projects — Beginner's Guide

A plain-language walkthrough of what issues and projects are, how they relate, and how to create them — both on the GitHub website and from the terminal.

---

## What is an Issue?

Think of an issue like a **sticky note on a whiteboard**.

Each sticky note says:
- **What needs to be done** (title)
- **Why it needs to be done** (description)
- **Who will do it** (assignee)
- **How urgent it is** (label)

When the work is done, you **peel the sticky note off** (close the issue).

---

## What is a Project?

A Project is the **whiteboard itself**.

You group related sticky notes (issues) onto one whiteboard. For example:
- One whiteboard for **security work** (M2)
- One whiteboard for **video features** (M3)

This way you see all related work in one place.

---

## The Relationship

```
Project (whiteboard)
  └── Issues (sticky notes)
        └── Each issue has: title, description, labels, assignee
```

---

## Creating an Issue — GitHub Website

**Step 1** — Go to your repository

```
github.com/pradip9096/SkillSync
```

**Step 2** — Click the **Issues** tab at the top

**Step 3** — Click the green **New issue** button (top right)

**Step 4** — Fill in the form:

| Field | What to write |
|---|---|
| **Title** | One clear sentence — e.g. `Fix login button not working on mobile` |
| **Description** | What needs doing, why, and how to verify it is done (acceptance criteria) |
| **Labels** | Click the gear icon → pick `severity:high`, `type:bug`, etc. |
| **Assignee** | Click the gear icon → assign to yourself |
| **Milestone** | Click the gear icon → pick M2, M3, etc. |

**Step 5** — Click **Submit new issue**

The issue now exists and has a number (e.g. `#14`).

---

## Creating an Issue — Terminal (gh CLI)

```bash
# Simple issue
gh issue create \
  --repo pradip9096/SkillSync \
  --title "Fix login button not working on mobile" \
  --body "## Summary\nButton does not respond on iOS Safari.\n\n## Acceptance Criteria\n- [ ] Button works on iOS Safari\n- [ ] Button works on Android Chrome" \
  --label "severity:high,type:bug" \
  --milestone "M2 — Hardening & Assurance"

# View all open issues
gh issue list --repo pradip9096/SkillSync

# Filter by label
gh issue list --repo pradip9096/SkillSync --label "severity:critical"

# View one issue in detail
gh issue view 14 --repo pradip9096/SkillSync

# Open an issue in the browser
gh issue view 14 --repo pradip9096/SkillSync --web
```

---

## Creating a Project — GitHub Website

**Step 1** — Go to your profile

```
github.com/pradip9096
```

**Step 2** — Click the **Projects** tab

**Step 3** — Click the green **New project** button

**Step 4** — Choose a template:
- **Board** — looks like Trello (columns: To Do, In Progress, Done)
- **Table** — looks like a spreadsheet

**Step 5** — Give it a name, e.g. `M2 — Hardening & Assurance`

**Step 6** — Click **Create project**

---

## Creating a Project — Terminal (gh CLI)

```bash
# Create a project
gh project create --owner pradip9096 --title "M2 — Hardening & Assurance"

# List all projects
gh project list --owner pradip9096
```

---

## Adding Issues to a Project

### Via GitHub Website

**Step 1** — Open your project

**Step 2** — Click **+ Add item** at the bottom of any column

**Step 3** — Type `#` and search for your issue by name or number

**Step 4** — Click the issue — it appears on the board

### Via Terminal

```bash
# Add issue #14 to project #3
gh project item-add 3 --owner pradip9096 \
  --url https://github.com/pradip9096/SkillSync/issues/14
```

---

## Linking a Project to Your Repository

This makes the project visible under the repository's **Projects** tab.

### Via GitHub Website

**Step 1** — Go to `github.com/pradip9096/SkillSync`

**Step 2** — Click the **Projects** tab

**Step 3** — Click **Link a project**

**Step 4** — Select your project from the list

### Via Terminal

```bash
gh project link 3 --owner pradip9096 --repo SkillSync
```

---

## Starting Work on an Issue — Best Practices

Follow this order every time:

```
1. Read the issue fully (title, description, acceptance criteria, labels)
2. Check it is not blocked by another issue
3. Assign it to yourself
4. Create a branch named after the issue
5. Write code
6. Run tests
7. Commit with "Closes #N" in the message
8. Push and open a Pull Request
9. PR merges → issue auto-closes
```

### Step-by-Step Commands

```bash
# 1. Assign to yourself (claim the issue)
gh issue edit 14 --repo pradip9096/SkillSync --add-assignee "@me"

# 2. Create a branch
#    Format: <type>/<issue-number>-<short-description>
git checkout -b fix/14-alreadyprocessed-http-400

# 3. Do the work...

# 4. Commit — "Closes #14" auto-closes the issue on merge
git commit -m "fix: return HTTP 200 on alreadyProcessed webhook path

Closes #14"

# 5. Push
git push -u origin fix/14-alreadyprocessed-http-400

# 6. Open a Pull Request
gh pr create \
  --title "fix: return HTTP 200 on alreadyProcessed" \
  --body "## Summary
- Changed HTTP 400 → 200 on alreadyProcessed path in bookingController.js:96

Closes #14"
```

### Branch Naming Convention

| Type | When to use | Example |
|---|---|---|
| `fix/` | Bug fixes | `fix/14-alreadyprocessed-http-400` |
| `feat/` | New features | `feat/22-account-lockout` |
| `test/` | Adding tests | `test/77-expert-discovery-gaps` |
| `docs/` | Documentation | `docs/70-rtm-file-path-corrections` |
| `refactor/` | Code restructure | `refactor/36-bookingservice-coverage` |
| `chore/` | Config, tooling | `chore/50-github-actions-workflow` |

---

## Tracking Issues — Useful Commands

```bash
# See all open issues
gh issue list --repo pradip9096/SkillSync

# See only critical issues
gh issue list --repo pradip9096/SkillSync --label "severity:critical"

# See issues assigned to you
gh issue list --repo pradip9096/SkillSync --assignee "@me"

# Add a progress comment
gh issue comment 14 --repo pradip9096/SkillSync \
  --body "Fix implemented in bookingController.js line 96 — opening PR shortly"

# Close an issue manually (prefer Closes #N in PR instead)
gh issue close 14 --repo pradip9096/SkillSync
```

---

## The Complete Picture

```
You discover work to be done
          ↓
Create an Issue (the sticky note)
  - Clear title
  - Description + acceptance criteria
  - Labels, milestone, assignee
          ↓
Add it to a Project (the whiteboard)
  - Move to "In Progress" when you start
  - Move to "Done" when finished
          ↓
Assign → Branch → Code → Test → Commit → PR
  - PR body contains "Closes #14"
          ↓
PR merges → Issue auto-closes → Project updates automatically
```

---

## What NOT to Do

| Anti-pattern | Why it is bad |
|---|---|
| Work directly on `main` | Cannot review, cannot revert cleanly |
| Start without reading acceptance criteria | You will miss requirements and redo work |
| Open a PR before tests pass | Wastes review time |
| One giant commit for everything | Hard to review, hard to revert |
| Close the issue manually | Let the PR merge do it via `Closes #N` |
| Start a `blocked` issue | Depends on another issue that is not done yet |
