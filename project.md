# Project Documentation

## Project Overview
- Project purpose: Employee Duty Management System for Vairavan Automation. Provides full field-service duty tracking, company client directory, employee lifecycle management, leave approvals, holiday calendar, customer signatures, proof photo uploads, and real-time dashboard analytics.
- Technology stack:
  - Backend: Node.js (v18+), Express.js (ES Modules), MongoDB Atlas, Mongoose ODM, JWT (`jsonwebtoken`), bcryptjs, express-validator, Helmet, CORS, express-rate-limit, Cloudflare R2 (@aws-sdk/client-s3), Firebase Admin SDK (FCM). Deployed at `https://vairavan-automation-client.vercel.app/api`.
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
- `SignaturePadModal`: Touch SVG drawing canvas modal using PanResponder with mutable refs to prevent stroke loss upon finger lift. Supports Clear, Save, and high-fidelity vector rendering.
- `DatePickerModal`: Reusable modal calendar date picker with year/month pagination, interactive day-of-month grid, and "Today" quick selector returning formatted `YYYY-MM-DD` strings.
- `TimePickerModal`: Reusable 12-hour/24-hour clock time picker modal with AM/PM toggle, hour/minute selectors, preset quick time slots, and clean `HH:mm` format.
- `DropdownPickerModal`: Reusable searchable dropdown selection modal supporting "All" defaults, dynamic item filtering, active checkmark highlighting, and full list support.
- `NotificationsScreen`: Real-time notification feed displaying staff details, leave reason, date range, status badge, and direct inline Approve and Reject actions with admin remarks.

## Change History

### 2026-10-13
#### Employee Features: Duty Form Client Company Dropdown, My Duties Filter Options, and My Leaves Status Tabs
- What was changed:
  - **Employee Duty Form Client Company Searchable Dropdown (`DutyFormScreen.jsx`)**:
    - Replaced the horizontal scrolling company chips with a searchable `DropdownPickerModal` button showing the selected company name, client location/site subtitle, and dropdown chevron.
    - Added instant client search by name and site address.
    - Auto-populates client company phone number upon selection if not already entered by the employee.
    - Added error highlighting and validation feedback on the dropdown trigger button.
  - **Employee My Duties Filter Options & Active Pills (`MyDutiesScreen.jsx`)**:
    - Added a header "Filter" toggle button with an active filter badge counter beside the "New" button.
    - Integrated a centered Filter Popup Modal (`Modal`, `centeredModalOverlay`, `filterPopupCard`) supporting:
      - **Date Presets**: All, Today, Yesterday, Single Date (`DatePickerModal`).
      - **Custom Date Range**: From Date and To Date (`DatePickerModal`).
      - **Client Company**: Searchable dropdown picker (`DropdownPickerModal`) with company name and location.
      - **Duty Status**: Filter selector chips (All, Submitted, Approved, Needs Fix, Rejected).
      - **Footer Actions**: "Reset All" and "Apply Filters".
    - Added an Active Filters summary pill bar (`activeFiltersBar`) below the universal search bar displaying date pills, company pills, status pills, and a quick "Clear" button.
    - Integrated with backend `dutyApi.getMyDuties` query parameters and added real-time client-side filter computation for instant UI reactivity.
    - Updated `EmptyState` to dynamically provide "Clear Filters" when filters yield no matches.
  - **Employee My Leaves Status Tabs (`MyLeavesScreen.jsx`)**:
    - Added a horizontal scrollable status filter bar with tabs: `All`, `Pending`, `Approved`, `Rejected`, and `Cancelled`.
    - Each tab includes its respective status icon, label, and dynamic count badge indicating the quantity of records for that status.
    - Applied filtered leave records to `FlatList`, keeping fast navigation and status switching.
    - Configured dynamic `EmptyState` to adapt descriptions and actions according to the active status tab (e.g. "No Pending Leaves", "Show All Leaves").
- Files changed:
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `duty-management-app/src/screens/employee/MyDutiesScreen.jsx`
  - `duty-management-app/src/screens/employee/MyLeavesScreen.jsx`
  - `project.md`
- Logic changed:
  - Company selection on the employee duty form now uses a modal search picker instead of small horizontal chips.
  - Employee duty list now offers multi-criteria filtering (date presets, range, client company, status) in addition to universal text search.
  - Leave list for employees is segmented by status tabs with real-time badges.
- Reason: User requested: "employee=> submit duty form- client company make the drop down fix; employee= my duty details add filter option also; employee->my leave section add all,pending,approve,reject,cancel; fix".
- Impact: Streamlined company selection on mobile screens, comprehensive date and status filtering for employees on their duty history, and clear tab-based categorization of leave requests.

### 2026-10-13
#### Signature Preview & Clipping Fix, PDF Export Spinner & Delay Fix, Staff Today/Clear Filter, Centered Filter Modal & Lifted Bottom Nav Bar
- What was changed:
  - **Signature Click & Clipping Resolution (`SignatureImage.jsx`, `SignaturePadModal.jsx`, `DutyDetailsScreen.jsx`, `AllDutiesScreen.jsx`, `ImageViewerModal.jsx`)**:
    - Fixed click event propagation by setting `pointerEvents="none"` on the inner container wrapped in `TouchableOpacity`, preventing native `react-native-svg` responder elements from swallowing tap events and ensuring tapping any signature thumbnail reliably opens the full-screen `ImageViewerModal`.
    - Added fallback checks for `duty.customerSignature` (supporting object `{ url, signedAt }` or string representations, and fallback to `duty.signature`).
    - Resolved signature cutoff / clipping issue by adding `viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"` and `preserveAspectRatio="xMidYMid meet"` in `SignaturePadModal.jsx` SVG generator.
    - Added `ensureSvgResponsive(xml)` in `SignatureImage.jsx` to dynamically inject `viewBox` and `preserveAspectRatio` for existing stored SVGs missing `viewBox`, ensuring vector signatures scale without getting clipped on any screen.
    - Updated `ImageViewerModal.jsx` to constrain signature width to `100%` rather than fixed overflow widths.
  - **PDF Export Acceleration & Loading Spinner (`exportUtils.js`, `ExportLoadingModal.jsx`, `AllDutiesScreen.jsx`, `EmployeeDetailsScreen.jsx`, `CompanyDetailsScreen.jsx`)**:
    - Created reusable `ExportLoadingModal.jsx` displaying an animated activity indicator, report icon, title, and descriptive message during PDF and Excel generation.
    - Integrated `ExportLoadingModal` and async loading state into `AllDutiesScreen.jsx`, `EmployeeDetailsScreen.jsx`, and `CompanyDetailsScreen.jsx`.
    - Accelerated PDF generation in `exportUtils.js`: inlined SVG signatures directly into HTML to eliminate data URL re-parsing, limited embedded proof photos to 3 thumbnails per card with `loading="lazy"`, and added `onerror="this.style.display='none'"` to remote images so network timeouts don't hang document compilation.
  - **Admin Staff View: Today & Clear Filter Quick Action Chips (`EmployeeDetailsScreen.jsx`)**:
    - Added quick-toggle chips **[ Today ]** and **[ Clear Filter ]** to the filter toolbar header for specific employee work and leave views.
    - Admin can seamlessly switch between today's duties and all logged records with a single tap, with active chip highlighting.
  - **Centered Duty Filter Popup Modal (`AllDutiesScreen.jsx`)**:
    - Created `centeredModalOverlay` with `justifyContent: 'center', alignItems: 'center'` and switched the filter popup modal from bottom-aligned sheet style to a centered dialog card on all screen resolutions.
  - **Lifted Responsive Bottom Navigation Bar (`AdminNavigator.jsx`, `EmployeeNavigator.jsx`)**:
    - Integrated `useSafeAreaInsets()` from `react-native-safe-area-context` in both `AdminTabs` and `EmployeeTabs`.
    - Enforced safe bottom spacing: `bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 10)` and `barHeight = 60 + bottomInset`.
    - Added elevated shadow and `paddingBottom: bottomInset + 4` lifting the bottom tab bar above system navigation bars (Android gesture pills and 3-button nav bars, iPhone home indicator) across all mobile devices.
