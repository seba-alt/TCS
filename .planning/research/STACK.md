# Stack Research

**Domain:** RAG-based expert discovery chatbot — v1.1 Expert Intelligence & Search Quality
**Researched:** 2026-02-21
**Research Mode:** Ecosystem (Subsequent Milestone)
**Confidence:** HIGH for additions; existing stack already in production

---

## Scope of This Document

This document covers ONLY the stack additions and changes needed for v1.1. The existing production stack (FastAPI + SQLAlchemy + SQLite + FAISS + google-genai + React + Vite + Tailwind) is validated and unchanged. Each section below is scoped to one of the five new feature areas.

---

## Critical Breaking Change: Embedding Model Deprecation

**text-embedding-004 was shut down on January 14, 2026.** The codebase has already migrated to `gemini-embedding-001` (confirmed in `app/config.py`). All v1.1 work must use `gemini-embedding-001`.

**Dimension change:** gemini-embedding-001 defaults to 3072 dimensions. The codebase truncates to 768 via `output_dimensionality=768` (Matryoshka Representation Learning — truncated prefixes retain quality). This is already set in `app/config.py` and `scripts/ingest.py`. Do not change OUTPUT_DIM without rebuilding the FAISS index.

---

## Feature 1: AI Auto-Tagging (Batch LLM for 1,558 Experts)

### What is needed

A one-shot offline script that calls `gemini-2.5-flash` for each expert and writes domain tags back to the SQLite `experts` table. This is a batch processing problem, not a library selection problem — the existing `google-genai` SDK already supports it. The challenge is rate limit management.

### Rate Limit Reality (MEDIUM confidence — verify at ai.google.dev/gemini-api/docs/rate-limits)

| Tier | gemini-2.5-flash RPM | gemini-2.5-flash RPD |
|------|---------------------|---------------------|
| Free | ~5 RPM | ~250 RPD |
| Tier 1 (paid) | ~150-300 RPM | ~10,000 RPD |

At 1,558 experts and free tier (5 RPM), tagging takes ~5+ hours. At Tier 1 (150 RPM), ~11 minutes. Use paid Tier 1 for the tagging run — this is a one-time offline job.

### Stack additions for auto-tagging

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `tenacity` | `9.1.*` (already in requirements.txt as `8.4.*` — upgrade) | Retry with exponential backoff on 429 rate limit errors | Already used in `scripts/ingest.py` for embeddings. Same pattern applies to LLM tagging calls. Upgrade to 9.1.x for Python 3.10+ requirement compliance. |
| `asyncio.Semaphore` | stdlib | Bound concurrent LLM calls | Use Python stdlib semaphore to cap inflight requests — no additional library needed. Pattern: `async with semaphore: await client.aio.models.generate_content(...)` |

**Do NOT add:** LangChain, Haystack, or any orchestration framework. The existing `google-genai` SDK (`client.models.generate_content`) handles this directly.

### Tagging script pattern

```python
# scripts/generate_tags.py — offline, one-shot, run before FAISS re-ingest
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

CONCURRENCY = 10  # adjust to stay under RPM limit
SEMAPHORE = asyncio.Semaphore(CONCURRENCY)

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=5, max=120),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def tag_expert(client, expert: dict) -> list[str]:
    async with SEMAPHORE:
        prompt = f"""Given this expert profile, return a JSON array of 3-7 domain tags.
Job Title: {expert['job_title']}
Bio: {expert['bio'][:500]}
Tags must be lowercase, specific domain terms (e.g. "contract law", "ux research", "growth marketing").
Return ONLY valid JSON: ["tag1", "tag2", ...]"""
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        return json.loads(response.text)
```

### SQLite schema addition for tags

Add a `tags` column to the `experts` table (TEXT, JSON-serialized list). No migration framework needed — SQLite `ALTER TABLE experts ADD COLUMN tags TEXT DEFAULT '[]'` via SQLAlchemy `text()` at script startup.

```python
# Pattern: idempotent column addition
from sqlalchemy import text
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE experts ADD COLUMN tags TEXT DEFAULT '[]'"))
        conn.commit()
    except Exception:
        pass  # Column already exists
```

---

## Feature 2: Findability Scoring

### What is needed

