# Architecture Research

**Domain:** v2.2 Evolved Discovery Engine — integration points for new features
**Researched:** 2026-02-22
**Confidence:** HIGH (all findings grounded in actual codebase files, FAISS index type confirmed by local load)

---

## Context: Subsequent Milestone Research

This document answers the five concrete integration questions for v2.2. The v2.0 system is ground truth. All existing components listed in the v2.0 architecture document remain unchanged unless explicitly noted here. This document focuses only on new integration points.

**FAISS index confirmed:** `IndexFlatIP` with 536 vectors, 768 dimensions. Loaded from `data/faiss.index` and verified by running `faiss.read_index()` locally.

---

## Q1: Atomic FAISS Swap — Lock Strategy and Mapping

### Short answer: no new lock needed; the pattern already exists in admin.py

The atomic swap pattern is fully implemented in `_run_ingest_job()` in `app/routers/admin.py` (lines 93–146). IDX-01..04 is an admin UI trigger and status polling task, not a new concurrency design task.

### Why asyncio.Lock is not needed

Railway runs a **single-process Uvicorn worker** by default (no `--workers N` flag). Within one process, CPython's GIL ensures that Python object reference assignment (`app.state.faiss_index = new_index`) is atomic at the bytecode level. Concurrent coroutines in the event loop cannot observe a partially-written object reference.

`asyncio.Lock` only serializes coroutines sharing the same event loop. The FAISS rebuild runs in `threading.Thread` (not an asyncio coroutine). Acquiring an asyncio.Lock from a thread requires `asyncio.run_coroutine_threadsafe()` — adding complexity that provides no correctness benefit for single-process deployments.

### What already exists (do not duplicate)

```python
# app/routers/admin.py lines 93–146 (_run_ingest_job)

# Step 1: subprocess runs tag_experts.py
# Step 2: subprocess runs ingest.py (writes faiss.index to disk atomically via staging rename)
# Step 3: HOT-RELOAD — three sequential attribute assignments:

app.state.faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))          # line 123
with open(METADATA_PATH, "r", encoding="utf-8") as f:
    app.state.metadata = json.load(f)                                      # line 125

# Phase 14: rebuild username → FAISS position mapping
_new_mapping: dict[str, int] = {}
for _pos, _row in enumerate(app.state.metadata):
    _uname = _row.get("Username") or _row.get("username") or ""
    if _uname:
        _new_mapping[_uname] = _pos
app.state.username_to_faiss_pos = _new_mapping                            # line 140
```

This code already swaps all three state objects. The `_ingest` module-level dict already tracks `status/log/error/started_at` for IDX-04 status polling. The existing `GET /api/admin/ingest/status` endpoint exposes it.

### The one real risk: 3-statement swap window

Between the `faiss_index` assignment and the `username_to_faiss_pos` assignment, a concurrent `/api/explore` call could read the new index but the old mapping. In `run_explore()` (explorer.py line 196), the guard `if e.username in username_to_pos` skips unmapped experts gracefully — they get `faiss_score=0.0` and are excluded from hybrid results. This is acceptable degradation during a rebuild that takes 60+ seconds overall.

If zero-inconsistency is required: bundle all three as a single dataclass and replace the entire object atomically:
```python
from dataclasses import dataclass

@dataclass
class IndexState:
    faiss_index: faiss.Index
    metadata: list[dict]
    username_to_faiss_pos: dict[str, int]

# Single atomic assignment — one attribute, one bytecode STORE_ATTR:
app.state.index_state = IndexState(new_index, new_metadata, new_mapping)
```
Callers then access `app_state.index_state.faiss_index` etc. This requires updating `run_explore()` and the `compare_configs()` endpoint — moderate refactor.

**Recommendation:** Keep the existing three-line pattern. The graceful degradation is sufficient. The rebuild window is ~60s but the inconsistency window is microseconds (three sequential stores).

### v2.2 additions needed (IDX-01..04)

IDX-01/02: The existing `POST /api/admin/ingest/run` endpoint already triggers `_run_ingest_job` in a background thread. The admin frontend needs a button that calls this endpoint — no new backend endpoint required.

IDX-03: Already implemented (the three-line swap above).

IDX-04: The existing `GET /api/admin/ingest/status` exposes `_ingest` dict. The admin frontend needs to poll this endpoint and display status. Add `last_rebuild_at` and `expert_count_at_rebuild` to `_ingest` for the Index Drift metric (INTEL-03).

### After atomic swap: invalidate t-SNE cache

Add one line to `_run_ingest_job` after the username mapping rebuild:
```python
app.state.tsne_cache = []   # signals stale; background recompute optional
log.info("atomic_swap.complete", vectors=app.state.faiss_index.ntotal)
```

---

## Q2: t-SNE Heatmap — reconstruct_n Compatibility

