# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (with auto-reload via nodemon)
npm run dev

# Production
npm start

# Tests
npm test

# Run a single test file
NODE_OPTIONS=--experimental-vm-modules npx jest tests/app.test.js
```

## Architecture

This is an Express.js web application template designed for GKE/Cloud Run deployment. It uses ES modules (`"type": "module"` in package.json).

**Entry point**: `index.js` — sets up Express, CORS, trust proxy (required for GKE load balancer), EJS templating, static files, and mounts routes.

**Routes**: `route/indexRouter.js` — all API endpoints live here. Key routes:
- `GET /` — renders `views/index.ejs` with version info
- `POST /api/chart-data` — fetches GitHub trending repos (last 30 days)
- `POST /api/popular-repos` — fetches repos with 10K+ stars
- `GET /healthz`, `GET /pod-health` — health checks for Kubernetes probes

**Database**: `mysql-connect.js` — exports a MySQL connection pool and a `pingDatabase()` function. Uses promise-based queries. Timezone is UTC+8 (Taipei). Pool has 15-minute idle timeout.

**Logging**: `log/userAccess.js` — Express middleware logging every request (IP, method, URL, status, response time) to `log/logs/access-YYYY-MM-DD.log`. Errors go to `log/logs/error-YYYY-MM-DD.log`.

**Error handling**: `log/asyncHandler.js` — wraps async route handlers to catch errors and return standardized JSON `{ status, message }` responses.

**Tracing**: `tracing.js` — OpenTelemetry setup targeting a Tempo instance. Must be imported before other modules if enabled. Configure via `TEMPO_IP` and `TEMPO_SERVICE_NAME` env vars.

## Environment Variables

Copy `env.example` to `.env`:
- `PORT` — app port (default: 3009)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` — MySQL credentials
- `TEMPO_IP`, `TEMPO_SERVICE_NAME` — distributed tracing (optional)
- `APP_VERSION` — used in docker-compose to tag the image

## Deployment

**Docker Compose** (local):
```bash
docker-compose up -d
```

**Cloud Run**:
```bash
bash deploy-cloudrun.sh
```
Requires `GCP_PROJECT` env var and gcloud authenticated. Deploys to `asia-east1`, image pushed to `asia-docker.pkg.dev`.

**CI/CD**: GitHub Actions (`.github/workflows/ci.yaml`) runs on push to main/master — installs deps, runs tests, then calls `deploy-cloudrun.sh`. Uses self-hosted GKE runner. Requires `GCP_PROJECT` and `PUSH_STATUS_WEBHOOK_URL` secrets.

## Key Patterns

- All route handlers use `asyncHandler()` wrapper from `log/asyncHandler.js`
- API responses follow `{ status: 'success'|'error', data|message }` format
- Database queries go through the pool exported from `mysql-connect.js`
- Frontend uses EJS templates in `views/` with static assets in `public/` (Bootstrap 5, Chart.js, DataTables, jQuery — all vendored locally)
