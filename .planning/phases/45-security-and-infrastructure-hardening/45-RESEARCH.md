# Phase 45: Security and Infrastructure Hardening - Research

**Researched:** 2026-02-27
**Domain:** Backend auth (bcrypt + JWT), rate limiting (slowapi), SQLite WAL mode, FastAPI lifespan background tasks
**Confidence:** HIGH (all findings verified against official docs or FastAPI official tutorial)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth migration**
- Instant cutover — old single-key auth stops working immediately once new auth is deployed
- No dual-mode transition period; admin logs in with new credentials from day one
- Single admin account only — no multi-admin schema needed
- Initial credentials seeded from env vars (ADMIN_USERNAME, ADMIN_PASSWORD) on Railway
- App creates the admin account on first boot if it doesn't exist
- Password changes only via updating the env var and redeploying — no UI password change

**Login form experience**
- Keep existing login page design, swap single key field for username + password fields
- Session lasts until browser tab closes (no persistent sessions, no remember-me)
- Failed login shows generic "Invalid credentials" message — doesn't reveal whether username or password was wrong
- Rate limiting: 5 failed attempts per IP per minute triggers rejection

### Claude's Discretion
- JWT token storage strategy (sessionStorage vs httpOnly cookie) — pick based on security/simplicity tradeoff
- JWT expiration timing (should align with session-until-tab-close preference)
- Rate limiting implementation details (slowapi configuration)
- WAL mode enablement approach
- t-SNE heatmap fix approach

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Admin can log in with username and hashed password (bcrypt) replacing single-key auth | PyJWT + pwdlib[bcrypt] stack; AdminUser model seeded from env vars; new auth endpoint pattern |
| SEC-02 | Auth endpoint rate-limited to prevent brute force (5 attempts/min per CONTEXT.md, 3/min per REQUIREMENTS.md) | slowapi 0.1.9 with `@limiter.limit("5/minute")` on `/api/admin/auth`; IP key via `get_remote_address` |
| SEC-03 | SQLite uses WAL mode with busy_timeout to handle concurrent traffic | SQLAlchemy `@event.listens_for(engine, "connect")` pattern; PRAGMA journal_mode=WAL + busy_timeout |
| ADM-03 | Embedding heatmap (t-SNE) loads correctly on dashboard | Fix: `asyncio.create_task` called after lifespan `yield` runs at shutdown not startup; must be launched before yield using `asyncio.ensure_future` or task-before-yield pattern |
</phase_requirements>

---

## Summary

This phase has four independent pieces of work: backend auth upgrade, rate limiting, SQLite WAL mode, and a t-SNE lifespan bug fix. Each is well-understood and uses standard patterns. None depend on each other at runtime, though auth must be complete before the frontend can be updated.

The auth upgrade replaces a plain string key with username+bcrypt password. FastAPI's official tutorial (2025) recommends **PyJWT** (actively maintained) and **pwdlib[bcrypt]** (passlib replacement, Python 3.13 compatible) — both are the current ecosystem standard. A new `AdminUser` DB model seeds from env vars on first boot. The login endpoint receives `{username, password}`, verifies against the DB, and returns a JWT; all other admin endpoints verify the JWT in the `Authorization: Bearer` header.

The rate-limiting story is straightforward: **slowapi 0.1.9** is the canonical FastAPI rate-limiting library. A single `@limiter.limit("5/minute")` on the auth endpoint, keyed by IP, covers the brute-force requirement. No Redis needed — in-process memory storage is fine for a single Railway instance.

The SQLite WAL fix is a one-liner in `database.py`: add a SQLAlchemy `connect` event listener that executes `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` on every new connection. WAL is a database-file property that persists once set.

The t-SNE bug is a **placement error in main.py line 335**: `asyncio.create_task(_compute_tsne_background(app))` sits after the lifespan `yield`, which means it executes during shutdown, not startup. The fix is to move the `create_task` call to *before* `yield` — the standard FastAPI pattern for startup background tasks.

