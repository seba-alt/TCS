# Architecture Research

**Domain:** RAG expert-matching chatbot — v1.1 Expert Intelligence & Search Quality
**Researched:** 2026-02-21
**Confidence:** HIGH — based on direct inspection of the production codebase (all files read), verified against Google GenAI API docs, FAISS docs, and established RAG patterns.

---

## Context: What Already Exists (v1.0)

This is a subsequent-milestone research document. The following components are **live in production** and must not be replaced, only extended:

| File | Role | Status |
|------|------|--------|
| `app/models.py` | SQLAlchemy ORM — Expert, Conversation, Feedback, EmailLead | EXISTS — needs new columns |
| `app/main.py` | FastAPI lifespan, FAISS load, DB seed, router mounts | EXISTS — needs migration additions |
| `app/config.py` | Shared constants (EMBEDDING_MODEL, OUTPUT_DIM, paths) | EXISTS — unchanged |
| `app/services/embedder.py` | Single-query embedding via `gemini-embedding-001` | EXISTS — unchanged |
| `app/services/retriever.py` | FAISS search, candidate assembly, `RetrievedExpert` dataclass | EXISTS — needs query expansion hook |
| `app/services/llm.py` | Gemini `gemini-2.5-flash` generation, prompt builder | EXISTS — unchanged for now |
| `app/routers/chat.py` | `POST /api/chat` SSE endpoint | EXISTS — unchanged |
| `app/routers/admin.py` | All `/api/admin/*` endpoints | EXISTS — needs new endpoints + serializer update |
| `scripts/ingest.py` | FAISS build from experts.csv | EXISTS — needs `expert_to_text()` update |
| `data/faiss.index` | 530-vector FAISS index (incomplete) | EXISTS — must be rebuilt |
| `data/metadata.json` | Position-aligned metadata sidecar | EXISTS — must be rebuilt |

---

## System Overview (v1.1 Target State)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         OFFLINE PIPELINES                            │
│                                                                      │
│  ┌──────────────────────────────────────┐                            │
│  │ scripts/tag_experts.py (NEW)         │                            │
│  │  Expert table (all 1,558) →          │                            │
│  │  Gemini 2.5 Flash (structured JSON)  │                            │
│  │  → Expert.tags column (JSON text)    │                            │
│  │  → Expert.findability_score (Float)  │                            │
│  └──────────────────────────────────────┘                            │
│                       │                                              │
│                       ▼ (after tags exist)                           │
│  ┌──────────────────────────────────────┐                            │
│  │ scripts/ingest.py (MODIFIED)         │                            │
│  │  Expert table (with tags) →          │                            │
│  │  expert_to_text() adds tags →        │                            │
│  │  gemini-embedding-001 batch embed →  │                            │
│  │  FAISS index (1,558 vectors)         │                            │
│  │  + metadata.json (1,558 records)     │                            │
│  └──────────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                         RUNTIME (FastAPI)                            │
│                                                                      │
│  React Admin UI                                                      │
│  ┌──────────────────┐  GET /api/admin/experts                        │
│  │ Expert Tab       │  (with tags, findability_score) ─────────────► │
│  │ (MODIFIED)       │                                                │
│  └──────────────────┘       admin.py (MODIFIED)                      │
│                             _serialize_expert() adds tags+score      │
│                                                                      │
│  React Chat UI                                                       │
│  ┌──────────────────┐  POST /api/chat { query, history, email }      │
│  │ Chat + Cards     │ ────────────────────────────────────────────► │
│  └──────────────────┘                                                │
│                             chat.py (UNCHANGED)                      │
│                             │                                        │
│                             ▼                                        │
│                        services/query_expander.py (NEW)              │
│                        Gemini → 3 query variants                     │
│                             │                                        │
│                             ▼                                        │
│                        services/retriever.py (MODIFIED)              │
│                        multi-query FAISS → deduplicate → top-K       │
│                             │                                        │
│                             ▼                                        │
│                        services/llm.py (UNCHANGED)                   │
│                        Gemini → narrative + expert selection         │
│                             │                                        │
│                             ▼                                        │
│                        SQLite Conversation + Feedback tables         │
│                        (domain mapping queries read Feedback)        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### New Components (create from scratch)

