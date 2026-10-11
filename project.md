# Project Documentation

## Project Overview
- Project purpose: Frontend client application for Vairavan Automation.
- Technology stack: React, Material UI (MUI), SCSS Modules, Google Fonts, Google Icons.
- Main architecture: Component-driven frontend client with modular styling and centralized API/state management.
- Important conventions:
  - Single source of truth is `project.md`.
  - Always read `project.md` before making changes and update it immediately after any change.
  - Consistent UI styling using MUI combined with SCSS Modules.
  - No undocumented changes allowed.

## Project Structure
- Important folders:
  - Initial repository setup (scaffolding in progress)
- Important files:
  - `project.md`: Single source of truth for project changes, logic, decisions, and progress.
- Component structure: Modular reusable components styled with SCSS Modules and MUI.
- Shared utilities: To be documented upon setup.

## UI & Styling Rules
- MUI usage: Core UI component primitives and theming.
- Google Icons: Material Symbols / Material Icons for UI iconography.
- SCSS Modules: Component-scoped styling (`*.module.scss`) for custom layouts and fine-grained styling.
- Google Fonts: Modern typography imported and configured globally.
- Responsive approach: Mobile-first responsive layouts leveraging MUI breakpoints and SCSS mixins.
- Component structure: Clean separation of concerns (JSX/TSX structure, SCSS module styles, logic hooks).

## Application Logic
- Authentication: To be implemented / documented.
- State management: To be implemented / documented.
- API handling: Centralized API client service with typed payloads and responses.
- Business logic: Modular services and custom hooks.
- Validation: Form and payload validation.
- Error handling: Graceful UI error boundaries and user-friendly alert/toast notifications.

## API / Backend Integration
- API endpoints: To be documented upon backend connection.
- Request methods: Standard RESTful conventions (GET, POST, PUT, DELETE, PATCH).
- Payload structures: JSON payloads.
- Response handling: Standardized response wrappers and error codes.
- Authentication requirements: Bearer token / session auth as required.

## Components
### (Initial Scaffolding Pending)
- Location: `src/components/`
- Purpose: Components will be documented here as they are developed.
- Props: -
- State: -
- Logic: -
- API dependencies: -
- Related components: -

## Change History

### 2026-10-11
#### Initialization
- What was changed: Created root `project.md` tracking file and established project tracking guidelines.
- Files changed: `project.md`, `AGENTS.md`
- Logic changed: Initialized documentation tracking workflow.
- Reason: Project setup and establishing persistent single source of truth for project memory.
- Impact: All future changes, features, decisions, and logic must be documented here.

## Current Progress
- Completed:
  - Initialized repository project tracking file (`project.md`).
  - Defined tracking workflow, UI & styling rules, and documentation standards.
- In Progress:
  - Client workspace scaffolding and dependency setup.
- Pending:
  - Project initialization (Vite/React with MUI & SCSS).
  - Folder structure and architecture layout.
  - Base layout, routing, and theme configuration.

## Known Issues
- Issue: None currently.
- Status: Clean state.
- Notes: Initial project setup phase.

## Technical Decisions
- Decision: Use `project.md` as single source of truth for project tracking and agent memory.
- Reason: Ensure continuity across sessions, prevent conflicting changes, and track all logic and architecture decisions.
- Date: 2026-10-11

- Decision: UI stack standardized with Material UI (MUI), SCSS Modules, Google Fonts, and Google Icons.
- Reason: Provides robust component library primitives alongside scoped custom SCSS styling flexibility.
- Date: 2026-10-11

## Important Notes
- Mandatory Rule: Before making ANY change to the project:
  1. Read `project.md`.
  2. Understand existing implementation, decisions, and pending work.
  3. Check whether the requested change conflicts with anything already documented.
  4. Follow existing conventions.
- After making ANY change:
  - Update `project.md` (Change History, Current Progress, Components, Logic, etc.).
- Never make undocumented changes.