**Primary recommendation:** Two plan files. Plan 45-01 covers backend auth + rate limiting (same file, same deploy). Plan 45-02 covers SQLite WAL + t-SNE fix (infrastructure, no auth dependency).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PyJWT | latest (≥2.8) | JWT encode/decode | FastAPI official tutorial (2025) recommendation; actively maintained; replaces abandoned python-jose |
| pwdlib[bcrypt] | 0.3.0 | Password hashing | FastAPI official tutorial (2025) recommendation; passlib replacement; Python 3.13 compatible |
| slowapi | 0.1.9 | Rate limiting for FastAPI/Starlette | Only mature rate-limiting library for FastAPI; wraps limits library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SQLAlchemy event system | (already in requirements) | WAL PRAGMA on connect | Native SQLAlchemy; no additional package needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyJWT | python-jose | python-jose nearly abandoned (last release 3+ years ago), has 8 security warnings; PyJWT is the current standard |
| pwdlib[bcrypt] | passlib[bcrypt] | passlib is unmaintained; breaks on Python 3.13; pwdlib is the maintained successor |
| pwdlib[bcrypt] | pwdlib[argon2] | Argon2 is stronger but bcrypt is specified in SEC-01 requirement and CONTEXT.md decisions |
| slowapi | custom middleware | Custom sliding window is error-prone; slowapi is battle-tested |
| slowapi | redis-based rate limiter | Overkill; single Railway instance means in-process memory works |

**Installation:**
```bash
pip install "pyjwt" "pwdlib[bcrypt]" "slowapi"
```

---

## Architecture Patterns

### Recommended Project Structure

No new files/folders needed. Changes are confined to:
```
app/
├── database.py          # Add WAL PRAGMA connect event
├── models.py            # Add AdminUser model
├── main.py              # Fix t-SNE create_task placement; register slowapi middleware
└── routers/
    └── admin.py         # Replace _require_admin dep + auth endpoint
frontend/src/admin/
├── LoginPage.tsx        # username+password fields instead of single key
├── RequireAuth.tsx      # Read JWT from sessionStorage, pass as Authorization header
└── hooks/
    └── useAdminData.ts  # Update adminFetch to send Authorization: Bearer <jwt>
```

### Pattern 1: AdminUser model seeded from env vars

**What:** A new `AdminUser` SQLAlchemy model stores a single row (username + bcrypt hash). On every startup, if the table is empty, seed from `ADMIN_USERNAME` + `ADMIN_PASSWORD` env vars.

**When to use:** Single-user admin with Railway-managed credentials.

```python
# app/models.py addition
class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
```

```python
# In lifespan (main.py), after Base.metadata.create_all:
from pwdlib import PasswordHash
_pwd = PasswordHash.recommended()  # uses Argon2 by default — swap to bcrypt below

# To use bcrypt specifically (matches SEC-01 requirement):
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher
_pwd = PasswordHash([BcryptHasher()])

def _seed_admin_user():
    username = os.getenv("ADMIN_USERNAME", "")
    password = os.getenv("ADMIN_PASSWORD", "")
    if not username or not password:
        log.warning("startup: ADMIN_USERNAME or ADMIN_PASSWORD not set — admin login disabled")
        return
    with SessionLocal() as db:
        existing = db.scalar(select(func.count()).select_from(AdminUser))
        if existing == 0:
            db.add(AdminUser(
                username=username,
                hashed_password=_pwd.hash(password),
            ))
            db.commit()
            log.info("startup: admin user seeded", username=username)
```

### Pattern 2: New auth endpoint returns JWT

**What:** Replace the `AuthBody(key: str)` model with `AuthBody(username, password)`. On success, return a JWT instead of `{"ok": True}`. The JWT carries `sub=username` and expires in 24h (chosen below).

```python
# Source: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = os.getenv("JWT_SECRET", "")  # Set in Railway env vars
ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24  # See discretion decision below

class AuthBody(BaseModel):
    username: str
    password: str

@auth_router.post("/auth")
def authenticate(body: AuthBody, request: Request):
    """Rate-limited by slowapi. Returns JWT on success."""
    with SessionLocal() as db:
        user = db.scalar(select(AdminUser).where(AdminUser.username == body.username))
    if not user or not _pwd.verify(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    token = jwt.encode({"sub": user.username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token}
```

### Pattern 3: Replace `_require_admin` to verify JWT

**What:** The current `_require_admin` reads `X-Admin-Key` header and compares to `ADMIN_SECRET` env var. Replace with JWT verification.

```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import InvalidTokenError

_bearer = HTTPBearer(auto_error=False)

def _require_admin(credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer)) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise InvalidTokenError
        return username
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

### Pattern 4: slowapi rate limiting on auth endpoint

**What:** Add slowapi limiter to main.py; decorate the auth endpoint.

```python
# Source: https://slowapi.readthedocs.io/en/latest/
# main.py additions
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# admin.py — auth endpoint
@auth_router.post("/auth")
@limiter.limit("5/minute")  # MUST be below route decorator; request param REQUIRED
def authenticate(body: AuthBody, request: Request):
    ...