| Component | File | Responsibility |
|-----------|------|----------------|
| **Tag & Score Pipeline** | `scripts/tag_experts.py` | Reads Expert table, calls Gemini with structured output to generate domain tags per expert, computes findability score, writes both back to Expert table via SQLAlchemy |
| **Query Expander** | `app/services/query_expander.py` | Calls Gemini to rewrite a user query into 2-3 semantically varied expansions; returns list of strings including original |
| **Domain Mapper** | `app/routers/admin.py` (new endpoint) | Reads Feedback table + Expert table to surface which tags appear most in downvoted results; helps admin understand coverage gaps |

### Modified Components (surgical changes only)

| Component | File | What Changes | What Stays Identical |
|-----------|------|-------------|----------------------|
| **Expert model** | `app/models.py` | Add `tags: Text` (JSON), `findability_score: Float` columns | All existing columns, all other models |
| **Main lifespan** | `app/main.py` | Add two `ALTER TABLE` migration guards for new columns (same idempotent pattern as existing `top_match_score` migration) | Everything else in lifespan |
| **Ingest script** | `scripts/ingest.py` | `expert_to_text()` reads tags from Expert DB (or CSV column if present) and appends `"Tags: X, Y, Z."` before embedding | Batch logic, retry, FAISS build, normalization |
| **Retriever** | `app/services/retriever.py` | Accept optional `extra_queries: list[str]` param; run FAISS search for each query variant; deduplicate by username; return merged top-K | `RetrievedExpert` dataclass, filtering logic, threshold logic |
| **Admin serializer** | `app/routers/admin.py` | `_serialize_expert()` adds `"tags"` and `"findability_score"` keys; `GET /api/admin/experts` adds sort-by-score-asc option | Auth, all existing endpoints, CSV export |
| **Chat router** | `app/routers/chat.py` | Call `query_expander.expand(query)` before `retrieve()`, pass results as `extra_queries` | SSE flow, conversation logging, error handling |

### Unchanged Components (do not touch)

- `app/services/embedder.py` — embedding service is fine as-is
- `app/services/llm.py` — prompt builder and Gemini generation unchanged
- `app/routers/health.py`, `feedback.py`, `email_capture.py` — unrelated
- `app/database.py` — no changes needed
- `app/config.py` — no new constants needed (paths already defined)
- `frontend/` — admin Expert tab UI changes are in scope but not backend architecture

---

## Data Flow: Tag Generation Pipeline

```
1. Expert table (1,558 rows in SQLite)
   │
   ▼  scripts/tag_experts.py reads Expert rows in batches of ~20
   │
   ▼  For each batch, build prompt:
      "You are an expert taxonomy system. For each expert below,
       return a JSON array of 3-7 domain tags that describe their
       specialty. Tags must be specific (e.g. 'SaaS Sales' not 'Sales').
       Expert: {name} | {job_title} | {bio[:600]}"
      response_schema = list[ExpertTags]  # Pydantic model
      → Gemini 2.5 Flash (structured output, temperature=0.1)
   │
   ▼  Parse response → list of {username: str, tags: list[str]}
   │
   ▼  For each expert, compute findability_score (pure Python, no LLM):
      score = 0
      + 30 pts if bio exists and len(bio) > 100
      + 15 pts if bio exists and len(bio) > 300
      + 20 pts if profile_url is not empty
      + 20 pts if tags is not empty (just generated)
      + 15 pts if job_title is not empty and len(job_title) > 5
      = max 100
   │
   ▼  UPDATE experts SET tags=:tags, findability_score=:score
      WHERE username=:username  (SQLAlchemy, batched commit every 50)
   │
   ▼  Output: all 1,558 Expert rows have tags (JSON text) + findability_score
```

**Why batch size ~20 for Gemini calls:** The bio text per expert can be 200-600 chars; 20 experts per call stays well within token limits for `gemini-2.5-flash` while keeping the number of API calls manageable (~78 calls for 1,558 experts). Structured output with `response_schema` ensures parse-safe JSON every time.