### Index type: IndexFlatIP — reconstruct_n works directly

**Confirmed by local load:**
```
faiss.read_index('data/faiss.index') → IndexFlatIP, ntotal=536, d=768
```

`IndexFlatIP` stores all vectors verbatim in a dense float32 matrix. `reconstruct_n(start, n, recons)` copies them back out. No special flags, no direct map needed.

```python
import numpy as np
import faiss

index = app.state.faiss_index  # IndexFlatIP confirmed
vectors = np.zeros((index.ntotal, index.d), dtype=np.float32)
index.reconstruct_n(0, index.ntotal, vectors)
# vectors.shape == (536, 768) — exact vectors that were added via index.add()
```

### Compatibility matrix (for future reference if index type changes)

| Index Type | reconstruct_n Support | Condition |
|------------|----------------------|-----------|
| `IndexFlatIP` / `IndexFlatL2` | YES — always | None — flat indices store verbatim |
| `IndexIVFFlat` | YES — with caveat | Must call `index.make_direct_map()` before saving; or call it after loading |
| `IndexIVFPQ` | APPROXIMATE only | `make_direct_map()` required; returns quantized approximation (not exact vectors) |
| `IndexHNSWFlat` | NO | HNSW graph does not support reconstruct |

For this codebase: no caveat applies. `IndexFlatIP` reconstruct_n is unconditional.

### t-SNE computation and startup integration

Compute once at startup in `main.py` lifespan, after the `username_to_faiss_pos` block (line 214):

```python
# Phase 26: t-SNE 2D projection — computed at startup from FAISS index, cached in app.state
# scikit-learn must be in requirements.txt; fails gracefully if absent
try:
    import numpy as _np
    from sklearn.manifold import TSNE as _TSNE

    _vecs = _np.zeros((app.state.faiss_index.ntotal, app.state.faiss_index.d), dtype=_np.float32)
    app.state.faiss_index.reconstruct_n(0, app.state.faiss_index.ntotal, _vecs)

    _coords = _TSNE(
        n_components=2,
        random_state=42,
        perplexity=min(30, app.state.faiss_index.ntotal - 1),
        n_iter=1000,
        metric="cosine",   # vectors are L2-normalized → cosine = inner product
    ).fit_transform(_vecs)

    app.state.tsne_cache = [
        {
            "x": float(_coords[i, 0]),
            "y": float(_coords[i, 1]),
            "username": app.state.metadata[i].get("Username", ""),
            "category": app.state.metadata[i].get("category", None),
        }
        for i in range(len(_coords))
    ]
    log.info("startup: tsne_cache built", points=len(app.state.tsne_cache))
except Exception as _exc:
    app.state.tsne_cache = []
    log.warning("startup: tsne_cache failed", error=str(_exc))
```

**Runtime:** TSNE on 536 × 768 typically completes in 2–8 seconds on a Railway shared CPU. This extends startup time but is acceptable — the Railway health check endpoint responds during lifespan (FastAPI yields after lifespan completes, so the first request is gated until TSNE finishes). If startup time becomes a concern, move TSNE to an `asyncio.to_thread` background task and set `tsne_cache = None` until ready.

**New admin endpoint (INTEL-05):**
```python
# In app/routers/admin.py, add to `router`:
@router.get("/embedding-map")
def get_embedding_map(request: Request):
    """Return cached t-SNE 2D projection. Empty list if cache is building."""
    return {"points": request.app.state.tsne_cache or []}
```

**Dependency:** Add `scikit-learn` to `requirements.txt`. It is a large package (~50MB) but Railway caches pip installs between deploys.

---

## Q3: Newsletter Table — SQLAlchemy Model and Email Gate Integration

### Minimal SQLAlchemy model (following models.py conventions exactly)

```python
# In app/models.py — add after the AppSetting class

class NewsletterSubscriber(Base):
    """
    Newsletter subscription captures created when user submits email via
    the redesigned ProfileGateModal (NLTR-01).

    source values (stored as plain string, validated at router layer):
        "profile_gate" — submitted via email gate unlock modal
        "sage_prompt"  — submitted via Sage co-pilot CTA
        "direct"       — submitted via a standalone subscribe form

    Unique constraint on email: use on_conflict_do_nothing at the query layer
    for idempotency, matching the EmailLead pattern in email_capture.py.
    """
    __tablename__ = "newsletter_subscribers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="profile_gate"
    )
```

**No ALTER TABLE needed.** `Base.metadata.create_all(bind=engine)` in the lifespan already runs on every startup and creates missing tables idempotently. Add the model class, redeploy — the table is created automatically on first Railway startup.

**Why String not Python Enum for source:** SQLite has no native enum type. Python Enum columns require Alembic or manual `CHECK` constraints. String(50) validated at the Pydantic layer is simpler and consistent with all other categorical fields in models.py (e.g., `Feedback.vote` is `String(4)` with `"up"|"down"` enforced by the router).

