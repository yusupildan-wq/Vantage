# Active Layer Auditor

A full-stack Power Platform engineering tool for auditing, validating, and comparing Microsoft Dataverse environments before deployment.

---

## Before you start — what you need

- **Node.js 18 or higher** — download at [nodejs.org](https://nodejs.org)
- **Azure AD App Registration** credentials (Tenant ID, Client ID, Client Secret) — get these from whoever set up the app
- The App Registration must be added as an **Application User** in each Dataverse environment you want to scan, with a role that allows read access (e.g. System Administrator)

---

## First-time setup

Do this once when you first clone the repo. Open a terminal in the `active-layer-auditor` folder.

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

Open a **new terminal** in the `active-layer-auditor` folder:

```
cd frontend
npm install
```

### Step 4 — Create the frontend config file

In the `frontend` folder, create a file called `.env` (no extension, just `.env`).

Paste this into it exactly as shown:

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

After running `git pull`, do this before starting the app again:

```
cd backend
npm install
```
```
cd frontend
npm install
```

Then start both terminals as normal. You do not need to recreate your `.env` files.

---

## Troubleshooting

**"Cannot reach the backend server"**
The backend is not running. Open a terminal, `cd backend`, run `npm run dev`, and keep it open.

**"Failed to fetch" / blank error**
Same as above — backend is not running, or it crashed on startup. Check the backend terminal for error messages.

**"Missing required environment variables"**
Your `backend/.env` file is missing or incomplete. Make sure it has all three lines: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.

**"No client config found for this environment"**
The environment URL you entered does not match any file in `config/clients/`. Ask whoever manages the tool for the correct config file and drop it in that folder.

**Backend crashes immediately**
Check the terminal output. The most common cause is a missing or malformed `backend/.env` file.

---

## Features

### 01 · Active Layer Scanner
Scans a Dataverse environment and identifies components sitting in the **active layer** — unmanaged customizations that could cause issues during solution export or deployment.

| Status | Meaning |
|---|---|
| **Active Layer** | Unmanaged change on top of a managed component — export risk |
| **Unmanaged** | Component has never been part of any managed solution |
| **Base Layer** | Clean — component is fully managed |

### 02 · Option Set Guard
Validates that critical option set values match an expected configuration. Detects value drift and can restore mismatched labels back to the expected state.

### 03 · Document vs Dev
Paste a table from any app (Loop, Excel, Google Sheets, Notion) and compare it against live dev environment option set values. Identifies mismatches, missing values, and unrecognised option sets.

### 04 · Deployment Readiness Checker
Runs automated checks across an environment and produces a pass/fail report covering: active layer components, cloud flow states, solution presence, environment variables, connection references, and option set integrity.

### 05 · Environment Comparison
Diffs two Dataverse environments side by side across solutions, environment variables, connection references, and cloud flows.

---

## Project structure

```
active-layer-auditor/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry point
│   │   ├── dataverse.ts          # Dataverse API client + scan logic
│   │   ├── optionsets.ts         # Option Set Guard logic
│   │   ├── pastecompare.ts       # Document vs Dev paste parser + comparison
│   │   ├── readiness.ts          # Deployment Readiness logic
│   │   ├── comparison.ts         # Environment Comparison logic
│   │   ├── remediation.ts        # Auto-fix plan builder (read-only)
│   │   ├── types.ts              # Shared TypeScript types
│   │   └── routes/               # Express route handlers
│   ├── .env                      # Your credentials — create this, never commit it
│   ├── .env.example              # Template showing what .env needs
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                # One file per page
│   │   └── components/           # Shared UI components
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