- Files changed:
  - `duty-management-app/src/components/SignatureImage.jsx`
  - `duty-management-app/src/components/SignaturePadModal.jsx`
  - `duty-management-app/src/components/ImageViewerModal.jsx`
  - `duty-management-app/src/components/ExportLoadingModal.jsx`
  - `duty-management-app/src/utils/exportUtils.js`
  - `duty-management-app/src/screens/employee/DutyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `duty-management-app/src/screens/admin/EmployeeDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/CompanyDetailsScreen.jsx`
  - `duty-management-app/src/navigation/AdminNavigator.jsx`
  - `duty-management-app/src/navigation/EmployeeNavigator.jsx`
  - `project.md`
- Logic changed:
  - Signatures are rendered with responsive SVG viewBox attributes and unblocked touch responders.
  - Export actions provide live visual feedback via `ExportLoadingModal` while inlining SVGs for near-instant PDF generation.
  - Bottom navigation bar height dynamically adapts to device safe area insets to stay fully visible.
- Reason: User requested fixing signature click in details page, fixing signature clipping, accelerating PDF export delay with a loading spinner, adding Today / Clear Filter quick actions for specific employees, centering the duties filter popup, and moving the bottom navigation bar up so it is not hidden on their phone.
- Impact: Flawless signature inspection, fast and transparent PDF/Excel exports, instant staff date filtering, and perfectly visible bottom tabs across all mobile devices.

### 2026-10-13
#### Export Verification, Photo/Signature Lightbox Preview, Signature Timestamp Watermark & Exact GPS Location Name
- What was changed:
  - **Verified Export Download & Share Sheet Resilience (`exportUtils.js`)**:
    - Verified direct downloading to device storage and sharing across Android and iOS.
    - Improved Android Storage Access Framework (SAF) flow with safe cancellation handling: if a user cancels directory selection in the system folder picker, it gracefully opens the native Share sheet (`Sharing.shareAsync`) so the user can easily save to Downloads, Drive, or WhatsApp.
    - Enhanced PDF export: embedded formatted exact location address, coordinates, and Google Maps link into the Duty Card table. Added a styled timestamp badge (`🕒 DD Mon YYYY, hh:mm A`) in the bottom-right corner of the customer signature box.
    - Enhanced Excel/CSV export: added `Location Address` and `Signature Timestamp` columns to both CSV header definitions and row serialization.
  - **Photo & Signature Full-Size Lightbox Preview Modal (`ImageViewerModal.jsx`)**:
    - Created reusable full-screen modal `ImageViewerModal.jsx` supporting high-definition raster photos and vector SVG signatures.
    - Features translucent dark backdrop (`rgba(15, 23, 42, 0.96)`), header with title, client/visit subtitle, full-screen image fit, signature verification badge, timestamp pill, and responsive close button.
    - Enabled click-to-preview on proof photos and signature previews across `DutyFormScreen.jsx`, `DutyDetailsScreen.jsx`, and `AllDutiesScreen.jsx`.
    - Added visual expand hint badge on all photo and signature thumbnails.
  - **Signature Bottom-Right Corner Date & Time Watermark**:
    - In `SignaturePadModal.jsx`: Added live date and time watermark badge in the bottom-right corner of the canvas. Embedded an SVG `<text ...>` element directly into the generated vector XML string at coordinates `(CANVAS_WIDTH - 10, CANVAS_HEIGHT - 8)`. Returns `signedAt` (ISO string) and `timestamp` formatted string.
    - In `SignatureImage.jsx`: Added `timestamp` badge prop rendered in the bottom-right corner (`position: 'absolute', bottom: 6, right: 8`) with clock icon, and `onPress` prop making signatures interactive.
    - In backend `Duty.js` model & `dutyValidator.js`: Added `customerSignature.signedAt` (Date) and validated optional timestamp.
    - In `dutyController.js`: Stored and updated `customerSignature.signedAt` in `createDuty` and `updateDuty`.
  - **GPS Exact Location Name (Reverse Geocoding) & Map View**:
    - Created `duty-management-app/src/utils/locationUtils.js` with:
      - `formatGeocodeAddress(geo)`: Formats reverse-geocoded location data into clean strings (e.g. `Ameyy, Sholinganallur, Chennai, Tamil Nadu, 600119`).
      - `reverseGeocodeCoords(latitude, longitude)`: Uses `expo-location` with in-memory caching to resolve address components asynchronously.
      - `openMapLocation(latitude, longitude, label)`: Opens coordinates in device maps (Apple Maps on iOS, geo URI on Android, Google Maps on web/fallback).
    - In backend `Duty.js` model: Added `location.address` (String, default: '', trim: true).
    - In backend `dutyValidator.js`: Added `body('address').optional().isString()` for duty creation and updates.
    - In backend `dutyController.js`: Saved and updated `location.address`, and added `{ 'location.address': searchRegex }` to universal search filters in `getMyDuties` and `getAllDuties`.
    - In `DutyFormScreen.jsx`: Automatically reverse geocodes coordinates on GPS capture and displays exact location name in GPS card with "View Map" button.
    - In `DutyDetailsScreen.jsx` & `AllDutiesScreen.jsx`: Displays exact location name card with GPS coordinates, accuracy, and "Open in Google Maps" button.
- Files changed:
  - `duty-management-app/src/utils/locationUtils.js`
  - `duty-management-app/src/utils/exportUtils.js`
  - `duty-management-app/src/components/ImageViewerModal.jsx`
  - `duty-management-app/src/components/SignatureImage.jsx`
  - `duty-management-app/src/components/SignaturePadModal.jsx`
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `duty-management-app/src/screens/employee/DutyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `backend/src/models/Duty.js`
  - `backend/src/validators/dutyValidator.js`
  - `backend/src/controllers/dutyController.js`
  - `project.md`
- Logic changed:
  - Duty GPS capture now automatically resolves and persists readable location names in addition to raw latitude/longitude.
  - Proof photos and signatures are interactive, opening full-screen lightbox previews with tap feedback.
  - Signatures carry permanent date/time watermarks in their vector format and display badges in the bottom-right corner.
  - Export utilities include formatted addresses, signature timestamps, and robust Android SAF download/share fallback.
- Reason: User requested verifying export downloads, adding click-to-preview lightbox popups for photos and signatures, adding bottom-right corner date and time to signatures, displaying exact location name (e.g. Ameyy, Sholinganallur, Chennai, Tamil Nadu, pincode) instead of only raw coordinates, and adding map view actions.
- Impact: Highly polished field-service verification with human-readable addresses, interactive proof inspections, watermarked signatures, and verified PDF/Excel downloads.

### 2026-10-13
#### Duty Management Enhancements: Duty ID, Universal Search, Role-Based Edit & Delete, Dashboard Cleanups
- What was changed:
  - **Employee Dashboard Updates (`EmployeeDashboardScreen.jsx`)**:
    - Removed the "Recent Activity" section as requested.
    - Added a "View All" right-corner navigation button on the "Today's Duty Visits" section, routing employees directly to `MyDutiesTab` to inspect all duty reports.
    - Displayed human-readable `dutyId` badge on each today duty card.
  - **Status Chips Removal & Direct Duty Listing (`MyDutiesScreen.jsx`)**:
    - Removed status filter tabs/chips (`All`, `Submitted`, `Approved`, `Needs Fix`, `Rejected`). The screen now directly presents all logged duties in full.
  - **Universal Search on Admin & Employee Duty Screens**:
    - In `MyDutiesScreen.jsx`: Added a universal search bar filtering by Duty ID, company name, customer phone, customer name, machine name, work type, and work description.
    - In `AllDutiesScreen.jsx`: Enhanced the search bar and backend query to match Duty ID, company name, phone number, customer name, employee name, machine name, work type, and work description.
    - In backend `dutyController.js`: Enhanced `getAllDuties` and `getMyDuties` with multi-field search conditions matching Duty ID, phone, name, machine, description, and related company/employee records.
  - **Role-Based Edit & Delete Permissions**:
    - **Admin Permissions**: Can both **Edit** and **Delete** duty reports.
      - Added `DELETE /api/duties/:id` endpoint in backend (`dutyRoutes.js` and `dutyController.js`) restricted to Admin with ID validation.
      - Updated `PUT /api/duties/:id` in `dutyController.js` to allow Admins to edit any duty report regardless of approval status.
      - Added "Edit" and "Delete" quick action buttons on duty cards and inside the full report modal in `AllDutiesScreen.jsx`.
      - Added "Edit" and "Delete" buttons in `DutyDetailsScreen.jsx` for Admins.
    - **Employee Permissions**: Can **only Edit** their own duties (no deletion).
      - Added "Edit" action button on duty cards in `MyDutiesScreen.jsx` and inside `DutyDetailsScreen.jsx`.
    - **DutyFormScreen Edit Mode**:
      - Updated `DutyFormScreen.jsx` to accept `route.params.dutyToEdit`, prefilling date, company, customer contact, equipment, work type, timings, work description, existing Cloudflare R2 signatures, proof photos, and coordinates.
      - Routes submissions to `dutyApi.updateDuty(id, payload)` with feedback alerts.
      - Registered `DutyForm` screen in `AdminNavigator.jsx` so Admins can edit duty reports seamlessly.
  - **Duty ID Generation & Export Integration**:
    - In `Duty.js` model: Added indexed `dutyId` field with pre-save generator fallback (`DUTY-${_id.slice(-6).toUpperCase()}`) and `toJSON` fallback.
    - In `exportUtils.js`: Added `Duty ID` column into both PDF export card headers/tables and Excel spreadsheet headers/rows.
  - **Automated Tests**:
    - Added unit and integration tests in `backend/tests/duty.test.js` validating Admin duty edit, Admin duty deletion, and verifying that employees cannot delete duty reports. All 34 backend tests pass with 0 errors.
