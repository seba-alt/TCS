# Stack Research

**Domain:** Expert Marketplace — v2.0 rearchitecture additions only
**Researched:** 2026-02-21
**Research Mode:** Ecosystem (Subsequent Milestone — stack additions only)
**Confidence:** HIGH for npm packages; MEDIUM for FAISS IDSelectorBatch on flat index; MEDIUM for FTS5/SQLAlchemy pattern

---

## Scope of This Document

Covers ONLY the stack additions and changes needed for v2.0. The existing production stack is validated and unchanged:

- **Backend:** FastAPI + SQLAlchemy + SQLite + FAISS (faiss-cpu 1.13.*) + google-genai (1.64.*) + tenacity (9.1.*)
- **Frontend:** React + Vite + Tailwind v3 + React Router v7
- **AI:** gemini-embedding-001 (768-dim, MRL-truncated) + Gemini 2.5 Flash

Seven specific questions were investigated. Each section below gives a direct answer.

---

## 1. Zustand — State Management

### Recommendation

Install `zustand@^5.0.0`. Version 5.0.10 was released 2026-01-12. This is the current stable major with no breaking changes from 5.0.8 (October 2025).

### Persist middleware pattern

`persist` ships bundled inside `zustand/middleware` — no additional package required.

```typescript
// store/useSearchStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SearchState {
  searchParams: { query: string; rateMin: number; rateMax: number; tags: string[] }
  results: Expert[]
  isPilotOpen: boolean
  setSearchParams: (params: Partial<SearchState['searchParams']>) => void
  setResults: (results: Expert[]) => void
  togglePilot: () => void
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      searchParams: { query: '', rateMin: 0, rateMax: 9999, tags: [] },
      results: [],
      isPilotOpen: false,
      setSearchParams: (params) =>
        set((state) => ({ searchParams: { ...state.searchParams, ...params } })),
      setResults: (results) => set({ results }),
      togglePilot: () => set((state) => ({ isPilotOpen: !state.isPilotOpen })),
    }),
    {
      name: 'tcs-search-v2',                          // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({                        // ONLY persist these fields
        searchParams: state.searchParams,
        isPilotOpen: state.isPilotOpen,
        // results intentionally excluded — re-fetched on load
      }),
    }
  )
)
```

**Key points:**
- `partialize` is the correct way to exclude `results` from persistence (large, stale on reload)
- `createJSONStorage` is required in v5 — bare `localStorage` no longer accepted directly
- No `devtools` middleware conflict — stack as `create<S>()(devtools(persist(...)))` if needed
- Hydration is synchronous in browser environments — no SSR hydration concern (this is Vite SPA)

### Installation

```bash
npm install zustand@^5.0.0
```

**Confidence:** HIGH — version confirmed from npm (5.0.10), persist pattern from official Zustand docs (zustand.docs.pmnd.rs/middlewares/persist).

---

## 2. react-virtuoso — Virtualized Expert Grid

### Recommendation

Install `react-virtuoso@^4.18.0`. Version 4.18.1 is current (published ~2 months before 2026-02-21).

### VirtuosoGrid vs Virtuoso — which to use

**Use `Virtuoso` (not `VirtuosoGrid`) for the expert marketplace grid.**

| Component | Item sizing | Layout | Best for |
|-----------|-------------|--------|----------|
| `VirtuosoGrid` | Fixed, identical items | CSS grid via className props | Image galleries, same-height uniform tiles |
| `Virtuoso` | Variable height, measured at render | Single column or custom row renderer | Cards with variable bio length, tag counts |

Expert cards will have variable height — different bio lengths, tag counts, findability scores. `VirtuosoGrid` requires items to be the same size (its grid is CSS-controlled, not measured per-item). It will produce misaligned rows if card heights differ by even a few pixels.

**Correct pattern for variable-height multi-column grid:**

```tsx
// Option A: Virtuoso with CSS grid row renderer (recommended for v2.0)
// Render N cards per "row item" — Virtuoso measures each row naturally
import { Virtuoso } from 'react-virtuoso'

const COLS = 3  // or responsive via useBreakpoint

export function ExpertGrid({ experts }: { experts: Expert[] }) {
  const rows = chunkArray(experts, COLS)   // [[e1,e2,e3],[e4,e5,e6],...]

  return (
    <Virtuoso
      data={rows}
      itemContent={(_, row) => (
        <div className="grid grid-cols-3 gap-4 px-4">
          {row.map((expert) => <ExpertCard key={expert.username} expert={expert} />)}
        </div>
      )}
      style={{ height: '100vh' }}
    />
  )
}
```