**Why compute findability score in Python, not LLM:** The score is based on objective field presence/length — no judgment required, zero API cost, deterministic, and instantly re-runnable when the formula is tweaked.

---

## Data Flow: FAISS Re-Ingest

```
After tag_experts.py completes (tags column populated):

1. scripts/ingest.py (modified expert_to_text())
   │
   ▼  Read Expert table or experts.csv (existing mechanism)
      For each row, expert_to_text() now appends:
        "Tags: {', '.join(tags_list)}." if tags else ""
      Example output:
        "Jane Doe. ML Engineer at FinCo. Jane is a machine learning
         engineer specializing in fraud detection...
         Tags: Machine Learning, FinTech, Fraud Detection, Python, MLOps."
   │
   ▼  Same batch embed → FAISS IndexFlatIP → faiss.index + metadata.json
      (unchanged pipeline, just richer input text)
   │
   ▼  All 1,558 experts indexed (vs 530 in v1.0)
      Tags appear in both the Expert DB column and the FAISS embedding text

IMPORTANT: ingest.py must read tags from the Expert DB table (not CSV),
since tags are generated by tag_experts.py and stored in SQLite.
The ingest script currently reads from experts.csv — this must be
changed to query the Expert SQLAlchemy table directly, or the ingest
script must accept a flag to read from DB instead of CSV.

Recommended approach: ingest.py reads from Expert table via SQLAlchemy,
not experts.csv. This also fixes the data consistency risk where CSV
and DB can diverge.
```

---

## Data Flow: Query Expansion (Runtime)

```
User types query in React
   │
   ▼  POST /api/chat { query, history, email }
   │
   ▼  chat.py (MODIFIED — one new call before retrieve())
      │
      ▼  query_expander.expand(query)  →  [original, variant_1, variant_2]
         Gemini 2.5 Flash prompt:
           "Rewrite this expert search query 2 times with different
            phrasing to improve recall. Keep the same intent.
            Return JSON: {\"variants\": [\"...\", \"...\"]}"
         Temperature=0.7 (higher = more diverse expansions)
         Total queries: [original] + variants = 3
   │
   ▼  retriever.retrieve(query, extra_queries=[v1, v2], faiss_index, metadata)
      For each query in [original, v1, v2]:
        embed_query(q) → FAISS search → top-10 candidates
      Merge all results, deduplicate by username, keep best score per expert
      Sort by score desc, return top-5
   │
   ▼  llm.generate_response(query=original, candidates, history)
      (LLM always sees original query, not expansions)
   │
   ▼  SSE result stream → React
```

**Why pass original query to LLM:** The expansions are internal retrieval aids. The LLM should see what the user actually typed to write a relevant narrative. Passing expansions to the LLM would cause prompt confusion.

**Why temperature=0.7 for expansion:** Low temperature produces near-identical rewrites. 0.7 gets meaningfully different phrasings while staying on-topic.

**Performance consideration:** Expansion adds one Gemini call (~300ms) and 2 extra FAISS searches (<5ms each). Total latency impact: +300ms before the existing LLM call. Acceptable given the current 2-8s generation time.

**Caching consideration (optional):** Cache expansion results for identical queries using a simple dict `{query_text: [variants]}` in `app.state`. Cache up to 1,000 entries (LRU). This eliminates the expansion latency for repeated queries (common in test lab and admin use).

---

## Data Flow: Feedback Learning (Domain Mapping)

```
Existing Feedback table (vote, expert_ids JSON, conversation_id)
   │
   ▼  NEW admin endpoint: GET /api/admin/domain-map
      Query: For each downvoted Feedback row,
             join to Expert by username (from expert_ids JSON),
             read Expert.tags,
             aggregate tag frequency in downvoted results
      Returns: [{tag: "FinTech", downvote_count: 12, total_count: 45, rate: 0.27}, ...]
   │
   ▼  Admin sees: "FinTech experts are being downvoted 27% of the time"
      → signals retrieval gap or expert quality issue in that domain

No runtime feedback learning in v1.1 (no model retraining, no score boosting).
v1.1 feedback learning is READ-ONLY analytics: surface the signal, let admin
interpret and act (e.g. recruit better FinTech experts or improve their bios).
```