A pure Python computation function — no new libraries required. Findability score (0-100) is calculated from existing SQLite fields: bio presence/length, profile_url presence, tags count, job_title presence. This is arithmetic over already-fetched data.

### Stack additions for findability scoring

None. All computation uses:
- `len()`, string checks on existing SQLite `experts` fields
- `json.loads()` on the `tags` JSON column (stdlib)
- SQLAlchemy to persist the score back to the `experts` table

Add a `findability_score` column (Float, nullable) to the `experts` table via the same idempotent `ALTER TABLE` pattern above.

### Scoring formula guidance

```python
def compute_findability(expert: dict) -> int:
    score = 0
    bio = (expert.get("bio") or "").strip()
    if bio:
        score += 30
        if len(bio) >= 100:
            score += 10
        if len(bio) >= 300:
            score += 10
    if (expert.get("profile_url") or "").strip():
        score += 20
    tags = json.loads(expert.get("tags") or "[]")
    if tags:
        score += 15
        if len(tags) >= 3:
            score += 5
    if (expert.get("job_title") or "").strip():
        score += 10
    return min(score, 100)
```

---

## Feature 3: FAISS Re-ingest with Enriched Text

### What is needed

The existing `scripts/ingest.py` is already the correct pattern. The only change is updating `expert_to_text()` to include tags in the embedding text. No new libraries — `faiss-cpu`, `numpy`, and `google-genai` are already present.

### Updated `expert_to_text` pattern

```python
def expert_to_text(row: dict) -> str:
    # ... existing name/title/company/bio logic ...
    tags = json.loads(row.get("tags") or "[]")
    if tags:
        parts.append(f"Domain expertise: {', '.join(tags)}.")
    return " ".join(parts) if parts else "Unknown expert"
```

### Batch embedding strategy (confirmed working pattern)

The existing `ingest.py` batch strategy is correct and already handles this:
- Batch size: 100 texts per `embed_content` call (API hard limit confirmed)
- `tenacity` retry with exponential backoff for 429 errors
- `output_dimensionality=768` (MRL truncation — 75% storage savings, 0.26% quality loss)
- `faiss.normalize_L2()` required after truncation (truncated vectors are NOT pre-normalized)
- `time.sleep(0.5)` between batches as basic throttle

For 1,558 experts at 100/batch = 16 batches. At 5 RPM free tier: ~3 minutes. At 150 RPM paid: ~7 seconds. The existing implementation already handles this.

**faiss-cpu version:** Already on `1.13.*` (latest as of December 2025 is 1.13.2). No change needed.

---

## Feature 4: Feedback-Based Retrieval Improvement

### What is needed

A query-time signal layer that reads from the existing `feedback` + `conversations` SQLite tables to boost or suppress retrieval results. No new libraries — this is pure SQLAlchemy + Python list manipulation.

### Design: SQLite-based feedback signal

The `feedback` table already stores `vote` ("up"/"down"), `expert_ids` (JSON list of profile_url|name), and `conversation_id`. The `conversations` table has `query`. The feedback loop works in two steps:

**Step 1: Expert reputation map** (cached in `app.state` at startup, refreshed periodically)

```python
# Aggregate: for each expert_id, compute net_score = upvotes - downvotes
# Cache as dict: {expert_id: net_score}
# Refresh every N minutes via background task or on /admin reload endpoint
```

**Step 2: Score adjustment at retrieval time**

```python
# In retriever.py — after FAISS search, before returning candidates
for candidate in candidates:
    expert_key = candidate.profile_url or candidate.name
    reputation = feedback_map.get(expert_key, 0)
    # Additive boost: small signal, don't override FAISS quality
    candidate.adjusted_score = candidate.score + (reputation * 0.01)
# Re-sort by adjusted_score
candidates.sort(key=lambda c: c.adjusted_score, reverse=True)
```

**Step 3: Domain feedback signal** (for query expansion integration)

Store a lightweight in-memory map `{domain_keyword: feedback_direction}` derived from queries that received thumbs-up/down. Persist to SQLite as a JSON blob in a new `search_signals` table for cross-restart durability.

### SQLite schema addition for search signals