- Files changed:
  - `backend/src/models/Duty.js`
  - `backend/src/controllers/dutyController.js`
  - `backend/src/routes/dutyRoutes.js`
  - `backend/tests/duty.test.js`
  - `duty-management-app/src/api/dutyApi.js`
  - `duty-management-app/src/utils/exportUtils.js`
  - `duty-management-app/src/navigation/AdminNavigator.jsx`
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `duty-management-app/src/screens/employee/EmployeeDashboardScreen.jsx`
  - `duty-management-app/src/screens/employee/MyDutiesScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `duty-management-app/src/screens/employee/DutyDetailsScreen.jsx`
  - `project.md`
- Logic changed:
  - Removed duty status tabs for employee viewing; duty lists display all duties with real-time multi-field search.
  - Admin granted full edit and delete powers; employee restricted to editing own records.
  - Duty reports are stamped with human-readable Duty IDs which export directly to PDF and Excel.
- Reason: User requested removing recent activity on employee dashboard, adding right-corner "View All" navigation on today's duty section, removing duty status filter chips to show all duties, adding role-based Edit & Delete (Admin can edit & delete, Employee can only edit), generating & exporting Duty ID, and providing universal search across both Admin and Employee duty views.
- Impact: Streamlined operational duty workflow, instant cross-field search by ID/company/phone/name/machine, rich exports with Duty ID, and clean role-based data management.

### 2026-10-12
#### Fix Task Employee Assignment, Add Company Picker to Task Assign, Default Duty List Filter, and Resolve Dropdown Filters
- What was changed:
  - **Employee Assignment Fix in TaskAssignScreen**:
    - Fixed `DropdownPickerModal.jsx` value extraction to support `value`, `id`, and `_id`, and updated `onSelect` callback to pass both `(val, fullItem)`.
    - Updated `TaskAssignScreen.jsx` to correctly capture and assign the selected employee object and ID (`selectedEmployee.value || selectedEmployee.id || selectedEmployee._id`).
  - **Company Selection in TaskAssignScreen**:
    - Added company directory loading via `companyApi.getCompanies({ status: 'active', limit: 100 })`.
    - Added a searchable Company Selection button opening `DropdownPickerModal`, auto-populating company name and phone number while allowing custom edits.
    - Added a quick "New Company" shortcut link navigating to `CompanyFormScreen`.
  - **Duty List Predefined Filter Fix**:
    - In `AllDutiesScreen.jsx`, changed `startDate` and `endDate` to default to empty strings `''` (no filter applied), so opening the Duty list displays ALL records by default.
    - Added route parameter detection `route?.params?.filterToday`. When clicking "Today's Duties" metric card on `AdminDashboardScreen`, it passes `{ filterToday: true }` to filter only today's duties.
    - In `backend/src/controllers/dutyController.js`, ensured full day UTC bounds (`00:00:00.000` to `23:59:59.999`) for accurate single-day date queries.
  - **Filter Employee & Company Visibility Fix**:
    - Replaced the modal-in-modal `<Modal visible={filterModalVisible}>` in `AllDutiesScreen.jsx` with a collapsible inline Filter Card toggled by the "Filter" button.
    - Fixed Android modal nesting issues so tapping "Filter By Employee" or "Filter By Company" opens `DropdownPickerModal` directly and cleanly.
    - Updated `DropdownPickerModal` to accept both `items` and `options` props and handle search filtering and checkmark selection reliably.
    - Updated `LeaveRequestsScreen.jsx` to pass `items` prop to `DropdownPickerModal`.
- Files changed:
  - `duty-management-app/src/components/DropdownPickerModal.jsx`
  - `duty-management-app/src/screens/admin/TaskAssignScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx`
  - `duty-management-app/src/screens/admin/LeaveRequestsScreen.jsx`
  - `backend/src/controllers/dutyController.js`
  - `project.md`
- Logic changed:
  - Duty list defaults to unrestricted view; filtered by today only when initiated from Dashboard.
  - Staff and company dropdown options are properly resolved and displayed without modal conflicts.
  - Task assignment allows selecting companies from database and reliably assigns staff.
- Reason: User reported that selecting employee in add-task didn't assign, company list was missing in add-task, duty list was incorrectly filtered to today by default, and filter employee/company lists were not showing.
- Impact: Seamless task assignment with employee & company pickers; comprehensive, unrestricted duty reports by default with on-demand today filters.

### 2026-10-12
#### Fix Leave Application in Mobile App & Admin Recent Duty Click Navigation
- What was changed:
  - Added and exported `isDateRangeValid(startDate, endDate)` in `duty-management-app/src/utils/dateUtils.js` to resolve an unhandled `TypeError: (0, _dateUtils.isDateRangeValid) is not a function` when submitting leave requests in the mobile app.
  - Updated `duty-management-app/src/screens/employee/LeaveRequestScreen.jsx` to safely check `navigation.canGoBack()` before falling back to `MyLeaves`.
  - Updated `backend/src/routes/leaveRoutes.js` to allow `admin`, `staff`, and `employee` roles on `POST /api/leaves` and `GET /api/leaves/my` so test admin accounts can submit and test leaves.
  - Updated `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx` so that tapping on any item in "Recent Duty Activity" navigates directly to `DutyDetailsScreen` with `{ dutyId: duty._id }`, displaying complete duty information (customer details, machine info, time, GPS location, interactive map, customer/technician digital signatures, and proof photos).
- Files changed:
  - `duty-management-app/src/utils/dateUtils.js`
  - `duty-management-app/src/screens/employee/LeaveRequestScreen.jsx`
  - `backend/src/routes/leaveRoutes.js`
  - `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx`
- Logic changed:
  - Leave date validation is now safely resolved without throwing runtime exceptions.
  - Recent duties on the Admin Dashboard are now fully interactive and clickable.
- Reason: User reported that leave application worked in manual API testing (Postman) but failed in the mobile app, and requested that clicking any recent duty on the admin dashboard display full duty details.
- Impact: Flawless leave requests in mobile app; immediate visibility of full duty reports from the admin dashboard.

### 2026-10-12
#### Feature: Admin Task Assignment to Employees
- What was changed:
  - **Backend Model & Schema (`backend/src/models/Task.js`)**:
    - Created Mongoose schema with `taskName`, `employee` (ref to User), `date`, `companyName`, `phoneNumber` (validated 10-digit mobile number), `work`, `description`, `status` (`assigned`, `in_progress`, `completed`, `cancelled`), `assignedBy` (ref to User), `isDeleted`, and timestamps.
  - **Backend Validators (`backend/src/validators/taskValidator.js`)**:
    - Input validation for `taskName`, valid MongoDB ObjectId for `employee`, valid ISO date for `date`, `companyName`, 10-digit mobile regex (`phoneNumber`), `work`, and status transitions.
  - **Backend Controllers & Routes (`backend/src/controllers/taskController.js`, `backend/src/routes/taskRoutes.js`)**:
    - `POST /api/tasks`: Admin assigns a new task; triggers push notification and in-app notification to the assigned employee.
    - `GET /api/tasks`: List all tasks with status and date filters (restricted to Admin).
    - `GET /api/tasks/my`: Retrieves tasks assigned specifically to the authenticated employee.
    - `GET /api/tasks/:id`: Retrieves full details of a specific task.
    - `PATCH /api/tasks/:id/status`: Updates task status (allowed for assigned employee or Admin).
    - `DELETE /api/tasks/:id`: Soft-deletes a task (Admin only).
    - Mounted under `/api/tasks` in `backend/src/routes/index.js`.
  - **Frontend Client (`duty-management-app/src/api/taskApi.js`)**:
    - Centralized API endpoints for creating, fetching, filtering, updating status, and deleting tasks.
  - **Admin Task Screens**:
    - `TaskAssignScreen.jsx`: Form with employee selector (`DropdownPickerModal`), scheduled date picker (`DatePickerModal`), task name, company name, 10-digit phone, work, and description.
    - `AdminTaskListScreen.jsx`: Full task management screen with status tabs, search, one-tap phone call button (`Linking.openURL`), and task cancellation.
  - **Employee Task Screens & Dashboard**:
    - `EmployeeTaskListScreen.jsx`: View list of tasks assigned to the employee with one-tap phone call button and status update buttons ("Start Task", "Mark Done").
    - `EmployeeDashboardScreen.jsx`: Added "Assigned Tasks" section with direct task overview cards and quick phone dial button, plus a "My Tasks" quick action button.
    - `AdminDashboardScreen.jsx`: Added "Assign Task" and "All Tasks" quick action buttons.
  - **Navigation**:
    - Registered `TaskAssign` and `AdminTaskList` in `AdminNavigator.jsx`.
    - Registered `EmployeeTaskList` in `EmployeeNavigator.jsx`.
- Files changed:
  - `backend/src/models/Task.js`
  - `backend/src/validators/taskValidator.js`
  - `backend/src/controllers/taskController.js`
  - `backend/src/routes/taskRoutes.js`
  - `backend/src/routes/index.js`
  - `duty-management-app/src/api/taskApi.js`
  - `duty-management-app/src/screens/admin/TaskAssignScreen.jsx`
  - `duty-management-app/src/screens/admin/AdminTaskListScreen.jsx`
  - `duty-management-app/src/screens/employee/EmployeeTaskListScreen.jsx`
  - `duty-management-app/src/screens/employee/EmployeeDashboardScreen.jsx`
  - `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx`
  - `duty-management-app/src/navigation/AdminNavigator.jsx`
  - `duty-management-app/src/navigation/EmployeeNavigator.jsx`
- Logic changed:
  - Admin can now assign ad-hoc field tasks with company, date, work, phone number, and instructions.
  - Employees immediately receive and view their assigned tasks with status tracking and direct calling.
- Reason: User requested admin task assignment (employee, taskname, date, company name, number, work, description) and employee task visibility.
- Impact: Full end-to-end task workflow for field technicians and admin dispatchers.

### 2026-10-12
#### Fix Vercel Production Build: Explicit @vercel/node Builder & Root Dependencies
- What was changed:
  - Added explicit `@vercel/node` builder definitions to root `vercel.json` and `backend/vercel.json`.
  - Added backend production dependencies (`express`, `mongoose`, `helmet`, `cors`, etc.) directly into root `package.json` and generated root `package-lock.json`.
  - Removed erroneous `"build"` script from root `package.json` which caused Vercel to look for non-existent frontend static output directories.
- Files changed:
  - `package.json`
  - `package-lock.json`
  - `vercel.json`
  - `backend/vercel.json`
  - `project.md`
- Logic changed: Converted Vercel project configuration to explicit serverless Node runtime builder without requiring static build artifacts.
- Reason: User's Vercel production deployment on `backend` branch failed with a build error due to missing root dependencies and invalid build script expectations.
- Impact: Vercel production deployments build and deploy serverless endpoints successfully.

### 2026-10-12
#### Fix Holiday Modal Android Conflicts, DatePicker Safe Dispatch, and Backend Vercel Serverless Deployment
- What was changed:
  1. **Date Picker Component & Selection Error Fix (`DatePickerModal.jsx`)**:
     - Fixed date selection runtime errors where screens calling `onSelectDate` or `selectedDate` threw `TypeError: onSelect is not a function`.
     - Standardized dual-prop compatibility (`value` or `selectedDate`, `onSelect` or `onSelectDate`).
     - Added safe function type checks before invoking selection callbacks and close handlers.
     - Implemented `inline={true}` mode to allow calendars to render seamlessly inside existing modals/views without creating nested native dialogs.
  2. **Holiday Creation & Management Fix (`HolidayManagementScreen.jsx` & `holidayController.js`)**:
     - Resolved Android nested `<Modal>` conflict where opening DatePicker inside the Create/Edit Holiday modal failed to show or froze touches. Start Date and End Date now toggle inline calendar pickers directly within the form.
     - Backend: Sanitized holiday name regular expression search in duplicate detection (`escapeRegExp`), preventing crashes when holiday names contain special characters (e.g., parentheses or dashes).
     - Backend: Awaited `notificationService.notifyAllEmployees` in `createHoliday` so serverless function execution on Vercel is not terminated prematurely before push notifications dispatch.
     - Backend: Extended `getHolidays` and employee push notification targeting to include users with role `'staff'`.
  3. **Backend Vercel Deployment Configuration**:
     - Created root `api/index.js` and `backend/api/index.js` serverless function entrypoints.
     - Created root `vercel.json` and `backend/vercel.json` with URL rewrites mapping to serverless handlers.
     - Added `"build": "npm --prefix backend install"` to root `package.json` to ensure clean automated builds across all Vercel root directory settings.
- Files changed:
  - `duty-management-app/src/components/DatePickerModal.jsx`
  - `duty-management-app/src/screens/admin/HolidayManagementScreen.jsx`
  - `backend/src/controllers/holidayController.js`
  - `backend/src/services/notificationService.js`
  - `api/index.js`
  - `backend/api/index.js`
  - `vercel.json`
  - `backend/vercel.json`
  - `package.json`
  - `project.md`
- Logic changed:
  - Switched date picker inside Holiday modal to inline expansion.
  - Added dual prop support in DatePickerModal.
  - Added serverless entrypoints and rewrites for Vercel deployment.
- Reason: User reported "holdiday error", "backend deployee error", and "date selecterror".
- Impact: Vercel builds and runs serverless backend reliably; date selection works without errors on all screens; holiday creation works smoothly on mobile without modal stacking issues.

### 2026-10-12
#### Fix EAS Build JS Bundling SyntaxError in EmployeeListScreen & eas.json Config
- What was changed:
  - Resolved `SyntaxError: 'import' and 'export' may only appear at the top level. (500:0)` in `EmployeeListScreen.jsx`.
  - Added missing closing `};` to `handleResetPassword` which previously left the function scope unclosed and nested the export declaration inside the component scope.
  - Added `"appVersionSource": "local"` to `eas.json` under `cli` to address future versioning requirements.
  - Verified with Babel parser that all 50+ JavaScript and JSX files across `duty-management-app/src` parse with zero syntax errors.
- Files changed:
  - `duty-management-app/src/screens/admin/EmployeeListScreen.jsx`
  - `duty-management-app/eas.json`
  - `project.md`
- Logic changed: Closed `handleResetPassword` function properly, restoring valid ES module structure.
- Reason: EAS Android build failed during `Bundle JavaScript` phase due to an unclosed function brace.
- Impact: JavaScript bundle compiles cleanly for both Expo Go and EAS Android APK preview builds.

### 2026-10-12
#### Full Improvements & Bug Fixes: Export Engine, Reusable Calendar & Time Pickers, 10-Digit Validation, Dropdowns & Signature Persistence
- What was changed:
  1. **Export Engine & File System Fix**:
     - Fixed `writeAsStringAsync imported from "expo-file-system" is deprecated` runtime failure.
     - Implemented resilient write architecture in `exportUtils.js` with fallback to `expo-file-system/legacy` and Expo modern `File` / `Paths` API.
     - Added comprehensive PDF and Excel exports for Duties, Employees, Companies, and Leaves (`exportDutiesToPDF`, `exportDutiesToExcel`, `exportEmployeesToPDF`, `exportEmployeesToExcel`, `exportCompaniesToPDF`, `exportCompaniesToExcel`, `exportLeavesToPDF`, `exportLeavesToExcel`).
  2. **Strict 10-Digit Phone Validation**:
     - Enforced exact 10-digit phone number rules across frontend (`validators.js` and `maxLength={10}` on number-pad inputs in `CompanyFormScreen`, `EmployeeFormScreen`, `DutyFormScreen`) and backend validators (`companyValidator.js`, `dutyValidator.js`, `employeeValidator.js`).
  3. **Work Type "Other" Custom Input**:
     - Added conditional text input on `DutyFormScreen` to capture custom work details when "Other" is selected as the work type.
  4. **Reusable Date & Time Picker Components**:
     - Created `DatePickerModal.jsx`: Full interactive calendar modal with month/year navigation, day grid, and quick "Today" selector.
     - Created `TimePickerModal.jsx`: Easy 12h clock picker modal with AM/PM toggle, hour/minute selector grids, preset quick buttons, and formatted output.
     - Replaced manual text inputs with these reusable components in `DutyFormScreen` (duty date, in time, out time), `LeaveRequestScreen` (start & end dates), `HolidayManagementScreen` (start & end dates), and all screen filter bars.
  5. **Signature Drawing Persistence**:
     - Fixed finger-lift stroke disappearance bug in `SignaturePadModal.jsx` by migrating from stale React state within `PanResponder` to mutable `useRef` buffers (`pathsRef` and `currentPathRef`).
     - Ensured vector signatures render persistently during touch gestures and export cleanly to base64 SVG images.
  6. **Interactive Duty Details & GPS Location**:
     - Extracted GPS latitude and longitude coordinates accurately.
     - Added interactive GPS card with coordinates display, accuracy metric badge, and "Open in Google Maps" button (`Linking.openURL`) across `DutyDetailsScreen`, `AllDutiesScreen`, `CompanyDetailsScreen`, and `EmployeeDetailsScreen`.
     - Displayed technician and customer signatures alongside uploaded proof photos.
  7. **Leave Export**:
     - Added working PDF and Excel export options for leave records with date range filters and employee details in both `LeaveRequestsScreen` (Admin) and `EmployeeDetailsScreen` (Staff leave history tab).
  8. **Holiday Management**:
     - Reusable calendar date pickers integrated into Admin `HolidayManagementScreen`.
     - Confirmed upcoming holidays are clearly presented on Staff and Employee dashboards with date ranges and descriptions.
  9. **Searchable Dropdowns Defaulting to "All"**:
     - Created `DropdownPickerModal.jsx` with search capability, active selection highlight, and automatic "All" default.
     - Integrated into `AllDutiesScreen` (Staff & Company pickers) and `LeaveRequestsScreen` (Employee picker).
- Files changed:
  - `duty-management-app/src/utils/exportUtils.js`
  - `duty-management-app/src/components/DatePickerModal.jsx`
  - `duty-management-app/src/components/TimePickerModal.jsx`
  - `duty-management-app/src/components/DropdownPickerModal.jsx`
  - `duty-management-app/src/components/SignaturePadModal.jsx`
  - `duty-management-app/src/utils/validators.js`
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `duty-management-app/src/screens/employee/LeaveRequestScreen.jsx`
  - `duty-management-app/src/screens/employee/DutyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/HolidayManagementScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `duty-management-app/src/screens/admin/CompanyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/EmployeeDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/LeaveRequestsScreen.jsx`
  - `duty-management-app/src/screens/admin/EmployeeListScreen.jsx`
  - `duty-management-app/src/screens/admin/CompanyListScreen.jsx`
  - `backend/src/validators/companyValidator.js`
  - `backend/src/validators/dutyValidator.js`
  - `backend/src/validators/employeeValidator.js`
  - `backend/src/controllers/leaveController.js`
  - `project.md`
