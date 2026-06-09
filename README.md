# Active Layer Auditor

A full-stack web app that scans a Microsoft Dataverse environment and flags unmanaged active-layer customizations before solution export.

## What it does

When developers make changes directly inside a Dataverse environment (outside of a managed solution), those changes sit in the **active layer**. If a solution is exported without cleaning up the active layer, those changes can be lost or cause conflicts in production.

Active Layer Auditor connects to your environment, scans all workflows, business rules, flows, and custom entities, and classifies each as:

| Status | Meaning |
|--------|---------|
| **Active Layer** | Unmanaged changes exist on top of a managed component — export risk |
| **Unmanaged** | Component has never been part of any managed solution |
| **Base Layer** | Clean — component is fully managed |

## Architecture

```
frontend/   React + TypeScript + Vite + Tailwind
backend/    Node.js + Express + TypeScript
data/       Local scan history (JSON, gitignored)
```

The frontend sends a scan request to the backend, which authenticates with Azure AD and calls the Dataverse Web API. Results are returned to the frontend and saved locally for history.

## Prerequisites

- Node.js 18+
- An Azure AD App Registration with access to the target Dataverse environment
- The App Registration must be added as an **Application User** in the Dataverse environment with an appropriate security role

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd active-layer-auditor
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `backend/.env` with your Azure credentials:

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

### 3. Set up the frontend

```bash
cd frontend
npm install
```

Optionally create `frontend/.env.local` if the backend runs on a different port:

```env
VITE_API_URL=http://localhost:3001
```

## Running locally

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npx ts-node src/index.ts
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173), paste your Dataverse environment URL (e.g. `https://yourorg.crm.dynamics.com`), and click **Run Scan**.

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | App Registration client ID |
| `AZURE_CLIENT_SECRET` | App Registration client secret |
| `PORT` | Port to run the backend on (default: `3001`) |
| `FRONTEND_URL` | Allowed CORS origin (default: `http://localhost:5173`) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (default: `http://localhost:3001`) |

## Project structure

```
active-layer-auditor/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express server entry point
│   │   ├── dataverse.ts      # Dataverse API client + scan logic
│   │   ├── db.ts             # Scan history (JSON file storage)
│   │   ├── types.ts          # Shared TypeScript types
│   │   └── routes/
│   │       ├── scan.ts       # POST /api/scan
│   │       └── history.ts    # GET /api/scans
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── types.ts
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── ScanForm.tsx
│   │       ├── ResultsTable.tsx
│   │       ├── StatusBadge.tsx
│   │       └── EmptyState.tsx
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
└── docs/
    └── project-plan.md
```

## Roadmap

- [x] V1 — Frontend dashboard with mock data
- [x] V2 — Express backend with scan history
- [x] V3 — Live Dataverse integration via Azure AD
- [ ] V4 — Authentication UI (user login instead of app credentials)
- [ ] V5 — Export report as CSV/PDF