### New router: app/routers/newsletter.py

Create a new router file following the `email_capture.py` pattern exactly:

```python
# app/routers/newsletter.py
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import NewsletterSubscriber, EmailLead

router = APIRouter()

class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    source: Literal["profile_gate", "sage_prompt", "direct"] = "profile_gate"

@router.post("/api/newsletter-subscribe", status_code=200)
def newsletter_subscribe(body: NewsletterSubscribeRequest, db: Session = Depends(get_db)):
    """
    Newsletter subscription — writes to newsletter_subscribers and email_leads.
    Both are idempotent (on_conflict_do_nothing). Returns {"status": "ok"} always.
    """
    db.execute(
        insert(NewsletterSubscriber)
        .values(email=str(body.email), source=body.source)
        .on_conflict_do_nothing(index_elements=["email"])
    )
    # Also write to email_leads for unified lead tracking
    db.execute(
        insert(EmailLead)
        .values(email=str(body.email))
        .on_conflict_do_nothing(index_elements=["email"])
    )
    db.commit()
    return {"status": "ok"}
```

Register in `main.py`:
```python
from app.routers import admin, chat, email_capture, feedback, health, explore, pilot, suggest, newsletter

app.include_router(newsletter.router)
```

### Integration with existing email gate — no breaking changes

The current email gate flow:
1. `ProfileGateModal` opens when user clicks "View Full Profile"
2. User submits email → `POST /api/email-capture` → writes to `email_leads`
3. Frontend: `localStorage.setItem('tcs_email_unlocked', 'true')`
4. Returning visitors: `useState` reads `localStorage['tcs_email_unlocked']` on init → gate bypassed

**v2.2 change (NLTR-01):** The modal copy changes to newsletter CTA language. The submit action changes from calling `/api/email-capture` to calling `/api/newsletter-subscribe` (which internally also writes to `email_leads` — no lead data is lost). The localStorage key `'tcs_email_unlocked'` and the returning-visitor bypass logic are **completely unchanged**.

The returning-visitor localStorage logic in `ProfileGateModal`:
```typescript
// This line is unchanged — still works after NLTR redesign
const [isUnlocked, setIsUnlocked] = useState(
  () => localStorage.getItem('tcs_email_unlocked') === 'true'
)
```

The Zustand `nltrSlice` is additive UI state — it does not replace the localStorage check.

### Admin leads page (NLTR-04)

Add a new section to `GET /api/admin/leads` or create a separate `GET /api/admin/newsletter-subscribers` endpoint:

```python
@router.get("/newsletter-subscribers")
def get_newsletter_subscribers(db: Session = Depends(get_db)):
    from app.models import NewsletterSubscriber
    from sqlalchemy import func
    count = db.scalar(select(func.count()).select_from(NewsletterSubscriber)) or 0
    subscribers = db.scalars(
        select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc()).limit(100)
    ).all()
    return {
        "count": count,
        "subscribers": [
            {"email": s.email, "source": s.source, "created_at": s.created_at.isoformat()}
            for s in subscribers
        ],
    }
```

---

## Q4: Zustand Newsletter Slice — Fields and Persist Key

### Recommended: standalone store with separate persist key 'nltr-state'

Do **not** add the newsletter slice to `useExplorerStore`. Create a separate `create()` store.

**Rationale:**

1. The `'explorer-filters'` key uses a `partialize` whitelist: `{query, rateMin, rateMax, tags, sortBy, sortOrder}`. Adding newsletter fields requires either (a) updating the whitelist and bumping `version: 1` with a migrate function, or (b) they silently don't persist. Either path adds risk to an already-working persist setup.

2. `filterSlice.resetFilters()` calls `set({ ...filterDefaults })`. If newsletter state lived in the same store, there is no reset bleed (it only sets filter-specific keys), but the combined store is already complex enough. Newsletter state has a completely different lifecycle.

3. A separate store with its own persist key can be versioned independently and cleared independently without affecting filter persistence.

### Minimal slice (create a new file)

```typescript
// frontend/src/store/nltrSlice.ts

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface NltrState {
  // Persisted data
  subscribed: boolean
  email: string            // '' when not subscribed

  // Actions
  setSubscribed: (email: string) => void
  clearSubscription: () => void
}

export const useNltrStore = create<NltrState>()(
  persist(
    (set) => ({
      subscribed: false,
      email: '',
      setSubscribed: (email) => set({ subscribed: true, email }),
      clearSubscription: () => set({ subscribed: false, email: '' }),
    }),
    {
      name: 'nltr-state',         // separate localStorage key — no collision with 'explorer-filters'
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
)
```

### Integration in ProfileGateModal

