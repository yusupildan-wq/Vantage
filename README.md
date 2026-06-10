# Active Layer Auditor

A full-stack Power Platform engineering tool for auditing, validating, and comparing Microsoft Dataverse environments before deployment.

Built with React + TypeScript (frontend) and Node.js + Express + TypeScript (backend). Authenticates with Azure AD using client credentials and queries the Dataverse Web API directly — the same API that Power Apps, Power Automate, and the maker portal use.

---

## Features

### 01 · Active Layer Scanner
Scans a Dataverse environment and identifies components sitting in the **active layer** — unmanaged customizations that could cause issues during solution export or deployment.

Classifies each component as:
| Status | Meaning |
|---|---|
| **Active Layer** | Unmanaged change on top of a managed component — export risk |
| **Unmanaged** | Component has never been part of any managed solution |
| **Base Layer** | Clean — component is fully managed |

### 02 · Option Set Guard
Validates that critical global and local option set values match an expected configuration defined in a client config file. Detects value drift and can restore mismatched labels back to the expected state.

### 03 · Deployment Readiness Checker
Runs 6 automated checks across an environment and produces a single pass/fail report:
- Active layer components
- Cloud flow states (enabled/disabled)
- Greymatter solution presence and version
- Environment variable values
- Connection reference assignments
- Option set integrity

Includes a **Preview Auto-Fix** dry-run that scans for automatically fixable issues (disabled flows, missing env var defaults, disconnected connection refs) without making any changes to the environment.

### 04 · Environment Comparison
Diffs two Dataverse environments side by side across:
- Solutions (version comparison)
- Environment Variables (value comparison)
- Connection References (connected/disconnected)
- Cloud Flows (enabled/disabled state)

Each section is collapsible and filterable by diff status: Different / Source Only / Target Only / Match.

---

## Prerequisites

- **Node.js 18+**
- An **Azure AD App Registration** in the same tenant as your Dataverse environments
- The App Registration must be added as an **Application User** in each target environment with a security role that allows read access (e.g. System Administrator or a custom read-only role)

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd active-layer-auditor
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and fill in your Azure AD credentials:

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-app-registration-client-id
AZURE_CLIENT_SECRET=your-app-registration-client-secret
```

### 3. Frontend

```bash
cd frontend
npm install
```

The frontend points to `http://localhost:3001` by default. If you need a different backend URL, create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3001
```

---

## Running locally

Open two terminals from the project root:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

> **Windows / PowerShell note:** PowerShell 5.1 does not support `&&`. Use `;` to chain commands or open two separate terminals.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `AZURE_TENANT_ID` | Yes | — | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Yes | — | App Registration client ID |
| `AZURE_CLIENT_SECRET` | Yes | — | App Registration client secret |
| `PORT` | No | `3001` | Port the backend listens on |
| `FRONTEND_URL` | No | `http://localhost:5173` | Allowed CORS origin |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend base URL |

---

## Project structure

```
active-layer-auditor/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry point
│   │   ├── dataverse.ts          # Dataverse API client + active layer scan logic
│   │   ├── optionsets.ts         # Option Set Guard logic
│   │   ├── readiness.ts          # Deployment Readiness Checker logic
│   │   ├── comparison.ts         # Environment Comparison logic
│   │   ├── remediation.ts        # Auto-fix plan builder (read-only)
│   │   ├── db.ts                 # Scan history (local JSON file)
│   │   ├── types.ts              # Shared TypeScript types
│   │   └── routes/
│   │       ├── scan.ts           # POST /api/scan
│   │       ├── history.ts        # GET  /api/scans
│   │       ├── optionsets.ts     # POST /api/optionsets/check, /restore
│   │       ├── readiness.ts      # POST /api/readiness/check
│   │       ├── comparison.ts     # POST /api/comparison/run
│   │       └── remediation.ts    # POST /api/remediation/plan
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Route shell
│   │   ├── main.tsx              # React entry point
│   │   ├── types.ts              # Shared TypeScript types
│   │   ├── index.css             # CSS custom property design system
│   │   ├── hooks/
│   │   │   └── useSmoothScroll.ts
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ScanPage.tsx
│   │   │   ├── OptionSetPage.tsx
│   │   │   ├── ReadinessPage.tsx
│   │   │   └── ComparisonPage.tsx
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── ScanForm.tsx
│   │       ├── ResultsTable.tsx
│   │       ├── StatusBadge.tsx
│   │       ├── EmptyState.tsx
│   │       ├── OptionSetGuard.tsx
│   │       ├── ReadinessReport.tsx
│   │       └── ComparisonReport.tsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── config/
│   └── clients/                  # Per-client option set config files
├── data/                         # Scan history — gitignored, created at runtime
├── docs/
│   └── project-plan.md
├── .gitignore
└── README.md
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/scan` | Run active layer scan |
| `GET` | `/api/scans` | Fetch scan history |
| `POST` | `/api/optionsets/check` | Run option set check |
| `POST` | `/api/optionsets/restore` | Restore mismatched option set values |
| `POST` | `/api/readiness/check` | Run deployment readiness check |
| `POST` | `/api/comparison/run` | Run environment comparison |
| `POST` | `/api/remediation/plan` | Preview auto-fix plan (read-only, no changes made) |

---

## How it works

Every piece of data visible in make.powerapps.com, Power Automate, and the Power Platform admin centre is stored in **Dataverse** and exposed through a public OData REST API (`/api/data/v9.2`). This tool authenticates with Azure AD using the client credentials flow (App Registration → access token) and queries that same API directly.

The Azure credentials in `.env` are never sent to the frontend. All Dataverse communication happens server-side in the Node.js backend.

---

## Roadmap

- [x] Active Layer Scanner
- [x] Scan history
- [x] Option Set Guard with restore
- [x] Deployment Readiness Checker
- [x] Environment Comparison
- [x] Auto-fix preview (dry-run)
- [ ] Apply fixes (enable flows, set env var defaults)
- [ ] Export report as PDF / CSV
- [ ] Multi-environment dashboard
- [ ] Scheduled/automated scan runs
