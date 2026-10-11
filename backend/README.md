# Vairavan Automation — Employee Duty Management System Backend API

Production-ready REST API backend for the Employee Duty Management System built with Node.js, Express.js (ES Modules), MongoDB Atlas, Mongoose, JWT authentication, and Cloudinary.

---

## 1. Architecture & Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Runtime** | Node.js (v18+) | ES Modules (`"type": "module"`) |
| **Framework** | Express.js 4.x | Modular MVC Architecture |
| **Database** | MongoDB Atlas / Mongoose | ODM with strict schemas, indexing, and validation |
| **Authentication** | JWT (`jsonwebtoken`) | Bearer Access Tokens + Rotated Refresh Tokens |
| **Security** | Helmet, CORS, bcryptjs | Rate limiting (`express-rate-limit`), password hashing |
| **File Storage** | Cloudinary + Multer | In-memory buffering for signature & proof photos |
| **Validation** | express-validator | Param, query, and request body validation |
| **Push Notifications** | Firebase Admin SDK | FCM multicast delivery with automatic token cleanup |
| **Testing** | Node.js Test Runner + Supertest | Automated in-memory database test harness |
| **Deployment** | Render Web Services | Configured for Render Free Tier (`PORT`, `0.0.0.0`) |

---

## 2. Directory Structure

```text
backend/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore configuration
├── package.json              # Project metadata, dependencies, scripts
├── README.md                 # System documentation & deployment guide
├── postman/
│   └── vairavan-automation-api.postman_collection.json # Complete Postman collection
├── src/
│   ├── app.js                # Express app setup, security headers, middleware
│   ├── server.js             # Server startup, DB connection, graceful shutdown
│   ├── config/
│   │   ├── db.js             # Mongoose MongoDB connection & disconnect
│   │   ├── cloudinary.js     # Cloudinary SDK configuration
│   │   └── firebase.js       # Firebase Admin SDK modular configuration
│   ├── controllers/
│   │   ├── authController.js        # Login, profile, password change, refresh
│   │   ├── companyController.js     # Company CRUD & soft deletion
│   │   ├── employeeController.js    # Employee administration & password reset
│   │   ├── dutyController.js        # Daily reports, review workflow, audit trail
│   │   ├── leaveController.js       # Leave submission, overlap checks, reviews
│   │   ├── holidayController.js     # Holiday schedule & notifications
│   │   ├── dashboardController.js   # Admin & Employee aggregated analytics
│   │   ├── uploadController.js      # Signatures & proof photos upload
│   │   └── notificationController.js# FCM device token management
│   ├── middleware/
│   │   ├── authenticate.js   # JWT verification & active account checks
│   │   ├── authorize.js      # Role-based access control (admin/employee)
│   │   ├── errorHandler.js   # Centralized error handler
│   │   ├── notFound.js       # 404 Route handler
│   │   ├── rateLimiter.js    # IP & auth brute-force protection
│   │   ├── upload.js         # Multer in-memory upload middleware
│   │   └── validate.js       # express-validator error formatter
│   ├── models/
│   │   ├── User.js           # Admins and Employees
│   │   ├── Company.js        # Customer companies / factory units
│   │   ├── Duty.js           # Duty reports with location & audit trail
│   │   ├── Leave.js          # Leave requests & admin decisions
│   │   └── Holiday.js        # Company holidays
│   ├── routes/
│   │   ├── index.js          # Root router & /health endpoint
│   │   ├── authRoutes.js
│   │   ├── companyRoutes.js
│   │   ├── employeeRoutes.js
│   │   ├── dutyRoutes.js
│   │   ├── leaveRoutes.js
│   │   ├── holidayRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── uploadRoutes.js
│   │   └── notificationRoutes.js
│   ├── services/
│   │   ├── cloudinaryService.js   # Cloudinary buffer upload & deletion
│   │   └── notificationService.js # Firebase Cloud Messaging sender
│   ├── validators/
│   │   ├── authValidator.js
│   │   ├── companyValidator.js
│   │   ├── employeeValidator.js
│   │   ├── dutyValidator.js
│   │   ├── leaveValidator.js
│   │   └── holidayValidator.js
│   └── scripts/
│       └── createAdmin.js    # Secure one-time Admin account bootstrapper
└── tests/
    ├── setup.js              # In-memory MongoDB test server harness
    ├── auth.test.js          # Auth & role authorization tests
    ├── company.test.js       # Company CRUD & soft deletion tests
    ├── duty.test.js          # Duty ownership & workflow tests
    └── leave.test.js         # Leave requests & overlap tests
```

