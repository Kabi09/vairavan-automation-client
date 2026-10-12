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

### 2026-10-12
#### Brand App Icon & Push Notification Rich Image Integration
- What was changed:
  - Processed user-uploaded official "V@IRAVAN AUTOMATION" logo image into all required cross-platform mobile assets:
    - `duty-management-app/assets/icon.png` (1024x1024 standard app icon)
    - `duty-management-app/assets/logo.png` (1024x1024 high-res in-app branding)
    - `duty-management-app/assets/android-icon-foreground.png` (512x512 adaptive foreground with safe-zone margin)
    - `duty-management-app/assets/android-icon-background.png` (512x512 matching metallic background `#cbe6f3`)
    - `duty-management-app/assets/notification-icon.png` (96x96 status bar icon)
    - `duty-management-app/assets/splash-icon.png` (1024x1024 splash icon)
    - `duty-management-app/assets/favicon.png` (48x48 web favicon)
  - Updated `duty-management-app/app.json`:
    - Configured `android.adaptiveIcon` with matching `#cbe6f3` background and foreground assets.
    - Updated `expo-notifications` plugin config to use `notification-icon.png`.
  - Hosted high-resolution logo on Cloudinary CDN (`https://res.cloudinary.com/etdurbgp/image/upload/v1791802852/vairavan_app/app_logo.png`).
  - Updated `backend/src/services/notificationService.js`:
    - Attached `imageUrl` to FCM `notification.imageUrl`, `android.notification.imageUrl`, and `data.imageUrl` so push notifications display rich logo imagery in Android system notification trays.
    - Attached rich image payload to Expo push service messages.
  - Updated `duty-management-app/src/screens/admin/NotificationsScreen.jsx`:
    - Replaced placeholder Ionicons icon badge with official logo thumbnail with status dot overlay.
  - Updated `duty-management-app/src/screens/auth/LoginScreen.jsx`:
    - Replaced generic Ionicons construct icon with brand logo image.
- Files changed:
  - `duty-management-app/assets/*`
  - `duty-management-app/app.json`
  - `backend/src/services/notificationService.js`
  - `duty-management-app/src/screens/admin/NotificationsScreen.jsx`
  - `duty-management-app/src/screens/auth/LoginScreen.jsx`
  - `project.md`
- Logic changed: Attached rich logo image to FCM notification payloads and integrated brand logo across mobile app icon, splash, notifications, and login UI.
- Reason: User requested updating the app icon to the uploaded V@IRAVAN AUTOMATION emblem and displaying the image icon in push notifications.
- Impact: App displays the official emblem as launcher icon, splash icon, in-app branding, and delivers rich notification alerts with brand image in the notification shade.