This approach: Virtuoso virtualizes rows, each row is a CSS grid with N cards. Works correctly with variable card heights because Virtuoso measures each full row.

**If cards become uniform fixed-height** (e.g. you clamp bio to 2 lines): switch to `VirtuosoGrid` for simpler API. But do not start there.

### Installation

```bash
npm install react-virtuoso@^4.18.0
```

**Confidence:** HIGH — version from npm (4.18.1); VirtuosoGrid/Virtuoso distinction from official docs (virtuoso.dev) and GitHub issue #85.

---

## 3. Framer Motion — Animations

### Recommendation

Install `framer-motion@^12.0.0`. Version 12.34.3 was the latest as of 2026-02-21 (actively published — last update was ~21 hours before research date).

**Rebranding note:** The library was rebranded to "Motion" but the npm package is still `framer-motion`. Import paths are unchanged. Do not install the separate `motion` package (it targets the web animations API, not React).

### React 18 + Vite compatibility

- Framer Motion v7+ requires React 18 as minimum. v12 is fully React 18 compatible.
- Vite compatibility is standard — no special config needed. The library ships ESM and is tree-shakable by Vite's bundler.
- React 19 support is in active testing in their CI as of v12.

### Usage pattern for marketplace animations

```tsx
import { motion, AnimatePresence } from 'framer-motion'

// Card entrance animation
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.15, ease: 'easeOut' }}
>
  <ExpertCard expert={expert} />
</motion.div>

// AI co-pilot panel slide-in
<AnimatePresence>
  {isPilotOpen && (
    <motion.aside
      key="pilot"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50"
    >
      <AIPilot />
    </motion.aside>
  )}
</AnimatePresence>
```

**Warning:** Do NOT wrap virtualized list items in `motion.div` at the Virtuoso item level — this creates a new animation instance per row on every scroll event, causing jank. Animate only on mount via `initial`/`animate`; use `layoutId` only for shared element transitions (e.g. expert card expanding to detail view).

### Installation

```bash
npm install framer-motion@^12.0.0
```

**Confidence:** HIGH — version confirmed from npm (12.34.3); React 18 minimum from official changelog (v7 release notes).

---

## 4. FAISS IDSelectorBatch — Pre-filtered Vector Search

### Recommendation

**IDSelectorBatch is available in `faiss-cpu` with no additional installation.** The existing `faiss-cpu==1.13.*` (already in requirements.txt) includes Python bindings for `IDSelectorBatch` and `SearchParametersFlat`.

### API pattern for flat index pre-filtering

The existing FAISS index is `IndexFlatIP` (inner product, with normalized vectors). The IDSelectorBatch + SearchParameters pattern for flat indexes:

```python
import faiss
import numpy as np

# --- At search time, after SQLAlchemy pre-filter ---

# 1. Get candidate IDs from SQLAlchemy filter (rate, tags, etc.)
candidate_ids: list[int] = [42, 99, 301, ...]   # FAISS internal IDs (0-indexed row in index)

# 2. Build IDSelectorBatch
ids_array = np.array(candidate_ids, dtype=np.int64)
selector = faiss.IDSelectorBatch(ids_array)

# 3. Build SearchParameters — for flat (non-IVF) index use SearchParameters directly
params = faiss.SearchParameters()
params.sel = selector

# 4. Search only within the selected IDs
D, I = index.search(query_vector, k=20, params=params)
```

**Critical implementation note:** The existing FAISS index uses consecutive integer IDs (0 to N-1) that correspond to the order experts were added. If experts are ever deleted or reordered in SQLite, the FAISS IDs will drift from SQLite row IDs. The safest mapping is to maintain a Python list `faiss_id_to_expert_id: list[int]` loaded at startup alongside the index. The SQLAlchemy pre-filter returns expert database IDs; translate to FAISS IDs via this list before building IDSelectorBatch.

**For the IVF variant** (not used in production, but if migrated): use `SearchParametersIVF(sel=selector, nprobe=index.nprobe)` instead.

