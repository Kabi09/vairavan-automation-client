# Project Tracking Instructions

Create and maintain a root-level file named:

```text
project.md
```

This file is the **single source of truth for project changes, logic, decisions, and implementation progress**.

### 1. Mandatory Rule

Before making **any change** to the project:

* Read `project.md`.
* Understand the existing implementation, decisions, and pending work.
* Check whether the requested change conflicts with anything already documented.
* Follow the existing approach documented in `project.md`.

After making **any change**, update `project.md`.

### 2. Track Every Change

Whenever you modify the project, track:

* Feature changes
* UI changes
* Component changes
* Logic changes
* API changes
* State management changes
* Routing changes
* Bug fixes
* Configuration changes
* Dependency changes
* File/folder structure changes
* Important technical decisions
* Known issues
* Pending tasks

Do not make undocumented changes.

### 3. Update Format

Maintain `project.md` using this structure:

```md
# Project Documentation

## Project Overview
- Project purpose:
- Technology stack:
- Main architecture:
- Important conventions:

## Project Structure
- Important folders
- Important files
- Component structure
- Shared utilities

## UI & Styling Rules
- MUI usage
- Google Icons
- SCSS Modules
- Google Fonts
- Responsive approach
- Component structure

## Application Logic
- Authentication
- State management
- API handling
- Business logic
- Validation
- Error handling

## API / Backend Integration
- API endpoints
- Request methods
- Payload structures
- Response handling
- Authentication requirements

## Components
### ComponentName
- Location:
- Purpose:
- Props:
- State:
- Logic:
- API dependencies:
- Related components:

## Change History

### YYYY-MM-DD
#### Change
- What was changed:
- Files changed:
- Logic changed:
- Reason:
- Impact:

## Current Progress
- Completed:
- In Progress:
- Pending:

## Known Issues
- Issue:
- Status:
- Notes:

## Technical Decisions
- Decision:
- Reason:
- Date:

## Important Notes
- Anything the agent must remember before modifying the project.
```

### 4. Change Workflow

For **every task**, follow this process:

```text
Read project.md
      ↓
Understand current implementation
      ↓
Inspect relevant existing files
      ↓
Plan the change
      ↓
Implement the change
      ↓
Test / verify the change
      ↓
Update project.md
      ↓
Confirm the change is documented
```

### 5. Do Not Lose Existing Information

When updating `project.md`:

* Do not unnecessarily delete existing documentation.
* Do not overwrite previous decisions.
* Preserve useful historical information.
* Update outdated information instead of creating contradictions.
* Keep the documentation concise and organized.
* Add new information to the appropriate section.

### 6. Logic Tracking

If any existing logic is changed, document:

```md
### Logic Change
- Previous behavior:
- New behavior:
- Reason for change:
- Files affected:
- Dependencies:
- Side effects:
```

### 7. Architecture Changes

If the project structure or architecture changes, update:

* Project Structure
* Application Logic
* Technical Decisions
* Change History

The documentation must always reflect the **actual current codebase**.

### 8. Agent Memory

Treat `project.md` as the agent's **persistent project memory**.

Do not rely only on conversation history.

If something important is learned during implementation, add it to `project.md` so that another agent or future session can understand the project without needing previous chat history.

### 9. Final Verification

Before completing every task, verify:

* [ ] `project.md` was read before changes.
* [ ] Existing project conventions were followed.
* [ ] Requested changes were implemented.
* [ ] Existing functionality was not unnecessarily broken.
* [ ] Changes were tested/verified where possible.
* [ ] `project.md` was updated.
* [ ] New logic/decisions were documented.
* [ ] Current progress is accurate.

**Mandatory:** Any code, UI, logic, architecture, or configuration change must be reflected in `project.md`.
