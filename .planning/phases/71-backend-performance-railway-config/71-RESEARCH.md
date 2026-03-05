# Phase 71: Backend Performance & Railway Config - Research

**Researched:** 2026-03-05
**Domain:** FastAPI performance tuning, SQLite optimization, asyncio patterns, Railway deployment config
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Health endpoint:** Two-tier design — public `/api/health` (ok/not-ok for Railway healthcheck) + authenticated `/api/admin/health` (full diagnostics requiring admin JWT)
- **Detailed health endpoint contents:** DB status, expert count, latency metric; plus FAISS status, memory, uptime, version at Claude's discretion
- **Admin UI widget:** Small status indicator in the admin panel (header or overview page) pulling from the detailed health endpoint
- **Event batch queue:** Fire-and-forget — `POST /api/events` returns 202 Accepted immediately after adding to the async queue; retry once on flush failure, then drop and log; queue cap 1000 events, drop oldest when exceeded
- **Admin pagination:** Default sort alphabetical by first name (A-Z); classic page numbers (1/2/3) with total count; fixed page size 50; simple text search filtering by expert name
- **Explore/search API cache:** In-memory LRU with 5-minute TTL — repeated queries hit cache; invalidated on expert add/delete/import
- **GZip:** FastAPI GZipMiddleware on all responses with min-size threshold ~500 bytes
- **Client-side Cache-Control:** Photo proxy only (24h) — API data stays dynamic, no browser caching on explore results
- **Flush interval and batch size:** Claude's discretion based on expected load patterns
- **GZip minimum size threshold:** Claude's discretion
- **LRU cache max size:** Claude's discretion
- **SQLite PRAGMA tuning values:** Claude's discretion (requirements specify exact values — see BPERF-05)
- **Railway Uvicorn flags and keep-alive tuning:** Claude's discretion (requirements specify exact flags — see RAIL-02)
- **Admin health widget placement and design:** Claude's discretion

### Claude's Discretion

- Detailed health endpoint contents beyond DB/experts/latency (FAISS, memory, uptime, version)
- Event batch flush interval and batch size tuning
- GZip minimum size threshold (requirements say ~500 bytes default is correct)
- LRU cache max size
- SQLite PRAGMA tuning values (requirements BPERF-05 specify exact values to use)
- Railway Uvicorn flags and keep-alive tuning (requirements RAIL-02 specify exact flags)
- Admin health widget placement and design

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 71 is a backend-only performance hardening pass with no new user-facing features. It falls into three implementation clusters: (1) endpoint improvements — health endpoint two-tier redesign, admin experts pagination, photo proxy cache header verification; (2) infrastructure tuning — asyncio event batch queue, SQLite PRAGMA tuning, GZipMiddleware, explore endpoint LRU cache, SQLAlchemy connection pool config; and (3) Railway deployment config — region, Uvicorn flags, healthcheck timeout reduction, restart policy.

**Critical discovery:** The photo proxy endpoint (`GET /api/photos/{username}`) at `app/routers/browse.py` already returns `Cache-Control: public, max-age=86400`. BPERF-03 requires verifying this in the browser network tab, not adding it. The admin pagination frontend component (`AdminPagination.tsx`) already exists and is ready to use — the work is wiring it to a backend `page`/`limit` endpoint. The `useHealthCheck` hook in `OverviewPage.tsx` already pings `/api/health` and shows a status indicator — the admin health widget is already partially implemented using the public endpoint.