```typescript
// frontend/src/components/modals/ProfileGateModal.tsx (modified)
import { useNltrStore } from '../../store/nltrSlice'

// Inside submit handler:
const handleSubmit = async (email: string) => {
  await fetch(`${API_URL}/api/newsletter-subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: 'profile_gate' }),
  })
  // Gate unlock (unchanged):
  localStorage.setItem('tcs_email_unlocked', 'true')
  setIsUnlocked(true)
  // Newsletter state (new):
  useNltrStore.getState().setSubscribed(email)
}
```

Note: `useNltrStore.getState()` is used here (not the hook) because this is inside an async handler, following the established `useExplorerStore.getState()` pattern from `useSage.ts`.

### What subscribed/email enable in v2.2

- Show "You're subscribed as {email}" in the modal after submission
- Conditionally show a "Manage preferences" link in the header for subscribed users
- Skip the modal entirely if `nltrStore.subscribed === true` (alternative to the localStorage check — but keep both for defense in depth)

---

## Q5: OTR@K Storage — Column and Computation Location

### The explore vs chat pipeline distinction

`explorer.py`'s `run_explore()` powers the **browse/filter marketplace** (`/api/explore`). It does not write to the `conversations` table — that table is for **Sage/chat interactions** from `chat.py`. These are separate pipelines.

INTEL-01 says "computed per search query and stored in conversations table" — this matches the chat pipeline where each query already produces a `Conversation` row. For the explore pipeline, a separate log table is cleaner.

**Recommendation:** Track OTR@K in two places:
- **Chat pipeline** (chat.py / search_intelligence.py): add `otr_at_k` column to `conversations` table.
- **Explore pipeline** (explorer.py): expose `otr_at_k` in `ExploreResponse` for the admin to read; optionally log to a lightweight `explore_events` table.

### ALTER TABLE for the conversations table

Add to the existing inline migration block in `main.py` lifespan (lines 116–127):

```python
# In the existing migration block alongside top_match_score, gap_resolved, etc.:
"ALTER TABLE conversations ADD COLUMN otr_at_k REAL",
```

This follows the identical pattern used for all five existing analytics columns. SQLite raises `OperationalError` if the column already exists — the `except: pass` guard handles it.

Also add the mapped column to the `Conversation` model in `app/models.py`:
```python
otr_at_k: Mapped[float | None] = mapped_column(Float, nullable=True)
```

### Computation in explorer.py (run_explore)

After the `scored.sort(...)` call (line 304), before pagination:

```python
# OTR@K — On-Topic Rate at K=10
# Fraction of top-10 hybrid results whose final_score >= SIMILARITY_THRESHOLD
SIMILARITY_THRESHOLD = 0.60   # mirrors GAP_THRESHOLD in admin.py

otr_at_k: float | None = None
if is_text_query and scored:
    top_k = scored[:10]
    on_topic = sum(1 for final_s, _, _, _ in top_k if final_s >= SIMILARITY_THRESHOLD)
    otr_at_k = round(on_topic / len(top_k), 4)
```

Add `otr_at_k: float | None` to `ExploreResponse`:
```python
class ExploreResponse(BaseModel):
    experts: list[ExpertCard]
    total: int
    cursor: int | None
    took_ms: int
    otr_at_k: float | None = None    # None in pure filter mode (no text query)
```

### Computation in chat pipeline (for conversations table)

In `app/services/search_intelligence.py` or `app/routers/chat.py`, after the retrieval pipeline returns candidates, compute OTR@K using the candidate scores before writing the `Conversation` row:

```python
# After candidates are ranked (top-K available):
top_10 = candidates[:10]
on_topic = sum(1 for c in top_10 if c.score >= settings["SIMILARITY_THRESHOLD"])
otr_at_k = round(on_topic / max(1, len(top_10)), 4) if top_10 else None

# Pass to Conversation row creation:
conversation = Conversation(
    ...
    otr_at_k=otr_at_k,
)
```

### Admin 7-day rolling average (INTEL-02)

Add to `GET /api/admin/intelligence-stats` in `admin.py`:

```python
# In get_intelligence_stats(), alongside existing daily trend query:
from sqlalchemy import text as _text

otr_rows = db.execute(_text("""
    SELECT
        strftime('%Y-%m-%d', created_at) AS day,
        AVG(otr_at_k) AS avg_otr
    FROM conversations
    WHERE date(created_at) >= date('now', '-7 days')
      AND otr_at_k IS NOT NULL
    GROUP BY strftime('%Y-%m-%d', created_at)
    ORDER BY day
""")).all()

otr_7day = [{"date": r.day, "avg_otr": round(float(r.avg_otr), 4) if r.avg_otr else None}
            for r in otr_rows]
