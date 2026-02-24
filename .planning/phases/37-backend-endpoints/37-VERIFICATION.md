---
phase: 37-backend-endpoints
status: passed
verified: 2026-02-24
verifier: automated
---

# Phase 37: Backend Endpoints - Verification

## Goal
Backend serves curated Browse data and proxies expert photos so the Browse UI can be built against real data from day one.

## Success Criteria Verification

### SC1: GET /api/browse returns { featured, rows[] } with category rows and cold-start guard
- **Status: PASSED**
- `/api/browse` endpoint registered in FastAPI app routes
- Response shape: `{ featured: [...], rows: [...] }` with category rows having 3+ expert threshold
- Cold-start guard returns "All Experts" row when no categories meet threshold
- `per_row` query parameter supports 1-30 range (default 10)
- Uses SQL queries (no FAISS, no Gemini) as required

### SC2: GET /api/photos/{username} proxies photo with 404, Cache-Control, and CORS
- **Status: PASSED**
- `/api/photos/{username}` endpoint registered in FastAPI app routes
- Returns 404 when expert not found or has no photo_url
- Includes `Cache-Control: public, max-age=86400` header (24h cache)
- StreamingResponse with upstream Content-Type forwarding
- CORSMiddleware in main.py covers all GET endpoints (including browse router)

### SC3: Admin can POST CSV to /api/admin/experts/photos with dry-run
- **Status: PASSED**
- `/api/admin/experts/photos` endpoint registered on admin router (requires X-Admin-Key)
- Accepts CSV with first_name, last_name, photo_url columns
- dry_run=True (default) returns preview counts without writing
- dry_run=False writes photo URLs to Expert records
- Reports matched/not_found/ambiguous/will_overwrite counts
- _serialize_expert includes photo_url field

### SC4: Photo endpoint returns HTTPS URL in production
- **Status: PASSED**
- Photo proxy rewrites `http://` to `https://` before fetching upstream
- No mixed-content risk from Railway to Vercel

## Requirements Traceability

| Requirement | Plan | Status |
|-------------|------|--------|
| PHOTO-01 | 37-02 | Verified - Admin bulk photo CSV import with dry-run |
| PHOTO-02 | 37-01 | Verified - Photo proxy endpoint with HTTPS and caching |

## Must-Haves Verification

### Plan 37-01 Must-Haves
- [x] GET /api/browse returns JSON with featured array (3-5 experts) and rows array
- [x] GET /api/browse supports ?per_row=N query param (default 10, max 30)
- [x] GET /api/browse returns cold-start fallback (single All Experts row)
- [x] GET /api/photos/{username} proxies image bytes with correct Content-Type
- [x] GET /api/photos/{username} returns 404 when expert not found or has no photo_url
- [x] GET /api/photos/{username} includes Cache-Control: public, max-age=86400 header
- [x] Photo proxy rewrites http:// to https:// before fetching upstream

### Plan 37-02 Must-Haves
- [x] Admin can POST CSV with first_name,last_name,photo_url to bulk-import photo URLs
- [x] Dry-run mode (default) returns preview counts without writing
- [x] Commit mode (dry_run=false) writes photo URLs to Expert records
- [x] Ambiguous name matches (2+ experts) are skipped and reported
- [x] Not-found names are reported in response details
- [x] Existing photos are overwritten when matched
- [x] Admin _serialize_expert includes photo_url field

## Artifacts Verified

| Path | Exists | Min Lines | Contains |
|------|--------|-----------|----------|
| app/routers/browse.py | Yes | 160+ (>80 min) | Browse API and photo proxy endpoints |
| app/main.py | Yes | N/A | browse.router |
| app/routers/admin.py | Yes | N/A | experts/photos |

## Key Links Verified

| From | To | Via | Pattern Found |
|------|----|----|--------------|
| app/routers/browse.py | app/models.py | SQLAlchemy Expert model queries | Expert.category, Expert.findability_score |
| app/main.py | app/routers/browse.py | include_router registration | app.include_router(browse.router) |
| app/routers/admin.py | app/models.py | Expert.photo_url write | expert.photo_url = |

## Verdict

**PASSED** - All 4 success criteria verified. All must-haves from both plans confirmed. All requirement IDs (PHOTO-01, PHOTO-02) accounted for.

---
*Phase: 37-backend-endpoints*
*Verified: 2026-02-24*