**Why not runtime feedback boosting in v1.1:** Score boosting during retrieval (e.g. penalise experts with many downvotes) requires careful implementation to avoid feedback loops where a few bad votes unfairly bury experts. The correct first step is to observe the signal and act on it manually. Automated feedback-driven retrieval can be added in v1.2 once the signal volume is sufficient to be reliable.

---

## Database Schema Changes

### Expert table — two new columns

```python
# app/models.py additions to Expert class
tags: Mapped[str | None] = mapped_column(Text, nullable=True)
# JSON text: '["Machine Learning", "FinTech", "Python"]'
# None until tag_experts.py runs

findability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
# 0.0-100.0; None until tag_experts.py runs
```

### Migration pattern (same as existing top_match_score pattern in main.py)

```python
# In lifespan(), add alongside existing ALTER TABLE guards:
for _col_ddl in [
    "ALTER TABLE conversations ADD COLUMN top_match_score REAL",
    "ALTER TABLE conversations ADD COLUMN gap_resolved INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE experts ADD COLUMN tags TEXT",           # NEW
    "ALTER TABLE experts ADD COLUMN findability_score REAL",  # NEW
]:
    try:
        _conn.execute(_text(_col_ddl))
        _conn.commit()
    except Exception:
        pass  # Column already exists — idempotent
```

**Why not Alembic:** The project already uses a proven manual migration pattern with `ALTER TABLE ... IF NOT EXISTS` guards. Introducing Alembic for two columns adds tooling overhead (alembic.ini, env.py, versions/ directory) that isn't justified. The existing pattern handles Railway's production environment correctly and is already battle-tested.

---

## New File Structure

```
app/
├── models.py              MODIFIED — add tags, findability_score to Expert
├── main.py                MODIFIED — add ALTER TABLE guards for new columns
├── routers/
│   └── admin.py           MODIFIED — serializer + domain-map endpoint
├── services/
│   ├── query_expander.py  NEW — Gemini query rewriting service
│   ├── retriever.py       MODIFIED — multi-query FAISS + dedup
│   ├── embedder.py        UNCHANGED
│   └── llm.py             UNCHANGED
scripts/
├── tag_experts.py         NEW — offline tag generation + findability scoring
└── ingest.py              MODIFIED — expert_to_text() reads tags; reads from DB
```

---

## Architectural Patterns

### Pattern 1: Structured Gemini Output for Tag Generation

**What:** Use Gemini's `response_schema` parameter with a Pydantic model to guarantee parse-safe JSON for tag generation. Never parse free-form text.

**When to use:** Any Gemini call that must produce structured data (tags, query variants, scoring rationale).

**Example:**

```python
from pydantic import BaseModel
from google.genai import types

class ExpertTagResult(BaseModel):
    username: str
    tags: list[str]

class TagBatch(BaseModel):
    experts: list[ExpertTagResult]

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=TagBatch,
        temperature=0.1,  # Low for consistent taxonomy
    ),
)
result: TagBatch = response.parsed
```

**Trade-off:** Requires Pydantic model definition per use case. Worth it — eliminates JSON parse failures entirely.

### Pattern 2: Multi-Query FAISS with Deduplication

**What:** Run FAISS search for N query variants, merge results, keep highest score per expert.

**When to use:** Query expansion is active. Deduplication is mandatory — same expert can appear in multiple queries' results.

**Example:**

