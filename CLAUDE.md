# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development (Docker)

```bash
# Start full dev stack (db + app with hot reload + Vite dev server)
docker compose up --build

# Or run in background
docker compose up -d --build

# Rebuild and restart a specific service
docker compose build app && docker compose up -d --wait
```

In dev mode (`docker-compose.override.yml` is auto-loaded):
- Backend source is mounted, uvicorn runs with `--reload`
- Frontend Vite dev server runs in Docker with HMR on `:5173`
- `node_modules` lives in a named volume (`frontend_node_modules`) — survives `docker compose down` and restarts
- `npm ci` only runs on first start (when `node_modules/.package-lock.json` is missing); subsequent starts skip straight to `npm run dev`
- If `package.json` changes, run `docker volume rm johntex_frontend_node_modules && docker compose up -d` to force a clean install
- PostgreSQL exposed on `localhost:5432`
- API exposed on `localhost:8000`
- `.env` is used

## Production

```bash
# Start production stack (db + app with 4 workers + nginx frontend)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check running service health
curl http://localhost/health
```

In production:
- No source mounts, baked images
- Uvicorn runs with 4 workers
- Nginx serves built frontend on port 80 with gzip and cache headers
- PostgreSQL is not exposed to the host
- `.env.prod` is used — change all `change-me-*` values before deploying

## Local / Bypass Docker

```bash
# Backend type-check (no real test suite exists)
.venv/bin/python -c "from app.main import app"

# Frontend type-check
cd frontend && npx tsc --noEmit

# Database migrations (point .env DATABASE_URL at localhost:5432)
.venv/bin/alembic revision --autogenerate -m "description"
.venv/bin/alembic upgrade head

# Seed database (set SEED_DB=true in .env or pass inline)
SEED_DB=true .venv/bin/python seed_db.py

# Run API directly (needs postgres running)
.venv/bin/uvicorn app.main:app --reload

# Frontend dev server (with proxy to localhost:8000)
cd frontend && npm run dev
```

## Architecture

**Stack:** FastAPI + SQLModel (async SQLAlchemy) on PostgreSQL 16, React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS on the frontend. Docker Compose deploys three services: `db`, `app` (uvicorn on :8000), `frontend` (nginx on :80). Two modes: dev (`docker compose up`) with hot reload and mounted source; prod (`docker compose -f docker-compose.yml -f docker-compose.prod.yml up`) with 4 workers, nginx static serving, and no exposed DB port.

**Layered backend pattern** — every domain follows the same structure:
- `app/models.py` — SQLModel table definitions (single file, all models)
- `app/schemas.py` — Pydantic request/response schemas (single file)
- `app/api/<domain>.py` — FastAPI route handlers, inject `AsyncSession` + `current_user`
- `app/crud/<domain>.py` — async data access functions, accept `session` + data
- `app/services/<domain>.py` — business logic that isn't pure CRUD (e.g., M-Pesa client)

**Session lifecycle:** `get_session()` in `database.py` yields an `AsyncSession` via `async with`. CRUD functions commit internally — this is important for audit logging: always call `log_action()` BEFORE the CRUD function's internal `commit()`, otherwise the audit entry is lost.

**Auth:** JWT via `python-jose`, password hashing via `passlib[bcrypt]`. Three roles: admin, supervisor, clerk. Dependency chain: `get_current_user` → `get_current_active_user` → `get_current_supervisor` / `get_current_admin`.

**Frontend routing:** React Router v6 with `ProtectedRoute` wrapping `Layout` (sidebar + content). API calls go through `api/client.ts` — axios instance with `/api` base URL and JWT interceptor. In dev, Vite proxies `/api` to `localhost:8000`. In production, nginx proxies `/api/` to `app:8000`.

**State management:** TanStack React Query with `staleTime: 5 * 60 * 1000` default. Hooks are in `frontend/src/hooks/` — one file per domain. Mutations call `queryClient.invalidateQueries()` on success.

**Frontend UI patterns:**
- shadcn/ui components live in `frontend/src/components/ui/`
- Forms use either `react-hook-form` (AdvanceRequest) or plain `useState` with manual `formErrors` object (ProductionEntry, WorkersTab) — prefer plain useState for forms with shadcn Select components, as react-hook-form integration with the Select is fragile
- Bulk selection pattern: `Set<number>` tracking selected IDs, checkboxes with select-all + indeterminate state (see `PendingApprovals.tsx`, `PayrollRun.tsx`)