**Primary recommendation:** Implement in three sequential plans: (1) endpoint improvements (health + pagination + cache verification), (2) infrastructure tuning (batch queue + pragmas + gzip + explore cache + connection pool), (3) Railway config file changes. Keep all backend changes in pure Python stdlib/Starlette — no new pip packages needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BPERF-01 | Health check endpoint returns DB status, expert count, and latency metric | Two-tier pattern: public `/api/health` for Railway + authenticated `/api/admin/health` for diagnostics |
| BPERF-02 | Admin experts endpoint supports pagination (page/limit query params, default 50) | Backend: add `page`/`limit` Query params to `GET /api/admin/experts`, return `total`/`page`/`total_pages`. Frontend: wire `AdminPagination.tsx` (already built) + add search param |
| BPERF-03 | Photo proxy endpoint returns Cache-Control header (public, max-age=86400) | ALREADY IMPLEMENTED in `browse.py:196`. Task is verification only |
| BPERF-04 | Event writes batched via asyncio queue (flush every 2-3s or 10 items, executemany commit) | asyncio.Queue + background worker started in lifespan; `SessionLocal().execute(text("INSERT..."), rows)` for batch; 202 returns immediately after `queue.put_nowait()` |
| BPERF-05 | SQLite PRAGMAs tuned (synchronous=NORMAL, cache_size=-32000, temp_store=MEMORY, mmap_size=128MB, wal_autocheckpoint=1000) | Add to `_set_sqlite_pragma` event listener in `database.py`; all are safe in WAL mode |
| BPERF-06 | GZipMiddleware compresses API responses over 500 bytes | `app.add_middleware(GZipMiddleware, minimum_size=500)` in `main.py`; import from `fastapi.middleware.gzip` |
| BPERF-07 | Explore endpoint caches responses with 30s TTL (invalidated on expert add/delete/import) | Module-level dict cache in `explore.py` or a new `app/services/explore_cache.py`; invalidate in `add_expert`, `delete_expert`, `bulk_delete`, and `_run_ingest_job` |
| BPERF-08 | Connection pool explicitly configured (pool_size=5, max_overflow=10, pool_pre_ping=True) | Add to `create_engine()` call in `database.py`; SQLite file DBs already use QueuePool — params just need to be explicit |
| RAIL-01 | Railway region set to europe-west4 (Netherlands) in railway.json | `"region": "europe-west4"` in `deploy` block — confirmed valid field in Railway JSON schema |
| RAIL-02 | Uvicorn tuned with --timeout-keep-alive 75 --log-level warning --no-access-log | Update `startCommand` in both `railway.json` and `Procfile` |
| RAIL-03 | healthcheckTimeout reduced to 120s with ON_FAILURE restart policy in railway.json | `"healthcheckTimeout": 120` + `"restartPolicyType": "ON_FAILURE"` — both confirmed valid fields |
</phase_requirements>

---

## Standard Stack

### Core (already in use, no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.129.x | Web framework + middleware | Project foundation |
| Starlette GZipMiddleware | (bundled) | Response compression | Ships with FastAPI/Starlette; `from fastapi.middleware.gzip import GZipMiddleware` |
| asyncio.Queue | stdlib | Background event batch queue | Zero dependencies; integrates with FastAPI lifespan |
| SQLAlchemy | 2.0.x | ORM + connection pool | Project foundation |
| SQLite PRAGMAs | sqlite3 stdlib | DB tuning | Applied via existing `_set_sqlite_pragma` hook |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `time` / `os` | stdlib | Uptime, memory for health endpoint | Included in detailed `/api/admin/health` |
| `psutil` | NOT installed | Process memory | Avoid — use `os.getpid()` + `/proc/self/status` or skip memory; psutil not in requirements.txt |
| `cachetools` | NOT installed | TTL LRU cache | NOT needed — hand-roll TTL dict per existing project pattern (see `_embed_cache` in embedder.py and `_settings_cache` in search_intelligence.py) |

**Installation:** No new pip packages required. All implementations use stdlib or already-installed dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module-level TTL dict cache | `cachetools.TTLCache` | cachetools not installed; project pattern is hand-rolled TTL dicts (see embedder.py, search_intelligence.py) — stay consistent |
| asyncio.Queue batch worker | FastAPI `BackgroundTasks` | BackgroundTasks runs per-request; Queue runs as persistent background worker across requests — Queue is correct for batching |
| `pool_pre_ping=True` | No pre-ping | Pre-ping adds one SELECT per connection checkout; prevents silent stale-connection failures on Railway container restart |

---

## Architecture Patterns

### Recommended Project Structure (changes only)