```python
def retrieve(
    query: str,
    faiss_index: faiss.IndexFlatIP,
    metadata: list[dict],
    extra_queries: list[str] | None = None,
) -> list[RetrievedExpert]:
    all_queries = [query] + (extra_queries or [])
    seen: dict[str, RetrievedExpert] = {}  # username -> best candidate

    for q in all_queries:
        vector = np.array(embed_query(q), dtype=np.float32).reshape(1, -1)
        k = min(10, faiss_index.ntotal)  # Retrieve more per query when multi-query
        scores, indices = faiss_index.search(vector, k)
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            row = metadata[idx]
            username = row.get("Username") or row.get("username") or ""
            if username and (username not in seen or score > seen[username].score):
                candidate = _build_candidate(row, score)  # existing logic
                if candidate:
                    seen[username] = candidate

    return sorted(seen.values(), key=lambda c: c.score, reverse=True)[:TOP_K]
```

**Trade-off:** 3x embedding API calls per request (one per query variant). At ~50ms per embed call, this adds ~100ms. Acceptable given the retrieval quality improvement.

### Pattern 3: Idempotent Offline Scripts with DB as Source of Truth

**What:** tag_experts.py and ingest.py both operate on the Expert SQLAlchemy table directly, not experts.csv. The DB is the single source of truth.

**When to use:** Any offline pipeline that modifies or reads expert data.

**Why:** experts.csv and the DB can diverge (new experts added via admin API go to DB first). Reading from DB ensures consistency. The CSV becomes a bootstrap-only artifact.

**Example (ingest.py change):**

```python
# OLD: reads from experts.csv
df = pd.read_csv(csv_path)

# NEW: reads from Expert table
from app.database import SessionLocal
from app.models import Expert as ExpertModel
from sqlalchemy import select

with SessionLocal() as db:
    experts = db.scalars(select(ExpertModel)).all()
    rows = [
        {
            "First Name": e.first_name,
            "Last Name": e.last_name,
            "Job Title": e.job_title,
            "Company": e.company,
            "Bio": e.bio,
            "Hourly Rate": e.hourly_rate,
            "tags": json.loads(e.tags) if e.tags else [],
            "Username": e.username,
        }
        for e in experts
        if e.bio and e.hourly_rate  # existing filter
    ]
```

### Pattern 4: Tags as JSON Text Column (not separate table)

**What:** Store tags as a JSON text column on Expert: `'["ML", "FinTech", "Python"]'`. No ExpertTag join table.

**When to use:** Tags are always read/written as a complete set per expert, never queried individually in SQL. Tag frequency analytics are done in Python after fetching rows.

**Why not a separate ExpertTag table:** A join table would add FK management, cascade complexity, and join overhead for every expert fetch. For 1,558 experts with 3-7 tags each, the JSON column approach is simpler and sufficient. SQL-level tag filtering is not a requirement — admin analytics filter in Python.

**Gotcha:** SQLite's JSON functions (json_each, json_extract) work but are not needed here. Avoid adding JSON-specific SQL queries; keep logic in Python.

### Pattern 5: Findability Score as Computed-at-Write-Time Float

**What:** Compute findability score once in the tag pipeline (tag_experts.py), store as a Float column. Do not recompute on every API request.

**When to use:** Any derived score where inputs don't change frequently.

**Why not compute on-the-fly:** The score formula may evolve, but the computation is deterministic and cheap. Storing it enables SQL-level sorting (`ORDER BY findability_score ASC` for worst-first admin view) without Python-side post-sort.

**Re-compute trigger:** Run tag_experts.py again after any formula change. The script should support `--recompute-scores-only` flag (no Gemini call — just re-score from existing tags).

---

## Integration Points

### New vs Modified Endpoints in admin.py

| Endpoint | Status | Change |
|----------|--------|--------|
| `GET /api/admin/experts` | MODIFIED | `_serialize_expert()` adds `tags` (parsed list) and `findability_score`; add `?sort=findability_asc` query param |
| `GET /api/admin/domain-map` | NEW | Joins Feedback + Expert.tags; returns tag-level downvote frequency |
| All other admin endpoints | UNCHANGED | No modification |

### chat.py Integration Point

The query expander hooks in at exactly one place — between request validation and the `retrieve()` call:

```python
# In _stream_chat(), BEFORE the retrieve() call:
from app.services.query_expander import expand_query

expanded = await loop.run_in_executor(None, lambda: expand_query(body.query))
candidates = await loop.run_in_executor(
    None,
    lambda: retrieve(
        query=body.query,
        faiss_index=request.app.state.faiss_index,
        metadata=request.app.state.metadata,
        extra_queries=expanded,  # NEW param
    ),
)
```

The `expand_query` call is optional — if it fails (Gemini error), fall back to empty list. Never let expansion failure break the chat response.

### FAISS Hot Reload After Re-Ingest

The re-ingested `faiss.index` is a new file written to disk. For Railway (single container), the simplest approach is redeploy after re-ingest:

1. Run `scripts/tag_experts.py` → DB updated
2. Run `scripts/ingest.py` → new `faiss.index` + `metadata.json` written to Railway volume
3. Redeploy Railway service (automatic on git push, or manual restart)
4. Lifespan re-loads the new index at startup

**Alternative (no-restart hot swap):** Add `POST /api/admin/reload-index` endpoint that calls `faiss.read_index()` and atomically assigns to `app.state.faiss_index`. This requires a threading lock (since multiple requests may be mid-retrieval). Viable but adds complexity. Only implement if ingest → redeploy cycle is too slow.

---

## Build Order (Dependency Graph)

The order is dictated by hard data dependencies. Each step must fully complete before the next begins.