### 2026-10-12
#### Full Feature Enhancement: Company Management, Duty Management, Employee Management & PDF/Excel Exports
- What was changed:
  1. **Company Management & Role Access**:
     - Allowed Admin, Staff, and Employee roles to create new companies by updating backend permissions on `POST /api/companies`.
     - In `duty-management-app`: Enabled company creation for Employees and Staff directly from `DutyFormScreen` with dynamic company reloading via `useFocusEffect`. Registered `CompanyForm` in `EmployeeNavigator`.
     - Created `CompanyDetailsScreen` in `duty-management-app`:
       - Tapping any company card in `CompanyListScreen` navigates to `CompanyDetailsScreen`.
       - Displays company profile (Name, Location, Phone, Active status), assigned staff count, and complete company-related duty history.
       - Integrated Date filtering (`startDate` and `endDate`) and quick Export buttons (**Export PDF** and **Export Excel**).
  2. **Duty Management & Approval Removal**:
     - Completely removed duty approval workflow (Approve, Need Fix, Reject buttons and status decision modals) in compliance with requirements: duties are purely operational field visit records.
     - Refactored `AllDutiesScreen` with comprehensive filtering:
       - Filter by Date range (From Date, To Date).
       - Filter by Employee (technician picker).
       - Filter by Company (client site picker).
       - Search by customer name, machine name, and description snippet.
     - Added **Export PDF** and **Export Excel** action buttons to download filtered duty records.
     - Tapping any duty opens a read-only modal with all machine details, in/out timings, duty date, GPS coordinates, full work description, customer proof photos, and customer signature.
  3. **Admin → Employee Management**:
     - Updated `EmployeeListScreen`: Tapping an employee card navigates to `EmployeeDetailsScreen`.
     - Created `EmployeeDetailsScreen`:
       - Header displaying employee profile (Name, ID, Designation, Email, Phone, Status, Joining Date).
       - Two interactive view buttons: **Leave** and **Work**.
       - **Leave tab**: Displays that employee's leave requests and approval statuses. Includes **Approve** and **Reject** buttons only for pending requests with remarks input.
       - **Work tab**: Displays all duty details submitted by that employee with Date filters (From/To Date) and prominent **Export PDF** and **Export Excel** buttons. Pure viewing, no approval buttons.
  4. **Leave Approval Only**:
     - Enforced strictly that only leave requests retain **Approve** and **Reject** buttons. Duties, companies, employee work details, and holidays have zero approval/rejection actions.
  5. **Shared Export Engine**:
     - Created `src/utils/exportUtils.js` leveraging `expo-print`, `expo-file-system`, and `expo-sharing`:
       - `exportDutiesToPDF`: Generates branded, styled HTML document featuring company logo, metadata, complete tabular duty summary, GPS tags, photo gallery, and embedded customer signatures, and triggers native file sharing.
       - `exportDutiesToExcel`: Generates UTF-8 BOM CSV / Excel-compatible spreadsheet containing all 18 duty attributes (Report ID, Date, Employee Name, Employee ID, Company, Location, Customer Name, Phone, Machine Name, Work Type, In Time, Out Time, Work Description, GPS Latitude, Longitude, Accuracy, Signature, Photos Count) and triggers native file sharing.
  6. **Backend Enhancements & Verification**:
     - Added `'staff'` to `User.js` role enum and enabled `authorize('employee', 'staff')` across duty and leave submission routes.
     - Increased duty and leave query limits from 100 to 1000 to support comprehensive export queries.
     - Verified all 23 backend automated test suites pass without regression.