```
app/
├── database.py          # Add pool_size=5, max_overflow=10, pool_pre_ping=True + PRAGMA additions
├── main.py              # Add GZipMiddleware; start batch queue worker in lifespan; add /api/health update
├── routers/
│   ├── health.py        # Enhance public endpoint; add /api/admin/health endpoint
│   ├── events.py        # Replace sync DB write with queue.put_nowait()
│   ├── explore.py       # Add TTL cache wrapper around run_explore()
│   └── admin/
│       └── experts.py   # Add page/limit/search Query params; invalidate explore cache on mutations
railway.json             # Add region, reduce healthcheckTimeout, add restartPolicyType
Procfile                 # Update uvicorn startCommand with keep-alive flags
frontend/src/admin/
├── pages/
│   └── ExpertsPage.tsx  # Wire AdminPagination (already exists) + add server-side page param to API call
└── pages/
    └── OverviewPage.tsx # Optionally upgrade health widget to call /api/admin/health for richer data
```

### Pattern 1: Two-Tier Health Endpoint

**What:** Public endpoint stays minimal (Railway pings it every few seconds); authenticated endpoint exposes diagnostics.

**When to use:** Any production service where healthcheck must be fast and unauthenticated, but ops monitoring wants rich data.

**Example:**
```python
# app/routers/health.py
import time
import os
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from app.database import SessionLocal

router = APIRouter()
_start_time = time.time()

@router.get("/api/health")
async def health(request: Request) -> dict:
    """Public — Railway healthcheck. Fast, no auth."""
    index = request.app.state.faiss_index
    return {"status": "ok", "index_size": index.ntotal}


@router.get("/api/admin/health")
async def admin_health(
    request: Request,
    _: str = Depends(_require_admin),  # import from admin._common
) -> dict:
    """Authenticated — full diagnostics for admin UI."""
    t0 = time.monotonic()
    try:
        with SessionLocal() as db:
            db_expert_count = db.execute(text("SELECT COUNT(*) FROM experts")).scalar()
        db_latency_ms = round((time.monotonic() - t0) * 1000, 1)
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"
        db_latency_ms = None
        db_expert_count = None

    index = request.app.state.faiss_index
    uptime_s = round(time.time() - _start_time)

    return {
        "status": "ok",
        "db": db_status,
        "expert_count": db_expert_count,
        "db_latency_ms": db_latency_ms,
        "faiss_vectors": index.ntotal,
        "uptime_s": uptime_s,
        "version": "v5.4",
    }
```

**Important:** `_require_admin` must be imported from `app.routers.admin._common` — do not duplicate the JWT logic.

### Pattern 2: Asyncio Batch Queue for Event Writes

**What:** Replace synchronous per-request SQLite commit with an asyncio queue that a background worker drains every 2s or 10 items.

**When to use:** High write frequency (events endpoint), SQLite write contention, fire-and-forget semantics.

**Example:**
```python
# In app/main.py — lifespan setup

import asyncio
from app.database import SessionLocal
from sqlalchemy import text

_event_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)

async def _event_flush_worker():
    """Drain the event queue every 2s or 10 items."""
    FLUSH_INTERVAL = 2.0
    BATCH_SIZE = 10
    while True:
        batch = []
        deadline = asyncio.get_event_loop().time() + FLUSH_INTERVAL
        while len(batch) < BATCH_SIZE:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                break
            try:
                item = await asyncio.wait_for(_event_queue.get(), timeout=remaining)
                batch.append(item)
            except asyncio.TimeoutError:
                break
        if batch:
            for attempt in range(2):  # retry once
                try:
                    with SessionLocal() as db:
                        db.execute(
                            text("INSERT INTO user_events (session_id, event_type, payload, email) VALUES (:s, :e, :p, :m)"),
                            [{"s": r["session_id"], "e": r["event_type"], "p": r["payload"], "m": r["email"]} for r in batch]
                        )
                        db.commit()
                    break
                except Exception as exc:
                    if attempt == 1:
                        log.error("event_batch.flush_failed", count=len(batch), error=str(exc))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... existing startup ...
    task = asyncio.create_task(_event_flush_worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
```

