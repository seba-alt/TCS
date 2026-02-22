---
phase: 14-hybrid-search-backend
verified: 2026-02-21T21:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "When a text query is given, results reflect fused FAISS (0.7) + BM25 (0.3) weighted ranking, with findability AND feedback boosts applied on top"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Confirm feedback boost actually affects ranking on Railway (requires Feedback rows to exist)"
    expected: "Experts with more upvotes on the explore page rank higher than comparable experts with downvotes"
    why_human: "Railway Feedback table may be empty or have very few rows — cold-start guard means boost may be 0 for all experts even after implementation, so functional difference cannot be confirmed programmatically"
  - test: "FTS5 Population Count on Railway"
    expected: "Startup logs show 'FTS5 index created/verified'; SELECT COUNT(*) FROM experts_fts returns same count as experts table"
    why_human: "Cannot query Railway SQLite database programmatically from this environment"
---

# Phase 14: Hybrid Search Backend Verification Report

**Phase Goal:** The backend exposes a hybrid search API that fuses semantic and keyword signals so the marketplace has a working, validated data contract to build against.
**Verified:** 2026-02-21T21:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (previous score 4/5, gap: missing feedback boost in run_explore())

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/explore returns ExploreResponse JSON with experts[], total, cursor, and took_ms for any query/filter combination | VERIFIED | ExploreResponse Pydantic schema at lines 58-63 of explorer.py defines all four fields; route registered at main.py line 270; router wiring in explore.py confirmed |
| 2 | Without a text query, results are sorted by findability_score descending — FAISS and BM25 are skipped entirely | VERIFIED | explorer.py lines 317-333: pure filter branch sorts by `e.findability_score or 0.0`, builds cards with `faiss_score=None, bm25_score=None`; FAISS/FTS5 stages never execute |
| 3 | When a text query is given, results reflect fused FAISS (0.7) + BM25 (0.3) weighted ranking, with findability AND feedback boosts applied on top | VERIFIED | FAISS*0.7+BM25*0.3 at line 247; `_apply_findability_boost()` at line 248; inline feedback boost block at lines 251-302: Feedback table queried, cold-start guard at <10 total votes, multipliers computed and applied to scored list, graceful degradation on any exception |
| 4 | The FTS5 experts_fts virtual table exists in SQLite and is populated with all experts at startup | VERIFIED | main.py lines 144-166: CREATE VIRTUAL TABLE IF NOT EXISTS experts_fts USING fts5(...) with content='experts', content_rowid='id'; bulk INSERT when fts_count==0; INSERT trigger created at lines 168-179 for ongoing sync |
| 5 | The username_to_faiss_pos mapping is built at startup and IDSelectorBatch correctly restricts FAISS search to the SQLAlchemy pre-filtered expert set | VERIFIED | main.py lines 210-220: mapping built from metadata.json using "Username" key; explorer.py lines 191-212: allowed_positions built from filtered set, dtype=np.int64, guard at len==0 before IDSelectorBatch construction |

**Score:** 5/5 truths verified

---

## Re-Verification: Gap Closure Evidence

### Gap that was closed: Feedback boost in run_explore()

**Previous status:** PARTIAL — `_apply_findability_boost()` was called but no feedback boost existed in the text-query path of run_explore().

**Fix applied:** Inline feedback boost block added at `app/services/explorer.py` lines 251-302.

**Verification of the fix:**

| Check | Result |
|-------|--------|
| `Feedback` model imported at line 27 | CONFIRMED — `from app.models import Expert, Feedback` |
| Feedback rows queried via `db.scalars(select(Feedback).where(Feedback.vote.in_(["up","down"])))` | CONFIRMED — lines 261-263 |
| `expert_ids` parsed via `json.loads(row.expert_ids or "[]")` | CONFIRMED — line 267 |
| Cold-start guard: `if total_votes < 10: continue` | CONFIRMED — lines 280-281 |
| Boost formula: `ratio = up / total_votes`, multiplier 1.0 +/- (ratio-0.5)*0.40 | CONFIRMED — lines 282-286 |
| Multipliers applied: `scored` list comprehension replaces `final_s * multiplier` | CONFIRMED — lines 288-299 |
| Graceful degradation: `except Exception: log.warning(); scored unchanged` | CONFIRMED — lines 300-302 |
| Boost runs only inside `if is_text_query:` block | CONFIRMED — boost block is nested within the text-query branch, not the pure-filter branch |
| Formula matches search_intelligence._apply_feedback_boost() | CONFIRMED — FEEDBACK_BOOST_CAP=0.20, boost_factor=0.40; identical ratio formula |