# Add to response dict: "otr_7day": otr_7day
```

---

## System Overview (v2.2 additions)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  MarketplacePage — aurora mesh gradient background (VIS-01)              │
│  ┌──────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │ FilterSidebar            │  │ ExpertGrid (VirtuosoGrid unchanged) │   │
│  │ [glassmorphism VIS-02]   │  │ ExpertCard [bento CARD-01..03]      │   │
│  │                          │  └─────────────────────────────────────┘   │
│  │ AnimatedTagCloud (NEW)   │                                            │
│  │ Framer Motion layout     │  SagePanel [glassmorphism VIS-04]          │
│  │ [DISC-01..04]            │  [unchanged interaction model]             │
│  └──────────────────────────┘                                            │
│                                                                          │
│  ProfileGateModal (MODIFIED — newsletter CTA)                            │
│  → POST /api/newsletter-subscribe (NEW)                                  │
│  → localStorage 'tcs_email_unlocked' (UNCHANGED)                         │
│                                                                          │
│  Zustand stores                                                          │
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐   │
│  │ useExplorerStore              │  │ useNltrStore (NEW)             │   │
│  │ 'explorer-filters' (unchanged)│  │ 'nltr-state'                  │   │
│  │ filterSlice / resultsSlice /  │  │ subscribed: bool              │   │
│  │ pilotSlice                    │  │ email: string                 │   │
│  └───────────────────────────────┘  └────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                         BACKEND (Railway)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  app.state                                                               │
│  ┌──────────────────┐  ┌────────────────┐  ┌───────────────────────┐    │
│  │ faiss_index      │  │ metadata       │  │ tsne_cache (NEW)      │    │
│  │ IndexFlatIP      │  │ list[dict]     │  │ list[{x,y,username,   │    │
│  │ 536 × 768        │  │ 536 rows       │  │  category}]           │    │
│  │ (swap target)    │  │ (swap target)  │  │ computed at startup   │    │
│  └──────────────────┘  └────────────────┘  └───────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ username_to_faiss_pos dict (rebuilt after each swap)           │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Existing routers (unchanged interaction model)                          │
│  explore.py — MODIFIED: add otr_at_k to ExploreResponse                 │
│  admin.py  — MODIFIED: add /embedding-map, /newsletter-subscribers,     │
│                         otr_7day to intelligence-stats                  │
│  newsletter.py (NEW) — POST /api/newsletter-subscribe                   │
│                                                                          │
│  SQLite tables                                                           │
│  conversations (MODIFIED: +otr_at_k REAL)                               │
│  newsletter_subscribers (NEW)                                            │
│  All other tables unchanged                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Recommended Project Structure (v2.2 delta only)

```
app/
├── models.py                  MODIFIED — add NewsletterSubscriber class; add otr_at_k to Conversation
├── main.py                    MODIFIED — add tsne_cache startup block; add otr_at_k ALTER TABLE;
│                                         register newsletter.router
├── routers/
│   ├── admin.py               MODIFIED — add /embedding-map; /newsletter-subscribers;
│   │                                     otr_7day to intelligence-stats
│   ├── explore.py             MODIFIED — otr_at_k now in ExploreResponse (optional log write)
│   └── newsletter.py          NEW — POST /api/newsletter-subscribe
└── services/
    └── explorer.py            MODIFIED — add otr_at_k field to ExploreResponse; compute after sort

frontend/src/
├── store/
│   ├── index.ts               UNCHANGED (nltrStore is standalone, not composed in)
│   └── nltrSlice.ts           NEW — useNltrStore with 'nltr-state' persist key
├── components/
│   ├── sidebar/
│   │   ├── TagMultiSelect.tsx REPLACED ENTIRELY by AnimatedTagCloud.tsx
│   │   └── AnimatedTagCloud.tsx  NEW — Framer Motion layout animations + proximity scale
│   ├── marketplace/
│   │   └── ExpertCard.tsx     MODIFIED — bento zones (CARD-01); aurora hover tokens (CARD-03)
│   └── modals/
│       └── ProfileGateModal.tsx  MODIFIED — newsletter CTA copy; calls /api/newsletter-subscribe;
│                                            calls useNltrStore.setSubscribed()
└── pages/
    └── MarketplacePage.tsx    MODIFIED — aurora mesh gradient background wrapper (VIS-01)