---

## 3. Environment Variables Reference

Create a `.env` file in the `backend/` directory by copying `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | HTTP port the server listens on | `5000` |
| `NODE_ENV` | Runtime environment | `development` or `production` |
| `HOST` | Server bind host address | `0.0.0.0` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key for signing Access Tokens | Minimum 32 characters |
| `JWT_EXPIRES_IN` | Access token lifespan | `1d` |
| `JWT_REFRESH_SECRET` | Secret key for signing Refresh Tokens | Minimum 32 characters |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token lifespan | `7d` |
| `CORS_ORIGIN` | Allowed client origins (comma-separated or `*`)| `*` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `900000` (15 mins) |
| `RATE_LIMIT_MAX_REQUESTS`| Max requests per window per IP | `200` |
| `AUTH_RATE_LIMIT_MAX` | Max login attempts per 15 minutes | `10` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `your_api_key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `your_api_secret` |
| `REQUIRE_DUTY_LOCATION` | Enforce GPS coordinates on duty submission | `false` |
| `ALLOW_OVERNIGHT_DUTY` | Allow duty outTime earlier than inTime | `false` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional inline JSON service account | `{ ... }` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional path to serviceAccountKey.json | `./serviceAccountKey.json` |
| `ADMIN_NAME` | Admin name for bootstrap script | `System Administrator` |
| `ADMIN_EMAIL` | Admin email for bootstrap script | `admin@vairavan.com` |
| `ADMIN_PASSWORD` | Admin password for bootstrap script | `AdminPassword123!` |
| `ADMIN_EMPLOYEE_ID` | Admin employee ID | `ADM001` |
| `ADMIN_PHONE` | Admin phone number | `+919876543210` |

---

## 4. Local Setup & Execution

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and set your MongoDB Atlas connection string:
```bash
cp .env.example .env
```

