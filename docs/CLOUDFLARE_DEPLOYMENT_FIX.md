# OmniAI — Cloudflare Workers Frontend Deployment Diagnosis & Fix

**Date**: November 3, 2026  
**Auditor**: Antigravity Automated Verification Agent  
**Live URL**: `https://omniai.aniket-agr2007.workers.dev/`  
**Repository**: `https://github.com/Aniketagr07/Multi_Model_AI_Agent`

---

## 1. Root Cause Analysis

### Error 1: "Cannot use assets with a binding in an assets-only Worker"
* **Mechanism**: In Cloudflare Workers with Static Assets, an **assets-only Worker** serves pre-compiled static files directly from Cloudflare's edge CDN without running custom Worker runtime JavaScript.
* **Failure Trigger**: Specifying `"binding": "ASSETS"` inside `wrangler.json` without defining a Worker script entry point (`"main": "..."`) violates Wrangler's configuration schema. The `ASSETS` binding is only valid when a Worker script needs programmatic access (`env.ASSETS.fetch(request)`).
* **Resolution**: Removed `"binding": "ASSETS"` from both root `wrangler.json` and `frontend/wrangler.json`.

### Error 2: Cloudflare skips the frontend build (`bun install` -> `npx wrangler deploy`)
* **Mechanism**: When Cloudflare Dashboard's **Build command** is set to `None`, Cloudflare's CI/CD runs the package manager install (`bun install` or `npm install`) and immediately executes the configured **Deploy command** (`npx wrangler deploy`).
* **Failure Trigger**: Because no build step ran, `frontend/dist` was either empty or missing, resulting in deployment failures or blank page outputs.
* **Resolution**:
  1. Configured Wrangler's native `"build"` hook in `wrangler.json`:
     ```json
     "build": {
       "command": "npm --prefix frontend install && npm --prefix frontend run build"
     }
     ```
     This ensures that whenever `wrangler deploy` (or `npx wrangler deploy`) is invoked, Wrangler **automatically runs the Vite build before deploying assets**.
  2. Added `"predeploy": "npm run build"` and updated `"deploy": "npm run build && wrangler deploy"` in root `package.json` and `frontend/package.json`.

---

## 2. Files Changed & Added