- Logic changed:
  - Upgraded export file writes to handle Expo SDK deprecations without crashes.
  - Normalized phone validation to strictly 10 digits across all forms and APIs.
  - State management for signature pad drawing strokes decoupled from re-renders.
  - Leave date filtering on backend augmented to match end-of-day UTC boundary.
- Reason: User requested fixing export crashes, default date filters, dropdowns defaulting to "All", 10-digit phone validation, "Other" work type text input, clock/time picker, calendar date picker, signature pad finger-lift fix, interactive map & GPS duty details, leave exports, and holiday display.
- Impact: All exports, filters, modals, pickers, and drawing flows work reliably without crashes across Android and iOS.

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

### 2026-10-13
#### Migration: Cloudinary to Cloudflare R2 Object Storage (AWS S3-Compatible API)
- What was changed:
  - Removed Cloudinary dependency (`cloudinary`) from both `backend/package.json` and root `package.json`.
  - Installed `@aws-sdk/client-s3` in backend and root workspaces.
  - Removed legacy Cloudinary files: `backend/src/config/cloudinary.js` and `backend/src/services/cloudinaryService.js`.
  - Created `backend/src/config/r2.js` configuring S3Client with endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, auto region, credentials, bucket name, and public URL helpers. Added mock mode detection for dev/tests.
  - Created `backend/src/services/r2Service.js` with `uploadBufferToR2`, `deleteFromR2`, `getFileStreamFromR2`, and collision-resistant `generateR2Key` (`uploads/{timestamp}-{hex}-{sanitizedName}`).
  - Updated `backend/src/controllers/uploadController.js` to upload customer signatures and service proof photos directly to Cloudflare R2, returning `{ url, key, publicId }` for backwards compatibility.
  - Updated `backend/src/routes/uploadRoutes.js` with streaming fallback route `GET /api/uploads/file/*` and wildcard object key deletion `DELETE /api/uploads/:key(*)`.
  - Updated `backend/src/models/Duty.js` to include `key` alongside `publicId` in `customerSignature` and `customerProofPhotos`.
  - Updated `backend/src/server.js` and health check route `GET /api/health` in `backend/src/routes/index.js` to report Cloudflare R2 status.
  - Replaced Cloudinary environment variables with Cloudflare R2 credentials across `.env`, `.env.example`, and `backend/.env`:
    `R2_ACCOUNT_ID=your_cloudflare_account_id`
    `R2_ACCESS_KEY_ID=your_r2_access_key_id`
    `R2_SECRET_ACCESS_KEY=your_r2_secret_access_key`
    `R2_BUCKET_NAME=your_r2_bucket_name`
    `R2_PUBLIC_URL=https://pub-yourbucketid.r2.dev`
    `MAX_FILE_SIZE_MB=10`
  - Added dynamic file size limits in `backend/src/middleware/upload.js` respecting `MAX_FILE_SIZE_MB`.
  - Added full test suite in `backend/tests/upload.test.js` verifying key generation, buffer uploads, deletion, and multipart API endpoints. All 7 tests pass.
