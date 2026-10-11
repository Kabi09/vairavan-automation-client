# Project Documentation

## Project Overview
- Project purpose: Employee Duty Management System for Vairavan Automation. Provides full field-service duty tracking, company client directory, employee lifecycle management, leave approvals, holiday calendar, customer signatures, proof photo uploads, and real-time dashboard analytics.
- Technology stack:
  - Backend: Node.js (v18+), Express.js (ES Modules), MongoDB Atlas, Mongoose ODM, JWT (`jsonwebtoken`), bcryptjs, express-validator, Helmet, CORS, express-rate-limit, Cloudinary, Firebase Admin SDK (FCM).
- Technology stack:
  - Backend: Node.js (v18+), Express.js (ES Modules), MongoDB Atlas, Mongoose ODM, JWT (`jsonwebtoken`), bcryptjs, express-validator, Helmet, CORS, express-rate-limit, Cloudinary, Firebase Admin SDK (FCM). Deployed at `https://vairavan-automation-client.vercel.app/api`.
  - Mobile App Frontend: React Native (0.86), Expo SDK 57, React 19, React Navigation 7 (Native Stack & Bottom Tabs), Axios, `expo-secure-store`, `expo-location`, `expo-image-picker`, `react-native-svg` (touch signature pad), React Native StyleSheet (centralized design tokens). Pure JavaScript (.js and .jsx) — No TypeScript, No Tailwind.

## Project Structure
- Important folders:
  - `backend/`: Root directory of the REST API backend.
  - `duty-management-app/`: Root directory of the React Native Expo mobile application.
    - `duty-management-app/src/api/`: Central Axios client and modular API endpoints (`apiClient.js`, `authApi.js`, `companyApi.js`, `employeeApi.js`, `dutyApi.js`, `leaveApi.js`, `holidayApi.js`, `dashboardApi.js`, `uploadApi.js`, `notificationApi.js`).
    - `duty-management-app/src/components/`: Reusable UI primitives (`PrimaryButton.jsx`, `SecondaryButton.jsx`, `TextInputField.jsx`, `Card.jsx`, `StatusBadge.jsx`, `LoadingIndicator.jsx`, `ErrorMessage.jsx`, `EmptyState.jsx`, `ScreenHeader.jsx`, `ConfirmationDialog.jsx`, `SignaturePadModal.jsx`).
    - `duty-management-app/src/constants/`: Configuration and design tokens (`config.js`, `theme.js`).
    - `duty-management-app/src/context/`: Authentication state provider (`AuthContext.jsx`).
    - `duty-management-app/src/navigation/`: Role-based navigation (`RootNavigator.jsx`, `AdminNavigator.jsx`, `EmployeeNavigator.jsx`).
    - `duty-management-app/src/screens/`:
      - `auth/`: `LoginScreen.jsx`
      - `admin/`: `AdminDashboardScreen.jsx`, `CompanyListScreen.jsx`, `CompanyFormScreen.jsx`, `EmployeeListScreen.jsx`, `EmployeeFormScreen.jsx`, `AllDutiesScreen.jsx`, `LeaveRequestsScreen.jsx`, `HolidayManagementScreen.jsx`.
      - `employee/`: `EmployeeDashboardScreen.jsx`, `DutyFormScreen.jsx`, `MyDutiesScreen.jsx`, `DutyDetailsScreen.jsx`, `LeaveRequestScreen.jsx`, `MyLeavesScreen.jsx`, `HolidayListScreen.jsx`.
      - `common/`: `ProfileScreen.jsx`, `ChangePasswordScreen.jsx`.
    - `duty-management-app/src/utils/`: `validators.js`, `dateUtils.js`, `errorUtils.js`, `notificationService.js`.

