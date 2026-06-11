# Johntex Payroll System

FastAPI + React payroll management system with PostgreSQL, M-Pesa integration, and a full observability stack.

## Quick Start (Development)

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 (Vite HMR) |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| Grafana | http://localhost:3000 (admin / admin) |
| Prometheus | http://localhost:9090 |
| Loki | http://localhost:3100 |

A single `docker compose up` starts all 7 services. Backend and frontend source are mounted for hot reload.

## Production Deployment

```bash
cp .env.prod .env.prod.local
# Edit .env.prod.local — change all change-me-* values
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod.local up -d --build
```

The app is served at http://localhost (nginx on port 80). Production optimizations:
- 4 uvicorn workers
- Nginx serves built frontend with gzip, security headers, and cache headers
- PostgreSQL not exposed to the host
- JSON-formatted structured logs with request IDs
- Timed log rotation (daily, 30-day retention)
- Sensitive data redaction (passwords, tokens, secrets)
- Automatic restart on failure

## Observability

The project includes a complete observability stack:

| Component | Port | Purpose |
|---|---|---|
| **Grafana** | 3000 | Pre-configured dashboards and alerts |
| **Prometheus** | 9090 | Metrics collection (request rate, latency, payment status, auth activity) |
| **Loki** | 3100 | Log aggregation with structured JSON parsing |
| **Promtail** | — | Ships application logs to Loki |

### Dashboards

Grafana is pre-provisioned with a **Payroll System** dashboard containing:
- Request rate and error rate by status
- Latency percentiles (P50/P95/P99)
- M-Pesa payment attempts (success/failure)
- M-Pesa callback outcomes
- Auth activity (success/failure)
- Log volume and error log table

### Alerts

Prometheus alerting rules are configured for:
- High HTTP 5xx error rate (>5% for 5 min)
- M-Pesa payment failures
- Auth failure spikes
- M-Pesa orphan callbacks (callbacks with no matching transaction)

### Logging

All backend modules use structured logging with `logger = logging.getLogger(__name__)`. Key features:
- **EAT timestamps** (Africa/Nairobi, UTC+3)
- **Request IDs** — `X-Request-ID` header generated/propagated across every request
- **Sensitive data filter** — redacts passwords, Bearer tokens, JWT secrets
- **Timed rotation** — daily at midnight, auto-deletes logs older than `LOG_RETENTION_DAYS` (default 30)
- **Dual output** — human-readable in dev, JSON in production
- Error log (`payroll_error.log`) captures ERROR+ level separately

### Metrics

Custom Prometheus counters track:
- `payroll_payment_attempts_total` — by status and payment method
- `payroll_auth_attempts_total` — by success/failure
- `payroll_mpesa_callbacks_total` — by outcome (success, failed, orphan, idempotent)

Auto-instrumented HTTP metrics are exposed at `/metrics`.

## Deploying to Coolify

1. Create a new service from this repository
2. Set build pack to **Docker Compose**
3. Set compose file to `docker-compose.yml:docker-compose.prod.yml`
4. Add environment variables (see `.env.prod`):
   - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
   - `DATABASE_URL`
   - `SECRET_KEY` — generate a strong random string
   - `SEED_DB` — set to `true` for first deploy, then `false`
   - `GRAFANA_ADMIN_PASSWORD` — change the default

## Local Development (Without Docker)

1. Create virtual environment: `python -m venv .venv && source .venv/bin/activate`
2. Install dependencies: `pip install -r requirements.txt`
3. Configure: `cp .env.example .env` (set `DATABASE_URL` to `localhost:5432`)
4. Start PostgreSQL: `docker run -d --name payroll-db -e POSTGRES_DB=payroll -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:16-alpine`
5. Migrate and seed: `alembic upgrade head && SEED_DB=true python seed_db.py`
6. Start API: `uvicorn app.main:app --reload`
7. Start frontend: `cd frontend && npm run dev`

## M-Pesa Sandbox Setup

To test M-Pesa B2C payments in the sandbox:

1. Create a sandbox app on the [Safaricom Developer Portal](https://developer.safaricom.co.ke)
2. Go to your app → **Test Credentials** — note your initiator name, initiator password, and shortcode (they may differ from the commonly shared defaults)
3. Use the portal's **Generate Security Credential** tool to encrypt your initiator password with the sandbox certificate
4. Add these to your `.env`:

```bash
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=<from your app>
MPESA_CONSUMER_SECRET=<from your app>
MPESA_SECURITY_CREDENTIAL=<generated credential>
MPESA_BASE_URL=https://your-ngrok-url.ngrok-free.app   # for local callbacks
```

5. Set the shortcode and initiator name in the app's **Settings** page (or via seed defaults)
6. Use Safaricom sandbox test phone numbers (e.g., `254708374149`, `254705912645`) — the sandbox rejects real or random numbers with error 2040

### Common M-Pesa B2C Errors

| Result Code | Meaning | Fix |
|---|---|---|
| `0` | Success | — |
| `2001` | Initiator information invalid | Wrong password/credential, wrong certificate, or B2C not enabled on the app |
| `2040` | Customer type not supported | Phone number is not a sandbox test number |

### Callback Delivery (Local Dev)

Safaricom delivers callbacks to `MPESA_BASE_URL`. For local development, use [ngrok](https://ngrok.com) to expose your local server:

```bash
ngrok http 8000
# Then update MPESA_BASE_URL in .env and restart
```

## Default Login

- Username: `admin`
- Password: `admin123`

## Roles

- **admin** — Full access, can run payroll, process payments, configure M-Pesa
- **supervisor** — Manage workers and products, log/approve production and advances
- **clerk** — View workers/products, log production, request advances (read-only payroll)

## Frontend Troubleshooting

**`npm ci` fails with `ETIMEDOUT` or `ENOTEMPTY`:** The frontend container uses a named volume for `node_modules`. If the install hangs or fails:

```bash
docker compose down
docker volume rm johntex_frontend_node_modules
docker compose up -d --build
```

If Docker's network to npm is slow, seed the volume from the host's `node_modules` first:

```bash
docker compose down
docker volume rm johntex_frontend_node_modules
docker compose up -d frontend   # creates volume, starts npm ci
# Wait a few seconds then Ctrl-C if it's stuck
docker compose stop frontend
docker run --rm -v johntex_frontend_node_modules:/app/node_modules \
  -v $(pwd)/frontend:/host alpine cp -a /host/node_modules/. /app/node_modules/.
docker compose up -d frontend   # skips npm ci, starts instantly
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_DB` | Database name | `payroll` |
| `POSTGRES_USER` | Database user | `user` |
| `POSTGRES_PASSWORD` | Database password | `password` |
| `DATABASE_URL` | Async PostgreSQL connection string | — |
| `SECRET_KEY` | JWT signing secret | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiry | `30` |
| `SEED_DB` | Seed database on startup | `false` |

### Logging

| Variable | Description | Default |
|---|---|---|
| `LOG_LEVEL` | Log level (DEBUG, INFO, WARNING, ERROR) | `INFO` |
| `ENVIRONMENT` | Formatter mode (`development` = readable, `production` = JSON) | `development` |
| `LOG_DIR` | Log file directory | `/app/logs` |
| `LOG_RETENTION_DAYS` | Days to keep rotated logs | `30` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password | `admin` |