```

**Critical:** The `request: Request` parameter MUST be in the endpoint signature or slowapi cannot intercept. The `@limiter.limit` decorator must be BELOW `@auth_router.post()`.

**Gotcha:** slowapi counts all requests to the endpoint (successful + failed). The CONTEXT.md says "5 failed attempts" — but implementing failed-only counting requires manual tracking (not native to slowapi). The success criteria says "5 failed login attempts … are rejected" which is the spirit, not the exact mechanism. Given simplicity preference, applying the 5/minute limit to all requests (including successful ones) is acceptable — an admin only logs in once per session, so this won't cause usability issues.

### Pattern 5: SQLite WAL mode via SQLAlchemy connect event

**What:** Execute `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` on every new SQLite connection. WAL persists at database-file level once set, but PRAGMA must still be re-issued for busy_timeout on every connection.

```python
# Source: https://docs.sqlalchemy.org/en/20/dialects/sqlite.html
# database.py
from sqlalchemy import event

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")  # 5 seconds before "database is locked" error
    cursor.close()
```

This is the only change needed in `database.py`. It is idempotent — setting WAL on an already-WAL database is a no-op.

### Pattern 6: Fix t-SNE background task placement

**What:** The current code in `main.py` has `asyncio.create_task(_compute_tsne_background(app))` AFTER the `yield` statement (line 335). Code after `yield` in a lifespan context manager runs during *shutdown*, not startup. The fix is to call it before `yield` so it runs at startup.

**Root cause:** The comment says "Phase 26: post-yield — NEVER above yield" but this is backwards — the intent was for the server to be ready before t-SNE starts, which is achieved by putting it just before yield (after all other startup steps complete).

```python
# BEFORE (broken — runs at shutdown):
    yield
    asyncio.create_task(_compute_tsne_background(app))  # runs at shutdown!

# AFTER (correct — launches background task then yields):
    asyncio.ensure_future(_compute_tsne_background(app))  # or asyncio.create_task
    yield
    # Shutdown: in-memory FAISS index is garbage-collected automatically
```

Both `asyncio.create_task` and `asyncio.ensure_future` work here. `create_task` is preferred in Python 3.7+ when inside an async context. The lifespan function is `async`, so `create_task` works.

```python
# Correct placement:
    app.state.tsne_ready = False
    app.state.embedding_map = []
    asyncio.create_task(_compute_tsne_background(app))  # launched before yield = runs at startup
    yield