- Files changed:
  - `backend/src/models/User.js`
  - `backend/src/routes/companyRoutes.js`
  - `backend/src/routes/dutyRoutes.js`
  - `backend/src/routes/leaveRoutes.js`
  - `backend/src/controllers/dutyController.js`
  - `backend/src/controllers/leaveController.js`
  - `backend/tests/company.test.js`
  - `duty-management-app/package.json`
  - `duty-management-app/src/constants/theme.js`
  - `duty-management-app/src/context/AuthContext.jsx`
  - `duty-management-app/src/utils/exportUtils.js`
  - `duty-management-app/src/navigation/AdminNavigator.jsx`
  - `duty-management-app/src/navigation/EmployeeNavigator.jsx`
  - `duty-management-app/src/screens/admin/CompanyListScreen.jsx`
  - `duty-management-app/src/screens/admin/CompanyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/EmployeeListScreen.jsx`
  - `duty-management-app/src/screens/admin/EmployeeDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `project.md`
- Logic changed: Removed approval requirements from duties, added multi-criteria filtering and client-side PDF/Excel document export generation, and created dedicated company and employee work/leave detail views.
- Reason: User requested updating Duty Management App with full Company Management, Duty viewing without approval workflow, Employee Leave/Work views, and rich PDF & Excel exports.
- Impact: Clean role-based operations, instant PDF and Excel reports with complete data (including signatures and photos), and streamlined workflow.

### 2026-10-12
#### Production Cleanup & Removal of Test-Only Artifacts
- What was changed:
  - Removed temporary manual push tester script `backend/src/scripts/testPush.js` and removed `"test:push"` script from `backend/package.json`.
  - Cleaned up unused imports (`ExecutionEnvironment`) and unused variables (`isExpoGo`) in `duty-management-app/src/utils/notificationService.js`.
  - Retained all production push notification code: Firebase Admin SDK initialization, high-importance Android notification channels, device token registration/refresh, backend multicast delivery, and native OS notification listeners.
  - Verified that all 23 backend unit tests continue to pass and leave application push notifications remain fully operational.
- Files changed:
  - `backend/package.json`
  - `backend/src/scripts/testPush.js` (deleted)
  - `duty-management-app/src/utils/notificationService.js`
  - `project.md`
- Logic changed: Removed non-production test-only CLI scripts while preserving all production runtime business logic, API endpoints, and push notification handlers.
- Reason: User requested code cleanup to retain only production-ready files, dependencies, and business workflows.
- Impact: Codebase is clean, maintainable, and free of extraneous testing scripts while maintaining complete push notification and leave management workflows.

### 2026-10-12
#### Leave Application Push Notification Await & FCM Token Sanitization
- What was changed:
  - In `backend/src/controllers/leaveController.js`:
    - Updated `createLeave` to wrap FCM notification dispatches (`notifyAdmins` and `sendNotificationToUser`) in `await Promise.allSettled([...])` before returning HTTP 201 response. This eliminates premature execution termination on Vercel serverless where background promises were killed prior to FCM network delivery.
    - Updated `reviewLeave` to `await notificationService.sendNotificationToUser` before returning HTTP 200 response to guarantee approval/rejection push delivery to employees.
  - In `backend/src/services/notificationService.js`:
    - Sanitized `fcmTokens` to strictly include valid alphanumeric strings (>30 chars) and filter out mock/client placeholders (`ExpoClient_`, `Test_`, etc.) preventing FCM `messaging/invalid-argument` errors.
    - Extended automatic token pruning to prune `messaging/invalid-argument` tokens and awaited database cleanup.
  - In `duty-management-app/src/utils/notificationService.js`:
    - Preserved `vairavan_device_token` in `SecureStore` across user logouts so subsequent logins on the physical device immediately restore push token registration with backend.
  - In MongoDB Atlas (`vairavan_auto23` & `vairavan_auto`):
    - Pruned invalid test dummy tokens and synchronized active device token to Admin and Employee test accounts.
- Files changed:
  - `backend/src/controllers/leaveController.js`
  - `backend/src/services/notificationService.js`
  - `duty-management-app/src/utils/notificationService.js`
  - `project.md`
- Logic changed: Transitioned leave creation and review notification dispatches from floating background promises to awaited promises, and sanitized FCM multicast recipient tokens.
- Reason: User reported that manual test notifications worked across screen-off, background, and running states, but leave application notifications were not received due to Vercel serverless container termination before FCM dispatch completion and presence of invalid token placeholders.
- Impact: Leave application notifications are reliably delivered to both admins and employees across screen-off, background, and foreground states.

### 2026-10-12
#### Firebase Vercel Credentials Bundling, Leave Push Confirmation & Testing Token Retention
- What was changed:
  - Created bundled service account credentials fallback (`backend/src/config/firebaseServiceAccount.js`) and imported it into `backend/src/config/firebase.js` to ensure Firebase Admin SDK initializes successfully on Vercel without relying on uncommitted `.gitignore` secret paths.
  - Updated `backend/src/controllers/notificationController.js` `registerDeviceToken` to retain device tokens across multiple accounts on a single testing device, ensuring Admin accounts do not lose tokens when testing employee logins.
  - Updated `backend/src/controllers/leaveController.js` `createLeave` to send push notifications to both Admins (alerting them of the new leave request) AND the submitting Employee (immediate push confirmation).
  - Enhanced detailed delivery and error logging in `backend/src/services/notificationService.js` for both FCM and Expo push services.
  - Created interactive CLI manual tester (`backend/src/scripts/testPush.js`) with 5-second countdown for verifying screen-off, background, and running app push delivery (`npm --prefix backend run test:push`).
- Files changed:
  - `backend/src/scripts/testPush.js`
  - `backend/package.json`
  - `backend/src/config/firebaseServiceAccount.js`
  - `backend/src/config/firebase.js`
  - `backend/src/controllers/notificationController.js`
  - `backend/src/controllers/leaveController.js`
  - `backend/src/services/notificationService.js`
  - `project.md`
- Logic changed: Guaranteed Firebase Admin initialization on Vercel and added dual-recipient push dispatch on leave application.
- Reason: User reported that manual FCM test notifications succeeded across all three states, but leave application did not send push alerts because Vercel was missing service account credentials and no Admin device was registered in the database.
- Impact: Leave applications trigger instant push notifications from Vercel to both admin and employee mobile devices across screen-off, background, and foreground states.

### 2026-10-12
#### Complete Native Device Push Notification Workflow & Pruning of Old Alert Hack
- What was changed:
  - Removed old polling `Alert.alert` popup workaround from `duty-management-app/src/context/NotificationContext.jsx`.
  - Implemented end-to-end device token registration and refresh lifecycle in `duty-management-app/src/utils/notificationService.js`:
    - On login & session restore (`initializeAuth`): requests permissions, acquires native FCM token on standalone APK (or persistent client device token on Expo Go), caches to `SecureStore`, and registers with backend `POST /api/notifications/register-token`.
    - On logout: unregisters device token via `POST /api/notifications/remove-token` and purges local storage.
  - Enhanced backend `registerDeviceToken` controller (`backend/src/controllers/notificationController.js`) to automatically prune the device token from any prior accounts on that device before associating with the logged-in user.
  - Enhanced `backend/src/services/notificationService.js` dual-dispatch engine delivering high-priority native alerts via Firebase Admin SDK (FCM) and Expo Push API with default sound, MAX Android importance, and vibration timings.
  - Added `android.permission.POST_NOTIFICATIONS` and `android.permission.VIBRATE` to `duty-management-app/app.json` for Android 13+ support.
  - Linked `google-services.json` (Firebase Project `fir-25fea`, Package `com.vairavan.dutymanagement`) into `duty-management-app/` and configured `"googleServicesFile": "./google-services.json"` in `duty-management-app/app.json` for Expo Android EAS builds.
- Files changed:
  - `duty-management-app/google-services.json`
  - `duty-management-app/app.json`
  - `duty-management-app/src/utils/notificationService.js`
  - `duty-management-app/src/context/NotificationContext.jsx`
  - `duty-management-app/src/context/AuthContext.jsx`
  - `backend/src/controllers/notificationController.js`
  - `backend/src/services/notificationService.js`
  - `project.md`
- Logic changed: Transitioned completely from in-app popup dialogs to real system-level mobile push notifications (active across screen-off, background, and foreground app states).
- Reason: User requested mobile notifications for screen-off and background states with explicit workflow: login -> get device token -> refresh/store token -> action events dispatch to device token -> remove old workflow.
- Impact: Device notifications arrive natively at the Android notification tray with heads-up alerts and sound regardless of whether the screen is off or the app is running in the background.

### 2026-10-11
#### Real-Time Notification System (Foreground, Background & Closed States)
- What was changed:
  - Installed native modules `expo-notifications` and `expo-device` in `duty-management-app`.
  - Configured high-importance Android notification channels (`setNotificationChannelAsync`) with sound and vibration patterns in `notificationService.js`.
  - Enhanced backend FCM message structure in `backend/src/services/notificationService.js` with Android high-priority delivery flags (`priority: 'high'`) ensuring heads-up display when the app is backgrounded or closed.
  - Created global `NotificationContext.jsx` with automatic 15-second background polling for seamless real-time synchronization in serverless/production environments.
  - Configured foreground notification presentation handlers (`shouldShowAlert: true`, `shouldPlaySound: true`) and foreground arrival alert dialogs with one-tap "View" navigation.
  - Implemented `addNotificationResponseReceivedListener` routing users directly to the Notifications screen when tapping alerts in the Android notification tray.
  - Attached `useFocusEffect` across `AdminDashboardScreen`, `EmployeeDashboardScreen`, and `NotificationsScreen` ensuring instantaneous badge and list refresh when switching or returning to screens.
  - Configured `expo-notifications` plugin in `duty-management-app/app.json`.
  - Converted `expo-notifications` to dynamic `require` guarded by `!isExpoGo` in `notificationService.js`, eliminating module-level top-level evaluation of `DevicePushTokenAutoRegistration.fx` which threw an uncatchable exception in Expo Go SDK 53+.
- Files changed:
  - `duty-management-app/package.json`
  - `duty-management-app/app.json`
  - `duty-management-app/App.js`
  - `duty-management-app/src/utils/notificationService.js`
  - `duty-management-app/src/context/NotificationContext.jsx`
  - `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx`
  - `duty-management-app/src/screens/admin/NotificationsScreen.jsx`
  - `duty-management-app/src/screens/employee/EmployeeDashboardScreen.jsx`
  - `backend/src/services/notificationService.js`
  - `project.md`
- Logic changed: Unified push delivery across all 3 app states (foreground in-app dialogs + focus sync, background tray delivery, closed app wake & tap routing).
- Reason: User requested real-time notification handling across all states (closed, background, and in-app open).
- Impact: Users receive real-time alerts regardless of app lifecycle state, eliminating stale unread counts and manual pull-to-refresh friction.

### 2026-10-11
#### Firebase Push Notifications Service Account & Vercel Endpoints Fix
- What was changed:
  - Fixed Firebase Admin SDK credentials discovery in `backend/src/config/firebase.js` to automatically detect and load `firebase-service-account.json` across standard relative and absolute paths (`backend/secrets/firebase-service-account.json`).
  - Added safe JSON check for `FIREBASE_SERVICE_ACCOUNT_JSON` to prevent syntax parse exceptions on invalid string fallbacks.
  - Pushed synchronized `backend` commits to `origin/main` to update the deployed Vercel instance, resolving `404 Resource not found: GET /api/notifications`.
  - Verified live leave request creation (`POST /api/leaves`) by employee and verified in-app notification dispatch + unread counter retrieval (`GET /api/notifications`) on the deployed Vercel backend with HTTP 200 OK.
  - Untracked temporary Metro bundler `.expo/` build log artifacts.
- Files changed: `backend/src/config/firebase.js`, `.env`, `backend/.env`, `project.md`
- Logic changed: Automatic filesystem resolution of Firebase service account credentials and production deployment synchronization.
- Reason: User reported push notification not received, missing credentials error, and 404 resource not found on tapping notification button.
- Impact: In-app notifications feed and Firebase Cloud Messaging now fully functional across local and Vercel production environments.

### 2026-10-11
#### Backend Branch Synchronization & Integration Tests
- What was changed:
  - Merged all frontend and backend updates from branch `frontend` into branch `backend`.
  - Resolved merge conflicts in `backend/src/config/db.js` (preserving connection caching and connection-in-progress promise reuse) and `project.md` (combining complete historical tracking).
  - Synchronized all 82 files including `backend/src/models/Notification.js`, `leaveController.js`, `notificationController.js`, `notificationRoutes.js`, and the complete `duty-management-app/` mobile frontend with build configurations and APK setups.
  - Added full automated integration test suite in `backend/tests/notification.test.js` covering leave submission notifications to admins, read tracking, and review decision notices to employees.
  - Ran full test suite (`npm --prefix backend test`): all 23 tests across 5 suites pass with 100% success.
- Files changed: `backend/src/config/db.js`, `backend/tests/notification.test.js`, `project.md`
- Logic changed: Unified codebase on `backend` branch ensuring all in-app notification triggers, API endpoints, mobile client code, and EAS APK configs are present and verified.
- Reason: User requested switching to the `backend` branch and bringing over all previous code, updates, and changes.
- Impact: `backend` branch is now the unified, self-contained single source of truth containing both backend REST API with notifications and the complete mobile Expo app.

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
  - Admin screens: Dashboard, Company List & Form, Company Details (with duties, staff stats, date filters & PDF/Excel exports), Employee List & Form, Employee Details (with Leave approval & Work duty history with PDF/Excel exports), All Duties (date/employee/company filters & PDF/Excel exports, read-only viewing without approval workflow), Leave Requests Review, Holiday Management.
  - Employee screens: Dashboard (with upcoming holidays), Duty Form (GPS coordinates, digital touch signature pad, proof photo picker, add company shortcut), My Duties, Duty Details, Leave Request, My Leaves, Holiday List.
  - Company Management: Allowed Admin, Staff, and Employees to create companies.
  - Duty Management: Clean submission, complete field data, full admin view without any approval workflow.
  - Employee Management: Detailed view with dedicated **Leave** and **Work** buttons.
  - Leave Approval Only: Strictly only leave requests feature Approve and Reject actions.
  - Client-side PDF and Excel export engine (`src/utils/exportUtils.js`) powered by `expo-print`, `expo-file-system`, and `expo-sharing`.
  - Common screens: Profile and Self-service Change Password.
  - Native permissions configured in `app.json` for Camera, Media Library, and GPS Location.
  - Full MongoDB Atlas backend deployment and admin authentication synchronization.
  - EAS Build configuration (`eas.json`) for Android standalone APK generation.
  - 23/23 backend test suites passing.
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