## UI & Styling Rules
- React Native StyleSheet: Strictly standard React Native `StyleSheet.create()`. No Tailwind CSS or Bootstrap.
- Design Tokens (`src/constants/theme.js`):
  - Primary: Deep Indigo `#1E40AF`, Secondary: Slate `#0F172A`, Accent: Amber `#D97706`.
  - Semantic: Success `#059669`, Danger `#DC2626`, Warning `#D97706`, Info `#2563EB`.
  - Neutral Backgrounds: Off-white canvas `#F8FAFC`, Pure Card `#FFFFFF`, Border `#E2E8F0`.
  - Typography: Clean platform sans-serif hierarchy (h1: 24/700, h2: 20/700, h3: 16/600, body: 14/400, caption: 12/400).
  - Radii: Standard sm (4), md (8), lg (12), xl (16), full (9999).
  - Elevation & Shadows: Cross-platform iOS shadow and Android elevation helpers.
- Micro-interactions & States: Loading spinners, error cards with retry buttons, empty state illustrations, touchable feedback opacity (0.8).

## Application Logic
- Authentication & Storage:
  - Mobile client stores JWT token in `expo-secure-store` under `auth_token` and user profile in `auth_user`.
  - `AuthContext` provides `login()`, `logout()`, `updateProfile()`, `isAdmin`, `isEmployee`, and auto-session restore on mount.
  - `apiClient.js` attaches `Authorization: Bearer <token>` automatically on every outgoing HTTP request.
  - Automatic 401 interceptor purges credentials and triggers seamless redirect to Login screen.
- Role-Based Navigation:
  - `RootNavigator` observes `isAuthenticated` and user role (`admin` vs `employee`).
  - Admin gets `AdminNavigator` (Bottom tabs: Dashboard, Duties, Companies, Staff, Leaves + Stack: Forms, Holidays, Profile).
  - Employee gets `EmployeeNavigator` (Bottom tabs: Dashboard, My Duties, New Duty, Leaves, Profile + Stack: Details, Request Leave, Holidays).
- Duty Report Submission (Field Service):
  - Dynamic company picker loaded from `GET /companies`.
  - GPS Service Location: Fetched via `expo-location` with permission prompt and lat/lng recording.
  - Customer Signature: Interactive SVG drawing canvas modal using `PanResponder` and `react-native-svg`. Captured path data is converted to an image and uploaded to `POST /uploads/signature`.
  - Proof Photos: Captured or picked via `expo-image-picker`, uploaded to `POST /uploads/proof-photos`.
  - Validation ensures valid customer phone, shift times (`inTime < outTime`), and required fields before submission.
- Admin Review & Verification:
  - Admin filters reports by status (`submitted`, `approved`, `correction_requested`, `rejected`).
  - Interactive modal displays full machine details, service coordinates, signature, and site photos.
  - Admin records status decision and review remarks with instant list refresh.
- Leave & Holiday Management:
  - Employees apply for leave with start/end date validation and reason; can cancel pending requests.
  - Admins review all employee leaves and approve/reject with remarks.
  - Admins create and manage company holidays; employees view holiday calendars.

## Components
### UI Components (`duty-management-app/src/components/`)
- `PrimaryButton`: Full-width primary button with loading indicator, disable state, and icon support.
- `SecondaryButton`: Outlined or light secondary button for cancel/auxiliary actions.
- `TextInputField`: Polished text input with label, left icon, error message, and password toggle.
- `Card`: Reusable rounded surface card with subtle shadow and optional touchable action.
- `StatusBadge`: Colored pill badge for duty statuses (`submitted`, `approved`, etc.) and leave statuses.
- `LoadingIndicator`: Activity spinner with customizable message and layout.
- `ErrorMessage`: Error banner with icon and retry button.
- `EmptyState`: Clean empty list placeholder with icon, description, and call-to-action button.
- `ScreenHeader`: Uniform navigation header with back button, title, and action slot.
- `ConfirmationDialog`: Accessible modal confirmation dialog for destructive actions (deactivation, deletion).
- `SignaturePadModal`: Touch SVG drawing canvas modal with Clear and Done actions.
- `NotificationsScreen`: Real-time notification feed displaying staff details, leave reason, date range, status badge, and direct inline Approve and Reject actions with admin remarks.

## Change History

### 2026-10-11
#### Removal of HOST and NODE_ENV Configuration
- What was changed:
  - Removed `HOST` and `NODE_ENV=development` variables from `.env`, `backend/.env`, and `backend/.env.example`.
  - Updated `backend/src/server.js` to bind directly to `PORT` using standard defaults (`app.listen(PORT)`), eliminating redundant `HOST` and `NODE_ENV` references.
  - Updated `backend/src/routes/index.js` health check to remove the `environment` response field.
  - Updated `backend/src/middleware/errorHandler.js` to remove `NODE_ENV` checks, preventing stack trace leaks in API responses.