```

### Anti-Patterns to Avoid

- **Storing JWT in localStorage:** XSS-vulnerable. Use `sessionStorage` (matches "session until tab closes" requirement) — same protection as current `admin_key` pattern.
- **Returning different error messages per credential field:** The CONTEXT.md requires generic "Invalid credentials" — never say "username not found" vs "wrong password".
- **Setting WAL mode only once in lifespan:** The `busy_timeout` PRAGMA is NOT persistent; it must be set per-connection. Only `journal_mode=WAL` is persistent. Use the connect event listener.
- **Importing slowapi limiter in admin.py:** The `limiter` object is created in `main.py` and must be imported into `admin.py` to use the decorator, OR exported from a shared module. Avoid circular imports.
- **Using X-Admin-Key header for JWT:** The existing `AdminFetch` calls pass `X-Admin-Key`. After migration, the frontend must switch to `Authorization: Bearer <jwt>`. The CORS configuration in `main.py` must allow the `Authorization` header.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt wrapper | `pwdlib[bcrypt]` | bcrypt has subtle timing-attack edge cases; pwdlib handles them |
| JWT encode/decode | Manual HMAC | `PyJWT` | Handles exp claim, algorithm selection, InvalidTokenError correctly |
| Rate limiting | Manual IP counter dict | `slowapi` | Sliding window semantics, thread-safe, handles X-Forwarded-For |
| WAL mode | Custom SQLite connection wrapper | SQLAlchemy event listener | Native pattern; no extra code paths |

**Key insight:** bcrypt, JWT, and rate limiting all have subtle edge cases (timing attacks, clock skew, distributed counter reset) that libraries solve correctly. Custom implementations routinely fail these.

---

## Common Pitfalls

### Pitfall 1: slowapi decorator order
**What goes wrong:** Rate limiting silently stops working (no 429s ever).
**Why it happens:** The `@limiter.limit("5/minute")` decorator must be placed BELOW `@router.post("/auth")`, not above it.
**How to avoid:** Always put `@limiter.limit` as the innermost (closest to function) decorator.
**Warning signs:** Auth endpoint never returns 429 regardless of attempt count.

### Pitfall 2: Missing `request: Request` in rate-limited endpoint
**What goes wrong:** slowapi cannot intercept the request; rate limiting silently does nothing.
**Why it happens:** slowapi hooks into the FastAPI request object. If not in the signature, no hook.
**How to avoid:** Every rate-limited endpoint must declare `request: Request` as a parameter.

### Pitfall 3: CORS blocks Authorization header
**What goes wrong:** Frontend gets CORS error after auth migration; all admin API calls fail.
**Why it happens:** `main.py` currently allows only `["Content-Type", "X-Admin-Key"]` in `allow_headers`. After switching to `Authorization: Bearer`, this must be updated.
**How to avoid:** Update `allow_headers` in CORSMiddleware to include `"Authorization"` and remove `"X-Admin-Key"`.

### Pitfall 4: JWT_SECRET not set in Railway
**What goes wrong:** All admin tokens are signed with an empty string or default dev value; tokens can be forged.
**Why it happens:** Env var not set in Railway dashboard.
**How to avoid:** Generate a cryptographically random 32-byte secret (`python -c "import secrets; print(secrets.token_hex(32))"`), set as `JWT_SECRET` in Railway. Add startup assertion: `if not os.getenv("JWT_SECRET"): raise RuntimeError("JWT_SECRET must be set")`.

### Pitfall 5: t-SNE task placement — "post-yield" misunderstanding
**What goes wrong:** t-SNE never computes at startup; endpoint always returns 202; loading spinner never resolves.
**Why it happens:** `asyncio.create_task` after `yield` in an async context manager runs during the shutdown phase (when lifespan exits), not startup. The comment in the code even says "post-yield — NEVER above yield" which was the wrong mental model.
**How to avoid:** Move `asyncio.create_task(_compute_tsne_background(app))` to before `yield`. The server is ready once `yield` is reached — tasks started just before yield will run concurrently once the event loop is live.
**Warning signs:** The `/api/admin/embedding-map` endpoint always returns 202 status, even minutes after startup.

### Pitfall 6: pwdlib bcrypt vs argon2 default
**What goes wrong:** `PasswordHash.recommended()` defaults to Argon2, not bcrypt. SEC-01 specifies bcrypt.
**Why it happens:** pwdlib's `.recommended()` factory selects the "best" algorithm (Argon2). If you use `.recommended()` without explicit configuration, passwords are hashed with Argon2.
**How to avoid:** Explicitly construct: `PasswordHash([BcryptHasher()])` to enforce bcrypt.

### Pitfall 7: busy_timeout not a persistent PRAGMA
**What goes wrong:** `busy_timeout` resets to 0 on each new connection even though WAL is active. Under concurrent load, "database is locked" errors still occur.
**Why it happens:** Only `journal_mode=WAL` persists at the file level. `busy_timeout` is per-connection.
**How to avoid:** Both `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` must be in the connect event listener, not just run once at startup.

---

## Code Examples

Verified patterns from official sources:

### Complete slowapi setup (FastAPI)
```python
# Source: https://slowapi.readthedocs.io/en/latest/
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Request

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In router/admin.py — import limiter from main (or a shared module)
@auth_router.post("/auth")
@limiter.limit("5/minute")
def authenticate(body: AuthBody, request: Request):
    ...
```

### PyJWT encode/decode
```python
# Source: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
import jwt
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta, timezone

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

def create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> str:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload["sub"]  # raises InvalidTokenError on failure
```

### pwdlib bcrypt usage
```python
# Source: https://pypi.org/project/pwdlib/
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

pwd = PasswordHash([BcryptHasher()])

hashed = pwd.hash("my_plain_password")
is_valid = pwd.verify("my_plain_password", hashed)  # True
```

### SQLAlchemy connect event for WAL
```python
# Source: https://docs.sqlalchemy.org/en/20/dialects/sqlite.html (event pattern)
from sqlalchemy import create_engine, event

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()
```

### Fixed t-SNE task launch (lifespan)
```python
# Before yield — task starts at server startup, not shutdown
    app.state.tsne_ready = False
    app.state.embedding_map = []
    asyncio.create_task(_compute_tsne_background(app))
    yield
    # Shutdown: nothing to clean up
