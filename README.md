# Vantage

Power Platform and Azure DevOps engineering toolkit — audit active layers, monitor cloud flows, guard option sets, validate deployment readiness, compare environments, monitor pipeline health, and automatically optimize YAML pipelines.

---

## Before you start — what you need

- **Node.js 18 or higher** — download at [nodejs.org](https://nodejs.org)
- **Azure AD App Registration** credentials (Tenant ID, Client ID, Client Secret) — get these from whoever set up the app
- The App Registration must be added as an **Application User** in each Dataverse environment you want to scan, with a role that allows read access (e.g. System Administrator)
- **Azure DevOps PAT** — needed for Features 06 and 07. Generate at Azure DevOps → User Settings → Personal Access Tokens. Required scopes: Build (Read), Code (Read & Write)

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
API_KEY=generate-a-random-string-here
AZURE_DEVOPS_PAT=paste-your-pat-here
```

To generate a random `API_KEY`:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> These credentials are never sent to the browser. All external API communication happens in the backend.

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
VITE_API_KEY=same-value-as-backend-API_KEY
```

> `VITE_API_KEY` must match the `API_KEY` you set in the backend `.env`. Every request the frontend makes is authenticated with this key.

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

> If you close either terminal, the app stops working. Keep both running while you use the tool.

---

## When you pull new changes

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
| **Base Layer** | Clean — fully managed |

Results are searchable, filterable by status, and exportable to CSV. Every scan is saved to local history and accessible from the history tab.

---

### 02 · Option Set Guard

Three tools in one page for protecting option set values that Greymatter deployments routinely overwrite.

**Option Set Guard** — compares live environment values against the pinned client config (`config/clients/andrews.json`) and highlights any drift. Restores overwritten values back to the correct state with one click.

**Document vs Dev** — paste a table copied from Microsoft Loop, Excel, Google Sheets, or any TSV-producing app and compare it against the live dev environment. The parser handles blank lines, reversed columns, CRLF line endings, and automatically prefers global option sets over local ones when both are present.

**Environment Comparison** — diff option set values between any two environments side by side, showing which values are different, missing, or extra.

---

### 03 · Deployment Readiness Checker

Runs 6 automated checks in parallel against a Dataverse environment and produces a single pass/warn/fail report before a Greymatter deployment.

| Check | What it validates |
|---|---|
| Active Layer | No unmanaged customizations on managed components |
| Cloud Flows | All required flows are turned on |
| Solutions | Versions are consistent, no duplicate managed layers |
| Environment Variables | All vars have values or defaults |
| Connection References | All connection refs are connected and healthy |
| Option Sets | Protected values match the pinned client config |

Includes a **fix preview** — a dry-run endpoint that identifies what can be auto-remediated (disabled flows, missing env var defaults, broken connection refs) and returns a plan for review before anything is changed.

---

### 04 · Environment Comparison

Diffs two Dataverse environments side by side across four dimensions:

- **Solutions** — version drift, missing or extra solutions
- **Environment Variables** — value mismatches, missing vars
- **Connection References** — status differences, missing refs
- **Cloud Flows** — on/off state differences, missing flows

Each dimension is a collapsible section with a count badge and a detailed table.

---

### 05 · Cloud Flow Monitor

Complete cloud flow visibility without clicking through Power Apps.

**Flow Health** — every flow's status, last run time, trigger type, and connection ref usage. Searchable and filterable.

**Silent Trigger Detection** — flags enabled flows that have never fired or haven't triggered in 7+ days. These are flows that look healthy in the UI but are silently doing nothing.

**Out of Sync** — compares flow states between two environments to surface configuration drift. Shows which flows are on in one environment but off in another.

**Connection Reference Health Map** — every connection reference with its live credential status, which flows depend on it, and the blast radius if the connection breaks. Includes a visual dependency graph and per-connection mini blast-radius chart.

**Auto-fix** — for broken Dataverse connection references, finds a healthy donor reference with the same connector type and copies its credential across. Requires explicit confirmation before executing.

---

### 06 · Pipeline Health Dashboard

Monitors Azure DevOps pipeline runs without leaving Vantage.

**Overview stats** — total runs, success rate, active pipelines, average duration across the selected time period.

**Per-pipeline sparklines** — inline SVG charts showing the last 10 run outcomes at a glance.

**Flaky detection** — automatically identifies pipelines that alternate between passing and failing on the same codebase, indicating environment or agent instability.

**Slowest pipelines** and **Needs Attention** panels highlight where to focus optimization effort.

**Run table** — full list of recent runs with status filter tabs (All / Running / Succeeded / Failed / Cancelled). Click any failed run to open the detail drawer.

**Run detail drawer** — shows each failed step's name, the relevant log lines, and an automatically identified error with a plain-English suggested fix. 22 error patterns are matched:

npm errors · TypeScript errors · .NET / MSBuild errors · missing .NET SDK · authentication failures · insufficient permissions · connection refused · connection timeout · DNS failures · disk full · Docker errors · image not found · test failures · pipeline timeout · file not found · permission denied · command not found · Azure resource not found · non-zero exit codes · and more

**Cancel and Retry** — cancel a running build or re-queue a failed one directly from the drawer, without going to Azure DevOps.

---

### 07 · Pipeline Optimizer

Analyzes YAML pipelines for performance problems, applies all safe fixes automatically, and creates a draft PR on a new branch. Main is **never** modified.

#### Single Pipeline mode

Pick any YAML pipeline from the list → click Analyze → review the findings across four stat cards (estimated time saved, number of optimizations, files changed, target branch) → apply. The tool creates branch `vantage/optimize-{pipeline-name}` and opens a draft PR.

#### Entire Repository mode

One click scans every YAML pipeline in the project simultaneously (3 concurrent workers), crawls every template file they reference across all repositories (up to 50 files per pipeline), deduplicates shared template files so they're only changed once, and creates one draft PR per repository with all changes in a single commit.

#### Optimization rules — 29 total

**Checkout:**
- Shallow clone (`fetchDepth: 1`) — cuts full-history checkout to seconds
- Remove `clean: true` — stops wiping the workspace on every run
- Disable LFS (`lfs: false`) — skips binary pointer downloads
- Disable submodule fetch (`submodules: false`)
- Set `persistCredentials: false`

**Power Platform (biggest wins for long-running pipelines):**
- Async solution import (`asyncOperation: true`) — **−90 min** — prevents the agent blocking for the full import duration
- Async solution export — **−45 min** — prevents connection timeouts on large solution exports
- Async publish customizations — −20 min
- Skip import if same version (`skipLowerVersion: true`) — **−60 min** — skips the entire import if nothing changed
- Import safe flags (`pp-import-fast-safe-flags`) — −20 min
- Import retry on transient failure — −15 min
- Cache PAC CLI installation — −15 min
- Remove unmanaged export step when managed export exists — −10 min
- Stable solution hash to prevent unnecessary re-imports — −120 min
- Skip flow toggle when import was skipped — −6 min
- Deployment control parameters guard — −30 min

**Artifact tasks:**
- Upgrade `PublishBuildArtifacts@1` → `PublishPipelineArtifact@1` (3–5× faster)
- Upgrade `DownloadBuildArtifacts@0` → `DownloadPipelineArtifact@2` (2–3× faster)

**Caching:**
- npm packages via `Cache@2` — −12 min
- Yarn packages — −12 min
- NuGet packages — −10 min
- .NET restore packages — −10 min
- pip packages — −8 min
- Maven local repository — −10 min
- PowerShell modules (Install-Module) — −8 min

**Tool upgrades:**
- `NuGetToolInstaller@0` → `@1`
- `UseDotNet@1` → `@2`
- MSBuild parallel flag (`/m`)
- VSTest flaky test retry

**Cleanup:**
- Remove `system.debug: true` — eliminates thousands of verbose log lines
- Set `timeoutInMinutes` on jobs with no timeout

**Parallelism (manual review recommendations):**
- Parallelize environment deployment chain — **−360 min** — for sequential PP multi-environment deploys
- Run independent stages in parallel — −120 min

Maximum possible saving if all rules fire: **~11.5 hours per run**.

#### Branch safety

Seven hard guarantees on every apply:
1. Will never push to `refs/heads/main`
2. Target branch must match `OPTIMIZER_TARGET_BRANCH` env var (default: `main`)
3. Verifies the target branch exists before creating anything
4. Checks the optimizer branch doesn't already exist
5. Creates branch and commit in two separate API calls (avoids zero-objectId race)
6. All PRs are created as drafts — a human must review and merge
7. Requires `safetyAcknowledged: true` and `createDraftOnly: true` in the POST body

---

## Security

All enforced at the Express layer before any route handler runs:

| Layer | Implementation |
|---|---|
| HTTP security headers | `helmet` — sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc. |
| CORS | Only `localhost:*` origins allowed (or explicit `FRONTEND_URL`) |
| API key auth | Every `/api/*` request requires a valid `X-API-Key` header |
| Rate limiting | 200 requests per 15 minutes per IP via `express-rate-limit` |
| Payload size | `express.json({ limit: '100kb' })` |
| MSAL OAuth2 | Client credentials flow for Dataverse — tokens acquired server-side, never sent to browser |
| Environment URL validation | Enforces HTTPS and `.dynamics.com` hostname — prevents SSRF |
| Optimizer path safety | Blocks `..`, bare `/`, and newline characters in repository file paths |
| Startup check | Server refuses to start if any required env var is missing |

---

## Project structure

```
vantage/
├── backend/
│   ├── src/
│   │   ├── index.ts              Express server, security middleware, route wiring
│   │   ├── auth.ts               MSAL token acquisition + URL validation
│   │   ├── dataverse.ts          Dataverse API client factory
│   │   ├── types.ts              Shared TypeScript interfaces
│   │   ├── db.ts                 JSON-file scan history store
│   │   ├── optimizer.ts          Pipeline optimizer engine (29 rules, repo scanner)
│   │   ├── pipelines.ts          Pipeline health + error analysis (22 patterns)
│   │   ├── readiness.ts          Deployment readiness checks (6 parallel)
│   │   ├── comparison.ts         Environment comparison logic
│   │   ├── flows.ts              Cloud flow health + trigger detection
│   │   ├── optionsets.ts         Option set check + restore
│   │   ├── connectionrefs.ts     Connection reference health + auto-fix
│   │   ├── remediation.ts        Auto-fix plan builder
│   │   ├── pastecompare.ts       TSV paste parser (Loop, Excel, Sheets)
│   │   ├── loopcompare.ts        Loop document comparison
│   │   └── routes/               One router file per domain (10 files)
│   ├── .env                      Your credentials — create this, never commit it
│   ├── .env.example              Template showing what .env needs
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               Router + route definitions
│   │   ├── api.ts                fetch wrapper that attaches API key header
│   │   ├── pages/                One file per feature page (7 pages)
│   │   ├── components/           Shared UI components (8 components)
│   │   └── hooks/                useEnvironmentUrl, useSmoothScroll
│   ├── .env                      Your frontend config — create this
│   ├── .env.example              Template
│   └── package.json
├── config/
│   └── clients/                  Per-client option set config JSON files
└── data/                         Scan history — auto-created, gitignored
```

---

## Environment variables reference

**`backend/.env`**

| Variable | Required | Description |
|---|---|---|
| `AZURE_TENANT_ID` | Yes | Entra ID / Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Yes | App Registration client ID |
| `AZURE_CLIENT_SECRET` | Yes | App Registration client secret |
| `API_KEY` | Yes | Shared secret for all API requests — generate randomly |
| `AZURE_DEVOPS_PAT` | For 06 + 07 | ADO Personal Access Token (Build Read + Code Read/Write) |
| `PORT` | No | Backend port — default `3001` |
| `FRONTEND_URL` | No | Locks CORS to a specific origin in production |
| `OPTIMIZER_TARGET_BRANCH` | No | Branch the optimizer is allowed to target — default `main` |

**`frontend/.env`**

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend base URL — e.g. `http://localhost:3001` |
| `VITE_API_KEY` | Yes | Must match `API_KEY` in backend `.env` |

---

## How authentication works

**Dataverse (Features 01–05):** The Azure credentials in `backend/.env` are used server-side only. The backend acquires an OAuth2 token from Entra ID using the client credentials flow, then uses that token to call the Dataverse Web API (`/api/data/v9.2`). The frontend never sees the credentials.

**Azure DevOps (Features 06–07):** The `AZURE_DEVOPS_PAT` is base64-encoded per-request into a `Basic` auth header sent directly to `dev.azure.com`. The PAT is stored only in `backend/.env` and is never returned to the browser.

**Frontend → Backend:** Every request from the frontend includes an `X-API-Key` header. The backend validates this against `process.env.API_KEY` before any route handler runs. Requests without a valid key receive `401 Unauthorized`.