```sql
CREATE TABLE IF NOT EXISTS search_signals (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,      -- e.g. "domain:marketing"
    signal REAL NOT NULL DEFAULT 0.0,  -- running average, positive=good, negative=bad
    sample_count INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

No ORM model required for v1.1 — use `sqlalchemy.text()` for direct SQL. Add a proper SQLAlchemy model if signals become a first-class feature.

### No new libraries needed

The feedback loop uses only:
- `sqlalchemy` (already present) — read `feedback` + `conversations` tables
- `json` (stdlib) — parse `expert_ids` JSON
- `app.state` (FastAPI) — cache the feedback map between requests
- `asyncio.create_task` + `asyncio.sleep` — periodic background refresh

**Do NOT add:** Redis, Celery, separate cache service. SQLite at this scale (hundreds of feedback rows) is fast enough for direct query-time reads.

---

## Feature 5: Query Expansion Before FAISS Search

### What is needed

Before embedding a user query and searching FAISS, expand the query using one of two techniques. Choose based on latency budget:

| Technique | Latency cost | Quality gain | Recommended |
|-----------|-------------|-------------|-------------|
| **HyDE** (Hypothetical Document Embeddings) | ~1-2s (one extra Gemini call) | HIGH — generates expert-like text, searches document space | YES for v1.1 |
| **Synonym expansion** | ~0ms | LOW — simple keyword expansion | Only if HyDE adds too much latency |
| Multi-query (RAG Fusion) | ~2-5s | HIGH — multiple retrieval paths averaged | Defer to v1.2 |

### HyDE implementation (no new libraries)

```python
# In retriever.py or a new query_expander.py service
async def expand_query_hyde(query: str, client: genai.Client) -> str:
    """
    Generate a hypothetical expert bio that would answer this query.
    Embed the hypothetical bio instead of (or averaged with) the raw query.
    """
    prompt = f"""Write a 2-3 sentence professional bio of an expert who would perfectly
answer this client need: "{query}"
Write as if describing a real expert profile. Be specific about domain and skills."""

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.2),
    )
    return response.text

# In retrieve():
hypothetical_doc = await expand_query_hyde(query, client)
# Option A: embed hypothetical doc only (pure HyDE)
vector = embed_text(hypothetical_doc, task_type="RETRIEVAL_DOCUMENT")
# Option B: average raw query embedding + HyDE embedding (hedged HyDE)
query_vec = embed_text(query, task_type="RETRIEVAL_QUERY")
hyde_vec = embed_text(hypothetical_doc, task_type="RETRIEVAL_DOCUMENT")
vector = (query_vec + hyde_vec) / 2
faiss.normalize_L2(vector)
```

**Recommendation: hedged HyDE (Option B).** Pure HyDE can drift from the user's intent if Gemini generates a bio with wrong assumptions. Averaging preserves the original query signal while enriching with document-space vocabulary.

### Expert pool domain mapping (for query expansion)

Build a domain vocabulary map at startup by extracting tags from all experts in the database. When a query matches known domain terms, expand it with related terms from the tag corpus.

```python
# At startup: build tag co-occurrence map from experts table
# {tag: set_of_related_tags_based_on_co_occurrence_in_same_expert}
# Use at query time: if "marketing" found in query, also search "growth marketing", "digital marketing", "brand strategy"
```

This is pure Python set/dict manipulation — no new libraries.

---

## Recommended Package Updates

The existing `requirements.txt` needs one version update for v1.1:

| Package | Current | Recommended | Reason |
|---------|---------|-------------|--------|
| `tenacity` | `8.4.*` | `9.1.*` | 9.x requires Python 3.10+, adds `retry_if_exception_message`, cleaner API. The existing usage pattern is compatible — no code changes needed beyond version bump. |

All other packages remain unchanged.

```bash
# Update tenacity only
pip install "tenacity==9.1.*"
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| LangChain | Adds 100+ MB of dependencies, obscures control flow, wraps google-genai in unpredictable ways. All v1.1 features are implementable directly with the existing SDK. | Direct `google-genai` SDK calls |
| Haystack | Same reasons as LangChain. Framework overhead for what is essentially a few Python functions. | Direct implementation |
| Redis / Memcached | Overkill for caching a ~1,558-entry feedback map. SQLite read + `app.state` dict is sufficient at this scale. | `app.state` dict + SQLite |
| Celery / RQ | Task queue overhead for a periodic 60-second refresh. `asyncio.create_task` covers this. | `asyncio` background task |
| `aiolimiter` / `asynciolimiter` | Third-party rate limiter libraries add complexity. `asyncio.Semaphore` + `tenacity` covers all rate limit scenarios for offline batch jobs. | `asyncio.Semaphore` + `tenacity` |
| pgvector / ChromaDB | Vector scale does not warrant infrastructure change. 1,558 vectors is tiny for FAISS. | `faiss-cpu` (already present) |
| Cross-encoder reranking models | sentence-transformers cross-encoders (~400MB models) add significant memory and cold-start cost on Railway for marginal gain at 1,558 expert scale. | HyDE query expansion + feedback score adjustment |