```

### Frontend: JWT storage and Authorization header
```typescript
// LoginPage.tsx — store JWT token (not raw credentials)
const res = await fetch(`${API_URL}/api/admin/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
})
const { token } = await res.json()
sessionStorage.setItem('admin_token', token)

// useAdminData.ts — send as Bearer token
const getAdminToken = () => sessionStorage.getItem('admin_token') ?? ''
headers: { 'Authorization': `Bearer ${getAdminToken()}` }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| passlib[bcrypt] | pwdlib[bcrypt] | Python 3.13 (2024) | passlib unmaintained; breaks on 3.13+ |
| python-jose | PyJWT | 2024 (FastAPI docs updated) | python-jose abandoned; 8 security warnings |
| `@app.on_event("startup")` | `@asynccontextmanager async def lifespan` | FastAPI 0.90+ | Deprecated event pattern removed |
| `X-Admin-Key` plain string | `Authorization: Bearer <jwt>` | This phase | Cryptographically signed token vs. plain secret |

**Deprecated/outdated:**
- `python-jose`: nearly abandoned, FastAPI now recommends PyJWT
- `passlib`: unmaintained, `pwdlib` is the recommended replacement
- `X-Admin-Key` pattern: this phase replaces it with JWT

---

## Claude's Discretion Recommendations

### JWT token storage: sessionStorage
Store the JWT in `sessionStorage` (same pattern as current `admin_key`). Matches the "session until tab closes" requirement. httpOnly cookie would require backend cookie handling (cross-domain complexity between Railway and Vercel) without meaningful security gain for this admin-only use case.

### JWT expiration: 24 hours
Set `exp` to 24 hours from issue time. The user requirement is "session lasts until browser tab closes" — sessionStorage already enforces this. The 24h expiry is a server-side safety net for abandoned tokens. There is no "remember me" feature, so short expiry + sessionStorage achieves the requirement.

### Rate limiting: 5/minute on ALL auth requests (not just failures)
Native slowapi does not support "only on failed attempts." Implement the limit on all requests to `/api/admin/auth`. An admin successfully logs in once per session, so a 5/minute limit on all requests is functionally identical to "5 failed attempts" for the one real user.

### WAL busy_timeout: 5000ms
5 seconds is the standard recommendation for busy_timeout with WAL. Long enough to handle momentary write contention; short enough to fail fast on actual deadlocks.

---

## Open Questions

1. **limiter import path in admin.py**
   - What we know: The `limiter` object must be created in one place and shared. If created in `main.py`, admin.py must import it — which risks circular imports since `main.py` already imports from `admin.py`.
   - What's unclear: Whether the import order causes issues.
   - Recommendation: Create a `app/limiter.py` module that exports the `limiter` singleton. Both `main.py` and `admin.py` import from `app/limiter.py`. This avoids any circular import.

2. **ADMIN_SECRET env var: keep or remove?**
   - What we know: The current auth reads `ADMIN_SECRET`. After migration, `ADMIN_USERNAME` + `ADMIN_PASSWORD` replace it.
   - What's unclear: Whether the Railway project still has `ADMIN_SECRET` set (it does from prior phases).
   - Recommendation: Leave `ADMIN_SECRET` in Railway untouched (harmless); don't reference it in code after migration. Add `JWT_SECRET` as a new env var. Document in Railway setup steps.

---

## Sources

### Primary (HIGH confidence)
- [FastAPI Security + JWT Official Docs](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) — JWT pattern, PyJWT recommendation, pwdlib[argon2] recommendation
- [slowapi Readthedocs](https://slowapi.readthedocs.io/en/latest/) — complete setup, decorator pattern, key_func
- [SQLite WAL Official Docs](https://sqlite.org/wal.html) — WAL semantics, persistence behavior
- [slowapi PyPI](https://pypi.org/project/slowapi/) — version 0.1.9 confirmed
- [pwdlib PyPI](https://pypi.org/project/pwdlib/) — version 0.3.0, bcrypt + argon2 hasher options

### Secondary (MEDIUM confidence)
- [FastAPI GitHub Discussion #11345](https://github.com/fastapi/fastapi/discussions/11345) — python-jose abandonment, PyJWT migration confirmed
- [Simon Willison TIL — SQLite WAL](https://til.simonwillison.net/sqlite/enabling-wal-mode) — WAL is file-level property (one-time)
- SQLAlchemy event.listens_for pattern — confirmed by SQLAlchemy 2.0 docs URL in search results

### Tertiary (LOW confidence)
- Various Medium/blog posts on slowapi, JWT — corroborate primary sources but not used as primary evidence

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — PyJWT and pwdlib confirmed by FastAPI official docs (2025), slowapi confirmed by PyPI and readthedocs
- Architecture: HIGH — all patterns verified against official documentation
- Pitfalls: HIGH — t-SNE bug is directly visible in existing code (line 335 main.py); CORS pitfall is verifiable from current main.py config; decorator order from slowapi docs

**Research date:** 2026-02-27
**Valid until:** 2026-05-27 (90 days — stable libraries with slow release cadence)
