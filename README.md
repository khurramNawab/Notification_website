# PayTrack CRM

PayTrack CRM is a full-stack, single-server billing, ledger, and follow-up management application designed for professional service firms (Chartered Accountants / Consultancies). It replaces manual Excel sheets with an interactive, data-dense web application that enforces backend math validation, tracks client profile accounts, logs payment histories, and automates overdue status tracking.

## Technology Stack
- **Frontend**: React, TypeScript, Tailwind CSS (v4), Recharts (dashboard trends and statuses)
- **Backend**: Node.js, Express
- **Database**: SQLite (Promise-based API using `sqlite` & `sqlite3`)
- **Authentication**: JWT (JSON Web Tokens), Role-based authorization (Admin vs. Staff)
- **Reports**: Excel exports/imports via SheetJS (`xlsx`), PDF invoice prints via `pdfkit`

---

## Folder Structure

```text
paytrack-crm/
├── backend/
│   ├── database.js          # SQLite schema declaration & connection initialization
│   ├── seed.js              # Database seed script containing 25 CA engagements
│   ├── server.js            # Express server initialization & static serving
│   ├── routes/
│   │   ├── auth.js          # Auth router (login, session /me, and admin user CRUD)
│   │   ├── clients.js       # Clients router (CRUD & lifetime billing aggregations)
│   │   ├── transactions.js  # Transactions CRUD, PDF invoice, and Excel import/export
│   │   ├── dashboard.js     # KPI card counts, Recharts trends, follow-ups
│   │   └── settings.js      # Parameter updates (overdue threshold)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (Sidebar, Header, Dashboard, Kanban, etc.)
│   │   ├── context/         # Auth session provider
│   │   ├── utils/           # Request helpers
│   │   ├── App.tsx          # Router layout
│   │   └── index.css        # Tailwind CSS v4 variables & theme definitions
│   ├── index.html
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

---

## Quick Start Setup

### Prerequisites
- Node.js (v18+ recommended, tested on v24)
- npm (v9+)

### Installation
1. Clone or copy the project files to your workspace directory.
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

---

## Database Seeding
To initialize the SQLite database (`backend/paytrack.db`) and populate it with 25 realistic CA records (GST Audits, Income Tax filings, ROC compilations) and default users:
```bash
cd backend
npm run seed
```

---

## Running the Application

### Option A: Running in Development (Concurrent Hot-Reload)
This starts the backend API on port 5000 and the Vite frontend on port 3000 (Vite will proxy API requests to backend).

1. Start backend:
   ```bash
   cd backend
   npm start
   ```
2. Start frontend (in a separate terminal):
   ```bash
   cd frontend
   npm run dev
   ```
3. Open your browser and navigate to: `http://localhost:3000`

### Option B: Running in Production (Single Server Port 5000)
This compiles the React bundle into static files, which are served fallback-style directly by the Express server on port 5000.

1. Compile React production files:
   ```bash
   cd frontend
   npm run build
   ```
2. Start Express server:
   ```bash
   cd ../backend
   npm start
   ```
3. Open your browser and navigate to: `http://localhost:5000`

---

## Default Access Roles & Credentials
The seed script configures two default accounts representing the Admin and Staff system roles.

1. **Admin User** (Full permissions: user management, archivals, financial summaries)
   - **Email**: `admin@paytrack.com`
   - **Password**: `admin123`

2. **Staff User** (Standard permissions: add/edit entries, logs payments; cannot delete, view reports, or edit settings)
   - **Email**: `staff@paytrack.com`
   - **Password**: `staff123`

---

## Environment Variables (Optional)
Create a `.env` file in the `backend/` directory if you wish to override parameters:
```env
PORT=5000
JWT_SECRET=paytrack-crm-super-secret-key
```