```

## Architectural Patterns

### Pattern 1: Atomic FAISS Swap — Reference Replacement

**What:** Three sequential Python attribute assignments on `app.state` replace the live FAISS index, metadata, and position mapping after an offline rebuild completes in a background thread.

**When to use:** Every time `_run_ingest_job` completes (triggered by admin rebuild).

**Trade-offs:** Simple and correct for single-process Railway. The 3-statement window is a theoretical race; the `username_in_pos` guard in `run_explore()` provides graceful degradation. If strict atomicity is needed, bundle into a single dataclass (requires updating all callers of `app_state.faiss_index`).

**Code:** Already exists in `admin.py:_run_ingest_job`. Do not duplicate.

### Pattern 2: reconstruct_n for Flat FAISS Indices

**What:** `IndexFlatIP.reconstruct_n(0, ntotal, output_array)` extracts all stored vectors into a pre-allocated numpy float32 array.

**When to use:** Any time you need all vectors for analysis (t-SNE, UMAP, drift detection) without re-reading from disk.

**Trade-offs:** O(n) memory allocation. At 536 × 768 = 3MB — negligible. At 50K × 768 = ~150MB — consider streaming or chunked processing.

```python
vectors = np.zeros((index.ntotal, index.d), dtype=np.float32)
index.reconstruct_n(0, index.ntotal, vectors)
# For IndexFlatIP: vectors == the exact matrix passed to index.add()
```

**Important:** The vectors in the index are L2-normalized (see `ingest.py` line 162: `faiss.normalize_L2(matrix)`). When computing TSNE, use `metric="cosine"` or know that distances are cosine distances.

### Pattern 3: Newsletter Model Following EmailLead Pattern

**What:** New `newsletter_subscribers` table with `email` unique + index, `created_at`, `source` string. Router uses `insert().on_conflict_do_nothing()` for idempotency. Also writes to `email_leads` for unified lead tracking.

**When to use:** Any new lead-capture table in this codebase.

**Trade-offs:** Two writes per submission (newsletter + email_leads) — both are fast SQLite inserts with unique index lookup. The duplication is intentional: `email_leads` is the unified lead view, `newsletter_subscribers` tracks consent with source attribution.

### Pattern 4: Standalone Zustand Store for Orthogonal State

**What:** Create a separate `create()` store (`useNltrStore`) with its own persist key instead of extending `useExplorerStore`.

**When to use:** When the new state has a different lifecycle than existing state, different persist requirements, and no shared actions with existing slices.

**Trade-offs:** More import paths (two stores vs one). Avoids partialize migration risk and lifecycle coupling.

```typescript
// Correct — standalone store
export const useNltrStore = create<NltrState>()(
  persist(set => ({ ... }), { name: 'nltr-state' })
)

// Wrong — composing into useExplorerStore would require updating partialize
// and risks version migration side effects
```

## Data Flow

### Atomic FAISS Swap Flow

```
Admin clicks "Rebuild Index" in admin panel
    ↓
POST /api/admin/ingest/run (EXISTING endpoint)
    ↓
threading.Thread: _run_ingest_job(app)
    ↓
subprocess: scripts/tag_experts.py (tags + findability — 60s+ with Gemini API)
subprocess: scripts/ingest.py     (embed + write faiss.index via staging rename)
    ↓
app.state.faiss_index = faiss.read_index(FAISS_INDEX_PATH)
app.state.metadata = json.load(METADATA_PATH)
app.state.username_to_faiss_pos = rebuild_mapping(metadata)
app.state.tsne_cache = []   ← NEW: invalidate cache
_ingest["status"] = "done"  ← IDX-04 polling sees completion
    ↓
Admin polls GET /api/admin/ingest/status (EXISTING endpoint)
Admin frontend updates rebuild status badge
```

### Newsletter Subscription Flow

```
User opens ProfileGateModal (profile click)
    ↓
Modal renders newsletter CTA ("Get expert insights. Unlock profiles.")
User submits email
    ↓
POST /api/newsletter-subscribe {email, source: "profile_gate"}
    ↓ (server: INSERT OR IGNORE newsletter_subscribers + email_leads)
    ↓
localStorage.setItem('tcs_email_unlocked', 'true')   ← UNCHANGED
useNltrStore.getState().setSubscribed(email)          ← NEW
    ↓
Modal: shows confirmation with user email
Profile: unlocked

Returning visitor:
  localStorage['tcs_email_unlocked'] === 'true'   → gate bypassed (UNCHANGED)
  useNltrStore rehydrates from 'nltr-state'        → subscribed=true, email restored
```

### t-SNE Heatmap Flow

```
FastAPI lifespan startup
    ↓
faiss_index loaded (536 vectors, IndexFlatIP)
    ↓
reconstruct_n(0, 536) → np.zeros((536, 768)) populated in-place
    ↓
TSNE(n_components=2, perplexity=30, metric='cosine').fit_transform() → (536, 2) coords
    ↓
app.state.tsne_cache = [{x, y, username, category}] × 536
    ↓
GET /api/admin/embedding-map → {"points": tsne_cache}
    ↓
Admin panel: scatter plot colored by category; expert name on hover (INTEL-06)
```

### OTR@K Flow (explore pipeline)

```
GET /api/explore?query=...
    ↓
run_explore() hybrid pipeline runs
scored list built and sorted (existing)
    ↓
