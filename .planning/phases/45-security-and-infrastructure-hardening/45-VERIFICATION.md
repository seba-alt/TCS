---
status: passed
phase: 45
phase_name: Security and Infrastructure Hardening
verified: 2026-02-27
requirements: [SEC-01, SEC-02, SEC-03, ADM-03]
---

# Phase 45: Security and Infrastructure Hardening — Verification

## Goal
The admin panel is secured with proper credentials and the backend is hardened for concurrent public traffic.

## Success Criteria Verification

### 1. Admin can log in with username and bcrypt-hashed password; old single-key login no longer works
**Status: PASSED**

- `AuthBody` model accepts `username: str` and `password: str` (not `key: str`)
- Password verified with `pwdlib` BcryptHasher via `_pwd.verify()`
- JWT token generated with `jwt.encode()` and returned as `{"token": "<jwt>"}`
- `_require_admin` dependency validates JWT from `Authorization: Bearer` header
- Zero references to `X-Admin-Key`, `ADMIN_SECRET`, or `APIKeyHeader` in backend code
- Zero references to `admin_key` or `X-Admin-Key` in frontend code (except intentional cleanup on login)
- Frontend login form has username + password fields

### 2. Five failed login attempts from the same IP within one minute are rejected with a rate-limit error
**Status: PASSED**

- `@limiter.limit("5/minute")` decorator applied to `/api/admin/auth` endpoint
- slowapi `Limiter` singleton in `app/limiter.py` with `key_func=get_remote_address`
- Rate limit exception handler registered: `app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)`
- `app.state.limiter = limiter` configured on app

### 3. The embedding heatmap (t-SNE) renders on the Intelligence page without a permanent loading spinner
**Status: PASSED**

- `asyncio.create_task(_compute_tsne_background(app))` placed before `yield` in lifespan
- Before yield = startup phase, after yield = shutdown phase
- t-SNE will compute in background while server handles requests
- Once complete, `app.state.tsne_ready = True` and `/api/admin/embedding-map` returns 200

### 4. SQLite runs in WAL mode so concurrent user event writes do not produce "database is locked" errors
**Status: PASSED**

- `@event.listens_for(engine, "connect")` callback in `app/database.py`
- Sets `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` on every new connection
- Verified programmatically: `PRAGMA journal_mode` returns `wal`, `PRAGMA busy_timeout` returns `5000`

## Requirement Traceability

| Requirement | Plan | Status |
|------------|------|--------|
| SEC-01 | 45-01 | Verified |
| SEC-02 | 45-01 | Verified |
| SEC-03 | 45-02 | Verified |
| ADM-03 | 45-02 | Verified |

## Score: 4/4 must-haves verified

## Human Verification Items
None required — all criteria verified programmatically.