**Performance reality at 1,558 experts:** IDSelectorBatch on a flat index of 1,558 vectors is essentially free — FAISS will scan all 1,558 vectors and apply the selector mask. The benefit is correctness (returning only pre-filtered experts), not speed. The `<200ms` latency target is dominated by SQLAlchemy query time, not FAISS scan time at this scale.

### No installation change needed

```bash
# Already in requirements.txt — no change
faiss-cpu==1.13.*
```

**Confidence:** MEDIUM — IDSelectorBatch confirmed in faiss-cpu Python bindings from official docs and GitHub issues. The exact `SearchParameters` class name for flat indexes (vs `SearchParametersIVF` for IVF indexes) was confirmed from FAISS wiki ("Setting search parameters for one query"). The specific attribute `params.sel` confirmed from GitHub test file `tests/test_search_params.py`. Flagged MEDIUM because the exact runtime behavior on `IndexFlatIP` was not tested live.

---

## 5. SQLite FTS5 — Full-Text Search on Expert Fields

### Recommendation

**FTS5 requires no pip install — it is compiled into CPython's `sqlite3` module.** Use SQLAlchemy `text()` for all DDL and FTS5 queries. No ORM-level FTS5 support exists in SQLAlchemy; raw SQL is the only path.

### Enable pattern via SQLAlchemy

```python
from sqlalchemy import text, event
from sqlalchemy.engine import Engine

# --- On startup / migration ---

def setup_fts5(engine):
    """Create FTS5 virtual table and sync triggers. Idempotent."""
    with engine.connect() as conn:
        # 1. Create FTS5 virtual table (content= points at source table)
        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS experts_fts USING fts5(
                username,
                first_name,
                last_name,
                job_title,
                bio,
                tags,
                content='experts',        -- content table (shadow table mode)
                content_rowid='id'         -- maps to experts.id
            )
        """))

        # 2. INSERT trigger — keep FTS in sync
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS experts_fts_insert
            AFTER INSERT ON experts BEGIN
                INSERT INTO experts_fts(rowid, username, first_name, last_name, job_title, bio, tags)
                VALUES (new.id, new.username, new.first_name, new.last_name, new.job_title, new.bio, new.tags);
            END
        """))

        # 3. DELETE trigger
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS experts_fts_delete
            AFTER DELETE ON experts BEGIN
                INSERT INTO experts_fts(experts_fts, rowid, username, first_name, last_name, job_title, bio, tags)
                VALUES ('delete', old.id, old.username, old.first_name, old.last_name, old.job_title, old.bio, old.tags);
            END
        """))

        # 4. UPDATE trigger
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS experts_fts_update
            AFTER UPDATE ON experts BEGIN
                INSERT INTO experts_fts(experts_fts, rowid, username, first_name, last_name, job_title, bio, tags)
                VALUES ('delete', old.id, old.username, old.first_name, old.last_name, old.job_title, old.bio, old.tags);
                INSERT INTO experts_fts(rowid, username, first_name, last_name, job_title, bio, tags)
                VALUES (new.id, new.username, new.first_name, new.last_name, new.job_title, new.bio, new.tags);
            END
        """))

        # 5. Initial population (only if FTS table is empty)
        count = conn.execute(text("SELECT COUNT(*) FROM experts_fts")).scalar()
        if count == 0:
            conn.execute(text("""
                INSERT INTO experts_fts(rowid, username, first_name, last_name, job_title, bio, tags)
                SELECT id, username, first_name, last_name, job_title, bio, tags FROM experts
            """))

        conn.commit()
```

### FTS5 query pattern for hybrid search

```python
# In retriever — Phase 1 of hybrid search pipeline
async def fts_prefilter(query: str, session) -> list[int]:
    """Return expert IDs matching FTS5 query. Used to narrow FAISS search space."""
    # FTS5 MATCH syntax: phrases, prefix search (term*), boolean (AND/OR/NOT)
    fts_query = " OR ".join(query.split()[:5])   # naive tokenization; improve later
    rows = session.execute(
        text("""
            SELECT e.id
            FROM experts e
            JOIN experts_fts fts ON fts.rowid = e.id
            WHERE experts_fts MATCH :q
            ORDER BY rank           -- FTS5 BM25 rank (lower = better)
            LIMIT 200               -- candidate set for FAISS re-ranking
        """),
        {"q": fts_query}
    ).fetchall()
    return [row[0] for row in rows]
```