```python
# In app/routers/events.py — replace sync DB write

@router.post("/api/events", status_code=202)
async def record_event(body: EventRequest, request: Request):
    """Fire-and-forget: enqueue and return 202 immediately."""
    from app.main import _event_queue  # import the shared queue
    validated_email = _validate_email(body.email)
    item = {
        "session_id": body.session_id,
        "event_type": body.event_type,
        "payload": json.dumps(body.payload),
        "email": validated_email,
    }
    try:
        _event_queue.put_nowait(item)
    except asyncio.QueueFull:
        # Drop oldest — not possible with put_nowait; use a try/get/put pattern
        # Alternative: just drop the new event and log
        log.warning("event_queue.full_dropping", event_type=body.event_type)
    return {"status": "accepted"}
```

**Queue cap strategy:** `asyncio.Queue(maxsize=1000)` raises `QueueFull` on `put_nowait()` when full. To drop oldest: attempt `_event_queue.get_nowait()` before `put_nowait()` when `QueueFull` is raised. This drops the oldest event and logs a warning.

**Important import concern:** Importing `_event_queue` from `main.py` in `events.py` creates a circular import risk. Better approach: define `_event_queue` in a new `app/queue.py` module and import from there in both `main.py` and `events.py`.

### Pattern 3: Explore Endpoint TTL Cache

**What:** Module-level dict cache matching the existing project pattern (`_embed_cache`, `_settings_cache`). Key = frozenset of query params. TTL = 30s per BPERF-07, but CONTEXT.md says 5-minute TTL for the LRU cache. **Resolution:** requirements say 30s TTL; CONTEXT.md says 5-minute TTL for LRU. Follow REQUIREMENTS.md (BPERF-07 = 30s TTL) since it is more specific.

**Example:**
```python
# app/services/explore_cache.py — new thin module

import time
import threading
from typing import Any

_cache: dict[str, tuple[Any, float]] = {}
_cache_lock = threading.Lock()
EXPLORE_CACHE_TTL = 30.0  # seconds (BPERF-07)
EXPLORE_CACHE_MAX_SIZE = 200

def get_cached(key: str) -> Any | None:
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        value, ts = entry
        if time.time() - ts > EXPLORE_CACHE_TTL:
            del _cache[key]
            return None
        return value

def set_cached(key: str, value: Any) -> None:
    with _cache_lock:
        # Evict oldest if at capacity
        if len(_cache) >= EXPLORE_CACHE_MAX_SIZE:
            oldest_key = min(_cache, key=lambda k: _cache[k][1])
            del _cache[oldest_key]
        _cache[key] = (value, time.time())

def invalidate_explore_cache() -> None:
    with _cache_lock:
        _cache.clear()
```

**Cache key construction** in `explore.py`:
```python
cache_key = f"{query}|{rate_min}|{rate_max}|{sorted(tags)}|{sorted(industry_tags)}|{limit}|{cursor}|{seed}"
```

**Invalidation hooks:** Call `invalidate_explore_cache()` in:
- `admin/experts.py`: `add_expert()`, `delete_expert()`, `delete_experts_bulk()`
- `admin/_common.py`: `_run_ingest_job()` after successful rebuild

### Pattern 4: Admin Experts Pagination

**What:** Add `page` (0-indexed) and `limit` Query params to `GET /api/admin/experts`. Return `total`, `page`, `total_pages` alongside the paginated `experts` list.

**Backend:**
```python
@router.get("/experts")
def get_experts(
    db: Session = Depends(get_db),
    active_only: bool = Query(default=False),
    page: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    search: str = Query(default=""),
):
    stmt = select(Expert)
    if active_only:
        stmt = stmt.where(Expert.is_active.is_(True))
    if search:
        search_lower = search.lower()
        stmt = stmt.where(
            (func.lower(Expert.first_name + " " + Expert.last_name)).contains(search_lower)
        )
    # Default sort: alphabetical by first name A-Z
    stmt = stmt.order_by(Expert.first_name.asc(), Expert.last_name.asc())
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    experts = db.scalars(stmt.offset(page * limit).limit(limit)).all()
    return {
        "experts": [_serialize_expert(e) for e in experts],
        "total": total,
        "page": page,
        "total_pages": math.ceil(total / limit) if total else 0,
    }
```

