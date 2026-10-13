# Employee Duty Management Mobile App (React Native & Expo)

A complete, modern, production-ready mobile application for Employee Duty Management built with React Native and Expo. Seamlessly connected to the backend REST API deployed at `https://vairavan-automation-client.vercel.app/api`.

---

## 📱 Features Overview

### 🔐 Authentication & Session
- **Secure JWT Storage**: Implemented with `expo-secure-store` (tokens never exposed in unencrypted storage).
- **Auto Session Restore**: Token check on app launch with automatic role redirect (`admin` vs `employee`).
- **Token Interceptor**: Automatic `Authorization: Bearer <token>` attachment and 401 response handling.
- **Password Masking & Visibility Toggle**: Accessible show/hide password toggle.

### 👔 Admin Portal
- **Dashboard**: High-level KPI cards (Total Active Staff, Companies, Today's Duties, Pending Reviews, Pending Leaves, Upcoming Holidays, Recent Reports) with pull-to-refresh.
- **Company Management**: Complete CRUD operations (Company list, add, edit, toggle active/inactive status) with phone & location tracking.
- **Employee Management**: Staff directory, create new staff with auto/manual passwords, update profile, activate/deactivate account, and reset passwords directly.
- **Duty Review System**: Filter duty reports by status (`submitted`, `approved`, `correction_requested`, `rejected`), view full details, customer signatures, proof photos, GPS location, and submit decisions with administrative remarks.
- **Leave Review**: Review all employee leave applications, filter by pending/approved/rejected, and approve or reject with comments.
- **Holiday Management**: Add, update, and manage company holidays and observances.

### 👷 Employee Portal
- **Dashboard**: Personalized welcome greeting, quick actions (`Submit Duty`, `Request Leave`), leave balance summary, today's visits, and recent history.
- **Duty Report Submission**:
  - Customer name, company selection (fetched dynamically from active companies), customer phone.
  - Machine name, work type picker (`Electrical`, `Mechanical`, `Installation`, `Maintenance`, `Repair`, `Other`).
  - Shift time selection (`inTime` and `outTime`), work description.
  - **GPS Location Capture**: One-tap GPS coordinate fetch (`latitude`, `longitude`) via `expo-location`.
  - **Digital Signature Pad**: Custom smooth touch canvas built with `react-native-svg` and `PanResponder` to capture real customer signatures and upload to Cloudflare R2.
  - **Proof Photos**: Multiple site photo attachments via `expo-image-picker` with live thumbnail preview and deletion.
- **Duty History**: Comprehensive list of past reports with status badges and full details screen.
- **Leave Management**: Submit leave requests with reason and date range validation, track status (`pending`, `approved`, `rejected`), and cancel pending applications.
- **Holiday Calendar**: View upcoming corporate holidays.
- **Profile & Security**: View personal details and self-service password change.

---

## 🛠️ Technology Stack

- **Framework**: React Native with Expo SDK 57
- **Language**: JavaScript ES6+ (No TypeScript)
- **Navigation**: React Navigation 7 (Native Stack & Bottom Tabs)
- **HTTP Client**: Axios with global timeout and interceptors
- **Secure Storage**: `expo-secure-store`
- **Device Features**: `expo-location`, `expo-image-picker`, `react-native-svg`
- **Styling**: React Native `StyleSheet` only with centralized theme tokens

---

## 📂 Project Structure

```
duty-management-app/
├── App.js                         # Root application entry point
├── app.json                       # Expo configuration & native permissions
├── package.json                   # Dependencies & scripts
├── .env                           # Local environment configuration
├── .env.example                   # Environment template
└── src/
    ├── api/
    │   ├── apiClient.js           # Central Axios client with JWT interceptor
    │   ├── authApi.js             # Authentication endpoints
    │   ├── companyApi.js          # Company CRUD endpoints
    │   ├── employeeApi.js         # Staff management endpoints
    │   ├── dutyApi.js             # Duty reporting & review endpoints
    │   ├── leaveApi.js            # Leave application & approval endpoints
    │   ├── holidayApi.js          # Holiday calendar endpoints
    │   ├── dashboardApi.js        # Admin & Employee analytics
    │   ├── uploadApi.js           # Cloudflare R2 multipart upload endpoints
    │   └── notificationApi.js     # FCM push token registration
    ├── components/
    │   ├── Card.jsx               # Elevated card container
    │   ├── ConfirmationDialog.jsx # Modal confirmation dialog
    │   ├── EmptyState.jsx         # Empty list feedback
    │   ├── ErrorMessage.jsx       # User-friendly error message with retry
    │   ├── LoadingIndicator.jsx   # Activity spinner with message
    │   ├── PrimaryButton.jsx      # High-emphasis button
    │   ├── ScreenHeader.jsx       # Standard navigation header
    │   ├── SecondaryButton.jsx    # Outlined/ghost action button
    │   ├── SignaturePadModal.jsx  # SVG-based touch signature canvas
    │   ├── StatusBadge.jsx        # Colored status pill badge
    │   └── TextInputField.jsx     # Form input with icon, error, and clear
    ├── constants/
    │   ├── config.js              # Environment & storage constants
    │   └── theme.js               # Color palette, spacing, and typography
    ├── context/
    │   └── AuthContext.jsx        # Global authentication provider
    ├── navigation/
    │   ├── AdminNavigator.jsx     # Admin bottom tabs & stack screens
    │   ├── EmployeeNavigator.jsx  # Employee bottom tabs & stack screens
    │   └── RootNavigator.jsx      # Dynamic role-based root router
    ├── screens/
    │   ├── admin/
    │   │   ├── AdminDashboardScreen.jsx
    │   │   ├── AllDutiesScreen.jsx
    │   │   ├── CompanyFormScreen.jsx
    │   │   ├── CompanyListScreen.jsx
    │   │   ├── EmployeeFormScreen.jsx
    │   │   ├── EmployeeListScreen.jsx
    │   │   ├── HolidayManagementScreen.jsx
    │   │   └── LeaveRequestsScreen.jsx
    │   ├── auth/
    │   │   └── LoginScreen.jsx
    │   ├── common/
    │   │   ├── ChangePasswordScreen.jsx
    │   │   └── ProfileScreen.jsx
    │   └── employee/
    │       ├── DutyDetailsScreen.jsx
    │       ├── DutyFormScreen.jsx
    │       ├── EmployeeDashboardScreen.jsx
    │       ├── HolidayListScreen.jsx
    │       ├── LeaveRequestScreen.jsx
    │       ├── MyDutiesScreen.jsx
    │       └── MyLeavesScreen.jsx
    └── utils/
        ├── dateUtils.js           # Date and time formatting utilities
        ├── errorUtils.js          # API error parser and extractor
        ├── notificationService.js # Firebase Cloud Messaging helper
        └── validators.js          # Form validation helpers
```

---

## 🚀 Setup & Local Development

### 1. Prerequisites
- Node.js >= 18
- npm or yarn
- Expo Go app on your physical iOS/Android phone OR Android Studio / Xcode Simulator

### 2. Install Dependencies
```bash
cd duty-management-app
npm install
```

### 3. Environment Configuration
Verify that `.env` is present in the `duty-management-app` directory:
```env
EXPO_PUBLIC_API_URL=https://vairavan-automation-client.vercel.app/api
```

### 4. Start Development Server
```bash
npx expo start
```
- Press `a` to open Android emulator.
- Press `i` to open iOS simulator.
- Or scan the QR code using Expo Go on your mobile device.

---

## 📦 Production Build Instructions

### Android Build (APK / AAB via EAS)
1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Log in to your Expo account:
   ```bash
   eas login
   ```
3. Configure the build:
   ```bash
   eas build:configure
   ```
4. Build APK for physical device testing:
   ```bash
   eas build -p android --profile preview
   ```
5. Build Google Play Store AAB:
   ```bash
   eas build -p android --profile production
   ```

### iOS Build (IPA via EAS)
1. Ensure your Apple Developer Account is linked in EAS.
2. Build for TestFlight or Ad-Hoc distribution:
   ```bash
   eas build -p ios --profile preview
   ```
3. Build for App Store release:
   ```bash
   eas build -p ios --profile production
   ```

---

## 🔔 Firebase Push Notifications Configuration

1. **Android**: Download `google-services.json` from the Firebase Console and place it in `duty-management-app/`.
2. **iOS**: Download `GoogleService-Info.plist` from the Firebase Console and place it in `duty-management-app/`.
3. In `app.json`, add paths to the configuration files:
   ```json
   {
     "expo": {
       "android": {
         "googleServicesFile": "./google-services.json"
       },
       "ios": {
         "googleServicesFile": "./GoogleService-Info.plist"
       }
     }
   }
   ```
4. Generate the native project via prebuild:
   ```bash
   npx expo prebuild
   ```

---

## 🧪 Testing Checklist

- [x] **Authentication Flow**: Login with admin credentials → Redirects to Admin Dashboard.
- [x] **Employee Authentication**: Login with employee credentials → Redirects to Employee Dashboard.
- [x] **Session Persistence**: Closing and reopening the app restores session from `expo-secure-store`.
- [x] **Logout Flow**: Clears secure token, resets navigation to Login screen.
- [x] **Company CRUD**: Admin can list, create, edit, and toggle company status.
- [x] **Staff CRUD**: Admin can create staff, update details, and reset passwords.
- [x] **Duty Submission**: Employee can capture GPS coordinates, sign on touch canvas, upload photos, and submit report.
- [x] **Duty Review**: Admin can view submitted duties with signature and site photos, then approve or request correction.
- [x] **Leave Management**: Employee can apply for leave and view status; Admin can approve or reject with comments.
- [x] **Holiday Calendar**: Admin manages holiday calendar; Employees view upcoming holidays.
- [x] **Security**: Password masking, token interceptor, and backend-derived identity.
