# Project Documentation

## Project Overview
- Project purpose: Employee Duty Management System for Vairavan Automation. Provides full field-service duty tracking, company client directory, employee lifecycle management, leave approvals, holiday calendar, customer signatures, proof photo uploads, and real-time dashboard analytics.
- Technology stack:
  - Backend: Node.js (v18+), Express.js (ES Modules), MongoDB Atlas, Mongoose ODM, JWT (`jsonwebtoken`), bcryptjs, express-validator, Helmet, CORS, express-rate-limit, Cloudinary, Firebase Admin SDK (FCM).
  - Frontend Client: React, Material UI (MUI), SCSS Modules, Google Fonts, Google Icons (configured for client branch/integration).
- Main architecture: Clean, modular MVC REST API with route-level validation, centralized operational error handling, in-memory test harness, and strict role-based access control.
- Important conventions:
  - Single source of truth is `project.md`.
  - Always read `project.md` before making changes and update it immediately after any change.
  - Passwords and sensitive secrets are never logged or returned in API responses.
  - Client-supplied user ID or role is never trusted; identity is extracted exclusively from verified JWT tokens.
  - Soft deletion used for companies and holidays to protect referential integrity.
  - Consistent JSON response format: `{ success: true, message: "...", data: { ... } }` and `{ success: false, message: "...", errors: [...] }`.

## Project Structure
- Important folders:
  - `backend/`: Root directory of the REST API backend.
  - `backend/src/config/`: Database (`db.js`), Cloudinary (`cloudinary.js`), and Firebase Admin (`firebase.js`) configurations.
  - `backend/src/models/`: Mongoose data models (`User.js`, `Company.js`, `Duty.js`, `Leave.js`, `Holiday.js`).
  - `backend/src/controllers/`: Business logic handlers for auth, companies, employees, duties, leaves, holidays, dashboard, uploads, notifications.
  - `backend/src/routes/`: Express routers mounted under `/api`.
  - `backend/src/middleware/`: Authentication, authorization, validation, rate limiting, file upload, error handling.
  - `backend/src/services/`: Cloudinary stream upload and FCM push notification services.
  - `backend/src/validators/`: express-validator request rule sets.
  - `backend/src/scripts/`: Secure Admin bootstrapper (`createAdmin.js`).
  - `backend/tests/`: Automated test suite using native Node.js test runner and in-memory MongoDB.
  - `backend/postman/`: Production Postman collection covering all API routes.
- Important files:
  - `project.md`: Single source of truth for project memory.
  - `AGENTS.md`: Mandatory agent operational guidelines.
  - `backend/.env.example`: Template for environment variables.
  - `backend/README.md`: Comprehensive setup, API reference, and Render deployment guide.
  - `backend/src/app.js`: Express application configuration and security middleware.
  - `backend/src/server.js`: Server bootloader and graceful shutdown handler.

## UI & Styling Rules
- MUI usage: Core UI component primitives and theming (for frontend client).
- Google Icons: Material Symbols / Material Icons for UI iconography.
- SCSS Modules: Component-scoped styling (`*.module.scss`) for custom layouts and fine-grained styling.
- Google Fonts: Modern typography imported and configured globally.
- Responsive approach: Mobile-first responsive layouts leveraging MUI breakpoints and SCSS mixins.

## Application Logic
- Authentication:
  - Secure login with email and password via `POST /api/auth/login`.
  - Password hashed using bcryptjs (salt rounds 10) in Mongoose pre-save hook.
  - Passwords excluded by default using `select: false` on Mongoose schema.
  - JWT access tokens (configurable expiration, default `1d`) and refresh tokens (default `7d`).
  - Inactive accounts prevented from authenticating or accessing protected routes.
  - Secure one-time Admin account bootstrapper script (`npm run seed:admin`); no public admin registration.
- Authorization:
  - Two roles: `admin` and `employee`.
  - `authorize(...roles)` middleware enforces permissions on route endpoints.
  - Employees restricted to their own duty reports, profile, and leave requests.
  - Admins have company-wide visibility and approval authorities.
  - Safety check: system prevents deactivating the last active administrator.
- Company Management:
  - Admin CRUD. Duplicate names prevented case-insensitively.
  - Soft deletion protects records referenced by existing duty reports.
  - Employees can only view active companies for submitting duties.
- Duty Work Reports:
  - Employees submit daily visit reports (`POST /api/duties`) with automatic ownership assignment.
  - Validation ensures company is active, coordinates are within legal GPS bounds, and `inTime < outTime` unless overnight shifts are enabled.
  - Edit policy: Employees can only edit reports in `submitted` or `correction_requested` status; approved reports are locked.
  - Comprehensive audit trail array tracks every change, timestamp, and actor.
  - Admin reviews reports and assigns statuses (`approved`, `rejected`, `correction_requested`).
- Customer Proofs & Signatures:
  - Multipart/form-data handled with Multer in-memory storage buffer.
  - Validates MIME types (JPEG, PNG, WebP) and maximum file size (2MB for signature, 5MB for photos).
  - Buffers streamed directly to Cloudinary; only secure URLs and public IDs stored in MongoDB.