**Important notes:**
- FTS5 `content=` mode means FTS stores no data itself — it reads from `experts` table on demand. Triggers are mandatory for keeping the index current.
- `rank` in FTS5 ORDER BY is the built-in BM25 rank — lower value = more relevant (FTS5 returns negative BM25 scores).
- The `tags` column stores JSON (`["tag1", "tag2"]`). FTS5 will tokenize the JSON text including brackets. This is acceptable — brackets won't match user queries. Do NOT pre-process to strip JSON if adding FTS5 later; the tokenizer handles it.
- Test FTS5 availability at startup: `conn.execute(text("SELECT fts5('test')"))` — if this raises, SQLite was compiled without FTS5 (rare in CPython but possible in some Railway base images).

### No installation change needed

```bash
# No new package — FTS5 is in Python's built-in sqlite3
# SQLAlchemy already in requirements.txt
```

**Confidence:** MEDIUM — FTS5 availability in CPython confirmed from Python/SQLite docs. SQLAlchemy `text()` pattern for FTS5 DDL confirmed from SQLAlchemy GitHub discussion #9466 and multiple community sources. Railway SQLite FTS5 availability assumed (standard CPython wheels include it) but not verified live — add startup check.

---

## 6. Gemini Function Calling — AI Co-Pilot

### Recommendation

**Use `google-genai` (already in requirements.txt). Do NOT install `google-generativeai`** — that package is deprecated and its GitHub repo is now named `deprecated-generative-ai-python`. The `google-genai` SDK reached GA in May 2025 and is the only supported path for new Gemini features.

Function calling is fully supported in `google-genai` via `types.FunctionDeclaration` and `response.function_calls`.

### Function calling API pattern for the AI co-pilot

```python
from google import genai
from google.genai import types

# --- Function declaration for the marketplace filter tool ---

apply_filters_fn = types.FunctionDeclaration(
    name="apply_filters",
    description=(
        "Apply search filters to narrow the expert marketplace results. "
        "Call this when the user mentions rate ranges, specific domains, tags, or location."
    ),
    parameters_json_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural language search query for semantic search"
            },
            "rate_min": {
                "type": "integer",
                "description": "Minimum hourly rate in USD"
            },
            "rate_max": {
                "type": "integer",
                "description": "Maximum hourly rate in USD"
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Domain tags to filter by (e.g. ['contract law', 'ip law'])"
            }
        },
        "required": []
    }
)

tool = types.Tool(function_declarations=[apply_filters_fn])

# --- At inference time ---

async def pilot_chat(
    user_message: str,
    visible_experts: list[dict],
    client: genai.Client,
) -> dict:
    # Give the model context about what's currently visible
    context = f"The user is viewing {len(visible_experts)} experts. " \
              f"Top 3: {', '.join(e['name'] for e in visible_experts[:3])}."

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Content(role="user", parts=[types.Part(text=context)]),
            types.Content(role="user", parts=[types.Part(text=user_message)]),
        ],
        config=types.GenerateContentConfig(
            tools=[tool],
            tool_config=types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(
                    mode="AUTO"   # model decides when to call vs respond in text
                )
            ),
            temperature=0.2,
        ),
    )

    # Check if model called a function
    if response.function_calls:
        fn_call = response.function_calls[0]
        # fn_call.name == "apply_filters"
        # fn_call.args == {"query": "...", "rate_max": 150, "tags": [...]}
        return {
            "type": "function_call",
            "function": fn_call.name,
            "args": dict(fn_call.args),
        }
    else:
        return {
            "type": "text",
            "text": response.text,
        }
```

**Key notes:**
- `response.function_calls` is a list — check `if response.function_calls` before accessing `[0]`
- `fn_call.args` is a `Struct` object (protobuf) — wrap in `dict()` before JSON serialization
- Function calling mode `"AUTO"` lets the model decide. Use `"ANY"` to force a tool call (not recommended for co-pilot — sometimes plain text answers are better)
- The co-pilot receives the function call result as a frontend event and triggers a Zustand state update via `setSearchParams(fn_call.args)` — no round-trip back to Gemini needed for filter application
- `google-genai` version already in production (`1.64.*`) supports all of the above — no version change needed

### No installation change needed

```bash
# Already in requirements.txt — no change
google-genai==1.64.*
```