**M-Pesa integration:** `app/services/mpesa.py` — `MpesaClient` handles Daraja API OAuth2 auth, B2C payments, and callback processing. Uses the B2C v3 endpoint (`/mpesa/b2c/v3/paymentrequest`). `format_phone()` normalizes Kenyan numbers to 254XXXXXXXXX. Secrets (consumer key, consumer secret, security credential, base URL) come from `.env`. Non-sensitive config (shortcode, initiator name) come from the `settings` table with `mpesa_` prefix. Callback endpoint at `POST /payments/mpesa/callback` has no auth (Safaricom calls it directly).

**M-Pesa sandbox setup:**
- Get credentials from the Safaricom Developer Portal → your test app → **Test Credentials** page
- The common shared sandbox credentials (`testapi` / `Safaricom999!*!` / `600000`) may NOT match your specific test app — always check the portal
- Generate the security credential using the portal's "Generate Security Credential" tool (uses the sandbox certificate) — do NOT manually encrypt with openssl
- Test phone numbers must be Safaricom sandbox test numbers (e.g., `254708374149`, `254705912645`). Real or random numbers return error 2040.
- Common result codes: 0 = success, 2001 = initiator auth invalid (wrong password/credential), 2040 = phone number not a sandbox test number

## Key Implementation Details

**Timezone:** All timestamps are stored and processed in East Africa Time (EAT, Africa/Nairobi, UTC+3). Use `eat_now()` from `app/timezone.py` for current time — it returns a naive datetime (EAT wall clock) compatible with the `TIMESTAMP WITHOUT TIME ZONE` columns. The Pydantic schema serializer (`_serialize_eat` in `app/schemas.py`) attaches `+03:00` on API output so the frontend can parse datetimes correctly with `new Date()`. JWT token expiry in `security.py` remains UTC (epoch-based, timezone-agnostic).

**Logging:** `setup_logging()` in `app/logging_config.py` configures the root logger at import time (called first in `app/main.py`). Dev uses `EatFormatter` (human-readable, EAT timestamps to console + file). Prod uses `JsonFormatter` (JSON to stdout for Docker, file). Logs go to `$LOG_DIR/payroll.log` (all levels) and `$LOG_DIR/payroll_error.log` (ERROR+). Rotation uses `TimedRotatingFileHandler` — rotates daily at midnight, retains `LOG_RETENTION_DAYS` (default 30) days of backups. Old rotated files are automatically deleted. For new modules, use `logger = logging.getLogger(__name__)` — do NOT call `logging.basicConfig()` or add handlers. When logging a caught exception, pass `exc_info=True`. The `SensitiveDataFilter` redacts passwords, tokens, and secrets from all log output. The `RequestLoggingMiddleware` automatically logs every request (method, path, status, duration, IP). Log files persist via Docker volume `app_logs`.

**Audit logging must precede CRUD commits.** All CRUD functions call `session.commit()` internally. Place `crud_audit.log_action()` before the CRUD call so both are in the same transaction. Pattern:
```python
await crud_audit.log_action(session, user.id, "thing_done", f"Human-readable detail with names")
return await crud_thing.do_thing(session, data)  # commits both the action and the log
```

**Phone validation:** Import from `app.services.mpesa` — `format_phone()` raises `ValueError` on invalid, `is_valid_phone()` returns bool. Valid formats: `07XXXXXXXX`, `+254XXXXXXXXX`, `254XXXXXXXXX`.

**Payment flow:** Payroll is calculated first (`POST /payroll/run`), then workers are paid individually or in bulk via M-Pesa (`POST /payments/mpesa/pay/{id}`, `POST /payments/mpesa/bulk-pay`). The `Payroll` model tracks `payment_method` (cash/mpesa) and `payment_status` (pending/processing/paid/failed). Method can be toggled per-worker before paying.

**Payment status polling:** After a B2C request is accepted, the status is "processing" until Safaricom's async callback updates it to "paid"/"failed". Since the callback can arrive seconds later, `usePayrolls` and `useAdvances` use `refetchInterval` — polling every 5 seconds while any record has `payment_status === 'processing'`, stopping automatically once all resolve. New hooks that display payment status should follow the same pattern:
```typescript
refetchInterval: (query) => {
  const hasProcessing = (query.state.data as T[] | undefined)?.some(
    (item) => item.payment_status === 'processing',
  );
  return hasProcessing ? 5000 : false;
},
```

**Number inputs:** All `<Input type="number">` elements must have `min="0"` or `min="0.01"` or `min="1"` to prevent negative values. Backend APIs also validate: `<= 0` → 400 error.

**User security:** `last_login` is set on every token request. `useUserActivity` and `useUsers` hooks have `staleTime: 10_000` (10s) to avoid showing stale login times. `timeAgo()` appends `Z` to naive UTC datetime strings for correct browser interpretation.
