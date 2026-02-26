# Phase 37: Backend Endpoints — Research

## RESEARCH COMPLETE

**Researched:** 2026-02-24
**Phase Goal:** Backend serves curated Browse data and proxies expert photos so the Browse UI can be built against real data from day one
**Requirements:** PHOTO-01, PHOTO-02

---

## 1. Current Architecture

### Expert Model (app/models.py:82-109)
- `Expert` table already has `photo_url: Mapped[str | None]` (added Phase 36)
- Key fields for Browse: `username`, `first_name`, `last_name`, `job_title`, `company`, `hourly_rate`, `category`, `tags`, `findability_score`, `photo_url`, `profile_url`
- `category` field is nullable String(100), populated via `_auto_categorize()` keyword matcher or manual admin classification

### Router Patterns (app/routers/admin.py)
- Two routers: `auth_router` (no auth) and `router` (requires `_require_admin` dep via `X-Admin-Key` header)
- Existing `_serialize_expert()` helper at line 222 — does NOT include `photo_url` yet
- Existing CSV import pattern: `import_experts_csv()` accepts file upload, upserts by username
- Category keywords defined in `CATEGORY_KEYWORDS` dict (11 categories)

### Main App (app/main.py)
- CORSMiddleware already configured with `ALLOWED_ORIGINS`, methods `["GET", "POST"]`, headers `["Content-Type", "X-Admin-Key"]`
- Routers registered via `app.include_router()` — new routers need to be added here
- `app.state.metadata` and `app.state.faiss_index` available but Browse should NOT use these (SQL-only per success criteria)

### Public Endpoint Pattern (app/routers/explore.py)
- `router = APIRouter()` with no prefix, no auth dependencies
- Endpoint: `GET /api/explore` — uses `Request` for `app.state`, `get_db` for SQLAlchemy session
- Async with `run_in_executor` for sync DB operations

---

## 2. Endpoint Design

### GET /api/browse (Public, No Auth)

**New router file:** `app/routers/browse.py` — keeps separation of concerns clean, matches existing pattern (explore.py, events.py, etc.)

**Response shape:**
```json
{
  "featured": [<expert_card>, ...],   // 3-5 experts for hero section
  "rows": [
    {
      "title": "Finance",
      "slug": "finance",
      "experts": [<expert_card>, ...],
      "total": 42
    }
  ]
}
```