top_k = scored[:10]
otr_at_k = count(final_s >= 0.60) / len(top_k)
    ↓
ExploreResponse(... otr_at_k=otr_at_k)
    ↓
Admin GET /api/admin/intelligence-stats:
  SELECT AVG(otr_at_k), date FROM conversations
  WHERE created_at >= date('now', '-7 days')
  GROUP BY date
```

## Integration Points

### New vs Modified Components — Complete Table

| Component | Status | What Changes |
|-----------|--------|--------------|
| `app/models.py` | MODIFIED | Add `NewsletterSubscriber`; add `otr_at_k: Mapped[float | None]` to `Conversation` |
| `app/main.py` | MODIFIED | Add t-SNE startup block after line 214; add `"ALTER TABLE conversations ADD COLUMN otr_at_k REAL"` to existing migration block; add `newsletter.router` import and registration |
| `app/routers/admin.py` | MODIFIED | Add `GET /embedding-map`; add `GET /newsletter-subscribers`; add `otr_7day` to `get_intelligence_stats()` response |
| `app/routers/explore.py` | MODIFIED | `ExploreResponse` now includes `otr_at_k`; no structural change to the route |
| `app/routers/newsletter.py` | NEW | `POST /api/newsletter-subscribe` |
| `app/services/explorer.py` | MODIFIED | Add `otr_at_k: float | None = None` to `ExploreResponse`; compute OTR@K after `scored.sort()` in `run_explore()` |
| `frontend/src/store/nltrSlice.ts` | NEW | `useNltrStore` with `subscribed`, `email`, `setSubscribed`, `clearSubscription` |
| `frontend/src/store/index.ts` | UNCHANGED | `nltrStore` is standalone — no changes needed to `useExplorerStore` |
| `frontend/src/components/sidebar/TagMultiSelect.tsx` | REPLACED | File contents replaced; same file path; exports `AnimatedTagCloud` component |
| `frontend/src/components/marketplace/ExpertCard.tsx` | MODIFIED | Bento visual zones (CARD-01); aurora hover glow color tokens (CARD-03); h-[180px] preserved (CARD-02) |
| `frontend/src/components/modals/ProfileGateModal.tsx` | MODIFIED | Newsletter CTA copy (NLTR-01); calls `POST /api/newsletter-subscribe`; calls `useNltrStore.setSubscribed()`; localStorage logic unchanged |
| `frontend/src/pages/MarketplacePage.tsx` | MODIFIED | Aurora mesh gradient background div wraps content (VIS-01) |

### Files Completely Unchanged

`app/routers/chat.py`, `app/routers/feedback.py`, `app/routers/email_capture.py`, `app/routers/health.py`, `app/routers/pilot.py`, `app/routers/suggest.py`, `app/services/embedder.py`, `app/services/retriever.py`, `app/services/search_intelligence.py`, `app/services/tagging.py`, `app/database.py`, `app/config.py`, `frontend/src/store/filterSlice.ts`, `frontend/src/store/resultsSlice.ts`, `frontend/src/store/pilotSlice.ts`, `frontend/src/store/index.ts`, `frontend/src/admin/` (entire directory).

### External Service Dependencies

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `scikit-learn` TSNE | Add to `requirements.txt`; import in lifespan | Railway caches pip installs; ~50MB package; startup adds 2–8s |
| FAISS `reconstruct_n` | Built into `faiss-cpu` already installed | IndexFlatIP supports it unconditionally — no new flags |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current: 536 experts, single-process | All patterns correct as described. IndexFlatIP, single attr-assign swap, app.state, asyncio. Zero ops complexity. |
| 5K experts | IndexFlatIP still viable (~15MB RAM). t-SNE startup time increases to 30–60s — move to background `asyncio.to_thread` with `tsne_cache = None` (loading state). Newsletter table has no scaling concern. |
| 50K experts | Switch FAISS to IndexIVFFlat with `make_direct_map()` for reconstruct_n support. Multi-worker Uvicorn requires external store for shared state (app.state pattern breaks). otr_at_k would need sampling instead of full computation. |

### Scaling Priorities

1. **First bottleneck — t-SNE startup blocking:** At 5K experts, 30–60s startup is unacceptable on Railway health checks. Move TSNE to `asyncio.to_thread` with a polling endpoint `GET /api/admin/embedding-map/status`.
2. **Second bottleneck — IndexFlatIP linear scan:** At 50K experts, switch to IndexIVFFlat. The atomic swap pattern is unchanged; only ingest.py changes.

## Anti-Patterns

### Anti-Pattern 1: asyncio.Lock for FAISS Swap in Single-Process Uvicorn

**What people do:** Wrap `app.state.faiss_index = new_index` in `async with asyncio.Lock()` to prevent concurrent reads during a swap.

**Why it's wrong:** The rebuild runs in `threading.Thread`, outside the event loop. Acquiring an asyncio.Lock from a thread requires `asyncio.run_coroutine_threadsafe()` — adding complexity for zero correctness benefit. The GIL already makes each attribute assignment atomic. The window between the three statements is real but handled by the existing graceful degradation guard in `run_explore()`.

**Do this instead:** Keep the existing three-line assignment pattern. If strict atomicity is required, bundle all three into a single dataclass and assign once.

### Anti-Pattern 2: Composing nltrSlice into useExplorerStore

**What people do:** Add `subscribed` and `email` to `useExplorerStore` and add them to the `partialize` whitelist.

**Why it's wrong:** The `'explorer-filters'` key has `version: 1` with an existing whitelist. Adding fields without a migrate function causes existing users to lose their newsletter state on next load (Zustand persist discards unrecognized keys at the old version). Also, `filterSlice.resetFilters()` semantically should not touch newsletter state — keeping them separate makes intent clear.

**Do this instead:** Standalone `create()` store with `'nltr-state'` key. Zero migration risk.

### Anti-Pattern 3: Recomputing t-SNE Per-Request

**What people do:** Call `TSNE.fit_transform()` inside the `/embedding-map` route handler.

**Why it's wrong:** 2–8 seconds of CPU-bound computation per admin page load. Railway's single process means this blocks all other requests for that duration.

**Do this instead:** Compute at lifespan startup, cache in `app.state.tsne_cache`. Return cached data instantly. Invalidate on index rebuild (`tsne_cache = []`).

### Anti-Pattern 4: Calling reconstruct_n on IndexIVFPQ Without Direct Map

**What people do:** Upgrade index to `IndexIVFPQ` for compression, then call `reconstruct_n` expecting exact vectors.

**Why it's wrong:** PQ quantization loses precision — reconstructed vectors are approximations. Without `make_direct_map()`, `reconstruct_n` raises `RuntimeError`. Even with it, the approximation distorts the t-SNE layout.

**Do this instead:** For this codebase, IndexFlatIP is correct at 536 vectors. If upgrading to IndexIVFFlat (the recommended step at 5K+ vectors), call `index.make_direct_map()` before `faiss.write_index()` in ingest.py.

### Anti-Pattern 5: Replacing localStorage Gate With nltrSlice

**What people do:** Replace `localStorage['tcs_email_unlocked']` check with `useNltrStore.subscribed` as the gate bypass condition.

**Why it's wrong:** The existing `useState(() => localStorage.getItem('tcs_email_unlocked') === 'true')` pattern reads synchronously in the initializer — it prevents flash of locked state for returning visitors. Zustand `persist` rehydration is asynchronous (it fires after first render). Switching to Zustand as the sole gate check causes a flash of the locked modal for every returning visitor on page load.

**Do this instead:** Keep localStorage as the gate check. Use `nltrSlice` only for UI state (confirmation display, email in header, etc.). Both can coexist — they use different keys.

## Sources

- Direct codebase inspection (HIGH confidence — ground truth):
  - `app/main.py` — lifespan startup sequence, existing migrations, app.state pattern
  - `app/routers/admin.py` — `_run_ingest_job`, `_ingest` dict, existing endpoints
  - `app/routers/email_capture.py` — EmailLead insert pattern, on_conflict_do_nothing
  - `app/routers/explore.py` — route structure, app_state access pattern
  - `app/services/explorer.py` — run_explore() pipeline, ExploreResponse schema, scored list structure
  - `app/models.py` — all existing model conventions, Mapped[T] style, DateTime defaults
  - `app/config.py` — OUTPUT_DIM=768, FAISS_INDEX_PATH
  - `scripts/ingest.py` — IndexFlatIP confirmed, faiss.normalize_L2, staging rename pattern
  - `frontend/src/store/index.ts` — persist config, partialize whitelist, version: 1
  - `frontend/src/store/filterSlice.ts` — filterDefaults, resetFilters pattern
  - `frontend/src/components/sidebar/TagMultiSelect.tsx` — toggleTag/setTags interface
- FAISS index type confirmed locally: `IndexFlatIP 536 768` (HIGH confidence — loaded production index)
- IndexFlatIP reconstruct_n: flat indices store verbatim vectors; reconstruct_n is always supported (HIGH confidence — fundamental FAISS property, no special conditions)
- Zustand persist behavior: rehydration is async, state initializer reads synchronously (HIGH confidence — Zustand docs + known React hydration behavior)
- scikit-learn TSNE startup estimate (2–8s for 536×768): MEDIUM confidence — typical range on shared CPU; Railway instance allocation varies

---

*Architecture research for: TCS v2.2 Evolved Discovery Engine integration points*
*Researched: 2026-02-22*
