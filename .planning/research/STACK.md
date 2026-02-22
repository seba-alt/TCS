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

---
---

# Stack Research — v2.2 Evolved Discovery Engine

**Domain:** Expert Marketplace — v2.2 feature additions only
**Researched:** 2026-02-22
**Research Mode:** Ecosystem (Subsequent Milestone — 5 specific questions)
**Confidence:** HIGH for scikit-learn Railway compat and OKLCH browser support; HIGH for t-SNE parameters; MEDIUM for Framer Motion proximity pattern (canonical approach confirmed, no v12-specific docs)

---

## Scope of This Section

Covers ONLY the five questions relevant to v2.2. The existing v2.0 production stack is unchanged. New additions:

- **Backend:** scikit-learn (t-SNE endpoint + PCA preprocessing)
- **Frontend:** OKLCH aurora aesthetics (no new packages); Motion proximity-based tag cloud (motion/react already installed)
- **Pattern:** asyncio.to_thread for atomic FAISS swap (stdlib — no new dep)

---

## Q1. scikit-learn on Railway — Version, Compatibility, Build Risk

### Recommendation

**Use `scikit-learn==1.8.0`.** It is the current stable release (December 10, 2025), supports Python 3.11–3.14, and ships **pre-built manylinux binary wheels** for Linux x86-64. No C++ compilation occurs on Railway.

### Railway compatibility breakdown

Railway uses Nixpacks to build Python services. Nixpacks installs packages via pip. The key question is whether pip can resolve a pre-built binary wheel (no build) or must compile from source (slow, risky).

scikit-learn 1.8.0 publishes these wheel files to PyPI for Python 3.11 on Linux x86-64:

```
scikit_learn-1.8.0-cp311-cp311-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl
```

Railway's Linux base image uses glibc 2.27+, which satisfies the `manylinux_2_27` requirement. pip will download this binary directly — no Cython, no C++ compiler, no build tools required.

**Build time impact:** scikit-learn 1.8.0 wheel is ~8.8 MB. It adds scipy (if not already present) and numpy (already present via faiss-cpu). scipy also ships manylinux binary wheels — no source compilation. Expect a 10–20 second increase in Railway build time, not minutes.

### scipy dependency

scikit-learn requires scipy. scipy 1.x and 2.x both ship manylinux binary wheels. The constraint in scikit-learn 1.8 is `scipy>=1.8.0,<1.16.0`. Pin to a specific version to avoid unexpected updates:

```
scikit-learn==1.8.0
scipy==1.15.1
```

scipy 1.15.1 is the current stable and satisfies scikit-learn 1.8's constraint. It also ships manylinux binary wheels for Python 3.11.

### numpy version note

numpy is already a transitive dependency (faiss-cpu, google-genai). scikit-learn 1.8.0 requires `numpy>=1.19.5`. The existing `numpy==2.2.*` in the project satisfies this. No conflict.

### requirements.txt additions

```
scikit-learn==1.8.0
scipy==1.15.1
```