### 3. Bootstrap Initial Administrator
Create the first system administrator account safely (no public registration endpoint):
```bash
npm run seed:admin
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Run Automated Tests
```bash
npm test
```

---

## 5. API Reference & Permissions Matrix

### Summary of Roles:
- **`Admin`**: Full access to create/manage employees, companies, holidays, view all reports, review duties, and approve/reject leave.
- **`Employee`**: Can submit and view own duty reports, upload customer signatures and proofs, view active companies and holidays, and manage own leave requests.

### Endpoints Table:

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | System uptime & MongoDB status |
| `POST`| `/api/auth/login` | Public | Rate-limited login; returns JWT |
| `POST`| `/api/auth/refresh` | Public | Refresh expired access token |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |
| `PATCH`| `/api/auth/change-password` | Authenticated | Change current password |
| `POST`| `/api/auth/logout` | Authenticated | Revoke refresh token |
| `POST`| `/api/employees` | Admin | Create employee account |
| `GET` | `/api/employees` | Admin | List employees (paginated, search) |
| `GET` | `/api/employees/:id` | Admin / Self | View employee profile |
| `PUT` | `/api/employees/:id` | Admin | Update employee profile details |
| `PATCH`| `/api/employees/:id/status` | Admin | Activate/deactivate account |
| `PATCH`| `/api/employees/:id/password` | Admin | Reset employee password |
| `POST`| `/api/companies` | Admin | Create customer company |
| `GET` | `/api/companies` | Authenticated | List companies (Employees see active only) |
| `GET` | `/api/companies/:id` | Authenticated | Get single company details |
| `PUT` | `/api/companies/:id` | Admin | Update company |
| `DELETE`| `/api/companies/:id` | Admin | Deactivate / soft-delete company |
| `POST`| `/api/duties` | Employee | Submit duty report |
| `GET` | `/api/duties/my` | Employee | View authenticated employee's duties |
| `GET` | `/api/duties/:id` | Admin / Owner | Get single duty report |
| `PUT` | `/api/duties/:id` | Employee | Update duty (only if submitted/correction) |
| `GET` | `/api/duties` | Admin | Filter & list all duty reports |
| `PATCH`| `/api/duties/:id/status` | Admin | Review duty (approved/rejected/correction) |
| `POST`| `/api/uploads/signature` | Authenticated | Upload customer signature (image) |
| `POST`| `/api/uploads/proof-photos`| Authenticated | Upload customer proof photos (max 5) |
| `DELETE`| `/api/uploads/:publicId` | Authenticated | Delete uploaded Cloudinary asset |
| `POST`| `/api/leaves` | Employee | Submit leave request |
| `GET` | `/api/leaves/my` | Employee | View own leave requests |
| `GET` | `/api/leaves/:id` | Admin / Owner | View single leave request |
| `GET` | `/api/leaves` | Admin | List all employee leave requests |
| `PATCH`| `/api/leaves/:id/review` | Admin | Approve or reject leave request |
| `PATCH`| `/api/leaves/:id/cancel` | Employee | Cancel own pending leave request |
| `POST`| `/api/holidays` | Admin | Create company holiday |
| `GET` | `/api/holidays` | Authenticated | List holidays (Employees see active only) |
| `GET` | `/api/holidays/:id` | Authenticated | View holiday details |
| `PUT` | `/api/holidays/:id` | Admin | Update holiday |
| `DELETE`| `/api/holidays/:id` | Admin | Deactivate / soft-delete holiday |
| `GET` | `/api/dashboard/admin` | Admin | Aggregated metrics & recent activity |
| `GET` | `/api/dashboard/employee` | Employee | Summary profile, duties, leaves |
| `POST`| `/api/notifications/register-token` | Authenticated | Register FCM device token |
| `POST`| `/api/notifications/remove-token` | Authenticated | Unregister FCM device token |

---

## 6. Example Request & Response Payloads

### 1. Login Request
`POST /api/auth/login`
```json
{
  "email": "admin@vairavan.com",
  "password": "AdminPassword123!"
}
```

Response (`200 OK`):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "67a9b1c2d3e4f5a6b7c8d9e0",
      "employeeName": "System Administrator",
      "employeeId": "ADM001",
      "email": "admin@vairavan.com",
      "role": "admin",
      "accountStatus": "active"
    }
  }
}
```

### 2. Duty Report Submission
`POST /api/duties` (Bearer Token: Employee)
```json
{
  "dutyDate": "2026-10-11",
  "companyId": "67a9b1c2d3e4f5a6b7c8d9e1",
  "customerName": "Senthil Nathan",
  "customerPhoneNumber": "+919876543210",
  "machineName": "Circular Knitting Machine #4",
  "workType": "Electrical",
  "inTime": "09:30",
  "outTime": "17:45",
  "workDescription": "Diagnosed servo drive error code E-104. Replaced communication harness and recalibrated zero point.",
  "customerSignature": {
    "url": "https://res.cloudinary.com/vairavan/image/upload/v1234/sig_001.png",
    "publicId": "vairavan-automation/signatures/sig_001"
  },
  "customerProofPhotos": [
    {
      "url": "https://res.cloudinary.com/vairavan/image/upload/v1234/proof_001.jpg",
      "publicId": "vairavan-automation/proofs/proof_001"
    }
  ],
  "latitude": 11.0168,
  "longitude": 76.9558,
  "accuracy": 8.5
}
```