**Frontend wiring:** `ExpertsPage.tsx` already has local client-side filtering/pagination via `useMemo`. The task is adding server-side `page`/`search` params to the `useAdminExperts` hook (or creating a new variant), and wiring `AdminPagination.tsx` (already built and ready). The existing local sort state can be kept or removed; server-side sort is fixed to first-name A-Z per decisions.

**Important:** The existing `useAdminExperts` hook in `useAdminData.ts` fetches all experts. The hook needs a `page` and `search` parameter added, or a new `useAdminExpertsPaginated` hook should be created.

### Pattern 5: SQLite PRAGMA Additions

**What:** Add tuning PRAGMAs to the existing `_set_sqlite_pragma` event listener in `database.py`.

```python
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    # Phase 71: performance tuning
    cursor.execute("PRAGMA synchronous=NORMAL")       # Safe in WAL mode; faster commits
    cursor.execute("PRAGMA cache_size=-32000")        # 32 MB page cache
    cursor.execute("PRAGMA temp_store=MEMORY")        # Temp tables in memory
    cursor.execute("PRAGMA mmap_size=134217728")      # 128 MB = 128*1024*1024
    cursor.execute("PRAGMA wal_autocheckpoint=1000")  # Checkpoint every 1000 WAL pages
    cursor.close()
```

**Safety:** `synchronous=NORMAL` with WAL mode is safe — transactions are atomic; only durability after power loss may be affected (acceptable for analytics data).

### Pattern 6: SQLAlchemy Connection Pool Config

**What:** Add explicit pool params to `create_engine()`. SQLite file DBs use QueuePool by default — these just make it explicit.

```python
# database.py
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)
```

**Why explicit:** Railway containers restart; `pool_pre_ping=True` ensures stale connections are detected and replaced rather than causing 500 errors.

### Pattern 7: GZipMiddleware

**What:** Add to `main.py` after existing middlewares.

```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=500)
```

**Middleware order matters:** GZip must be added before CORS in FastAPI/Starlette's execution model (middlewares are applied in reverse registration order). Add GZip after CORS registration.

**compresslevel:** Default is 9 (maximum compression). For latency-sensitive APIs, level 5 or 6 provides a better compression/speed tradeoff. Since this is a low-traffic API, level 9 is fine.

### Pattern 8: Railway Config

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT --timeout-keep-alive 75 --log-level warning --no-access-log",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "region": "europe-west4"
  }
}
```

**Procfile** must also be updated (Railway uses `startCommand` in railway.json, but Procfile is the fallback):
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT --timeout-keep-alive 75 --log-level warning --no-access-log
```

### Anti-Patterns to Avoid

- **Circular imports with `_event_queue`:** Do not define the queue in `main.py` and import it from `events.py`. Instead, define it in a new `app/queue.py` module imported by both.
- **Using `asyncio.sleep(0)` in the flush worker:** Use `asyncio.wait_for(queue.get(), timeout=...)` for correct timeout-based batching.
- **Caching explore responses containing the session-specific cursor/seed:** If `seed > 0`, skip caching (seed implies randomized results — caching defeats the purpose).
- **GZipMiddleware before CORS:** CORS headers on compressed responses must still be set. Add GZip after CORS in the `app.add_middleware()` call sequence.
- **Importing `_require_admin` into health.py differently:** Always import from `app.routers.admin._common` — do not re-implement JWT validation.
- **Multiple Uvicorn workers:** Out of scope per REQUIREMENTS.md. Single worker only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Response compression | Custom gzip wrapper | `GZipMiddleware` from `fastapi.middleware.gzip` | Already ships with FastAPI; handles streaming, content-type detection |
| Connection health check | Custom DB ping | `pool_pre_ping=True` in `create_engine()` | SQLAlchemy handles dialect-specific ping logic |
| JWT validation in admin health | New JWT logic | Import `_require_admin` from `admin._common` | Already exists; duplicating creates drift risk |
| LRU cache with TTL | External `cachetools` | Hand-rolled TTL dict (project pattern) | Matches existing `_embed_cache` and `_settings_cache` patterns; no new dependency |

