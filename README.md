# Vantage

Power Platform and Azure DevOps engineering toolkit for teams working with Dataverse and Azure DevOps pipelines.

## What it does

- **Active Layer Scanner** — find unmanaged customizations that could break a deployment
- **Option Set Guard** — detect and restore option set values overwritten by solution imports
- **Deployment Readiness Checker** — 6-check pass/fail report before any Greymatter deployment
- **Environment Comparison** — diff two Dataverse environments across solutions, flows, variables, and connection refs
- **Cloud Flow Monitor** — health dashboard, silent trigger detection, connection ref blast radius map
- **Pipeline Health Dashboard** — success rates, sparklines, flaky detection, error diagnosis with suggested fixes
- **Pipeline Optimizer** — scans YAML pipelines, applies 29 performance rules, opens a draft PR — up to 11.5 hrs saved per run

## Download and run

**No installs required.**

1. Go to [**Releases**](../../releases/latest) and download the latest `vantage-vX.X.X.zip`
2. Extract the zip anywhere on your machine
3. Double-click **`vantage.exe`**
4. Your browser opens automatically — enter your Azure credentials in the setup screen

That's it. Your credentials are saved locally and you never have to enter them again.

> **Windows security warning:** If you see "Windows protected your PC", click **More info → Run anyway**. This is expected for apps that aren't commercially code-signed.

---

## Features

### 01 · Active Layer Scanner

Scans a Dataverse environment and identifies components in the **active layer** — unmanaged customizations that could cause issues during solution export or deployment.

| Status | Meaning |
|---|---|
| **Active Layer** | Unmanaged change on top of a managed component — export risk |
| **Unmanaged** | Component has never been part of any managed solution |
| **Base Layer** | Clean — fully managed |

Results are searchable, filterable by status, and exportable to CSV. Every scan is saved to local history.

---

### 02 · Option Set Guard

Three tools in one page for protecting option set values that Greymatter deployments routinely overwrite.

**Option Set Guard** — compares live environment values against the pinned client config and restores any drift with one click.

**Document vs Dev** — paste a table from Microsoft Loop, Excel, Google Sheets, or any TSV-producing app and compare it against the live dev environment. Handles blank lines, reversed columns, CRLF line endings, and automatically prefers global option sets over local ones.

**Environment Comparison** — diff option set values between any two environments side by side.

---

### 03 · Deployment Readiness Checker

Runs 6 automated checks in parallel and produces a single pass/warn/fail report before a Greymatter deployment.

| Check | What it validates |
|---|---|
| Active Layer | No unmanaged customizations on managed components |
| Cloud Flows | All required flows are turned on |
| Solutions | Versions consistent, no duplicate managed layers |
| Environment Variables | All vars have values or defaults |
| Connection References | All refs connected and healthy |
| Option Sets | Protected values match the pinned client config |

Includes a fix preview — a dry-run that identifies what can be auto-remediated before anything is changed.

---

### 04 · Environment Comparison

Diffs two Dataverse environments side by side across solutions, environment variables, connection references, and cloud flows. Each dimension is a collapsible section with counts and a detailed table.

---

### 05 · Cloud Flow Monitor

**Flow Health** — every flow's status, last run, trigger type, and connection ref usage.

**Silent Trigger Detection** — flags flows that look enabled but have never fired or haven't triggered in 7+ days.

**Out of Sync** — compares flow states between two environments.

**Connection Reference Health Map** — every connection ref, its credential status, and blast radius if it breaks. Includes a dependency graph and per-connection mini chart.

**Auto-fix** — finds a healthy donor reference and copies its credential to a broken one. Requires confirmation before executing.

---

### 06 · Pipeline Health Dashboard

**Overview stats** — total runs, success rate, active pipelines, average duration.

**Per-pipeline sparklines** — last 10 run outcomes at a glance.

**Flaky detection** — pipelines alternating pass/fail on the same codebase.

**Run detail drawer** — failed steps, matching log lines, identified error, and plain-English suggested fix. 22 error patterns covered: npm, TypeScript, .NET/MSBuild, auth, network, disk, Docker, tests, timeout, and more.

**Cancel and Retry** — directly from the drawer, without going to Azure DevOps.

---

### 07 · Pipeline Optimizer

Analyzes YAML pipelines, applies safe fixes, and opens a draft PR on a new branch. Main is never touched.

**Single Pipeline** — pick from list → analyze → apply → draft PR created on `vantage/optimize-{name}`.

**Entire Repository** — scans all YAML pipelines concurrently, crawls templates across repos, deduplicates shared files, creates one PR per repository.

**29 optimization rules** across checkout settings, Power Platform task flags, artifact task upgrades, dependency caching, tool version upgrades, and parallelism recommendations. Maximum saving: **~11.5 hours per run**.

Branch safety: never pushes to main, always creates draft PRs, verifies branches exist before touching anything.

---

## Security

| Layer | What it does |
|---|---|
| Helmet | HTTP security headers — CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| CORS | Only `localhost:*` origins accepted |
| API key | Every `/api/*` request requires a valid `X-API-Key` header |
| Rate limiting | 200 requests per 15 minutes per IP |
| Payload limit | 100 kb max request body |
| MSAL OAuth2 | Dataverse tokens acquired server-side, never sent to the browser |
| URL validation | Enforces HTTPS and `.dynamics.com` — prevents SSRF |
| Path safety | Blocks `..`, bare `/`, and newlines in optimizer file paths |
| Credential storage | Saved to `data/config.json` on disk, never logged or returned to the client |

---

## Project structure

```
active-layer-auditor/
├── Start Vantage.bat         One-click launcher (Docker or Node.js)
├── Dockerfile                Multi-stage Docker build
├── docker-compose.yml
├── backend/
│   └── src/
│       ├── index.ts          Express server, middleware, route wiring
│       ├── config.ts         Credential storage and loading
│       ├── auth.ts           MSAL token acquisition + URL validation
│       ├── optimizer.ts      Pipeline optimizer (29 rules, ~1,360 lines)
│       ├── pipelines.ts      Pipeline health + 22 error patterns
│       ├── readiness.ts      6-check deployment readiness runner
│       └── routes/           One file per feature (12 route files)
├── frontend/
│   └── src/
│       ├── App.tsx           Router + setup gate
│       ├── pages/            One file per feature (10 pages)
│       └── components/       Shared UI components
├── config/clients/           Per-client option set config JSON files
└── data/                     Credentials + scan history (auto-created, gitignored)
```

---

## For developers

**Dev mode with hot reload:**
```
# Terminal 1
cd backend && npm install && npm run dev

# Terminal 2
cd frontend && npm install && npm run dev
```
Frontend: http://localhost:5173 · Backend: http://localhost:3001

The in-app setup wizard works in dev mode and writes credentials to `data/config.json`. Alternatively create `backend/.env` from `backend/.env.example`.

**Build the standalone exe locally:**
```
cd frontend && npm run build        # builds frontend/dist
cd ../backend && npm run build      # compiles TypeScript
npm run package                     # creates vantage.exe in the project root
```
Copy `frontend/dist` to a `public/` folder next to `vantage.exe` before running it.

**Docker:**
```
docker compose up --build
```

**Create a release:** Push a version tag and GitHub Actions builds and publishes everything automatically.
```
git tag v1.0.0
git push origin v1.0.0
```