**Confidence:** HIGH — scikit-learn 1.8.0 release date and Python support confirmed from [PyPI](https://pypi.org/project/scikit-learn/) and [GitHub releases](https://github.com/scikit-learn/scikit-learn/releases). manylinux_2_27 wheel availability for Python 3.11 confirmed from PyPI download page. Railway nixpacks glibc compatibility confirmed from [Railway nixpacks docs](https://docs.railway.com/reference/nixpacks). scipy constraint from [nixpkgs scikit-learn default.nix](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/python-modules/scikit-learn/default.nix).

---

## Q2. OKLCH in Target Browsers — Support and Fallback Strategy

### Recommendation

**Use OKLCH directly — no polyfill needed for the Tinrate target audience.** Provide a single CSS cascade fallback (hex before oklch) as a defensive posture; no JavaScript polyfill or PostCSS plugin required.

### Browser support as of February 2026

| Browser | Minimum version for OKLCH | Released |
|---------|--------------------------|---------|
| Chrome / Edge | 111 | March 2023 |
| Firefox | 113 | May 2023 |
| Safari | 15.4 | March 2022 |

Global support is approximately 93% (caniuse.com as of early 2026). The remaining ~7% is primarily Internet Explorer (no support, but IE usage is effectively zero for a modern SaaS product) and old Android WebView versions.

The Tinrate expert marketplace user base — professionals browsing vetted experts — will overwhelmingly use modern browsers. IE is not a support target. Chrome, Firefox, and Safari are all covered from versions shipped 2–3 years ago.

### backdrop-filter support (glassmorphism)

backdrop-filter (needed for glassmorphism surfaces) has 92% global support. It is supported in all target browsers:

- Chrome 76+
- Firefox 103+
- Safari 9+ (with `-webkit-` prefix; prefix-free since Safari 18)

### Fallback strategy for v2.2

**Two-level cascade — no JavaScript, no PostCSS plugin:**

```css
/* Level 1: hex fallback for browsers without OKLCH (ignored if OKLCH supported) */
:root {
  --aurora-1: #7c3aed;
  --aurora-2: #0ea5e9;
  --aurora-3: #10b981;
  --surface-bg: rgba(15, 15, 30, 0.7);
}

/* Level 2: OKLCH overrides — browser applies this if it understands oklch() */
@supports (color: oklch(0% 0 0)) {
  :root {
    --aurora-1: oklch(55% 0.22 290);
    --aurora-2: oklch(62% 0.18 220);
    --aurora-3: oklch(70% 0.18 160);
    --surface-bg: oklch(12% 0.02 270 / 70%);
  }
}

/* Glassmorphism: provide opaque fallback */
.glass-surface {
  background: var(--surface-bg);          /* fallback: rgba */
  border: 1px solid rgba(255,255,255,0.1);
}

@supports (backdrop-filter: blur(1px)) {
  .glass-surface {
    background: oklch(12% 0.02 270 / 40%);  /* more translucent when blur available */
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
  }
}
```

**Key rules:**
- Always define a hex/rgba fallback FIRST on the same property — browsers silently ignore `oklch()` if unsupported and use the previous valid value
- Use `@supports (color: oklch(0% 0 0))` for OKLCH-gated blocks (not strictly necessary given 93% support, but correct defensive practice)
- Use `@supports (backdrop-filter: blur(1px))` for glassmorphism blocks — this is the more useful gate since backdrop-filter has slightly lower support than OKLCH
- VIS-05 contrast requirement (≥4.5:1): test both the OKLCH path and the fallback hex path separately — the fallback surfaces must also meet contrast

### No new packages needed

```bash
# Nothing to install — OKLCH is native CSS, Tailwind v3 supports arbitrary oklch() values
# className="bg-[oklch(55%_0.22_290)]" works in Tailwind v3 JIT
```

**Confidence:** HIGH — Browser support matrix from [caniuse.com OKLCH](https://caniuse.com/mdn-css_types_color_oklch) and [MDN oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch). backdrop-filter support from [caniuse.com backdrop-filter](https://caniuse.com/css-backdrop-filter). @supports pattern from CSS spec and confirmed working in all target browsers.

---

## Q3. Framer Motion v12 — Proximity-Based Scaling Pattern

### Recommendation

**Use the `onMouseMove` + `useMotionValue` + `useTransform` + `useSpring` pattern.** This is the canonical approach for proximity-based scaling in Motion (Framer Motion) v12 — it is used in the official BuildUI Magnified Dock recipe and is the documented pattern in Motion's own examples.

Do NOT use `whileHover` for proximity effects — `whileHover` only fires on the hovered element itself, it does not respond to cursor distance. Proximity requires tracking the mouse position relative to each element's center.

### The pattern

The architecture has two levels:

**Level 1 — Container (TagCloud):** Tracks mouse X/Y position as `useMotionValue`. Passed to each tag via props or context.

**Level 2 — Each tag:** Receives a reference mouse position, calculates its center's distance from the cursor using `getBoundingClientRect()`, maps that distance through `useTransform` to a scale value, smooths it via `useSpring`.

```tsx
// TagCloud.tsx — container
import { useMotionValue } from 'motion/react'
import { useRef } from 'react'

const DISTANCE = 120  // px — cursor influence radius
const SCALE_MAX = 1.4 // scale at cursor center
const SPRING = { mass: 0.1, stiffness: 200, damping: 15 }

export function TagCloud({ tags }: { tags: string[] }) {
  const mouseX = useMotionValue(Infinity)  // Infinity = "no cursor" sentinel
  const mouseY = useMotionValue(Infinity)

  return (
    <div
      onMouseMove={(e) => {
        mouseX.set(e.clientX)
        mouseY.set(e.clientY)
      }}
      onMouseLeave={() => {
        mouseX.set(Infinity)  // reset: no cursor in area
        mouseY.set(Infinity)
      }}
      className="flex flex-wrap gap-2 p-4"
    >
      {tags.map((tag) => (
        <TagPill key={tag} tag={tag} mouseX={mouseX} mouseY={mouseY} />
      ))}
    </div>
  )
}
```

```tsx
// TagPill.tsx — individual tag with proximity scale
import { motion, useMotionValue, useTransform, useSpring, MotionValue } from 'motion/react'
import { useRef } from 'react'

const DISTANCE = 120
const SCALE_MAX = 1.4
const SPRING = { mass: 0.1, stiffness: 200, damping: 15 }

interface TagPillProps {
  tag: string
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
}

export function TagPill({ tag, mouseX, mouseY }: TagPillProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Derive distance from mouse to this pill's center
  const distance = useTransform([mouseX, mouseY], ([mx, my]: number[]) => {
    const el = ref.current
    if (!el) return Infinity
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = mx - cx
    const dy = my - cy
    return Math.sqrt(dx * dx + dy * dy)
  })

  // Map distance [0, DISTANCE] -> scale [SCALE_MAX, 1.0]
  const scaleRaw = useTransform(distance, [0, DISTANCE], [SCALE_MAX, 1.0], { clamp: true })

  // Smooth with spring physics
  const scale = useSpring(scaleRaw, SPRING)

  return (
    <motion.div
      ref={ref}
      style={{ scale }}
      onClick={() => { /* toggle selection unchanged */ }}
      className="px-3 py-1 rounded-full cursor-pointer select-none ..."
    >
      {tag}
    </motion.div>
  )
}
```

### Why this pattern over alternatives

| Approach | Works for proximity? | Notes |
|----------|---------------------|-------|
| `whileHover={{ scale: 1.2 }}` | No | Binary on/off, no distance gradient |
| `onMouseEnter` / `onMouseLeave` | No | Binary, no distance gradient |
| CSS `:hover` + `transform` | No | Binary, cannot read sibling cursor position |
| `useMotionValue` + `useTransform` + `useSpring` | Yes | Distance-continuous, spring-smoothed — canonical Motion pattern |
| `animate()` imperative API | Possible but worse | Cannot be composed into motion value pipeline; no automatic cleanup |

### Performance note for 530 tags

The `useTransform` callback inside TagPill runs on every animation frame while the mouse is in the container. With ~530 tags visible simultaneously this would be expensive — 530 getBoundingClientRect() calls per frame.

**Mitigation:** The tag cloud should show a curated subset (20–40 most common or relevant tags), not all 530. The "Everything is possible" element with quirky tags (DISC-03) is separate from the filter tags shown in DISC-01. Limit the proximate-scale cloud to 30–40 items maximum. At that count, the pattern is performant without further optimization.

If more tags are needed: debounce mouse events to ~60fps with `requestAnimationFrame`, or use CSS `will-change: transform` on each pill to promote to GPU layers.

### import path

The project already uses `motion/react` (confirmed from PROJECT.md: "motion from 'motion/react' for modals/FAB"). The import is consistent:

```typescript
import { motion, useMotionValue, useTransform, useSpring } from 'motion/react'
import type { MotionValue } from 'motion/react'
```

**No new packages needed.** `motion` (the npm package, which re-exports both the React and vanilla JS APIs) is already installed at v12.34.

**Confidence:** MEDIUM — Pattern confirmed from [BuildUI Magnified Dock recipe](https://buildui.com/recipes/magnified-dock) (uses useMotionValue + useTransform + useSpring for distance-based scaling), [Motion motion values docs](https://motion.dev/docs/react-motion-value), and [Motion useSpring docs](https://motion.dev/docs/react-use-spring). The `useTransform` with array input `[mouseX, mouseY]` is confirmed from Motion docs. Flagged MEDIUM because no v12-specific proximity tag cloud example was found with exact import paths — the BuildUI dock example uses `framer-motion` imports, but the API is identical in `motion/react` (same library, rebranded).

---

## Q4. scikit-learn t-SNE Parameters for 530 × 768

### Recommendation

**Use PCA-then-t-SNE two-stage pipeline.** Reduce 768 dimensions to 50 via PCA first, then run t-SNE on the 530×50 matrix. This is the officially documented approach for high-dimensional inputs and cuts t-SNE runtime significantly.

### Recommended parameters

```python
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import numpy as np

def compute_embedding_map(vectors: np.ndarray) -> np.ndarray:
    """
    vectors: shape (530, 768) — raw FAISS index vectors (numpy float32)
    returns: shape (530, 2)   — 2D t-SNE projection, stored in app.state
    """
    # Stage 1: PCA from 768 → 50 dims
    # PCA initialization is deterministic, fast (~0.5s for 530×768)
    pca = PCA(n_components=50, random_state=42)
    reduced = pca.fit_transform(vectors)  # shape: (530, 50)

    # Stage 2: t-SNE from 50 → 2 dims
    tsne = TSNE(
        n_components=2,
        perplexity=30,           # recommended for ~500 points; range 5-50
        max_iter=1000,           # replaces deprecated n_iter (removed in 1.7)
        learning_rate='auto',    # auto = max(N/early_exaggeration/4, 50); best practice
        init='pca',              # PCA init: more stable than random, default since sklearn 1.2
        method='barnes_hut',     # O(N log N) — appropriate for 530 points
        random_state=42,         # reproducibility
        n_jobs=1,                # single-threaded — Railway containers are typically 1-2 vCPU
    )
    embedding = tsne.fit_transform(reduced)  # shape: (530, 2)
    return embedding
```

### Parameter justification

| Parameter | Value | Justification |
|-----------|-------|---------------|
| `perplexity` | 30 | Recommended range is 5–50; 30 is the sklearn default and appropriate for N=530. Rule of thumb: perplexity ≈ sqrt(N) ≈ 23 for 530 points, so 25–35 is the sweet spot. 30 is safe. |
| `max_iter` | 1000 | Minimum is 250. 1000 is sufficient for 530 points to converge. 500 would likely suffice too, but 1000 ensures stable output. |
| `learning_rate` | `'auto'` | `'auto'` computes `max(N/early_exaggeration/4, 50)` = `max(530/12/4, 50)` ≈ `max(11, 50)` = 50. This is the correct sklearn 1.2+ best practice; replaces the old default of 200. |
| `init` | `'pca'` | PCA initialization produces more globally stable layouts than random. It is the default since sklearn 1.2. More reproducible runs. |
| `method` | `'barnes_hut'` | O(N log N) approximation — appropriate for N < 10,000. Exact method (`'exact'`) is O(N²) and slower; not needed here. |
| `random_state` | `42` | Reproducibility — t-SNE is stochastic; fixing seed ensures the same layout across container restarts. |
| `n_jobs` | `1` | Railway containers have 1-2 vCPU. t-SNE's barnes_hut implementation in sklearn is single-threaded anyway. Setting explicitly avoids surprises. |
| PCA `n_components` | `50` | Standard preprocessing dimension. Sklearn's own TSNE documentation explicitly recommends reducing to 50 with PCA before t-SNE for high-dimensional data. Preserves ≥95% variance in typical embedding spaces. |

### Startup caching pattern

t-SNE for 530×768 takes ~2–5 seconds. Compute once at startup, cache in `app.state`:

```python
# main.py — in @app.on_event("startup") or lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... existing FAISS load ...

    # Compute t-SNE embedding map (runs in thread to not block event loop)
    import asyncio
    from app.embedding_map import compute_embedding_map

    vectors = np.array(app.state.faiss_index.reconstruct_n(0, app.state.faiss_index.ntotal))
    app.state.embedding_map = await asyncio.to_thread(compute_embedding_map, vectors)

    yield
    # ... cleanup ...
```

```python
# routers/admin.py — the endpoint just reads cached state
@router.get("/admin/embedding-map")
async def get_embedding_map(request: Request, _=Depends(_require_admin)):
    embedding = request.app.state.embedding_map  # shape (530, 2)
    # Return alongside expert metadata for frontend coloring
    experts = ...  # query from DB
    return {
        "points": [
            {"x": float(embedding[i, 0]), "y": float(embedding[i, 1]),
             "username": experts[i].username, "category": experts[i].category}
            for i in range(len(experts))
        ]
    }
```

### Runtime estimate on Railway

| Stage | Time estimate |
|-------|--------------|
| PCA 768→50 (530 points) | ~0.3–0.5 seconds |
| t-SNE 50→2 (530 points, max_iter=1000) | ~2–4 seconds |
| Total at startup | ~3–5 seconds |

This is acceptable for a one-time startup computation. The endpoint itself returns in <1ms (reads from `app.state`).

**Confidence:** HIGH — Perplexity guidance from [sklearn TSNE official docs](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html) ("Larger datasets usually require a larger perplexity. Consider selecting a value between 5 and 50"). PCA preprocessing recommendation from sklearn TSNE docs ("It is highly recommended to use another dimensionality reduction method (e.g. PCA) to reduce the number of dimensions to a reasonable amount (e.g. 50) if the number of features is very high"). `max_iter` rename (from `n_iter`) confirmed from [sklearn GitHub issue #25518](https://github.com/scikit-learn/scikit-learn/issues/25518) — `n_iter` deprecated in 1.5, removed in 1.7. `learning_rate='auto'` recommended from sklearn 1.2+ docs. `init='pca'` as default since sklearn 1.2 confirmed from changelog.

---

## Q5. Additional Packages for t-SNE Endpoint

### Complete additions to requirements.txt

```
scikit-learn==1.8.0
scipy==1.15.1
```

That is the complete list. Detailed breakdown:

| Package | Already present? | Why needed | Version |
|---------|-----------------|-----------|---------|
| `scikit-learn` | No | TSNE + PCA from sklearn.manifold and sklearn.decomposition | `==1.8.0` |
| `scipy` | No (transitive of sklearn) | Required by scikit-learn; ships manylinux wheel | `==1.15.1` |
| `numpy` | Yes (faiss-cpu dep) | numpy.ndarray operations; already in requirements.txt | no change |

**What is NOT needed:**

| Avoid | Why |
|-------|-----|
| `umap-learn` | UMAP is explicitly deferred to v2.3+ in REQUIREMENTS.md due to heavy Railway dependency. Do not add for v2.2. |
| `openTSNE` | A faster t-SNE implementation but adds a separate package; sklearn t-SNE is fast enough for 530 points and avoids an extra dependency. |
| `plotly` / `matplotlib` | The t-SNE visualization is rendered in the browser (React scatter plot, INTEL-06) — not server-side. The backend returns JSON coordinates only. |
| `pandas` | Not needed; numpy arrays are sufficient for the pipeline. |

### requirements.txt diff

```diff
# Add to requirements.txt:
+ scikit-learn==1.8.0
+ scipy==1.15.1
```

**Confidence:** HIGH — Package list derived from scikit-learn 1.8.0 declared dependencies on PyPI. umap-learn exclusion from REQUIREMENTS.md explicit decision. No additional packages needed beyond sklearn + its required scipy.

---

## v2.2 Summary

### Backend additions (requirements.txt)

```
scikit-learn==1.8.0
scipy==1.15.1
```

### Frontend additions

None. All v2.2 frontend features use already-installed packages:
- OKLCH aurora: native CSS (no package)
- Glassmorphism: native CSS (no package)
- Animated tag cloud proximity: `motion/react` already at v12.34
- Framer Motion layout animations for tag cloud: `motion/react` already installed
- Easter egg barrel roll: `motion/react` already installed

### asyncio.to_thread for atomic FAISS swap (IDX-02, IDX-03)

This uses Python stdlib only — `asyncio.to_thread` is available in Python 3.9+. No new package required.

```python
import asyncio
import faiss

async def rebuild_faiss_index(app_state):
    """Rebuild FAISS index in thread, swap atomically. IDX-02 + IDX-03."""
    def _rebuild():
        # Heavy CPU work in thread — does not block event loop
        new_index = faiss.IndexFlatIP(768)
        # ... build new index from DB vectors ...
        return new_index

    new_index = await asyncio.to_thread(_rebuild)
    # Atomic swap — Python GIL ensures this assignment is thread-safe
    app_state.faiss_index = new_index
```

### newsletter_subscribers table (NLTR-02)

SQLite table addition — uses existing SQLAlchemy + SQLite stack. No new package.

```python
class NewsletterSubscriber(Base):
    __tablename__ = "newsletter_subscribers"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    source = Column(String, default="profile_gate")
```

---

## Version Compatibility — v2.2 additions

| Package | Version | Compatible with | Notes |
|---------|---------|-----------------|-------|
| `scikit-learn` | 1.8.0 | Python 3.11, numpy 2.2.* | manylinux wheel; no compile on Railway |
| `scipy` | 1.15.1 | Python 3.11, numpy 2.2.* | manylinux wheel; satisfies sklearn 1.8 constraint |
| OKLCH CSS | native | Chrome 111+, Firefox 113+, Safari 15.4+ | ~93% global support; hex fallback for rest |
| `motion/react` proximity | v12.34 (existing) | React 19, TypeScript 5.9 | useMotionValue + useTransform + useSpring pattern |
| `asyncio.to_thread` | stdlib | Python 3.9+ (Railway uses 3.11) | No package needed |

---

## What NOT to Add for v2.2

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `umap-learn` | Explicitly deferred to v2.3+; heavy build dep on Railway | scikit-learn t-SNE (good enough for 530 points) |
| `openTSNE` | Extra dep; sklearn's barnes_hut is fast enough for N=530 | `sklearn.manifold.TSNE` |
| `@csstools/postcss-oklab-function` | No polyfill needed — 93% OKLCH browser support, target users are modern-browser | Native CSS + hex cascade fallback |
| `plotly` / `matplotlib` | Visualization is browser-side (React); backend returns JSON coordinates | React scatter plot (e.g. recharts or plain SVG) |
| `motion` (npm, separate package) | Already available via `framer-motion` which re-exports `motion/react` | Import from `'motion/react'` (already in package.json) |

---

## Sources — v2.2

- [scikit-learn PyPI — version 1.8.0](https://pypi.org/project/scikit-learn/) — HIGH confidence (current stable)
- [scikit-learn GitHub releases](https://github.com/scikit-learn/scikit-learn/releases) — HIGH confidence (December 2025 release)
- [sklearn TSNE docs 1.8](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html) — HIGH confidence (parameter reference)
- [sklearn n_iter deprecation issue #25518](https://github.com/scikit-learn/scikit-learn/issues/25518) — HIGH confidence (rename timeline)
- [Railway nixpacks docs](https://docs.railway.com/reference/nixpacks) — MEDIUM confidence (build process)
- [caniuse OKLCH](https://caniuse.com/mdn-css_types_color_oklch) — HIGH confidence (93% browser support)
- [MDN oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch) — HIGH confidence (official spec)
- [caniuse backdrop-filter](https://caniuse.com/css-backdrop-filter) — HIGH confidence (92% support)
- [BuildUI Magnified Dock](https://buildui.com/recipes/magnified-dock) — MEDIUM confidence (canonical proximity pattern; framer-motion imports, same API as motion/react)
- [Motion useTransform docs](https://motion.dev/docs/react-use-transform) — HIGH confidence (official Motion docs)
- [Motion useSpring docs](https://motion.dev/docs/react-use-spring) — HIGH confidence (official Motion docs)
- [Motion motion values docs](https://motion.dev/docs/react-motion-value) — HIGH confidence (official Motion docs)
- [sklearn t-SNE perplexity example](https://scikit-learn.org/stable/auto_examples/manifold/plot_t_sne_perplexity.html) — HIGH confidence (official example)
- [sklearn t-SNE PCA preprocessing guidance](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html) — HIGH confidence ("highly recommended to use PCA" quote is in official docs)

---

*Stack research for: TCS v2.2 Evolved Discovery Engine — additive section*
*Researched: 2026-02-22*