**Key insight:** This phase is pure configuration and thin glue code. No new frameworks, no new pip packages.

---

## Common Pitfalls

### Pitfall 1: Queue Circular Import
**What goes wrong:** `events.py` imports `_event_queue` from `main.py`; `main.py` imports `events.py` router — circular import fails at startup.
**Why it happens:** Natural placement of the queue in `main.py` where the lifespan runs.
**How to avoid:** Create `app/queue.py` with `_event_queue = asyncio.Queue(maxsize=1000)`. Import from there in both `main.py` and `events.py`.
**Warning signs:** `ImportError: cannot import name '_event_queue' from partially initialized module`

### Pitfall 2: Explore Cache Returns Stale Data After Expert Changes
**What goes wrong:** Expert is added/deleted, but explore results still return old data because cache wasn't invalidated.
**Why it happens:** Cache invalidation must be called from every mutation path.
**How to avoid:** Call `invalidate_explore_cache()` in `add_expert`, `delete_expert`, `delete_experts_bulk`, and `_run_ingest_job` completion.
**Warning signs:** Admin adds expert, but explore search still doesn't show them within 30s.

### Pitfall 3: GZipMiddleware Placement
**What goes wrong:** CORS headers not applied correctly to gzip-compressed responses.
**Why it happens:** Starlette middleware is applied in LIFO order — last-registered middleware runs first on request, first on response.
**How to avoid:** Add `GZipMiddleware` AFTER `CORSMiddleware` registration in `main.py` so GZip compresses the final response after CORS headers are set.
**Warning signs:** CORS errors in browser for compressed responses.

### Pitfall 4: SQLite Pool Config with `check_same_thread=False`
**What goes wrong:** Adding `poolclass=QueuePool` without retaining `check_same_thread: False` causes threading errors in FastAPI.
**Why it happens:** SQLite's default C library is not thread-safe without this flag.
**How to avoid:** Keep `connect_args={"check_same_thread": False}` in the `create_engine()` call alongside pool params.

### Pitfall 5: Admin Pagination Breaking Existing Client-Side Sort
**What goes wrong:** `ExpertsPage.tsx` has client-side sort state (`sortCol`, `sortDir`). If the API now returns only 50 rows, sorting only applies to the visible page — not the full dataset.
**Why it happens:** Client-side sort + server-side pagination are incompatible.
**How to avoid:** Per user decisions, server-side sort is fixed to first-name A-Z. Remove or disable the sort header UI for paginated mode, or accept that sort only applies to visible page (acceptable for admin use).

### Pitfall 6: `mmap_size` Unit Confusion
**What goes wrong:** Setting `PRAGMA mmap_size=128` instead of `128 * 1024 * 1024`.
**Why it happens:** `mmap_size` takes bytes, not MB.
**How to avoid:** Use `cursor.execute("PRAGMA mmap_size=134217728")` (128 MB in bytes) or `cursor.execute(f"PRAGMA mmap_size={128 * 1024 * 1024}")`.

### Pitfall 7: Health Endpoint Import of `_require_admin`
**What goes wrong:** Importing `_require_admin` from `app.routers.admin._common` into `health.py` creates a potential startup-order issue if admin._common imports from health.
**Why it happens:** Cross-router imports.
**How to avoid:** `app/routers/admin/_common.py` does not import from `health.py` — import is safe. Alternatively, add the admin health endpoint directly to the admin router package.

---

## Code Examples

### Railway JSON Final State
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT --timeout-keep-alive 75 --log-level warning --no-access-log",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "region": "europe-west4"
  }
}
```

### GZipMiddleware in main.py
```python
# After CORSMiddleware registration
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)
```

### SQLAlchemy Pool + PRAGMA in database.py
```python
from sqlalchemy import create_engine, event
from sqlalchemy.pool import QueuePool
from app.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-32000")
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.execute("PRAGMA mmap_size=134217728")   # 128 MB
    cursor.execute("PRAGMA wal_autocheckpoint=1000")
    cursor.close()
