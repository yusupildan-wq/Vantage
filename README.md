# Vantage

Power Platform engineering toolkit — audit active layers, monitor cloud flows, guard option sets, validate deployment readiness, and compare environments across Dataverse.

---

## Before you start — what you need

- **Node.js 18 or higher** — download at [nodejs.org](https://nodejs.org)
- **Azure AD App Registration** credentials (Tenant ID, Client ID, Client Secret) — get these from whoever set up the app
- The App Registration must be added as an **Application User** in each Dataverse environment you want to scan, with a role that allows read access (e.g. System Administrator)

---

## First-time setup

Do this once when you first clone the repo.

### Step 1 — Install backend dependencies

```
cd backend
npm install
```

### Step 2 — Create the backend config file

In the `backend` folder, create a file called `.env` (no extension, just `.env`).

Paste this into it and fill in the real values:

```
AZURE_TENANT_ID=paste-your-tenant-id-here
AZURE_CLIENT_ID=paste-your-client-id-here
AZURE_CLIENT_SECRET=paste-your-client-secret-here
```

> These credentials are never sent to the browser. All Dataverse communication happens in the backend.

### Step 3 — Install frontend dependencies

Open a **new terminal** in the project root:

```
cd frontend
npm install
```

### Step 4 — Create the frontend config file

In the `frontend` folder, create a file called `.env`:

```
VITE_API_URL=http://localhost:3001
```

> This tells the frontend where the backend is running. Do not change this unless you changed the backend port.

---

## Running the app

You need **two terminals open at the same time** — one for the backend, one for the frontend. Both must be running.

**Terminal 1 — start the backend**
```
cd backend
npm run dev
```
You should see: `Backend running on http://localhost:3001`

**Terminal 2 — start the frontend**
```
cd frontend
npm run dev
```
You should see: `Local: http://localhost:5173`

Then open [http://localhost:5173](http://localhost:5173) in your browser.

> If you close either terminal, the app will stop working. Keep both running while you use the tool.

---

## When you pull new changes from the repo

After running `git pull`, reinstall dependencies before starting the app:

```
cd backend && npm install
cd frontend && npm install
```

You do not need to recreate your `.env` files.

---

## Features

### 01 · Active Layer Scanner
Scans a Dataverse environment and identifies components sitting in the **active layer** — unmanaged customizations that could cause issues during solution export or deployment.

| Status | Meaning |
|---|---|
| **Active Layer** | Unmanaged change on top of a managed component — export risk |
| **Unmanaged** | Component has never been part of any managed solution |
| **Base Layer** | Clean — component is fully managed |

Results are searchable, filterable by status, and exportable to CSV.

### 02 · Option Set Guard
Three tools in one page:
- **Option Set Guard** — validates that critical option set values match the expected configuration and restores any that have drifted
- **Document vs Dev** — paste a table from any app (Loop, Excel, Google Sheets, Notion) and compare it against live dev environment values
- **Environment Comparison** — diff option set values between two environments side by side

### 03 · Deployment Readiness Checker
Runs automated checks across an environment and produces a pass/fail report covering: active layer components, cloud flow states, solution presence, environment variables, connection references, and option set integrity. Includes a fix preview showing what can be auto-remediated vs. what requires manual action.

### 04 · Environment Comparison
Diffs two Dataverse environments side by side across solutions, environment variables, connection references, and cloud flows — highlighting what's different, missing, or extra.

### 05 · Cloud Flow Monitor
Full visibility into every cloud flow without clicking through Power Apps.

- **Flow Health** — run history, failure counts, and last error messages for the past 7 days
- **Silent Trigger Detection** — flags enabled flows that haven't triggered in 7+ days or have never run
- **Out of Sync** — compares flow states between two environments to surface configuration drift
- **Connection Reference Health Map** — shows every connection reference, whether it has a live credential, which flows depend on it, and the blast radius if it breaks. Includes a visual graph and per-connection mini blast radius chart
- **Auto-fix** — for broken Dataverse connection references, finds a healthy donor reference and copies its credential across (requires confirmation before executing)

---

## Project structure

```
vantage/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry point
│   │   ├── dataverse.ts          # Dataverse API client + scan logic
│   │   ├── optionsets.ts         # Option Set Guard logic
│   │   ├── pastecompare.ts       # Document vs Dev paste parser
│   │   ├── readiness.ts          # Deployment Readiness logic
│   │   ├── comparison.ts         # Environment Comparison logic
│   │   ├── remediation.ts        # Auto-fix plan builder
│   │   ├── flows.ts              # Cloud Flow health + trigger detection
│   │   ├── connectionrefs.ts     # Connection Reference health + auto-fix
│   │   ├── types.ts              # Shared TypeScript types
│   │   └── routes/               # Express route handlers
│   ├── .env                      # Your credentials — create this, never commit it
│   ├── .env.example              # Template showing what .env needs
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                # One file per page
│   │   ├── components/           # Shared UI components
│   │   └── hooks/                # Shared React hooks (e.g. URL persistence)
│   ├── .env                      # Your frontend config — create this
│   ├── .env.example              # Template showing what .env needs
│   └── package.json
├── config/
│   └── clients/                  # Per-client option set config JSON files
└── data/                         # Scan history — auto-created, gitignored
```

---

## How authentication works

The Azure credentials in `backend/.env` are used server-side only. The backend acquires a token from Azure AD using the client credentials flow, then uses that token to call the Dataverse Web API (`/api/data/v9.2`). The frontend never sees the credentials and never calls Dataverse directly.