- Leave Management:
  - Employees request leave (`POST /api/leaves`).
  - Strict date validation (`endDate >= startDate`).
  - Automatic collision detection prevents overlapping pending or approved leave requests.
  - Admin reviews and sanctions/rejects with optional remarks.
  - Employees can cancel own pending leaves.
- Holiday Management:
  - Admin creates company holidays with date range validations.
  - Prevents duplicate holiday names within the same calendar year.
  - Optional multicast push notification to all employees upon holiday creation.
- Analytics & Dashboards:
  - High-performance database aggregation pipelines via `$match`, `$group`, and `$countDocuments`.
  - Admin dashboard: active counts, today's duties, pending reviews, leave stats, upcoming holidays, recent activity.
  - Employee dashboard: personal profile, today's duties, recent reports, leave balances, upcoming holidays.
- Push Notifications (FCM):
  - Modular integration with Firebase Admin SDK.
  - Graceful fallback: logs and continues seamlessly if FCM credentials are not configured.
  - Prunes expired/unregistered device tokens automatically upon send failures.

## API / Backend Integration
- API endpoints:
  - Health: `GET /api/health`
  - Auth: `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`, `PATCH /api/auth/change-password`, `POST /api/auth/logout`
  - Employees: `POST /api/employees`, `GET /api/employees`, `GET /api/employees/:id`, `PUT /api/employees/:id`, `PATCH /api/employees/:id/status`, `PATCH /api/employees/:id/password`
  - Companies: `POST /api/companies`, `GET /api/companies`, `GET /api/companies/:id`, `PUT /api/companies/:id`, `DELETE /api/companies/:id`
  - Duties: `POST /api/duties`, `GET /api/duties/my`, `GET /api/duties/:id`, `PUT /api/duties/:id`, `GET /api/duties`, `PATCH /api/duties/:id/status`
  - Uploads: `POST /api/uploads/signature`, `POST /api/uploads/proof-photos`, `DELETE /api/uploads/:publicId`
  - Leaves: `POST /api/leaves`, `GET /api/leaves/my`, `GET /api/leaves/:id`, `GET /api/leaves`, `PATCH /api/leaves/:id/review`, `PATCH /api/leaves/:id/cancel`
  - Holidays: `POST /api/holidays`, `GET /api/holidays`, `GET /api/holidays/:id`, `PUT /api/holidays/:id`, `DELETE /api/holidays/:id`
  - Dashboard: `GET /api/dashboard/admin`, `GET /api/dashboard/employee`
  - Notifications: `POST /api/notifications/register-token`, `POST /api/notifications/remove-token`
- Request methods: GET, POST, PUT, PATCH, DELETE.
- Payload structures: JSON payloads for data mutations; multipart/form-data for file uploads.
- Response handling: Standardized wrapper (`ApiResponse`, `ApiError`).
- Authentication requirements: Bearer JWT token in Authorization header.

## Components
### (Frontend Client Component Scaffolding - main branch)
- Location: `src/components/`
- Status: Client-side UI scaffolding will be integrated on frontend client branch.

## Change History

### 2026-10-11
#### Local Environment Setup (.env)
- What was changed: Created `.env` files in both `backend/.env` and root `.env` configured for local MongoDB server (`mongodb://127.0.0.1:27017/vairavan_duty_management`) with secure JWT keys. Enhanced `server.js` and `createAdmin.js` to resolve `.env` across local and parent directories. Bootstrapped initial admin and verified live server startup and login endpoints.
- Files changed: `backend/.env`, `.env`, `backend/src/server.js`, `backend/src/scripts/createAdmin.js`, `project.md`
- Logic changed: Multi-path fallback resolution for dotenv configuration.
- Reason: Resolve missing environment variables on local `npm start`.
- Impact: Server boots seamlessly both from workspace root and inside `backend/` directory.

### 2026-10-11
#### Complete Backend Development — Employee Duty Management System
- What was changed: Built complete, production-ready REST API backend in `backend/` on branch `backend`.
- Files changed:
  - `backend/package.json`: Dependencies, scripts (`start`, `dev`, `seed:admin`, `test`).
  - `backend/.env.example`: Full template of environment variables.
  - `backend/.gitignore`: Ignore node_modules, secrets, env files.
  - `backend/README.md`: Complete architectural guide, API matrix, sample payloads, Render deployment instructions.
  - `backend/src/server.js`: Server listener on `0.0.0.0` with graceful shutdown.
  - `backend/src/app.js`: Express app with Helmet, CORS, general rate limiting, error handlers.
  - `backend/src/config/db.js`, `cloudinary.js`, `firebase.js`: Cloud service and MongoDB configs.
  - `backend/src/models/User.js`, `Company.js`, `Duty.js`, `Leave.js`, `Holiday.js`: 5 Mongoose models with indexes, hooks, and transforms.
  - `backend/src/middleware/authenticate.js`, `authorize.js`, `validate.js`, `errorHandler.js`, `notFound.js`, `upload.js`, `rateLimiter.js`: Security, auth, and upload middleware.
  - `backend/src/services/cloudinaryService.js`, `notificationService.js`: Upload and FCM messaging services.
  - `backend/src/validators/*`: 6 express-validator validation rule files.
  - `backend/src/controllers/*`: 9 modular controllers covering all required business operations.
  - `backend/src/routes/*`: 9 modular route files + main router aggregator with `/health`.
  - `backend/src/scripts/createAdmin.js`: Secure one-time admin bootstrap script.
  - `backend/postman/vairavan-automation-api.postman_collection.json`: Complete Postman collection with test scripts.
  - `backend/tests/*`: 4 test suites covering health, auth, permissions, companies, duty ownership, leave overlap. All 20 tests pass.