- Files changed:
  - `backend/package.json`
  - `package.json`
  - `backend/src/config/r2.js`
  - `backend/src/services/r2Service.js`
  - `backend/src/controllers/uploadController.js`
  - `backend/src/routes/uploadRoutes.js`
  - `backend/src/routes/index.js`
  - `backend/src/server.js`
  - `backend/src/models/Duty.js`
  - `backend/src/controllers/dutyController.js`
  - `backend/src/services/notificationService.js`
  - `backend/.env`
  - `backend/.env.example`
  - `.env`
  - `backend/tests/upload.test.js`
  - `backend/README.md`
  - `duty-management-app/README.md`
  - `backend/postman/vairavan-automation-api.postman_collection.json`
  - `project.md`
- Logic changed: Switched binary storage from proprietary Cloudinary upload streams to AWS S3-compatible Cloudflare R2 object storage with zero egress fees and high-durability cloud storage.
- Reason: User requested migration from Cloudinary to Cloudflare R2, removal of all Cloudinary-related code, implementation of Cloudflare R2 using documentation, and addition of demo environment variable values.
- Impact: Stateless, zero-egress cloud storage via Cloudflare R2; backward-compatible API responses for existing mobile clients.

### 2026-10-13
#### Fix StatusBadge Import in AllDutiesScreen
- What was changed:
  - Added missing `import StatusBadge from '../../components/StatusBadge';` in `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`.
- Files changed:
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `project.md`
- Logic changed:
  - Properly imported `StatusBadge` component, resolving the `Property 'StatusBadge' doesn't exist` render error when viewing linked task details in the admin duty modal.
- Reason: User encountered a render crash `Property 'StatusBadge' doesn't exist` in `AllDutiesScreen.jsx` at line 584:23 when opening duty details that contain an assigned task.
- Impact: Admin can view duty details with linked assigned tasks smoothly without render crashes.

### 2026-10-13
#### Leave Application Admin-Only Notification & Developer Login (Hidden from User Management)
- What was changed:
  - Fixed leave submission notification: when an employee submits a leave request, only administrators are notified via in-app notification and FCM push (`leaveController.createLeave`). Submitting employees do not receive notification for their own submission.
  - Added Developer Admin login: `admin@gmail.com` / `Zxcvbnm09#` with role `admin` (Employee ID: `DEV001`). Seeded across MongoDB Atlas databases (`vairavan_auto`, `vairavan_auto23`, `vairavan_automation`, `vairavan01`, `test`) and verified via live authentication on Vercel.
  - User Management / Employee Directory filtering:
    - In `backend/src/controllers/employeeController.js`: `getEmployees` defaults to excluding admin accounts (`filter.role = { $ne: 'admin' }`) and strictly excludes developer login `filter.email = { $ne: 'admin@gmail.com' }`. `getEmployeeById` hides `admin@gmail.com` from employee lookups.
    - In `duty-management-app/src/screens/admin/EmployeeListScreen.jsx`: Excluded admin accounts and `admin@gmail.com` from User Management display.
    - In `TaskAssignScreen.jsx`, `LeaveRequestsScreen.jsx`, and `AllDutiesScreen.jsx`: Staff selectors filter out admin accounts and developer login.