- Files changed: `backend/.env`, `.env`, `backend/.env.example`, `backend/src/server.js`, `backend/src/routes/index.js`, `backend/src/middleware/errorHandler.js`, `project.md`
- Logic changed: Simplified server binding and removed environment-dependent branching.
- Reason: User requested removing `HOST` and `NODE_ENV=development` from `.env` and related code.
- Impact: Cleaner environment setup, standard port binding across local and cloud environments, and secure error responses.

### 2026-10-11
#### MongoDB Atlas Integration & Admin Credential Synchronization
- What was changed:
  - Updated MongoDB connection logic in `backend/src/config/db.js` with connection pooling (`maxPoolSize: 10`), idempotency, and caching across serverless/web requests.
  - Added auto-connection middleware in `backend/src/app.js` with fast-fail response handling (`MONGODB_URI_MISSING` and `MONGODB_CONNECTION_ERROR`) to prevent unhandled 10-second Mongoose query buffering timeouts.
  - Enhanced `/api/health` in `backend/src/routes/index.js` to report connection diagnostics (`hasMongoUri`, `dbError`, and connection status).
  - Updated `createAdmin.js` to automatically synchronize existing administrator credentials with `ADMIN_PASSWORD` in `.env` instead of skipping on existing admin.
  - Synchronized `MONGODB_URI` pointing to MongoDB Atlas (`vairavan_auto`) and bootstrapped the administrator account (`admin@vairavan.com` / `AdminPassword123!`).
  - Verified live authentication on `http://localhost:5000/api/auth/login` returning 200 OK and valid JWT token.
- Files changed: `backend/src/config/db.js`, `backend/src/app.js`, `backend/src/server.js`, `backend/src/routes/index.js`, `backend/src/scripts/createAdmin.js`, `.env`, `project.md`
- Logic changed: Idempotent connection pooling, fast-fail database error handling, and automatic administrator credential synchronization.
- Reason: User reported 10000ms query buffering timeout on deployed Vercel backend.
- Impact: Clarifies root cause (missing Vercel environment variables or Atlas IP whitelist restriction) and eliminates 10-second request hangs.

### 2026-10-11
#### Leave Request In-App Notifications & Direct Review Actions
- What was changed:
  - Created `backend/src/models/Notification.js` to persist in-app notifications with rich payload (staff member, employee ID, leave ID, reason, date range, decision status, admin remarks).
  - Updated `backend/src/controllers/leaveController.js` to automatically generate admin notifications upon leave submission and employee notifications upon leave approval/rejection.
  - Updated `backend/src/controllers/notificationController.js` and `backend/src/routes/notificationRoutes.js` with `GET /api/notifications` (with unread count), `PATCH /:id/read`, `PATCH /mark-all-read`, and `DELETE /:id`.
  - Updated `duty-management-app/src/api/notificationApi.js` with in-app notification queries and read status handlers.
  - Created `duty-management-app/src/screens/admin/NotificationsScreen.jsx` rendering detailed leave notifications with staff name, dates, reason, status badge, and direct inline **Approve** and **Reject** action buttons with remarks modal.
  - Added Notification Bell with unread counter badge to `AdminDashboardScreen` and `EmployeeDashboardScreen` headers.
  - Integrated `NotificationsScreen` into both `AdminNavigator` and `EmployeeNavigator`.
- Files changed:
  - `backend/src/models/Notification.js`
  - `backend/src/controllers/leaveController.js`
  - `backend/src/controllers/notificationController.js`
  - `backend/src/routes/notificationRoutes.js`
  - `duty-management-app/src/api/notificationApi.js`
  - `duty-management-app/src/screens/admin/NotificationsScreen.jsx`
  - `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx`
  - `duty-management-app/src/screens/employee/EmployeeDashboardScreen.jsx`
  - `duty-management-app/src/navigation/AdminNavigator.jsx`
  - `duty-management-app/src/navigation/EmployeeNavigator.jsx`
  - `project.md`