```
Step 1: DB Schema — add tags + findability_score columns to Expert
   File: app/models.py + app/main.py (ALTER TABLE guards)
   Why first: tag_experts.py writes to these columns; they must exist
   Validation: start FastAPI locally, verify Expert table schema

Step 2: Tag Generation Pipeline
   File: scripts/tag_experts.py (NEW)
   Depends on: Step 1 (columns exist)
   Why before ingest: FAISS re-ingest must embed tags; tags must exist first
   Validation: run on 20 experts, verify tags column populated, scores computed

Step 3: FAISS Re-Ingest (modified ingest.py)
   File: scripts/ingest.py (MODIFIED — reads DB, appends tags to text)
   Depends on: Step 2 (tags populated in DB)
   Why before retriever: retriever reads FAISS; new index must be built first
   Validation: index.ntotal == 1558, sample query returns richer results

Step 4: Admin Expert Tab Enhancement
   File: app/routers/admin.py (MODIFIED — serializer + domain-map endpoint)
   Depends on: Steps 1-2 (tags + scores in DB)
   Why now: admin can verify tags before touching runtime search
   Validation: GET /api/admin/experts returns tags and findability_score;
               experts sorted worst-first by score

Step 5: Query Expander Service
   File: app/services/query_expander.py (NEW)
   Depends on: Step 3 (new FAISS index — tests expansion against full index)
   Why now: retriever modification needs the expander to be callable
   Validation: unit test expand_query() returns 2 variants; fallback works

Step 6: Retriever Multi-Query Support
   File: app/services/retriever.py (MODIFIED)
   Depends on: Step 5 (expander exists)
   Validation: retrieve() with extra_queries returns deduplicated candidates

Step 7: Chat Router Wiring
   File: app/routers/chat.py (MODIFIED)
   Depends on: Steps 5-6 (expander + retriever both ready)
   Validation: POST /api/chat with test query returns different (better) results
               than without expansion; no latency regression over 10s

Step 8: Domain Map Endpoint
   File: app/routers/admin.py (NEW endpoint)
   Depends on: Step 4 (tags exist in DB) + production Feedback data
   Validation: GET /api/admin/domain-map returns tag frequency breakdown
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running Tag Generation at API Startup

**What people do:** Call Gemini to generate tags for experts that don't have tags yet during the FastAPI lifespan startup.

**Why it's wrong:** 1,558 experts at ~20 per batch = ~78 Gemini calls. At 300ms each, startup takes 23 seconds. Railway will timeout and restart the container. Every redeploy re-runs the expensive pipeline.

**Do this instead:** Run `scripts/tag_experts.py` once as an offline script. Store tags in DB. Startup only reads from DB (milliseconds).

### Anti-Pattern 2: Embedding Tags at Query Time

**What people do:** Append tags to the query before embedding ("I need a FinTech expert Tags: FinTech, ML, Python").

**Why it's wrong:** Tags should enrich the document embeddings (expert profiles), not the query. Contaminating the query with document structure breaks the asymmetric RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT task types that the Google embedding model relies on.

**Do this instead:** Tags in `expert_to_text()` (document side only). Query expansion rewrites the user's natural language — it does not inject tags.

### Anti-Pattern 3: Separate ExpertTag Table

**What people do:** Create a junction table `expert_tags(expert_id, tag_name)` with FK to Expert.

**Why it's wrong:** Every admin expert list fetch becomes a JOIN. Tag insertion becomes multi-row. For this use case (always read/write full tag set per expert, 1,558 experts), the overhead is pure cost with no benefit. No SQL tag filtering is needed.

**Do this instead:** JSON text column `tags TEXT` on Expert. Parse with `json.loads()` in Python when needed.

### Anti-Pattern 4: Blocking the Event Loop on Expansion

**What people do:** Call `expand_query()` synchronously inside an `async` route handler.

**Why it's wrong:** `expand_query()` calls the Gemini API synchronously (same as `embed_query` and `generate_response`). Calling a sync function directly in an `async` handler blocks the event loop, preventing other concurrent requests from being processed.

**Do this instead:** `await loop.run_in_executor(None, lambda: expand_query(query))` — same pattern already used for `retrieve()` and `generate_response()` in chat.py.

### Anti-Pattern 5: Recomputing Findability Score on Every Admin Request

**What people do:** Compute findability score dynamically in `_serialize_expert()` from Expert field values.

**Why it's wrong:** 1,558 experts × string length checks × sorting = Python-level computation on every admin page load. Also means the DB can't sort by score (no stored value), so the full table must be fetched and sorted in Python.

**Do this instead:** Store `findability_score` as a Float column. Admin query becomes `ORDER BY findability_score ASC LIMIT 100` — DB does the work.

---

## Scalability Considerations

| Concern | Current (1,558 experts) | At 5K experts | At 20K experts |
|---------|------------------------|---------------|----------------|
| FAISS index size | ~5 MB, <5ms search | ~16 MB, <15ms | ~60 MB, <50ms — still viable |
| Tag generation (offline) | ~78 Gemini calls, ~25s | ~250 calls, ~80s | ~1,000 calls, ~5min |
| Multi-query retrieval | 3 FAISS searches, <15ms | Same — FAISS brute force scales linearly | Consider FAISS IVF index |
| Query expansion latency | +300ms per request | Same | Same |
| Admin expert list fetch | All 1,558 rows | Add pagination (already parameterised) | Mandatory pagination |
| Findability score sort | DB sort, instant | DB sort, instant | DB sort, instant |

---

## Sources

- Google GenAI structured output (Pydantic `response_schema`): https://ai.google.dev/gemini-api/docs/structured-output — HIGH confidence (official docs)
- FAISS write/read index pattern: https://faiss.ai/index.html — HIGH confidence (official docs)
- FastAPI lifespan pattern (already in production): https://fastapi.tiangolo.com/advanced/events/ — HIGH confidence
- Query expansion / HyDE for RAG: https://apxml.com/courses/optimizing-rag-for-production/chapter-2-advanced-retrieval-optimization/query-augmentation-rag — MEDIUM confidence (multiple corroborating sources)
- SQLite JSON column vs join table tradeoffs: https://www.beekeeperstudio.io/blog/sqlite-json-with-text — MEDIUM confidence
- Feedback learning RAG patterns: https://ragaboutit.com/how-to-build-self-improving-rag-systems-with-reinforcement-learning-from-human-feedback/ — MEDIUM confidence (pattern confirmed against codebase)
- Existing codebase direct inspection: `app/models.py`, `app/main.py`, `app/routers/admin.py`, `app/services/retriever.py`, `scripts/ingest.py` — HIGH confidence

---

*Architecture research for: Tinrate AI Concierge v1.1 Expert Intelligence & Search Quality*
*Researched: 2026-02-21*