- Logic changed: Implemented backend business logic, validation rules, role access control, and database operations.
- Reason: User requested complete, production-oriented backend API development for Employee Duty Management System.
- Impact: Full backend is fully implemented, verified, tested, and ready for deployment to Render Web Services.

### 2026-10-11
#### Initialization
- What was changed: Created root `project.md` tracking file and established project tracking guidelines.
- Files changed: `project.md`, `AGENTS.md`
- Logic changed: Initialized documentation tracking workflow.
- Reason: Project setup and establishing persistent single source of truth for project memory.
- Impact: All future changes, features, decisions, and logic must be documented here.

## Current Progress
- Completed:
  - Initialized repository project tracking file (`project.md`) and rule enforcement (`AGENTS.md`).
  - Complete backend architecture and directory structure (`backend/`).
  - 5 Mongoose models (`User`, `Company`, `Duty`, `Leave`, `Holiday`) with strict schemas, timestamps, indexes, and hooks.
  - Full authentication and role-based authorization system (JWT access + refresh tokens, bcryptjs, login rate limiting).
  - Secure admin bootstrap procedure (`npm run seed:admin`) without public admin signup.
  - Company CRUD with soft-deletion and duty reference protection.
  - Employee administration with pagination, multi-field search, status toggles, and admin password reset.
  - Duty management with GPS coordinates, time validation, status workflows, audit trail, and ownership protection.
  - Cloudinary file uploads for customer signatures and proof photos with buffer streaming.
  - Leave management with start/end date validation, overlap prevention, and admin review workflows.
  - Holiday management with yearly duplicate prevention and employee notifications.
  - Optimized aggregation dashboards for Admin and Employee.
  - Modular Firebase Cloud Messaging (FCM) push notification service with automatic invalid token pruning.
  - Automated test suite (4 suites, 20 tests) with 100% pass rate.
  - Production-ready Postman collection (`backend/postman/vairavan-automation-api.postman_collection.json`).
  - Comprehensive documentation and Render Web Service deployment guide (`backend/README.md`).
- In Progress:
  - Ready for deployment to Render and frontend client API integration.
- Pending:
  - Frontend client UI implementation on client branch.

## Known Issues
- Issue: None. All 20 automated tests pass with 100% success rate.
- Status: Clean state.
- Notes: Backend is completely functional, self-contained, and tested.

## Technical Decisions
- Decision: Use pure JavaScript ES Modules (`"type": "module"`) rather than TypeScript or CommonJS.
  Reason: Strictly adheres to user requirement while utilizing native Node.js 18+ module features.
  Date: 2026-10-11

- Decision: Use `bcryptjs` for password hashing instead of native `bcrypt`.
  Reason: Provides 100% hash compatibility without requiring native C++ build tools on Windows or differing Linux architectures on Render.
  Date: 2026-10-11

- Decision: Memory storage engine for Multer (`multer.memoryStorage()`) combined with Cloudinary stream upload (`upload_stream`).
  Reason: Avoids saving transient temporary image files to disk on serverless/containerized ephemeral file systems like Render.
  Date: 2026-10-11

- Decision: In-memory MongoDB (`mongodb-memory-server`) for automated integration tests.
  Reason: Allows isolated, fully reproducible automated test runs locally and on CI without requiring external network access or an active Atlas database.
  Date: 2026-10-11

- Decision: Soft deletion for companies and holidays (`isDeleted: true`, `status: 'inactive'`).
  Reason: Prevents orphaned records in historical duty logs and preserves service audit integrity.
  Date: 2026-10-11

- Decision: Modular, non-blocking Firebase Admin SDK notification service.
  Reason: Core business transactions (leave requests, duty approvals) must succeed even if FCM credentials are not configured or push delivery encounters network latency.
  Date: 2026-10-11

## Important Notes
- Mandatory Rule: Before making ANY change to the project:
  1. Read `project.md`.
  2. Understand existing implementation, decisions, and pending work.
  3. Check whether the requested change conflicts with anything already documented.
  4. Follow existing conventions.
- After making ANY change:
  - Update `project.md` (Change History, Current Progress, Components, Logic, etc.).
- Never make undocumented changes.