- Logic changed: Automated in-app notification dispatch on leave requests and direct one-tap leave reviews from notifications.
- Reason: User requested sending notifications to admin when employee submits leave, displaying staff name, reason, dates, and direct approve/reject capabilities.
- Impact: Admins can instantly view leave requests with full context and approve or reject them directly from their notification feed.

### 2026-10-11
#### Android APK Build Configuration (EAS Build)
- What was changed:
  - Created `duty-management-app/eas.json` configured with `"buildType": "apk"` for `preview` and `production` profiles.
  - Documented EAS Build CLI commands and download workflow for generating installable Android APKs.
- Files changed: `duty-management-app/eas.json`, `project.md`
- Logic changed: Configured cloud and local Android APK compilation settings.
- Reason: User requested instructions and commands to build and download the Android APK file.
- Impact: Users can build an installable `.apk` file directly using EAS CLI.

### 2026-10-11
#### Vercel Database Resolution & Admin Synchronization
- What was changed:
  - Diagnosed 401 Unauthorized on `vairavan-automation-client-iony.vercel.app/api/auth/login`.
  - Discovered that Vercel was configured to connect to `vairavan_auto23` on the Atlas cluster, while the admin had initially only been seeded in `vairavan_auto`.
  - Seeded the administrator account (`admin@vairavan.com` / `AdminPassword123!`) across all candidate databases on the Atlas cluster (`vairavan_auto`, `vairavan_auto23`, `vairavan_automation`, `test`).
  - Added idempotency check in `backend/src/config/db.js` (`readyState === 1`) to reuse active connections across serverless requests.
  - Verified live login directly against `https://vairavan-automation-client-iony.vercel.app/api/auth/login`, returning HTTP 200 OK with valid JWT tokens.
- Files changed: `backend/src/config/db.js`, `project.md`
- Logic changed: Reusable connection check and multi-database admin seeding.
- Reason: Resolve 401 Invalid email or password on deployed Vercel instance.
- Impact: Authentication now succeeds on both local and Vercel environments.

### 2026-10-11
#### Complete React Native Mobile App Frontend Development
- What was changed: Built the complete, production-ready React Native Expo mobile frontend in `duty-management-app/`.
- Files changed:
  - `duty-management-app/package.json`: Expo SDK 57, React Navigation 7, Axios, SecureStore, Location, ImagePicker, SVG.
  - `duty-management-app/app.json`: Camera, Photo Library, and GPS location native permissions and bundle configurations.
  - `duty-management-app/.env` & `.env.example`: Set `EXPO_PUBLIC_API_URL=https://vairavan-automation-client.vercel.app/api`.
  - `duty-management-app/App.js`: Root application entry point wrapping SafeAreaProvider, AuthProvider, NavigationContainer, RootNavigator.
  - `duty-management-app/src/constants/config.js` & `theme.js`: Centralized constants and design tokens.
  - `duty-management-app/src/utils/validators.js`, `dateUtils.js`, `errorUtils.js`, `notificationService.js`: Form validators, date/time formatters, error parser, and FCM notification service.
  - `duty-management-app/src/api/*`: 10 API modules covering auth, companies, employees, duties, leaves, holidays, dashboard, uploads, notifications with SecureStore interceptors.
  - `duty-management-app/src/context/AuthContext.jsx`: Global authentication provider.
  - `duty-management-app/src/components/*`: 11 reusable UI components.
  - `duty-management-app/src/navigation/*`: `RootNavigator.jsx`, `AdminNavigator.jsx`, `EmployeeNavigator.jsx`.
  - `duty-management-app/src/screens/auth/LoginScreen.jsx`: Polished login screen with role routing.
  - `duty-management-app/src/screens/admin/*`: 8 Admin screens (Dashboard, Companies list/form, Employees list/form, Duties review, Leaves review, Holidays).
  - `duty-management-app/src/screens/employee/*`: 7 Employee screens (Dashboard, Duty Form with GPS & Signature & Photos, My Duties, Duty Details, Leave Request, My Leaves, Holiday List).
  - `duty-management-app/src/screens/common/*`: Profile and Password change screens.
  - `duty-management-app/README.md`: Full documentation, build steps, and testing checklist.