| File Path | Status | Purpose |
|---|---|---|
| `wrangler.json` | **Updated** | Removed `"binding": "ASSETS"`, added native `"build"` hook to execute frontend install & build before deploy, kept `"directory": "./frontend/dist"` and `"not_found_handling": "single-page-application"`. |
| `frontend/wrangler.json` | **Updated** | Subdirectory Wrangler config removed `"binding": "ASSETS"`, added `"build": { "command": "npm run build" }`, kept `"directory": "./dist"`. |
| `package.json` | **Updated** | Added `"predeploy": "npm run build"` and chained `"deploy": "npm run build && wrangler deploy"`. |
| `frontend/package.json` | **Updated** | Added `"predeploy": "npm run build"` and chained `"deploy": "npm run build && wrangler deploy"`. |
| `frontend/public/_headers` | **Created** | HTTP security headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`) copied directly into `dist/`. |
| `frontend/public/_redirects` | **Created** | Cloudflare SPA catch-all rewrite rule (`/* /index.html 200`). |
| `frontend/src/services/api.js` | **Updated** | Flexible `API_BASE_URL` resolution prioritizing `VITE_API_BASE_URL`, runtime `window.__OMNIAI_API_URL__`, and `localStorage`. |
| `frontend/src/hooks/useRealtimeConversation.js` | **Updated** | WebSocket endpoint URL dynamically tracks the active API base URL. |
| `backend/app/main.py` | **Updated** | Expanded CORS `allow_origin_regex` to permit both `https://*.vercel.app` and `https://*.workers.dev`. |

---

## 3. Correct Wrangler Configuration

### Root `wrangler.json` (Used for Root Directory `/`)
```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "omniai",
  "compatibility_date": "2026-11-03",
  "build": {
    "command": "npm --prefix frontend install && npm --prefix frontend run build"
  },
  "assets": {
    "directory": "./frontend/dist",
    "not_found_handling": "single-page-application"
  }
}
```

### Subdirectory `frontend/wrangler.json` (Used if Root Directory is `frontend`)
```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "omniai",
  "compatibility_date": "2026-11-03",
  "build": {
    "command": "npm run build"
  },
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

---

## 4. Cloudflare Dashboard Settings

In the [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **`omniai`** -> **Settings** -> **Build & Deploy** -> **Edit**:

| Setting | Recommended Value | Notes |
|---|---|---|
| **Root directory** | `/` | Monorepo root |
| **Build command** | `npm run build` | Can also be `npm --prefix frontend install && npm --prefix frontend run build` |
| **Deploy command** | `npx wrangler deploy` | Auto-triggers `build.command` defined in `wrangler.json` |
| **Branch** | `main` | Production branch |

### Build Environment Variables
Under **Settings** -> **Variables and Secrets** (or **Build Environment Variables**):
* **Variable Name**: `VITE_API_BASE_URL`
* **Value**: `https://your-omniai-backend.onrender.com` (Your deployed Render backend URL)

---

## 5. Verification & Test Results

### 1. Frontend Dependency Installation
* **Command**: `npm --prefix frontend install`
* **Result**: **SUCCESS** (`up to date in 3s`, exit code 0).

### 2. Frontend Production Build
* **Command**: `npm --prefix frontend run build`
* **Result**: **SUCCESS** (320 modules transformed in 7.60s, exit code 0).
* **Generated Assets**:
  - `frontend/dist/index.html` (915 bytes)
  - `frontend/dist/assets/index-Cm73Pzi1.css` (57.50 kB)
  - `frontend/dist/assets/index-C8kvpRhB.js` (683.62 kB)
  - `frontend/dist/assets/index-CFKb_IS8.js` (6,155.41 kB)
  - `frontend/dist/_headers` (147 bytes)
  - `frontend/dist/_redirects` (24 bytes)

### 3. Wrangler Configuration Validation (`wrangler deploy --dry-run`)
* **Command**: `npx wrangler deploy --dry-run`
* **Wrangler Version**: `wrangler 4.156.2`
* **Execution Log**:
  ```text
  ⛅️ wrangler 4.156.2
  ────────────────────
  [custom build] Running: npm --prefix frontend install && npm --prefix frontend run build
  [custom build] up to date, audited 361 packages in 3s
  [custom build] > omniai-frontend@0.1.0 build
  [custom build] > vite build
  [custom build] vite v5.4.21 building for production...
  [custom build] ✓ 320 modules transformed.
  [custom build] rendering chunks...
  [custom build] computing gzip size...
  [custom build] dist/index.html                     0.91 kB │ gzip:     0.56 kB
  [custom build] dist/assets/index-Cm73Pzi1.css     57.50 kB │ gzip:    10.16 kB
  [custom build] dist/assets/index-C8kvpRhB.js     683.62 kB │ gzip:   181.44 kB
  [custom build] dist/assets/index-CFKb_IS8.js   6,155.41 kB │ gzip: 2,174.95 kB
  [custom build] ✓ built in 7.23s
  ✨ Read 7 files from the assets directory D:\Lpu lecture ppt\Sem 3\CSE 276\Project\1\frontend\dist
  Total Upload: 0.37 KiB / gzip: 0.27 KiB
  No bindings found.
  --dry-run: exiting now.
  ```
* **Result**: **SUCCESS (Exit Code 0)**. Zero bindings errors, build hook executed automatically, and all assets validated.

### 4. Vitest Unit & Integration Test Suite
* **Command**: `npm --prefix frontend test -- --run`
* **Result**: **14 / 14 suites passed, 70 / 70 tests passed (100%)**.

---

## 6. How to Deploy to Cloudflare

1. **Commit and push** the updated files:
   ```bash
   git add .
   git commit -m "fix(cloudflare): configure assets-only worker build hook and remove invalid asset binding"
   git push origin main
   ```

2. **Trigger deployment** in Cloudflare Dashboard:
   - Navigate to **Workers & Pages** -> **`omniai`** -> **Deployments**.
   - Cloudflare will run `npx wrangler deploy`.
   - Wrangler will execute the build command `npm --prefix frontend install && npm --prefix frontend run build`, generate the assets in `frontend/dist`, and upload them as an assets-only Worker without binding conflicts.
   - The live site `https://omniai.aniket-agr2007.workers.dev/` will load the full OmniAI user interface.