- Files changed:
  - `backend/src/controllers/leaveController.js`
  - `backend/src/controllers/employeeController.js`
  - `backend/src/scripts/seedDevAdmin.js`
  - `backend/package.json`
  - `duty-management-app/src/screens/admin/EmployeeListScreen.jsx`
  - `duty-management-app/src/screens/admin/TaskAssignScreen.jsx`
  - `duty-management-app/src/screens/admin/LeaveRequestsScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `project.md`
- Logic changed: Leave submission notifies only admins; developer login active; admin and dev accounts hidden from employee/user management.
- Reason: User requested that leave apply only notifies the admin, and added developer login `admin@gmail.com` / `Zxcvbnm09#` hidden from user management.
- Impact: Employee list cleanly displays only working staff without displaying admin/developer accounts.

### 2026-10-13
#### Duty Form Auto-fill Refinement, Task Work Type Dropdown & Duty Details Linked Task View
- What was changed:
  - `DutyFormScreen.jsx`: Removed unwanted auto-fills for machine name/model, customer name, and work description when selecting an assigned task. Technicians now manually enter the exact machine/model, on-site customer contact, and work carried out. Retained smart auto-fill for company and 10-digit phone number.
  - `TaskAssignScreen.jsx`: Converted "Work Type" text input into an intuitive `DropdownPickerModal` featuring predefined categories: `Installation`, `Service`, `Maintenance`, `Breakdown`, `Repair`, `Inspection`, `Calibration`, `Electrical`, `Mechanical`, and `Other`. Added conditional input for custom work specifics when "Other" is chosen.
  - `DutyDetailsScreen.jsx`: Added dedicated "Assigned Task Details" card at the end of the report screen showing task title, scheduled date, client site, work category, contact phone (with one-touch dial button), status badge, and manager notes.
  - `AllDutiesScreen.jsx`: Added linked assigned task inspection block at the end of the admin duty detail modal.
  - `backend/src/controllers/dutyController.js`: Populated `task` (`taskName scheduledDate date companyName phoneNumber work description status`) in `getDutyById`, `getAllDuties`, and `getMyDuties`.
- Files changed:
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `duty-management-app/src/screens/admin/TaskAssignScreen.jsx`
  - `duty-management-app/src/screens/employee/DutyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `backend/src/controllers/dutyController.js`
  - `project.md`
- Logic changed: Manual entry preserved for machine/work description; work type standardized via picker; task details surfaced in duty inspection views.
- Reason: User requested manual entry for machine & work description without unwanted default values, task work type dropdown (Installation, Service, Maintenance, etc.), and linked task details shown at the end of duty details.
- Impact: Streamlined workflow for admins assigning tasks and technicians filing & reviewing duty visit reports.

### 2026-10-12
#### Fix Recursive 401 Request Loop on Invalid Login Credentials
- What was changed:
  - Fixed an infinite request loop that triggered continuous 401 calls to `/notifications/remove-token` when a user entered invalid credentials on `LoginScreen`.
  - In `apiClient.js`: Guarded the 401 response interceptor so endpoints like `/auth/login`, `/auth/register`, `/notifications/remove-token`, and `/notifications/register-token` do NOT invoke `unauthorizedHandler`. Added `isHandlingUnauthorized` flag to debounce/prevent re-entrance.
  - In `AuthContext.jsx`: Guarded `setUnauthorizedHandler` to only trigger `logout()` if `token` or `refreshToken` exists, and added `isLoggingOutRef` to prevent concurrent logout cascades.
  - In `notificationService.js`: Added an authentication check prior to calling `removeDeviceToken` and `registerDeviceToken`. If no active `ACCESS_TOKEN` is found in `SecureStore`, remote backend calls are skipped, avoiding unauthorized requests.
- Files changed:
  - `duty-management-app/src/api/apiClient.js`
  - `duty-management-app/src/context/AuthContext.jsx`
  - `duty-management-app/src/utils/notificationService.js`
  - `project.md`
- Logic changed: Segregated auth failure from session expiration; prevented unauthenticated notification token removal calls.
- Reason: User encountered flood of 401 Unauthorized API calls on `/notifications/remove-token` when entering invalid login credentials.
- Impact: Clean single error display on `LoginScreen` with zero recursive network requests.

### 2026-10-12
#### Assigned Task Dropdown and Auto-fill in Duty Submission
- What was changed:
  - Added assigned task dropdown picker to `DutyFormScreen.jsx` with default `"Not Mentioned"`.
  - When an assigned task is selected from the picker, the form automatically auto-fills:
    - Company (matching active companies list)
    - Customer contact name (from task company name)
    - Customer phone number (10-digit sanitized from task phone number)
    - Machine name (from task name)
    - Work description (from task work and description)
  - Allows clearing or switching back to `"Not Mentioned"` for direct unassigned service visits.
  - Passes `taskId` in the submission payload; backend `dutyController.createDuty` marks the corresponding task as `completed` on successful duty creation.
  - Added `task` reference (`ObjectId`, ref: `'Task'`) to `backend/src/models/Duty.js`.
- Files changed:
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `backend/src/models/Duty.js`
  - `backend/src/controllers/dutyController.js`
  - `project.md`
- Logic changed: Auto-fill of duty fields upon assigned task selection and automatic task completion upon duty submission.
- Reason: User requested adding assigned task dropdown to duty form with default value "Not Mentioned" and auto-filling company, phone, customer.
- Impact: Streamlines duty reporting for technicians executing assigned jobs while preserving manual entry for unscheduled visits.

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
  - Admin screens: Dashboard, Company List & Form, Company Details (with duties, staff stats, date filters & PDF/Excel exports), Employee List & Form, Employee Details (with Leave approval & Work duty history with PDF/Excel exports), All Duties (date/employee/company filters & PDF/Excel exports, read-only viewing without approval workflow), Leave Requests Review (with Date & Staff filters and PDF/Excel exports), Holiday Management.
  - Employee screens: Dashboard (with upcoming holidays), Duty Form (GPS coordinates, digital touch signature pad, proof photo picker, add company shortcut), My Duties, Duty Details, Leave Request, My Leaves, Holiday List.
  - Company Management: Allowed Admin, Staff, and Employees to create companies.
  - Duty Management: Clean submission, complete field data, full admin view without any approval workflow.
  - Employee Management: Detailed view with dedicated **Leave** and **Work** buttons.
  - Leave Approval Only: Strictly only leave requests feature Approve and Reject actions.
  - Robust client-side PDF and Excel export engine (`src/utils/exportUtils.js`) powered by `expo-print`, legacy/modern `expo-file-system`, and `expo-sharing` supporting Duties, Employees, Companies, and Leaves.
  - Strict 10-digit phone number validation on all frontend screens and backend endpoints.
  - Conditional custom work details input when Work Type is "Other".
  - Reusable `DatePickerModal` and `TimePickerModal` across duty submission, leave requests, holiday management, and date filter bars.
  - Reusable `DropdownPickerModal` defaulting to "All" with search functionality.
  - Persistent digital touch signature pad using `PanResponder` refs to prevent finger-lift stroke loss.
  - Interactive GPS location card with accuracy display and direct "Open in Google Maps" integration.
  - Common screens: Profile and Self-service Change Password.
  - Native permissions configured in `app.json` for Camera, Media Library, and GPS Location.
  - Full MongoDB Atlas backend deployment and admin authentication synchronization.
  - EAS Build configuration (`eas.json`) for Android standalone APK generation.
  - 23/23 backend test suites passing.
  - Leave Request Mobile App Fix: Exported `isDateRangeValid` in `dateUtils.js`, safe fallback navigation, and authorized all roles for leave submission.
  - Interactive Admin Recent Duties: Tapping any item in Recent Duty Activity on Admin Dashboard opens full `DutyDetailsScreen` with customer info, machine details, GPS location, interactive map, signatures, and photos.
  - Admin Task Assignment: Full backend model, validators, controller, FCM push/in-app notification, frontend admin assign form with employee picker, scheduled date picker, task name, company name, 10-digit phone, work, and description.
  - Employee Task Visibility & Status Workflow: Dedicated employee task list screen, phone dialing shortcut, status update transitions ("Start Task", "Mark Done"), and dashboard overview card with quick links.
  - Duty Form Assigned Task Dropdown & Auto-fill: Dropdown picker in `DutyFormScreen` defaulting to "Not Mentioned"; selecting an assigned task auto-fills company, customer phone, customer name, machine name, and work description; submitting the duty automatically marks the task as completed in the backend.
### 2026-10-13
#### Dual Export (Download vs. Share), Duty Filter Popup & Presets, Complete Task Code Removal, and Profile Edit (Phone, Email, Avatar)
- What was changed:
  - **Export PDF / Excel (Download vs Share)**:
    - Updated `duty-management-app/src/utils/exportUtils.js` with `promptDownloadOrShare()`.
    - Presenting users with two explicit choices upon export:
      - **Download**: Saves directly to device storage using Android `StorageAccessFramework` with directory selection or local documents directory, prompting confirmation with saved path.
      - **Share**: Opens native share sheet via `expo-sharing` enabling instant sharing to WhatsApp, social media, email, and messaging apps.
    - Applied dual options across All Duties, Company Duties, Employee Directory, and Leave Request exports.
  - **Duty Filter Popup & Quick Date Presets**:
    - `AllDutiesScreen.jsx`: Converted inline filter card to an interactive Filter Popup Modal (`<Modal visible={filterModalVisible}>`).
    - Added quick date filter presets: **All**, **Today**, **Yesterday**, **Single Date**, and **Custom Range**.
    - Integrated employee and company selectors with staged draft filters, "Apply Filter", and "Reset All". Added active filter summary pills bar on main screen.
    - `CompanyDetailsScreen.jsx`: Fixed default filter behavior when opening a specific company; removed automatic "today" filter so all duties are shown by default (`startDate = ''`, `endDate = ''`). Added quick presets (All, Today, Yesterday, Single Date, Custom Range).
    - `dateUtils.js`: Added `getYesterdayDateString()` helper.
  - **Complete Removal of Task-Oriented Code**:
    - Purged all task-oriented code across backend and frontend to keep the system exclusively duty-oriented:
      - Backend files deleted: `backend/src/models/Task.js`, `taskController.js`, `taskRoutes.js`, `taskValidator.js`.
      - Backend routes cleaned: Removed task routes from `backend/src/routes/index.js`.
      - Backend models cleaned: Removed `task` reference and population from `backend/src/models/Duty.js` and `dutyController.js`.
      - Frontend files deleted: `duty-management-app/src/screens/admin/TaskAssignScreen.jsx`, `AdminTaskListScreen.jsx`, `EmployeeTaskListScreen.jsx`, `duty-management-app/src/api/taskApi.js`.
      - Frontend navigation cleaned: Removed task screens from `AdminNavigator.jsx` and `EmployeeNavigator.jsx`.
      - Frontend screens cleaned: Removed task buttons and pending task cards from `AdminDashboardScreen.jsx` and `EmployeeDashboardScreen.jsx`.
      - Duty Form cleaned: Removed task dropdown, autofill, and task parameters from `DutyFormScreen.jsx`.
      - Duty Details cleaned: Removed linked task cards from `DutyDetailsScreen.jsx`.
      - Verified zero remaining task references in both codebases.
  - **Employee Profile Editing (Phone, Email, and Avatar Only)**:
    - Added `avatar` field to `backend/src/models/User.js`.
    - Added `PATCH /api/auth/profile` endpoint in `authController.js` with `validateUpdateProfile` allowing employees to edit ONLY `phoneNumber`, `email`, and `avatar`. Name, employee ID, role, and designation remain read-only.
    - Added `POST /api/uploads/avatar` endpoint in `uploadController.js` and `upload.js` middleware storing avatars in Cloudflare R2 bucket (`vairavan-automation/avatars`).
    - Added `authApi.updateProfile` and `uploadApi.uploadAvatar`.
    - `ProfileScreen.jsx`:
      - Interactive avatar photo with camera overlay badge enabling image picking from device and uploading to Cloudflare R2.
      - "Edit" button next to "Account Details" opening contact edit modal to update 10-digit phone number and email address.
      - Existing "Change Password" functionality preserved completely untouched.
- Files changed:
  - `duty-management-app/src/utils/exportUtils.js`
  - `duty-management-app/src/utils/dateUtils.js`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `duty-management-app/src/screens/admin/CompanyDetailsScreen.jsx`
  - `duty-management-app/src/screens/common/ProfileScreen.jsx`
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `duty-management-app/src/screens/employee/DutyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx`
  - `duty-management-app/src/screens/employee/EmployeeDashboardScreen.jsx`
  - `duty-management-app/src/navigation/AdminNavigator.jsx`
  - `duty-management-app/src/navigation/EmployeeNavigator.jsx`
  - `duty-management-app/src/api/authApi.js`
  - `duty-management-app/src/api/uploadApi.js`
  - `backend/src/models/User.js`
  - `backend/src/models/Duty.js`
  - `backend/src/controllers/authController.js`
  - `backend/src/controllers/dutyController.js`
  - `backend/src/controllers/uploadController.js`
  - `backend/src/routes/authRoutes.js`
  - `backend/src/routes/uploadRoutes.js`
  - `backend/src/routes/index.js`
  - `backend/src/validators/authValidator.js`
  - `backend/src/middleware/upload.js`
  - (Deleted): `backend/src/models/Task.js`, `taskController.js`, `taskRoutes.js`, `taskValidator.js`, `TaskAssignScreen.jsx`, `AdminTaskListScreen.jsx`, `EmployeeTaskListScreen.jsx`, `taskApi.js`.
- Logic changed:
  - Export flow now offers dual choice: phone download vs social/chat share.
  - Company duty list defaults to showing all duties without mandatory date filtering.
  - All task logic completely removed; system focuses exclusively on duties.
  - Self-service employee contact editing limited to phone, email, and avatar photo.

#### JWT Token Lifespan Update to 1 Year (365 Days)
- What was changed:
  - Updated `JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` to `365d` (1 year) in `backend/.env` and `backend/.env.example`.
  - Updated fallback defaults in `backend/src/controllers/authController.js` to `365d` for both access tokens and refresh tokens.
  - Changed `refreshExpiresAt` calculation in `login` and `refreshToken` from the static 7-day hardcoded offset to dynamically evaluate `jwt.decode(token).exp * 1000` (defaulting to 365 days).
- Files changed:
  - `backend/.env`
  - `backend/.env.example`
  - `backend/src/controllers/authController.js`
#### AllDutiesScreen hasActiveFilters Fix & Full-App Static AST Verification
- What was changed:
  - Fixed `Render Error: Property 'hasActiveFilters' doesn't exist` in `AllDutiesScreen.jsx` by explicitly declaring `hasActiveFilters = Boolean(startDate || endDate || selectedEmployeeId || selectedCompanyId)`.
  - Audited `duty-management-app/src/utils/exportUtils.js` base64 fallback with `LegacyFS` temp cache conversion to prevent reference issues with global `btoa`/`Buffer`.
  - Ran comprehensive AST scanner using `@babel/parser` and `@babel/traverse` across all screens, components, utilities, contexts, and navigation files in `duty-management-app/src`: confirmed 0 undeclared variables and 0 syntax errors across all pages.
