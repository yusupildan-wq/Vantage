# Vantage

> Internal Power Platform and Azure DevOps engineering toolkit — built to replace manual checks, spreadsheet audits, and hours of pipeline debugging with a single desktop app.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-0078D4?style=flat-square&logo=microsoftazure&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

---

## Screenshots

<!-- Add screenshots here — suggested: dashboard overview, pipeline optimizer results, setup wizard -->
> *Screenshots coming soon*

---

## What it does

| Feature | Description |
|---|---|
| **Active Layer Scanner** | Identifies unmanaged Dataverse customizations that could break a managed solution deployment |
| **Option Set Guard** | Detects and restores option set values overwritten by solution imports — compares against pinned config |
| **Deployment Readiness** | Runs 6 parallel checks (active layers, flows, solutions, env vars, connection refs, option sets) and produces a pass/fail report |
| **Environment Comparison** | Diffs two Dataverse environments across solutions, flows, variables, and connection references |
| **Cloud Flow Monitor** | Flow health dashboard, silent trigger detection, connection ref blast radius map with auto-fix |
| **Pipeline Health** | Azure DevOps run history, sparklines, flaky detection, error pattern matching with suggested fixes, cancel/retry |
| **Pipeline Optimizer** | Scans YAML pipelines, applies 29 performance rules, opens a draft PR — up to **11.5 hours saved per run** |

---

## Download and run

**No installs required — just download and double-click.**

1. Go to [**Releases**](../../releases/latest) and download the latest `vantage-vX.X.X.zip`
2. Extract the zip anywhere on your machine
3. Double-click **`vantage.exe`**
4. Your browser opens automatically — a setup wizard guides you through entering credentials on first launch

Credentials are saved locally. You never enter them again.

> **Windows security prompt:** Click **More info → Run anyway** if Windows SmartScreen appears. Expected for unsigned apps.

---

## Tech stack