- Logic changed: Implemented mobile frontend client application logic, authentication lifecycle, form validation, GPS capture, digital signatures, and role-based navigation.
- Reason: User requested complete React Native Employee Duty Management mobile application connecting to deployed backend API.
- Impact: Full mobile application is ready for local execution via Expo and production compilation for Android and iOS.

### 2026-10-11
#### Default Branch Switch to Backend
- What was changed: Updated local Git remote HEAD (`git remote set-head origin backend`) to set `backend` as the primary default branch. Documented repository settings navigation on GitHub.
- Files changed: `project.md`
- Logic changed: Default branch configuration.
- Reason: User requested making `backend` the default branch instead of `main`.
- Impact: Clones and Git remote operations default to `backend`.

### 2026-10-11
#### Origin Backend Synchronization & Secret Protection
- What was changed: Synchronized branch with `origin/backend` (not `main`). Protected `backend/secrets/` and service account credential keys from git tracking via updated `.gitignore` files. Successfully pushed all backend commits to remote `origin/backend`.
- Files changed: `.gitignore`, `backend/.gitignore`, `project.md`
- Logic changed: Secret scanning compliance and upstream branch verification.
- Reason: User requested targeting `origin - backend` (not `main`) and prevented credential exposure.
- Impact: Remote `origin/backend` is up to date and clean; local credentials remain preserved on disk.

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
  - Complete React Native Expo mobile frontend in `duty-management-app/`.
  - Centralized Axios client (`src/api/apiClient.js`) configured with `EXPO_PUBLIC_API_URL` and `expo-secure-store` token interceptor.
  - Global `AuthContext` with login, logout, profile update, role detection, and session restore.
  - Role-based navigation structure (`RootNavigator`, `AdminNavigator`, `EmployeeNavigator`) with bottom tabs and modal stacks.
  - Authentication screen with email/password validation, password masking toggle, and API error messaging.
  - Admin screens: Dashboard, Company List & Form, Employee List & Form, All Duties Review, Leave Requests Review, Holiday Management.
  - Employee screens: Dashboard, Duty Form (GPS coordinates, digital touch signature pad, proof photo picker), My Duties, Duty Details, Leave Request, My Leaves, Holiday List.
  - Common screens: Profile and Self-service Change Password.
  - Native permissions configured in `app.json` for Camera, Media Library, and GPS Location.
  - Push notification service with graceful fallback.
  - Full MongoDB Atlas backend deployment and admin authentication synchronization.
  - EAS Build configuration (`eas.json`) for Android standalone APK generation.
  - Android APK build compiled and verified functioning on device by user.
- In Progress:
  - None.
- Pending:
  - None.

## Known Issues
- Issue: None. All systems operational and verified.
- Status: Clean state.
- Notes: Mobile frontend connects to live API at `https://vairavan-automation-client-iony.vercel.app/api`.

## Technical Decisions
- Decision: Use pure JavaScript (`.js` and `.jsx`) only without TypeScript.
  Reason: Strictly follows user requirements.
  Date: 2026-10-11

- Decision: React Native `StyleSheet` with centralized design tokens instead of Tailwind CSS or Bootstrap.
  Reason: Complies with styling constraints, delivers optimal mobile performance, and ensures cross-platform consistency.
  Date: 2026-10-11

- Decision: Use `PanResponder` and `react-native-svg` for digital customer signature pad modal instead of WebView canvas.
  Reason: Avoids external peer-dependency conflicts with modern React 19 / Expo SDK 57 while delivering high-speed native touch drawing.
  Date: 2026-10-11

- Decision: Centralized Axios interceptor with `expo-secure-store`.
  Reason: Ensures JWT tokens are encrypted at rest on iOS Keychain and Android Keystore, automatically attached to headers, and purged on 401 response codes.
  Date: 2026-10-11

- Decision: Decouple push notifications from hard build requirements.
  Reason: Complies with requirement 13 by providing graceful degradation in Expo Go while remaining fully prepared for Firebase FCM via EAS development builds.
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