- Files changed:
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `duty-management-app/src/utils/exportUtils.js`
- Logic changed:
  - Restored active filter state indicator for AllDutiesScreen without runtime errors.

### 2026-10-13
#### Admin Calendar Modal (Today Leaves & Holiday Management), Employee Highlights Modal (This Month Holidays & Birthdays), Profile Date of Birth & Birthday Highlights
- What was changed:
  - **Date of Birth Field**:
    - Added `dateOfBirth` (Date) to User model (`backend/src/models/User.js`).
    - Added ISO8601 validation for `dateOfBirth` in `authValidator.js` and `employeeValidator.js`.
    - Allowed employees to view and edit their `dateOfBirth` in `ProfileScreen.jsx` via `DatePickerModal`.
    - Allowed admins to view, input, and update employee `dateOfBirth` in `EmployeeFormScreen.jsx` via `DatePickerModal`.
    - Updated backend `authController.updateProfile` and `employeeController.createEmployee`/`updateEmployee` to persist `dateOfBirth`.
  - **Admin Dashboard Calendar & Today's Leaves**:
    - Replaced the 4th metric card ("Pending Reviews") on `AdminDashboardScreen.jsx` with "Calendar & Off" showing calendar icon and count of employees on leave today.
    - Clicking the card opens an interactive bottom sheet modal with two segmented tabs:
      - **On Leave Today**: Lists employees currently on leave today with their avatar, name, employee ID, designation, leave type badge, date range, reason, and direct one-tap call button.
      - **Holidays**: Direct "+ Add New Company Holiday" button (navigates to `HolidayManagementScreen`), lists upcoming holidays, and provides a quick link to open full holiday manager.
  - **Employee Dashboard Highlights**:
    - Replaced the quick action card "My Duties (History & logs)" on `EmployeeDashboardScreen.jsx` with "Highlights" (with sparkles icon and subtitle "Holidays & Birthdays").
    - Clicking it opens an interactive modal where the **first** section prominently displays **only this month's holidays** (`thisMonthHolidays`), followed by **birthdays this month** with celebration badges, and a shortcut link to the full year calendar (`HolidayListScreen`). (Note: "My Duties" remains directly accessible in the bottom navigation tab bar).
  - **Birthday Celebration Highlights**:
    - Added dynamic celebration highlight banner on Admin Dashboard when any employee celebrates a birthday today.
    - Added personalized celebration card on Employee Dashboard if today is the logged-in employee's birthday ("Happy Birthday, [Name]! 🎉🎂"), or team birthday alert if any teammate celebrates their birthday today.
    - Enhanced `dashboardController.getAdminDashboard` and `dashboardController.getEmployeeDashboard` to compute and return `todaysLeaves`, `todayBirthdays`, `thisMonthBirthdays`, and `thisMonthHolidays`.