Response (`201 Created`):
```json
{
  "success": true,
  "message": "Duty report submitted successfully",
  "data": {
    "duty": {
      "_id": "67a9b1c2d3e4f5a6b7c8d9e2",
      "dutyDate": "2026-10-11T00:00:00.000Z",
      "customerName": "Senthil Nathan",
      "workType": "Electrical",
      "status": "submitted",
      "createdAt": "2026-10-11T10:15:00.000Z"
    }
  }
}
```

### 3. Validation Error Example
Response (`422 Unprocessable Entity`):
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "customerName",
      "message": "Customer name is required",
      "value": ""
    },
    {
      "field": "inTime",
      "message": "In time must be in HH:mm 24-hour format (e.g., 09:30 or 14:00)",
      "value": "9 AM"
    }
  ]
}
```

---

## 7. Render Deployment Guide

Follow these steps to deploy this backend on Render Web Services:

1. **Sign Up / Log In** to [Render](https://render.com).
2. **Create New Web Service**:
   - Connect your GitHub repository: `https://github.com/Kabi09/vairavan-automation-client`.
   - Branch: `backend`.
   - Root Directory: `backend`.
   - Runtime: `Node`.
   - Build Command: `npm install`.
   - Start Command: `npm start`.
3. **Configure Environment Variables** in Render Dashboard:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (or leave default, Render sets `PORT` automatically)
   - `HOST` = `0.0.0.0`
   - `MONGODB_URI` = `mongodb+srv://<user>:<password>@cluster0.mongodb.net/vairavan_duty_management?retryWrites=true&w=majority`
   - `JWT_SECRET` = (Generate a strong 32+ character key)
   - `JWT_REFRESH_SECRET` = (Generate a strong 32+ character key)
   - `CORS_ORIGIN` = `*` (or your mobile client domain)
   - `CLOUDINARY_CLOUD_NAME` = (Your Cloudinary cloud name)
   - `CLOUDINARY_API_KEY` = (Your Cloudinary API key)
   - `CLOUDINARY_API_SECRET` = (Your Cloudinary API secret)
   - `ADMIN_EMAIL` = `admin@vairavan.com`
   - `ADMIN_PASSWORD` = (Strong initial password)
4. **Deploy**: Render will build the service and start `src/server.js`.
5. **Run Seed Script (One Time)**:
   - In Render Shell tab, run:
     ```bash
     npm run seed:admin
     ```
   - This creates your initial admin account safely.

> [!NOTE]
> **Render Free Tier Notice**:
> Render's Free web services spin down after 15 minutes of inactivity. When a new incoming request arrives, a cold start of 30-50 seconds may occur before responding. Do not rely on uninterrupted free hosting for critical production SLAs.

---

## 8. Third-Party Integrations Setup

### MongoDB Atlas Setup:
1. Log in to [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a Free Cluster (M0).
3. Under **Database Access**, create a user with `Read and write to any database` privileges.
4. Under **Network Access**, add `0.0.0.0/0` (Allow access from anywhere, required for Render dynamic IP egress).
5. Copy connection string and paste into `MONGODB_URI`.

### Cloudinary Setup:
1. Register free at [cloudinary.com](https://cloudinary.com).
2. In Dashboard, copy **Cloud name**, **API Key**, and **API Secret**.
3. Set in `.env`.

### Firebase Admin FCM Setup (Optional):
1. Go to [Firebase Console](https://console.firebase.google.com).
2. Create a project and navigate to **Project settings** > **Service accounts**.
3. Click **Generate new private key** to download the JSON credentials file.
4. Either set `FIREBASE_SERVICE_ACCOUNT_JSON` with the raw JSON content or save the file as `serviceAccountKey.json` and set `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json`.
5. If not configured, notification calls log gracefully without failing application requests.