```

### Admin Health Widget Upgrade (OverviewPage.tsx)
The existing `useHealthCheck` hook calls the public `/api/health`. To show richer data (DB status, expert count, latency), switch to calling `/api/admin/health` with the admin JWT — it already uses `adminFetch` elsewhere in `OverviewPage.tsx`.

---

## What Already Exists (Do Not Rebuild)

| Feature | Status | Location |
|---------|--------|----------|
| Photo proxy Cache-Control header | DONE | `browse.py:196` — `"Cache-Control": "public, max-age=86400"` already in `StreamingResponse` |
| Admin health indicator widget | PARTIAL | `OverviewPage.tsx` — `useHealthCheck` pings public `/api/health`, shows ms + up/down |
| AdminPagination component | DONE | `frontend/src/admin/components/AdminPagination.tsx` |
| WAL mode | DONE | `database.py:_set_sqlite_pragma` |
| busy_timeout=5000 | DONE | `database.py:_set_sqlite_pragma` |
| Settings cache (pattern reference) | DONE | `app/services/search_intelligence.py` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync event DB write per request | asyncio.Queue batch worker | Phase 71 | Eliminates SQLite write contention; 202 response latency drops |
| Single-process healthcheck (just FAISS size) | Two-tier health (public + admin) | Phase 71 | Railway gets minimal endpoint; admin gets diagnostics |
| NullPool / SingletonThreadPool SQLite default | Explicit QueuePool with pool_pre_ping | Phase 71 | Prevents silent stale-connection failures |

**Deprecated/outdated:**
- `@app.on_event("startup")` pattern: project already uses lifespan correctly — do not revert to on_event for the queue worker.

---

## Open Questions

1. **BPERF-07 TTL conflict: 30s (requirements) vs 5m (CONTEXT.md)**
   - What we know: REQUIREMENTS.md says 30s; CONTEXT.md (user decisions) says 5-minute TTL
   - What's unclear: Which takes precedence
   - Recommendation: CONTEXT.md represents the latest user decision. Use 5-minute TTL (300s). The BPERF-07 requirement text says 30s TTL but the user explicitly stated 5-minute in the discussion. Planner should note this and use 300s as the TTL value in the implementation plan.

2. **Admin health endpoint location: health.py vs admin router**
   - What we know: `_require_admin` is in `admin._common`; health.py is a separate router
   - What's unclear: Whether to add the admin health endpoint to health.py (importing `_require_admin`) or to an admin sub-module
   - Recommendation: Add to `app/routers/health.py` using imported `_require_admin`. The endpoint is `/api/admin/health` which fits naturally alongside `/api/health`. Import `_require_admin` from `admin._common` — no circular import exists.

3. **Explore cache with `usernames` param (saved view)**
   - What we know: Explore supports a `usernames` param for saved expert lists
   - What's unclear: Whether saved-view queries should hit the cache
   - Recommendation: Include `usernames` in the cache key. Cache will work correctly — just a different key.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.2 + pytest-asyncio 0.23 (backend); vitest (frontend) |
| Config file | None detected — `pytest.ini` / `pyproject.toml` not present; tests dir does not exist |
| Quick run command (backend) | `cd /Users/sebastianhamers/Documents/TCS && pytest tests/ -x -q` |
| Full suite command (backend) | `cd /Users/sebastianhamers/Documents/TCS && pytest tests/ -v` |
| Quick run command (frontend) | `cd /Users/sebastianhamers/Documents/TCS/frontend && npm test` |
| Estimated runtime | ~10-20s backend; ~5s frontend |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BPERF-01 | `GET /api/health` returns `status`, `index_size`; `GET /api/admin/health` returns DB status + expert count + latency | integration (httpx TestClient) | `pytest tests/test_health.py -x` | Wave 0 gap |
| BPERF-02 | `GET /api/admin/experts?page=0&limit=50` returns paginated result with `total`, `total_pages`; search param filters by name | integration | `pytest tests/test_admin_experts.py -x` | Wave 0 gap |
| BPERF-03 | `GET /api/photos/{username}` response headers contain `Cache-Control: public, max-age=86400` | integration | `pytest tests/test_browse.py::test_photo_proxy_cache_header -x` | Wave 0 gap (but impl is done — test just verifies) |
| BPERF-04 | 10 concurrent `POST /api/events` complete without 500; events appear in DB after 3s wait | integration | `pytest tests/test_events.py::test_batch_queue -x` | Wave 0 gap |
| BPERF-05 | DB connection PRAGMAs set: `PRAGMA synchronous` = 1, `PRAGMA cache_size` = -32000, etc. | unit (DB setup) | `pytest tests/test_database.py -x` | Wave 0 gap |
| BPERF-06 | Response to large explore query has `Content-Encoding: gzip` header | integration | `pytest tests/test_gzip.py -x` | Wave 0 gap |
| BPERF-07 | Two identical explore queries: second hits cache (response time faster / logged "cache hit") | integration | `pytest tests/test_explore_cache.py -x` | Wave 0 gap |
| BPERF-08 | `engine.pool.size()` == 5, `engine.pool._max_overflow` == 10 | unit | `pytest tests/test_database.py::test_pool_config -x` | Wave 0 gap |
| RAIL-01 | `railway.json` contains `"region": "europe-west4"` | file inspection | manual / `pytest tests/test_config_files.py -x` | Wave 0 gap |
| RAIL-02 | `railway.json` startCommand contains `--timeout-keep-alive 75 --log-level warning --no-access-log` | file inspection | manual / `pytest tests/test_config_files.py -x` | Wave 0 gap |
| RAIL-03 | `railway.json` has `healthcheckTimeout: 120` and `restartPolicyType: ON_FAILURE` | file inspection | manual / `pytest tests/test_config_files.py -x` | Wave 0 gap |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task → run `pytest tests/ -x -q` (backend) or `npm test` (frontend)
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~15 seconds (backend); ~5 seconds (frontend)

### Wave 0 Gaps (must be created before implementation)

- [ ] `tests/__init__.py` — makes tests a package
- [ ] `tests/conftest.py` — shared FastAPI TestClient fixture with in-memory SQLite DB
- [ ] `tests/test_health.py` — covers BPERF-01
- [ ] `tests/test_admin_experts.py` — covers BPERF-02
- [ ] `tests/test_browse.py` — covers BPERF-03
- [ ] `tests/test_events.py` — covers BPERF-04
- [ ] `tests/test_database.py` — covers BPERF-05, BPERF-08
- [ ] `tests/test_gzip.py` — covers BPERF-06
- [ ] `tests/test_explore_cache.py` — covers BPERF-07
- [ ] `tests/test_config_files.py` — covers RAIL-01, RAIL-02, RAIL-03 (reads and parses railway.json)

---

## Sources

### Primary (HIGH confidence)

- Official Railway JSON schema (`https://backboard.railway.app/railway.schema.json`) — confirmed `region`, `restartPolicyType` enum values (`ON_FAILURE`, `ALWAYS`, `NEVER`), `healthcheckTimeout` field
- Official Railway docs (`https://docs.railway.com/reference/config-as-code`) — deploy section field listing
- SQLAlchemy 2.0 docs (`https://docs.sqlalchemy.org/en/20/core/pooling.html`) — QueuePool is default for SQLite file DBs; `pool_pre_ping` applies to QueuePool
- FastAPI docs (`https://fastapi.tiangolo.com/advanced/middleware/`) — GZipMiddleware minimum_size default is 500 bytes
- Codebase inspection — confirmed existing patterns, what already exists vs what needs building

### Secondary (MEDIUM confidence)

- SQLite official PRAGMA docs (`https://sqlite.org/pragma.html`) — synchronous=NORMAL safe in WAL mode; mmap_size in bytes
- phiresky SQLite performance tuning (`https://phiresky.github.io/blog/2020/sqlite-performance-tuning/`) — wal_autocheckpoint, cache_size, temp_store recommendations align with BPERF-05 requirements

### Tertiary (LOW confidence)

- None — all critical claims verified with official sources or codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against codebase + official docs
- Architecture: HIGH — all patterns grounded in existing codebase conventions
- Pitfalls: HIGH — derived from codebase analysis + official docs
- Railway config: HIGH — verified against live Railway JSON schema

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (Railway schema may change; SQLAlchemy/FastAPI APIs are stable)