**File size growth:** 10,019 bytes (initial verification) to 12,421 bytes — +2,402 bytes consistent with the ~52-line inline block added.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/services/explorer.py` | ExpertCard schema, ExploreResponse schema, run_explore() pipeline with all boosts | VERIFIED | 12,421 bytes, 348 lines. All schemas, all three pipeline stages, findability boost, feedback boost. |
| `app/routers/explore.py` | GET /api/explore FastAPI route | VERIFIED | 1,705 bytes, 51 lines. GET /api/explore with response_model=ExploreResponse, run_in_executor pattern. |
| `app/main.py` | FTS5 startup migration, username_to_faiss_pos mapping, category classification, explore router registration | VERIFIED | FTS5 DDL at lines 144-166, INSERT trigger at 168-179, mapping at 210-220, category classification at 222-235, router at 270. |
| `app/routers/admin.py` | FTS5 sync in _run_ingest_job rebuild, username_to_faiss_pos refresh after hot-reload | VERIFIED | FTS5 rebuild at lines 128-132, mapping refresh at lines 134-141. Both confirmed present and unchanged. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/routers/explore.py` | `app/services/explorer.py` | `run_explore()` called in executor | WIRED | Line 15: import; line 40: `lambda: run_explore(...)` inside `loop.run_in_executor` |
| `app/services/explorer.py` | `app.state.username_to_faiss_pos` | `app_state.username_to_faiss_pos` lookup | WIRED | Line 191: assignment; used in IDSelectorBatch at lines 194-198 |
| `app/services/explorer.py` | `experts_fts` | `db.execute(text('SELECT rowid, rank FROM experts_fts ...'))` | WIRED | Lines 220-228: FTS5 MATCH query with LIMIT 200 |
| `app/services/explorer.py` | `Feedback` model | `db.scalars(select(Feedback).where(Feedback.vote.in_(...)))` | WIRED | Lines 261-263: Feedback table queried in feedback boost block; `vote` and `expert_ids` columns confirmed on model |
| `app/main.py` | `app/routers/explore.py` | `app.include_router(explore.router)` | WIRED | Line 270: confirmed |
| `app/main.py` | `experts_fts` | `CREATE VIRTUAL TABLE IF NOT EXISTS experts_fts USING fts5` | WIRED | Lines 145-156: full DDL confirmed |
| `app/main.py` | `app.state.username_to_faiss_pos` | `app.state.username_to_faiss_pos = _username_to_pos` | WIRED | Line 216: confirmed |
| `app/routers/admin.py` | `experts_fts` | `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` | WIRED | Line 130: explicit rebuild in _run_ingest_job; startup INSERT trigger covers add_expert path |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXPL-01 | 14-01 | System provides /api/explore endpoint returning paginated expert results (cursor, total, took_ms) | SATISFIED | GET /api/explore registered; ExploreResponse returns all four required fields; cursor=None signals end of results; took_ms via time.time() |
| EXPL-02 | 14-01 | System pre-filters experts by rate range and domain tags via SQLAlchemy to FAISS IDSelectorBatch before vector search | SATISFIED | SQLAlchemy WHERE on hourly_rate range + tag AND-logic; allowed_positions built from filtered set; IDSelectorBatch search-time restriction confirmed |
| EXPL-03 | 14-01 | System fuses FAISS semantic score (0.7) + FTS5 BM25 keyword score (0.3) into a single weighted rank | SATISFIED | FAISS_WEIGHT=0.7, BM25_WEIGHT=0.3 at lines 33-34; fusion at line 247; BM25 rank normalized via abs(rank)/max_rank |
| EXPL-04 | 14-01 | System applies findability score AND feedback boosts to fused rankings | SATISFIED | `_apply_findability_boost()` at line 248; inline feedback boost at lines 251-302; both boosts confirmed applied in text-query path |
| EXPL-05 | 14-02 | SQLite FTS5 virtual table is created at startup and synced with experts table on writes | SATISFIED | FTS5 DDL idempotent via IF NOT EXISTS; initial bulk population; INSERT trigger for new writes; explicit rebuild in _run_ingest_job |

### Orphaned Requirements

No requirement IDs mapped to Phase 14 in REQUIREMENTS.md are absent from the plans. All five EXPL-* requirements are accounted for and satisfied.