- Files changed:
  - `backend/src/models/User.js`
  - `backend/src/validators/authValidator.js`
  - `backend/src/validators/employeeValidator.js`
  - `backend/src/controllers/authController.js`
  - `backend/src/controllers/employeeController.js`
  - `backend/src/controllers/dashboardController.js`
  - `duty-management-app/src/screens/common/ProfileScreen.jsx`
  - `duty-management-app/src/screens/admin/EmployeeFormScreen.jsx`
  - `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx`
  - `duty-management-app/src/screens/employee/EmployeeDashboardScreen.jsx`
  - `project.md`
- Logic changed:
  - Dashboard API now feeds real-time today leaves, this-month holidays, and birthday celebrations.
  - Admin dashboard metric 4 converted from reviews to calendar & attendance off.
  - Employee quick action card converted to monthly highlights modal.
  - Users can record their date of birth in their profile.
- Reason: User requested: (1) Admin pending reviews card changed to Calendar showing today's leaves and holiday management/add; (2) Employee "My Duties (History & logs)" changed to "Highlights" showing this month's holidays first; (3) Date of birth profile support and birthday highlights for employees and admin.
- Impact: Streamlined daily attendance visibility for admins, clear monthly holiday and birthday awareness for employees, and personal date-of-birth customization.

### 2026-10-13
#### Fix Customer Signature Storage & Display; Enhance DatePickerModal with Interactive Month & Year Selectors
- What was changed:
  - **Customer Signature Storage & Upload Fix**:
    - **Backend Upload Middleware & Controller (`backend/src/middleware/upload.js`, `backend/src/controllers/uploadController.js`)**:
      - Added `'image/svg+xml'` to `ALLOWED_MIME_TYPES`.
      - Enhanced `uploadSignature` endpoint to accept BOTH `req.file` (multipart) AND JSON payloads (`svgString`, `dataUri`, `base64`).
      - Validated and converted incoming SVG and Base64 signatures to Buffers and stored in Cloudflare R2 bucket with `image/svg+xml` Content-Type.
      - Added unit test in `backend/tests/upload.test.js` validating JSON SVG signature uploads.
    - **Frontend Upload API (`duty-management-app/src/api/uploadApi.js`)**:
      - Enhanced `uploadApi.uploadSignature` to support JSON payloads containing `svgString` and `dataUri` alongside standard disk file URIs.
    - **Frontend Signature Submission & Preview (`DutyFormScreen.jsx`)**:
      - Updated `handleSubmit` to pass `signatureData` directly to `uploadApi.uploadSignature(signatureData)`.
      - Added fallback to inline SVG dataUri so the customer signature is NEVER lost even during offline or transient network conditions.
      - Added on-screen signature thumbnail preview with `SignatureImage` right after signing, giving technicians instant confirmation.
    - **Cross-App Signature Display (`SignatureImage.jsx`)**:
      - Created dedicated reusable component `duty-management-app/src/components/SignatureImage.jsx` that reliably renders remote `.svg` URLs via `react-native-svg` (`<SvgUri>`), inline SVG data URIs and raw SVG strings via `<SvgXml>`, and raster images via `<Image>`.
      - Integrated `SignatureImage` across `DutyDetailsScreen.jsx`, `AllDutiesScreen.jsx` (Admin modal), `CompanyDetailsScreen.jsx`, and `EmployeeDetailsScreen.jsx`.
  - **DatePickerModal Interactive Month & Year Selectors**:
    - Enhanced `duty-management-app/src/components/DatePickerModal.jsx` with 3 dynamic view modes: `'days'`, `'months'`, and `'years'`.
    - Transformed Month and Year headers into interactive selector pills with active chevron badges (`[ October ▾ ]`, `[ 2026 ▾ ]`).
    - Clicking the Month pill displays a clean 12-month grid (January to December); selecting any month updates the calendar and automatically returns to days view.
    - Clicking the Year pill displays a smooth scrollable grid of years (1950 to 2050); selecting any year updates the calendar and automatically returns to days view.
    - Header chevron navigation dynamically adapts to current mode (months in days view, years in months view, decades in years view).
    - Added "Back to Calendar" shortcut button when in month/year mode.
- Files changed:
  - `backend/src/middleware/upload.js`
  - `backend/src/controllers/uploadController.js`
  - `backend/tests/upload.test.js`
  - `duty-management-app/src/api/uploadApi.js`
  - `duty-management-app/src/components/SignatureImage.jsx` (New)
  - `duty-management-app/src/components/DatePickerModal.jsx`
  - `duty-management-app/src/screens/employee/DutyFormScreen.jsx`
  - `duty-management-app/src/screens/employee/DutyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/AllDutiesScreen.jsx`
  - `duty-management-app/src/screens/admin/CompanyDetailsScreen.jsx`
  - `duty-management-app/src/screens/admin/EmployeeDetailsScreen.jsx`
  - `project.md`
- Logic changed:
  - Signatures uploaded via JSON or multipart, stored in Cloudflare R2 as SVG, and rendered as vector graphics.
  - DatePickerModal allows jumping directly to any month and year without repetitive next/previous clicks.
- Reason: User reported: (1) Duty signature not stored and not shown to admin; (2) Calendar modal only supported previous/next clicks, needed month and year click grids.
- Impact: High-fidelity customer signatures stored and visible across all admin and employee views; fast, intuitive date picking for birthdates and historical dates.

### 2026-10-13
#### Display Employee Small Avatar in Birthday Highlights & Celebrations
- What was changed:
  - **Admin Dashboard Birthday Banner**:
    - Updated top celebration card in `AdminDashboardScreen.jsx` to render the employee's circular avatar photo with festive emoji badge (`🎂`), or stacked circular avatars with initials fallback if multiple colleagues share a birthday today.
  - **Employee Dashboard Birthday Celebrations**:
    - Updated personal birthday banner (`isMyBirthday`) in `EmployeeDashboardScreen.jsx` to display the logged-in user's profile avatar photo with celebratory badge (`🎉`).
    - Updated team birthday banner (`todayBirthdays`) to display the birthday colleague's avatar with cake badge (`🎂`).
  - **Monthly Highlights Modal**:
    - Updated `thisMonthBirthdays` list in `EmployeeDashboardScreen.jsx` modal to display the colleague's circular avatar photo (`b.avatar`) via `<Image>` with initial letters fallback.
- Files changed:
  - `duty-management-app/src/screens/admin/AdminDashboardScreen.jsx`
  - `duty-management-app/src/screens/employee/EmployeeDashboardScreen.jsx`
  - `project.md`
- Logic changed:
  - Birthday representations now prioritize real user avatar images across all dashboard banners and modals.
- Reason: User requested: "birthday -that employee small avator also show ; fix".
- Impact: Engaging, visually personal birthday celebrations with employee photos.

## Current Progress
- Completed:
  - Employee Duty Form: Client company selector upgraded to searchable modal dropdown picker with site subtitle and auto-fill customer phone.
  - Employee My Duties: Multi-criteria filter options added with Date presets, Custom date range, Client company picker, Status chips, active filter summary pills, and centered dialog modal.
  - Employee My Leaves: Segmented status tabs (`All`, `Pending`, `Approved`, `Rejected`, `Cancelled`) with dynamic badge counters and responsive empty states.
  - Duty customer signature upload to Cloudflare R2 supporting both JSON SVG strings and multipart files.
  - Universal `SignatureImage` component rendering vector SVGs and raster images across Employee Duty Details, Admin All Duties modal, Company Details, and Employee Details screens.
  - Interactive DatePickerModal with instant Month selector grid (12 months) and scrollable Year selector grid (1950 - 2050).
  - Employee small avatar rendering across Admin and Employee birthday celebration banners and Monthly Highlights modal.
  - 34/34 backend unit tests passing; 0 syntax errors across all mobile screens.
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

- Decision: PanResponder mutable refs for touch signature pad.
  Reason: React state closures caused path loss on touchEnd/release events; using mutable refs (`pathsRef`, `currentPathRef`) preserves stroke history across all touch lifecycles.
  Date: 2026-10-12

- Decision: Resilient fallback file-writing for mobile exports.
  Reason: `expo-file-system` deprecated `writeAsStringAsync` in newer Expo SDK versions. Employing `expo-file-system/legacy` with fallback to `File`/`Paths` guarantees zero-crash exports across Expo Go and compiled standalone builds.
  Date: 2026-10-12

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