**Expert card fields (Claude's discretion per CONTEXT.md):**
```json
{
  "username": "john-doe",
  "first_name": "John",
  "last_name": "Doe",
  "job_title": "CFO & Strategy Advisor",
  "company": "FinCorp",
  "hourly_rate": 150.0,
  "category": "Finance",
  "tags": ["finance", "strategy"],
  "photo_url": "/api/photos/john-doe",
  "profile_url": "https://tinrate.com/u/john-doe"
}
```

Note: `photo_url` in the card should be the **proxy endpoint** path (`/api/photos/{username}`), not the raw stored URL. This avoids mixed-content issues and keeps the external URL private.

**Category rows logic:**
1. Query `SELECT category, COUNT(*) FROM experts WHERE category IS NOT NULL GROUP BY category HAVING COUNT(*) >= 3 ORDER BY COUNT(*) DESC`
2. For each qualifying category, fetch up to `per_row` experts (default 10)
3. Sort experts within a row by `findability_score DESC NULLS LAST`
4. Add 1-2 cross-category special rows:
   - "Recently Added" — experts ordered by `created_at DESC`, limit `per_row`

**Featured experts:**
- Top 3-5 experts by `findability_score` (highest overall quality)
- Alternatively: random sample from top-scoring experts for variety

**Cold-start guard:**
- The success criteria says "cold-start guard when user_events is empty" — but the CONTEXT.md clarifies categories come from the `category` field, NOT user_events
- Interpretation: user_events emptiness is irrelevant since Browse uses SQL categories directly
- The "cold-start" means: if somehow no experts have categories, return a default set (all experts by findability_score)
- Simpler check: if zero category rows meet the 3+ threshold, fall back to a single "All Experts" row

**Query param:** `?per_row=N` (default 10, max ~30 to prevent oversized payloads)

### GET /api/photos/{username} (Public, No Auth)

**Approach: Proxy bytes (not redirect)**
- Redirect would expose the external photo URL and lose CORS/cache control
- Proxy streams the image bytes through Railway backend
- Use `httpx.AsyncClient` for async HTTP fetch (already commonly used, or fall back to standard library)

**Implementation:**
1. Look up `Expert` by username → 404 if not found or `photo_url` is NULL/empty
2. Fetch photo from stored URL using `httpx` (async)
3. Return `StreamingResponse` with:
   - `Content-Type` from upstream (e.g., `image/jpeg`)
   - `Cache-Control: public, max-age=86400` (24h)
   - No `X-Admin-Key` required
4. HTTPS enforcement: when constructing the stored URL, if it starts with `http://`, rewrite to `https://` before proxying
5. Error handling: if upstream returns non-200, return 502

**CORS:** Since this router has no prefix and the endpoint is `GET`, CORSMiddleware in main.py already covers it (allow_methods includes GET).

**Dependency:** Need `httpx` package. Check if already in requirements.

### POST /api/admin/experts/photos (Admin Auth Required)

**CSV format:** `first_name,last_name,photo_url`

**Two-step flow (from CONTEXT.md):**
- `?dry_run=true` (default true): returns preview counts + line-by-line detail, writes nothing
- `?dry_run=false`: actually writes the photo URLs

**Matching logic:**
1. For each CSV row, query `Expert` by `first_name` AND `last_name` (case-insensitive)
2. If exactly 1 match → matched (will write/overwrite)
3. If 0 matches → "not_found"
4. If 2+ matches → "ambiguous" (skip, report in response)

**Response shape:**
```json
{
  "dry_run": true,
  "summary": {
    "matched": 8,
    "not_found": 2,
    "ambiguous": 1,
    "will_overwrite": 3
  },
  "details": [
    {"first_name": "John", "last_name": "Doe", "status": "matched", "username": "john-doe", "existing_photo": null},
    {"first_name": "Jane", "last_name": "Smith", "status": "ambiguous", "matches": ["jane-smith-1", "jane-smith-2"]},
    {"first_name": "Bob", "last_name": "X", "status": "not_found"}
  ]
}
```

---

## 3. File Changes

### New Files
- `app/routers/browse.py` — Browse API router (GET /api/browse, GET /api/photos/{username})

### Modified Files
- `app/main.py` — Register browse router
- `app/routers/admin.py` — Add POST /api/admin/experts/photos endpoint
- `app/routers/admin.py` — Update `_serialize_expert()` to include `photo_url` field (for admin panel consistency)

### Dependencies
- Check if `httpx` is already in requirements.txt/pyproject.toml — needed for photo proxy
- If not present, add `httpx` dependency

---

## 4. Key Decisions

### Photo proxy vs redirect
**Decision: Proxy bytes.** Redirect would bypass CORS headers and expose external URLs. Proxy keeps control of caching, CORS, and HTTPS enforcement.

### Browse router location
**Decision: New file `app/routers/browse.py`.** The Browse and Photo endpoints are public-facing (no admin auth). Putting them in admin.py would require creating yet another no-auth router. A dedicated file follows the existing pattern (explore.py, events.py).

### Featured selection
**Decision: Top 5 by findability_score.** Simple, deterministic, no external dependency. Phase 38 can add rotation logic on the frontend.

### Category ordering
**Decision: By expert count descending.** Per CONTEXT.md. Most populated categories appear first — gives the richest browsing experience.

### HTTPS enforcement
**Decision: Rewrite `http://` → `https://` at proxy time.** Simple string replacement on the stored URL before fetching. Covers the mixed-content requirement without requiring URL normalization on import.

---

## 5. Risk Assessment

| Risk | Mitigation |
|------|------------|
| httpx not installed | Check requirements, add if missing |
| Photo proxy timeout | Set 5s timeout on httpx call, return 504 |
| Large photo files | Set response streaming, don't buffer full image in memory |
| Category field sparsely populated | Cold-start guard returns all-experts fallback |
| Name matching ambiguity in photo CSV | Report ambiguous matches, skip them (per CONTEXT.md) |

---

## 6. Testing Notes

- Browse endpoint testable with SQLite test DB (no FAISS needed)
- Photo proxy needs mocked HTTP responses (use `httpx` mock or `respx`)
- Admin photo import testable with StringIO CSV uploads
- Cold-start guard testable by having no categorized experts in test DB

---

*Research complete for Phase 37: Backend Endpoints*