| Layer | Details |
|---|---|
| **Backend** | Node.js · Express · TypeScript · compiled with `tsc` |
| **Frontend** | React 18 · Vite · Tailwind CSS · React Router v7 |
| **Authentication** | MSAL `ConfidentialClientApplication` client credentials flow (Dataverse) · PAT Basic auth (Azure DevOps) |
| **APIs consumed** | Microsoft Dataverse OData v9.2 · Azure DevOps Build REST API · Azure DevOps Git REST API |
| **Security middleware** | Helmet (CSP, HSTS, X-Frame-Options) · CORS lockdown · API key auth · rate limiting · SSRF prevention · path traversal blocking |
| **Distribution** | `@yao-pkg/pkg` standalone exe · Docker multi-stage build · GitHub Actions CI/CD release pipeline |
| **Data** | JSON file store for scan history and credentials · in-app first-launch setup wizard |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  vantage.exe  (Node.js + Express, self-contained)        │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │  React SPA   │    │  Express API                 │   │
│  │  (served     │───▶│  /api/*  (X-API-Key auth)    │   │
│  │  from /public│    │  /setup/* (unauthenticated)  │   │
│  │  folder)     │    │  /health  /config             │   │
│  └──────────────┘    └──────────┬───────────────────┘   │
│                                 │                        │
└─────────────────────────────────┼────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     Dataverse OData        Azure DevOps         Azure AD / MSAL
     (environments,         (pipelines,          (OAuth2 token
      flows, solutions)      repos, PRs)          acquisition)
```

---

## Features

### 01 · Active Layer Scanner

Connects to any Dataverse environment via the OData v9.2 REST API, queries all customizable component types, and identifies anything sitting in the active (unmanaged) layer on top of managed solutions.

| Status | Meaning |
|---|---|
| **Active Layer** | Unmanaged change on top of a managed component — export risk |
| **Unmanaged** | Component has never been part of any managed solution |
| **Base Layer** | Clean — fully managed |

Results are searchable, filterable by status, exportable to CSV, and saved to local history.

---

### 02 · Option Set Guard

Three tools in one page for protecting option set values that deployment pipelines routinely overwrite.

**Option Set Guard** — compares live environment values against a pinned client config and restores any drift with one click.

**Document vs Dev** — paste a table from Microsoft Loop, Excel, or Google Sheets and compare against the live environment. The parser handles blank lines, reversed columns, CRLF endings, and prefers global option sets over local when both are present. Includes 16 unit tests.

**Environment Comparison** — diff option set values between any two environments side by side.

---

### 03 · Deployment Readiness Checker

Runs 6 checks in parallel via `Promise.all` against a Dataverse environment and returns a single pass/warn/fail report.

| Check | What it validates |
|---|---|
| Active Layer | No unmanaged customizations on managed components |
| Cloud Flows | All required flows are enabled |
| Solutions | Consistent versions, no duplicate managed layers |
| Environment Variables | All vars have values or defaults |
| Connection References | All refs are connected and healthy |
| Option Sets | Protected values match the pinned client config |

Also includes a **dry-run fix preview** — identifies what can be auto-remediated (disabled flows, missing env var defaults, broken connection refs) and returns a plan for human review before any changes are made.

---

### 04 · Environment Comparison

Diffs two Dataverse environments in parallel across four dimensions: solutions, environment variables, connection references, and cloud flows. Each section is collapsible with a count badge and a detailed diff table.

---

### 05 · Cloud Flow Monitor

**Flow Health** — every flow's status, last run time, trigger type, and connection ref dependencies.

**Silent Trigger Detection** — flags enabled flows that have never fired or haven't triggered in 7+ days. Surfaces flows that look healthy in the Power Apps UI but are silently doing nothing.

**Out of Sync** — compares flow states between two environments to surface configuration drift.

**Connection Reference Health Map** — every connection ref, its live credential status, which flows depend on it, and the blast radius if it breaks. Includes a visual dependency graph.

**Auto-fix** — locates a healthy donor connection ref of the same connector type and copies its credential to the broken one. Requires explicit confirmation before executing.

---

### 06 · Pipeline Health Dashboard

**Overview stats** — total runs, success rate, active pipelines, average duration across a configurable time window.

**Per-pipeline sparklines** — inline SVG charts of the last 10 run outcomes, rendered client-side with no charting library.

**Flaky detection** — identifies pipelines that alternate pass/fail on the same codebase, indicating agent or environment instability rather than code issues.

**Run detail drawer** — fetches the build timeline and logs for a failed run, matches against 22 error patterns, and surfaces the identified error with a plain-English suggested fix.

Error patterns covered: npm (peer deps, network, missing scripts) · TypeScript · .NET/MSBuild · missing SDK · auth failures · permissions · ECONNREFUSED · timeouts · DNS · disk full · Docker daemon · image not found · test failures · job timeout · file not found · permission denied · command not found · Azure resource not found · non-zero exit codes

**Cancel and Retry** — cancel a running build or re-queue a failed one directly from the drawer.

---

### 07 · Pipeline Optimizer

Analyzes Azure DevOps YAML pipelines against 29 performance rules, applies all safe fixes in-place, and opens a draft PR. `refs/heads/main` is never touched.

**Single Pipeline mode** — select a definition → analyze → view findings with per-rule time estimates → apply → draft PR opened on `vantage/optimize-{name}`.

**Entire Repository mode** — scans every YAML pipeline concurrently (limit 3 parallel workers), crawls all referenced template files across repositories (up to 50 files per pipeline, recursive), deduplicates shared template files so each is only modified once, and creates one draft PR per repository containing all changes in a single commit.

**29 rules across 5 categories:**

| Category | Example rules | Max saving |
|---|---|---|
| Checkout | Shallow clone, disable LFS, remove clean | −41 min |
| Power Platform | Async import/export, skip same version, stable hash | **−386 min** |
| Artifacts | Upgrade to pipeline artifacts v2 | −18 min |
| Caching | npm, NuGet, pip, Maven, PowerShell modules | −70 min |
| Parallelism | Parallel env deploy chain, parallel stages | **−480 min** |

**Maximum combined saving: ~11.5 hours per run.**

Branch safety: verifies target branch exists, checks optimizer branch doesn't already exist, creates branch and commit in separate API calls, all PRs are drafts, requires explicit `safetyAcknowledged` flag in the request body.

---

## Security

| Layer | Implementation |
|---|---|
| HTTP security headers | `helmet` — CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| CORS | Only `localhost:*` origins accepted (or explicit `FRONTEND_URL`) |
| API key auth | Every `/api/*` request requires a valid `X-API-Key` header |
| Rate limiting | 200 requests / 15 min / IP via `express-rate-limit` |
| Payload size | 100 kb max via `express.json({ limit })` |
| OAuth2 token acquisition | MSAL `ConfidentialClientApplication` — tokens stay server-side |
| SSRF prevention | Environment URLs validated against HTTPS + `.dynamics.com` allowlist |
| Path traversal | Optimizer file paths checked for `..`, bare `/`, and newline characters |
| Credential storage | Written to `data/config.json`, never logged or returned to the client |
| Setup endpoint | `/setup/*` routes are unauthenticated by design — only functional before credentials exist |

---

## Project structure

```
active-layer-auditor/
├── vantage.exe               Standalone Windows executable (GitHub Releases)
├── public/                   Pre-built frontend (served by the exe)
├── Dockerfile                Multi-stage build (frontend → backend → Alpine runtime)
├── docker-compose.yml
├── Start Vantage.bat         Fallback launcher for Docker / Node.js dev environments
├── backend/
│   └── src/
│       ├── index.ts          Express server — security middleware, route wiring, static serving
│       ├── config.ts         Credential load/save/apply, pkg-aware data directory
│       ├── auth.ts           MSAL token acquisition, environment URL validation
│       ├── optimizer.ts      Pipeline optimizer engine (~1,360 lines, 29 rules)
│       ├── pipelines.ts      Pipeline health aggregation, 22 error pattern matchers
│       ├── readiness.ts      6-check parallel readiness runner
│       ├── flows.ts          Cloud flow health + silent trigger detection
│       ├── optionsets.ts     Option set comparison + restore
│       ├── connectionrefs.ts Connection reference health + auto-fix
│       ├── comparison.ts     Cross-environment diff engine
│       ├── pastecompare.ts   TSV paste parser (Loop / Excel / Sheets)
│       └── routes/           12 Express routers, one per domain
├── frontend/
│   └── src/
│       ├── App.tsx           Router + first-launch setup gate
│       ├── api.ts            Fetch wrapper — API key resolution, relative URL support
│       ├── pages/            10 page components
│       └── components/       Shared UI (Header, StatusBadge, charts, etc.)
└── data/                     Credentials + scan history — auto-created, gitignored
```

---

## For developers

**Dev mode with hot reload:**
```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```
Backend: http://localhost:3001 · Frontend: http://localhost:5173

The setup wizard works in dev mode and writes to `data/config.json`. You can also create `backend/.env` from `backend/.env.example` to skip the wizard.

**Build the standalone exe:**
```bash
cd frontend && npm run build       # output: frontend/dist/
cd ../backend && npm run build     # output: backend/dist/
npm run package                    # output: vantage.exe
# copy frontend/dist → public/ next to vantage.exe before running
```

**Docker:**
```bash
docker compose up --build          # serves everything on http://localhost:3001
```

**Publish a release** — GitHub Actions builds the exe and publishes automatically:
```bash
git tag v1.0.0 && git push origin v1.0.0
```