**Confidence:** HIGH — `FunctionDeclaration`, `response.function_calls`, and `fn_call.args` API confirmed from Google AI developer forum, googleapis/python-genai GitHub, and multiple 2025 examples. Package deprecation of `google-generativeai` confirmed from official GitHub repo rename.

---

## 7. OKLCH Colors — Tailwind v3 vs v4

### Recommendation

**Do not upgrade to Tailwind v4 for v2.0.** Stay on Tailwind v3. Use raw CSS custom properties for any OKLCH colors needed.

### The reality

| Tailwind version | OKLCH support |
|-----------------|---------------|
| v3 (current) | Not built-in. OKLCH can be used in arbitrary CSS values and `theme.extend.colors` with raw strings, but no built-in OKLCH palette. Requires PostCSS plugin for browser fallbacks. |
| v4 | Built-in native OKLCH palette. All default colors are in OKLCH. CSS variables by default. |

**Why NOT to upgrade to v4 for v2.0:**
- Tailwind v4 is a breaking change — it removes `tailwind.config.js` in favor of CSS-based config (`@import "tailwindcss"`), drops JIT mode (now always on), and changes how plugins work
- The existing Tailwind v3 config (custom colors, any plugins) would need migration
- React Router v7, Vite, and the existing component tree are tested against v3 — v4 migration risk is non-trivial
- v2.0 is a marketplace rearchitecture; a CSS framework migration adds scope and risk without feature value

**If OKLCH-like vivid colors are needed in v3:**

```css
/* globals.css — define OKLCH as CSS custom properties */
:root {
  --color-primary: oklch(65% 0.2 260);      /* vivid blue */
  --color-accent: oklch(72% 0.18 145);       /* vivid teal */
}
```

```js
// tailwind.config.js — reference CSS variables
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'oklch(var(--color-primary-l) var(--color-primary-c) var(--color-primary-h) / <alpha-value>)',
        // Simpler: just use the oklch() value directly in Tailwind arbitrary values
        // e.g. className="bg-[oklch(65%_0.2_260)]"
      }
    }
  }
}
```

**Simplest v3 approach:** Use Tailwind's arbitrary value syntax directly for OKLCH colors: `className="bg-[oklch(65%_0.2_260)]"`. No plugin, no config change. OKLCH is supported in all modern browsers (Safari 15.4+, Chrome 111+, Firefox 113+) — the Tinrate user base is assumed modern-browser.

**PostCSS fallback plugin:** Only needed if supporting Safari < 15.4. Install `@csstools/postcss-oklab-function` if required — but at this scale, browser support likely warrants no fallback.

### No installation change needed for v3 OKLCH usage

```bash
# If PostCSS fallbacks needed for older browsers only:
npm install -D @csstools/postcss-oklab-function
```

**Confidence:** HIGH — Tailwind v4 OKLCH built-in confirmed from official v4.0 blog post. v3 limitation (no built-in OKLCH palette) confirmed from official v3 color docs. Browser support for OKLCH confirmed from MDN/caniuse.

---

## New Package Summary

### Frontend additions

```bash
npm install zustand@^5.0.0 react-virtuoso@^4.18.0 framer-motion@^12.0.0
```

### Backend additions