---

## Schema Verification

### ExpertCard (15 fields — all confirmed)

Fields: `username`, `first_name`, `last_name`, `job_title`, `company`, `hourly_rate`, `currency`, `profile_url`, `tags`, `findability_score`, `category`, `faiss_score`, `bm25_score`, `final_score`, `match_reason`

- `faiss_score` and `bm25_score` are `float | None` — None in pure filter mode: CONFIRMED (lines 52-53)
- `match_reason` is `str | None` — None when query is empty: CONFIRMED (line 122)
- `final_score` rounded to 4 decimal places: CONFIRMED (line 137)
- `profile_url` uses profile_url_utm when available: CONFIRMED (line 131)

### ExploreResponse (4 fields — all confirmed)

Fields: `experts`, `total`, `cursor`, `took_ms` — exact match to PLAN spec.

### Pipeline Implementation Details

| Detail | Required | Actual | Status |
|--------|----------|--------|--------|
| IDSelectorBatch guard | len(allowed_positions) == 0 check before construction | Line 201: `if len(allowed_positions) > 0:` | CONFIRMED |
| allowed_positions dtype | np.int64 | Line 197: `dtype=np.int64` | CONFIRMED |
| FTS5 LIMIT | LIMIT 200 | Line 225: `"LIMIT 200"` | CONFIRMED |
| FTS5 query sanitizer | _safe_fts_query() before MATCH | Line 216: `safe_q = _safe_fts_query(query)` | CONFIRMED |
| k for FAISS search | min(50, len(allowed_positions)) | Line 205: `k = min(50, len(allowed_positions))` | CONFIRMED |
| Tag AND logic | Expert.tags.like('%"tag"%') normalized to lowercase | Line 174: `Expert.tags.like(f'%"{tag.lower()}"%')` | CONFIRMED |
| Findability boost formula | normalized=(score-75)/25, multiplier=1+(normalized*0.20) | Lines 91-93: exact match to spec | CONFIRMED |
| Feedback boost cold-start guard | fewer than 10 total votes = no boost | Lines 279-281: `total_votes < 10: continue` | CONFIRMED |
| Feedback boost graceful degradation | exception caught, scored unchanged, warning logged | Lines 300-302 | CONFIRMED |
| Cursor pagination | slice[cursor:cursor+limit+1], has_more check, next_cursor | Lines 306-310 in hybrid, 324-328 in filter mode | CONFIRMED |
| total = pre-filter count | len(filtered_experts) | Line 177: `total = len(filtered_experts)` | CONFIRMED |

---

## Anti-Patterns Found

No TODO/FIXME/PLACEHOLDER/XXX comments found in any of the four phase 14 files.
No empty implementations or stub return patterns found.
No debug print/console.log statements found.

---

## Regressions

No regressions detected. All four previously-verified truths remain confirmed:

- Truth 1 (ExploreResponse schema + route): CONFIRMED — ExploreResponse definition and explore.py router unchanged
- Truth 2 (pure filter mode, findability sort, FAISS/BM25 skipped): CONFIRMED — else branch at lines 317-333 unchanged; feedback boost block is not present in the pure-filter branch
- Truth 4 (FTS5 virtual table at startup): CONFIRMED — main.py startup block unchanged
- Truth 5 (username_to_faiss_pos mapping + IDSelectorBatch): CONFIRMED — main.py mapping build and explorer.py IDSelectorBatch construction unchanged

---

## Human Verification Required

### 1. Feedback Boost on Railway

**Test:** After deployment, submit thumbs-up feedback on multiple experts via the feedback system, then call `GET /api/explore?query=marketing` and confirm experts with upvotes rank higher than comparable experts without feedback.
**Expected:** Experts with 10+ upvotes appear above experts with comparable FAISS+BM25 scores but no feedback signal.
**Why human:** Railway Feedback table is likely sparse — cold-start guard (fewer than 10 interactions per expert) means no effect is visible until sufficient feedback accumulates. Cannot verify programmatically.

### 2. FTS5 Population Count on Railway

**Test:** Check Railway logs for "startup: FTS5 index created/verified"; then verify `SELECT COUNT(*) FROM experts_fts` matches the experts table row count.
**Expected:** FTS5 index fully populated — all experts searchable by keyword.
**Why human:** Cannot query the Railway SQLite database from this environment.

---

_Verified: 2026-02-21T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