---

## Version Compatibility

| Package | Version in requirements.txt | Compatible with | Notes |
|---------|---------------------------|-----------------|-------|
| `faiss-cpu` | `1.13.*` | `numpy 2.2.*` | faiss-cpu 1.13.x requires numpy 1.x or 2.x — both work |
| `google-genai` | `1.64.*` | `gemini-embedding-001`, `gemini-2.5-flash` | Confirmed: `client.aio.models.generate_content()` is async-native in 1.x |
| `tenacity` | upgrade to `9.1.*` | Python 3.10+ | Breaking: removed deprecated `RetryError.last_attempt` — verify any catches |
| `sqlalchemy` | `2.0.*` | `sqlite` + `text()` for raw SQL | No change needed; `ALTER TABLE ADD COLUMN` via `text()` is the migration pattern |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| HyDE query expansion via gemini-2.5-flash | Multi-query RAG Fusion | If latency becomes acceptable and recall still poor after v1.1 |
| `asyncio.Semaphore` + `tenacity` for batch tagging | Gemini Batch API (async job) | If tagging needs to run repeatedly or at scale beyond 10K experts; Batch API offers 50% cost savings but 24h latency — wrong tradeoff for a one-shot job |
| SQLite-native feedback map | Dedicated analytics store | When feedback volume exceeds ~50K rows and query latency on `feedback` table becomes measurable |
| In-memory `app.state` for feedback cache | Redis | Only if multiple Railway instances run concurrently (not the case in v1.1) |
| Hedged HyDE (averaged embeddings) | Pure HyDE | Use pure HyDE if hedged version shows query drift in test lab evaluation |

---

## Installation

No new packages needed. Update tenacity version only:

```bash
# Backend — update requirements.txt
# Change: tenacity==8.4.*
# To:     tenacity==9.1.*

pip install "tenacity==9.1.*"
```

No frontend package additions needed for v1.1. The admin Expert tab enhancements use existing React + Tailwind patterns.

---

## Sources

- [gemini-embedding-001 deprecation of text-embedding-004](https://github.com/mem0ai/mem0/issues/3942) — MEDIUM confidence (community issue confirming Jan 14, 2026 deprecation)
- [Gemini Batch API now supports Embeddings](https://developers.googleblog.com/en/gemini-batch-api-now-supports-embeddings-and-openai-compatibility/) — MEDIUM confidence
- [Gemini API Rate Limits — official docs](https://ai.google.dev/gemini-api/docs/rate-limits) — MEDIUM confidence (third-party summaries verified direction; check official docs for exact current numbers)
- [embed_content batch limit: 100 texts per call](https://github.com/googleapis/python-genai/issues/427) — MEDIUM confidence (community-confirmed hard limit)
- [gemini-embedding-001: 3072 dims, MRL truncation to 768](https://github.com/RooCodeInc/Roo-Code/issues/5774) — HIGH confidence (confirmed by multiple sources)
- [faiss-cpu 1.13.2 latest on PyPI](https://pypi.org/project/faiss-cpu/) — HIGH confidence
- [tenacity 9.1.4 latest on PyPI](https://pypi.org/project/tenacity/) — HIGH confidence
- [HyDE paper and implementation pattern](https://medium.aiplanet.com/advanced-rag-improving-retrieval-using-hypothetical-document-embeddings-hyde-1421a8ec075a) — MEDIUM confidence (pattern is well-established in RAG literature)
- Existing codebase (`app/config.py`, `scripts/ingest.py`, `app/services/embedder.py`) — HIGH confidence (in production, validated)

---
*Stack research for: TCS v1.1 Expert Intelligence & Search Quality*
*Researched: 2026-02-21*