None. All v2.0 backend features (IDSelectorBatch, FTS5, Gemini function calling) use packages already in `requirements.txt`.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@tanstack/react-virtual` | Overlaps with react-virtuoso; no advantage for this use case | `react-virtuoso` (simpler API for variable heights) |
| `react-window` / `react-virtualized` | Older generation; react-virtuoso supersedes both | `react-virtuoso` |
| `jotai` / `recoil` / `valtio` | Unnecessary — Zustand covers all v2.0 state needs with less API surface | `zustand` |
| `google-generativeai` | Deprecated package — Google has renamed its GitHub repo to `deprecated-generative-ai-python` | `google-genai` (already installed) |
| Tailwind v4 | Breaking changes to config, requires migration of existing v3 setup; no feature value for v2.0 | Tailwind v3 + OKLCH arbitrary values |
| `sqlitefts` (PyPI package) | Wraps FTS4 (older), not needed — FTS5 is available via SQLite built-in | Raw `CREATE VIRTUAL TABLE ... USING fts5` via `text()` |
| `pgvector` / ChromaDB | FAISS at 1,558 vectors needs no infrastructure change; IDSelectorBatch adds pre-filtering | `faiss-cpu` (already installed) |
| `@motionone/animation` / `motion` (npm) | This is the web animation API library, not the React framer-motion library | `framer-motion` |

---

## Version Compatibility

| Package | Version | Compatible with | Notes |
|---------|---------|-----------------|-------|
| `zustand@^5.0.0` | 5.0.10 | React 18, TypeScript 5.x | No React 19 issues; works with Vite ESM |
| `react-virtuoso@^4.18.0` | 4.18.1 | React 18, Vite | ESM-native; no special Vite config |
| `framer-motion@^12.0.0` | 12.34.3 | React 18 minimum (v7+ requirement) | ESM; tree-shakeable; no Vite config needed |
| `faiss-cpu@1.13.*` | 1.13.2 | numpy 1.x or 2.x | IDSelectorBatch included; no change |
| `google-genai@1.64.*` | 1.64.* | Gemini 2.5 Flash, function calling | GA since May 2025; `response.function_calls` available |
| Tailwind v3 (no change) | — | React 18, Vite | OKLCH via arbitrary values — no plugin needed |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `Virtuoso` (list) for variable-height grid | `VirtuosoGrid` | Only if cards are confirmed uniform fixed-height; then VirtuosoGrid offers simpler API |
| Stay on Tailwind v3 | Upgrade to Tailwind v4 | If starting a new project from scratch, v4 is the right choice; for v2.0 migration cost outweighs benefit |
| `framer-motion` for animations | CSS transitions only | If bundle size is a concern (framer-motion adds ~50KB gzip); CSS transitions are sufficient for filter state changes but cannot do spring physics for panel slide-in |
| Direct `google-genai` function calling | LangChain tool calling | If orchestrating multi-step agent chains with memory and planning; overkill for a single-tool co-pilot |
| SQLite FTS5 via triggers | Meilisearch / Typesense | If full-text search quality degrades significantly at >10K experts or if typo-tolerance becomes a priority |

---

## Sources

- [Zustand npm — version 5.0.10](https://www.npmjs.com/package/zustand) — HIGH confidence
- [Zustand persist middleware docs](https://zustand.docs.pmnd.rs/middlewares/persist) — HIGH confidence (official docs)
- [Zustand persist + slice pattern discussion #2027](https://github.com/pmndrs/zustand/discussions/2027) — MEDIUM confidence
- [react-virtuoso npm — version 4.18.1](https://www.npmjs.com/package/react-virtuoso) — HIGH confidence
- [react-virtuoso VirtuosoGrid docs](https://virtuoso.dev/react-virtuoso/virtuoso-grid/) — HIGH confidence (official docs)
- [framer-motion npm — version 12.34.3](https://www.npmjs.com/package/framer-motion) — HIGH confidence
- [Motion changelog — React 18 minimum](https://motion.dev/changelog) — HIGH confidence (official changelog)
- [FAISS IDSelectorBatch C++ API](https://faiss.ai/cpp_api/struct/structfaiss_1_1IDSelectorBatch.html) — HIGH confidence (official FAISS docs)
- [FAISS Setting search parameters wiki](https://github.com/facebookresearch/faiss/wiki/Setting-search-parameters-for-one-query) — HIGH confidence (official wiki)
- [faiss-cpu 1.13.2 on libraries.io](https://libraries.io/pypi/faiss-cpu) — HIGH confidence
- [SQLite FTS5 official docs](https://sqlite.org/fts5.html) — HIGH confidence
- [SQLAlchemy FTS5 discussion #9466](https://github.com/sqlalchemy/sqlalchemy/discussions/9466) — MEDIUM confidence (community discussion confirming text() is the only path)
- [google-genai PyPI](https://pypi.org/project/google-genai/) — HIGH confidence
- [google-generativeai deprecated GitHub](https://github.com/google-gemini/deprecated-generative-ai-python) — HIGH confidence (official deprecation)
- [Gemini function calling API — google-genai](https://ai.google.dev/gemini-api/docs/function-calling) — HIGH confidence (official docs, confirmed API shape)
- [Tailwind v4.0 blog — OKLCH built-in](https://tailwindcss.com/blog/tailwindcss-v4) — HIGH confidence (official announcement)
- [Tailwind v3 colors docs — no OKLCH built-in](https://tailwindcss.com/docs/customizing-colors) — HIGH confidence

---

*Stack research for: TCS v2.0 Expert Marketplace rearchitecture*
*Researched: 2026-02-21*
