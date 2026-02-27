# Phase 48: Admin Features and Industry Tags - Research

**Researched:** 2026-02-27
**Domain:** Admin dashboard enhancements, CSV data export/import, industry taxonomy, tag cloud extension, Zustand store extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lead export content:**
- Export includes ALL search queries and ALL profile clicks per lead (not truncated)
- Each query/click paired with its timestamp — useful for recency and intent analysis
- CSV columns: lead info + timestamped queries + timestamped profile clicks

**Industry tag taxonomy:**
- Use a standard industry taxonomy (simplified NAICS or GICS) adapted for this use case
- Auto-assign industry tags from job titles, companies, and bio text as a starting point
- Admin can override or correct auto-assigned tags through the admin panel
- Experts can have 1-3 industry tags (supports multi-industry consultants like fintech = Finance + Tech)
- Industry tags appear in their own separate labeled section in the tag cloud, visually distinct from domain tags
- Industry filters apply independently of domain tag filters

**CSV import flow:**
- Drag-and-drop zone upload UI with option to click and browse
- Preview rows shown before confirming import
- Column mapping UI after upload — admin matches CSV columns to expected fields
- Auto-regenerate embeddings and rebuild FAISS index after successful import

**Overview stat cards:**
- New stat cards placed in a top row above existing Sage volume stats
- Cards: Total Leads, Expert Pool, Top Searches (top 3-5 queries), Conversion Rate (% visitors → leads)
- Each card shows count + 7-day trend indicator (up/down arrow with delta vs previous 7-day period)

### Claude's Discretion
- CSV format for multi-value fields (semicolon-separated vs one-row-per-event)
- Date range filter on lead export (include or skip)
- Partial failure handling on CSV import (import valid + skip bad, or all-or-nothing)
- Exact industry list derived from standard taxonomy
- Auto-tagging algorithm (keyword matching vs LLM inference)
- Stat card visual design and refresh behavior

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADM-01 | Dashboard shows one-snap overview with key stats (Total Leads, Expert Pool, Sage volume) | New backend `/api/admin/stats` fields + new frontend stat card row in OverviewPage |
| ADM-02 | Admin can export leads as CSV including their search queries and card clicks | New backend endpoint `/api/admin/export/leads.csv`; requires joining `conversations` + `user_events` per email |
| ADM-05 | Admin can bulk import experts via improved CSV upload flow | Replace hidden `<input type="file">` with drag-and-drop zone + preview + column mapping multi-step UI |
| DISC-01 | Industry-level tags (e.g. Finance, Healthcare, Tech) added alongside domain tags | New `industry_tags` JSON column on `Expert` model; new INDUSTRY_TAGS constant; keyword auto-assign in admin.py |
| DISC-02 | Industry tags visible in tag cloud as a separate section | TagCloud split into two labeled sections; `industryTags` state in filterSlice |
| DISC-03 | User can filter experts by industry tags | Backend `explore.py` extends tag filter to accept industry tags as OR-matched section; frontend passes `industry_tags` query param independently |
</phase_requirements>

---

## Summary

Phase 48 modifies six files on the backend and at least seven on the frontend. None of the features require new third-party libraries — everything is achievable with the existing stack (FastAPI + SQLAlchemy + SQLite + React + Zustand + Tailwind + motion/react).

The highest-complexity item is the **improved CSV import flow** (ADM-05): it needs a multi-step UI (upload → preview → column-map → confirm) and a backend that auto-triggers the FAISS rebuild after a confirmed import. The rebuild mechanism already exists (`/api/admin/ingest/run`) and the current single-step CSV import endpoint (`POST /api/admin/experts/import-csv`) needs to be expanded with a preview/mapping layer.

The **industry tags** (DISC-01/02/03) require: (a) a DB schema migration adding an `industry_tags` column to `experts`, (b) an auto-assign helper using the existing `CATEGORY_KEYWORDS` dict pattern, (c) a `INDUSTRY_TAGS` constant in the frontend, (d) a new `industryTags` slice in the Zustand store (STATE.md: "separate `industryTags: string[]` field in filterSlice, never share array with domain tags"), and (e) a backend query param extension on `/api/explore`.

**Primary recommendation:** Implement in four focused plans: (1) lead export CSV endpoint + UI button, (2) overview stat cards + trend data, (3) improved CSV import flow (multi-step), (4) industry tags DB + backend + frontend.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | current (Railway) | New backend endpoints | Already in use; StreamingResponse for CSV |
| SQLAlchemy | current | DB queries for stats/export/import | Already in use |
| SQLite | current | Persistent storage | Already in use; WAL mode |
| React + Vite + Tailwind | current | Admin UI enhancements | Already in use |
| Zustand | current | State management for industryTags slice | Already in use; pattern established in filterSlice.ts |
| motion/react | current | Tag cloud animation | Already in use in TagCloud.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| csv (stdlib) | stdlib | CSV generation in backend | StreamingResponse already used for other exports |
| io.StringIO | stdlib | In-memory CSV buffer | Already used in admin.py exports |
| react-dropzone | NOT needed | Could power drag-and-drop | **Do not add** — HTML5 drag-and-drop is sufficient and already used via `<input type="file">` drag target |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keyword auto-assign for industry tags | Gemini LLM inference | Keyword is instant and deterministic; LLM adds latency and cost for a taxonomy with only 10-12 fixed values |
| Semicolon-separated for multi-value CSV fields | One-row-per-event (long format) | Semicolon keeps one row per lead; long format is easier to analyze in Excel but explodes row count |
| Custom drag-drop zone | react-dropzone | No new dependency needed; HTML5 drag events on a div suffice |

**Installation:**
No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

New and modified files for this phase:

```
Backend:
  app/routers/admin.py              — ADD: /export/leads.csv, /stats/overview (extended), /experts/preview-csv
  app/models.py                     — ADD: industry_tags column on Expert
  app/services/explorer.py          — EXTEND: handle industry_tags query param

Frontend:
  frontend/src/admin/pages/OverviewPage.tsx          — ADD: stat card row (Total Leads, Expert Pool, etc.)
  frontend/src/admin/pages/LeadsPage.tsx             — ADD: "Export CSV" button
  frontend/src/admin/pages/ExpertsPage.tsx           — REPLACE: file input with multi-step import modal
  frontend/src/admin/components/CsvImportModal.tsx   — NEW: drag-drop + preview + column-map modal
  frontend/src/store/filterSlice.ts                  — ADD: industryTags, toggleIndustryTag, resetIndustryTags
  frontend/src/constants/industryTags.ts             — NEW: INDUSTRY_TAGS constant list
  frontend/src/components/sidebar/TagCloud.tsx       — EXTEND: second labeled section for industry tags
  frontend/src/components/sidebar/FilterSidebar.tsx  — EXTEND: "Industry" section label
  frontend/src/components/marketplace/MobileInlineFilters.tsx — EXTEND: industry tags in tag picker
  frontend/src/pages/MarketplacePage.tsx             — EXTEND: pass industryTags to /api/explore
```

### Pattern 1: Lead Export CSV — One Row Per Lead, Timestamped Multi-Values
**What:** Each lead = one CSV row. Queries serialized as semicolon-separated `timestamp|query` pairs. Card clicks as `timestamp|expert_id` pairs. This keeps the file compact while preserving temporal data.
**When to use:** When the admin needs to analyze behavior sequences per lead in a spreadsheet.

```python
# Source: existing pattern in admin.py export_searches_csv / export_newsletter_csv
# New endpoint: GET /api/admin/export/leads.csv
@router.get("/export/leads.csv")
def export_leads_csv(db: Session = Depends(get_db)):
    # Fetch all conversations ordered by email, then created_at asc
    rows = db.scalars(
        select(Conversation).order_by(Conversation.email, Conversation.created_at.asc())
    ).all()

    # Fetch all card_click events ordered by session_id then created_at
    # NOTE: card_clicks are in user_events, linked by session_id NOT email
    # We can join on email from conversations sharing session, OR export per email
    # Simplest: group conversations by email, export queries+timestamps
    # Card clicks come from user_events where event_type='card_click' —
    # These are NOT linked by email directly, only by session_id
    # Decision: export queries with timestamps from conversations table,
    # export card clicks from user_events (session_id basis, not email basis)
    # → Use "all queries per email" from conversations + all events from user_events

    leads: dict[str, dict] = {}
    for row in rows:
        email = row.email
        if email not in leads:
            leads[email] = {"email": email, "queries": [], "last_active": None}
        leads[email]["queries"].append(f"{row.created_at.isoformat()}|{row.query}")
        leads[email]["last_active"] = row.created_at.isoformat()

    # Card clicks are not directly email-keyed — export as separate section or skip
    # → Recommended: include card clicks from user_events grouped by session
    # but without email linkage, skip card clicks in this phase (ADM-02 says "profile clicks")
    # → If LeadRow has session_id correlation, use it; otherwise queries only

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Total leads", len(leads)])
    writer.writerow([])
    writer.writerow(["email", "last_active", "total_queries", "queries_timestamped", "card_clicks_timestamped"])
    for lead in leads.values():
        writer.writerow([
            lead["email"],
            lead["last_active"],
            len(lead["queries"]),
            "; ".join(lead["queries"]),
            "",  # card clicks — see Open Questions
        ])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", ...)
```

### Pattern 2: Overview Stat Cards with 7-Day Trend
**What:** The existing `/api/admin/stats` endpoint returns aggregate data without trend deltas. New endpoint or extension adds Total Leads, Expert Pool count, and 7-day vs prior-7-day comparison.
**When to use:** Adding new stat cards to OverviewPage.

```python
# Extend GET /api/admin/stats to include new fields, OR add GET /api/admin/overview-stats
# Recommended: add to existing /stats to avoid a second fetch on OverviewPage

# New fields to add to /stats response:
# total_leads: db.scalar(select(func.count(func.distinct(Conversation.email))).select_from(Conversation))
# expert_pool: db.scalar(select(func.count()).select_from(Expert).where(Expert.first_name != ""))
# leads_7d: count of distinct emails with created_at in last 7 days
# leads_prior_7d: count of distinct emails with created_at in 8-14 days ago (for trend delta)
# top_queries already exists — slice [0:5] in frontend for "Top Searches" card
# conversion_rate: (total_leads / total_unique_visitors) — requires visitor tracking
#   NOTE: Visitor tracking is not in current schema — skip or compute as leads/total_searches
```

```typescript
// Frontend StatCard with trend indicator (HIGH confidence — existing pattern in OverviewPage.tsx)
// The existing StatCard component in OverviewPage.tsx does NOT have trend arrows
// Need to extend or replace with a TrendStatCard:
function TrendStatCard({
  label, value, delta, deltaLabel
}: { label: string; value: number; delta: number; deltaLabel: string }) {
  const isUp = delta > 0
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      <div className="flex items-center gap-1 mt-1">
        <span className={`text-xs font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '↑' : '↓'} {Math.abs(delta)}
        </span>
        <span className="text-xs text-slate-500">{deltaLabel}</span>
      </div>
    </div>
  )
}
```

### Pattern 3: Industry Tags — DB Column + Auto-Assign
**What:** New `industry_tags` column on Expert (JSON list, 1-3 values). Auto-assign via keyword matching on job_title, similar to existing `CATEGORY_KEYWORDS` / `_auto_categorize()` in admin.py.
**When to use:** Adding industry taxonomy to Expert model.

```python
# app/models.py — add to Expert class:
industry_tags: Mapped[str | None] = mapped_column(Text, nullable=True)
# Stored as JSON list: '["Finance", "Tech"]' or null

# app/routers/admin.py — new constant alongside CATEGORY_KEYWORDS:
INDUSTRY_TAGS = [
    "Finance", "Technology", "Healthcare", "Real Estate", "Marketing",
    "Sales", "Operations", "Legal", "HR", "Strategy", "Sports", "Media",
]

INDUSTRY_KEYWORDS = {
    "Finance":     ["finance", "cfo", "accountant", "banker", "investment", "fintech", "trading", "corporate finance", "private equity", "venture capital"],
    "Technology":  ["engineer", "developer", "cto", "software", "data", "ai", "ml", "saas", "product", "web", "devops", "tech"],
    "Healthcare":  ["health", "medical", "doctor", "pharma", "wellness", "biotech"],
    "Real Estate": ["real estate", "property", "construction", "renovation", "architecture"],
    "Marketing":   ["marketing", "cmo", "brand", "social media", "growth", "seo", "content", "digital marketing"],
    "Sales":       ["sales", "revenue", "business development", "account management"],
    "Operations":  ["operations", "coo", "supply chain", "logistics", "procurement", "process"],
    "Legal":       ["legal", "lawyer", "attorney", "compliance", "gdpr", "regulatory"],
    "HR":          ["hr", "human resources", "recruiter", "talent", "coaching", "people"],
    "Strategy":    ["strategy", "consulting", "advisor", "entrepreneur", "founder", "ceo", "board"],
    "Sports":      ["sport", "football", "fitness", "athlete", "coach", "esports"],
    "Media":       ["media", "journalism", "publishing", "entertainment", "film", "music"],
}

def _auto_industry_tags(job_title: str, bio: str = "", company: str = "") -> list[str]:
    """Return up to 3 matching industry tags from job title + bio + company."""
    text = f"{job_title} {bio} {company}".lower()
    matched = []
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            matched.append(industry)
        if len(matched) == 3:
            break
    return matched
```

### Pattern 4: Extend `/api/explore` for Industry Tag Filtering
**What:** The existing `tags` query param uses AND logic (expert must have ALL domain tags). Industry tags use independent OR-within-industry + AND-with-domain-tags logic. Simplest: separate `industry_tags` query param that filters `Expert.industry_tags` JSON column.
**When to use:** Extending explore service for DISC-03.

```python
# app/routers/explore.py — add industry_tags query param:
@router.get("/api/explore", response_model=ExploreResponse)
async def explore(
    ...
    industry_tags: str = Query(default=""),  # comma-separated industry tags
) -> ExploreResponse:
    industry_tag_list = [t.strip() for t in industry_tags.split(",") if t.strip()]
    ...

# app/services/explorer.py — run_explore() signature:
def run_explore(
    query, rate_min, rate_max, tags, industry_tags, limit, cursor, db, app_state
) -> ExploreResponse:
    # Stage 1 pre-filter — add industry tag filter (OR logic within section):
    for itag in industry_tags:
        stmt = stmt.where(Expert.industry_tags.like(f'%"{itag}"%'))
    # Note: using AND across industry tags is acceptable per requirements
    # (DISC-03: "apply independently of domain tag filters" — means separate param, not OR-within)
```

### Pattern 5: Multi-Step CSV Import Modal (ADM-05)
**What:** Replace the hidden `<input type="file">` + instant upload with a multi-step modal: (1) Drag-drop zone or click-to-browse, (2) Preview first N rows, (3) Column mapping UI, (4) Confirm → upload → show result + trigger FAISS rebuild.
**When to use:** Building CsvImportModal.tsx.

```typescript
// frontend/src/admin/components/CsvImportModal.tsx
// State machine: 'idle' | 'preview' | 'mapping' | 'importing' | 'done' | 'error'
//
// Step 1 (idle → preview):
//   - Drop zone div with onDrop + onDragOver handlers
//   - <input type="file" accept=".csv"> click target
//   - Parse CSV in browser using FileReader + manual CSV split (no papa-parse needed)
//   - Show first 5 rows in a table
//
// Step 2 (preview → mapping):
//   - Auto-detect columns matching expected field names (case-insensitive)
//   - <select> per expected field for user override
//   - Expected fields: Username, First Name, Last Name, Job Title, Company, Bio, Hourly Rate
//
// Step 3 (mapping → importing):
//   - POST to /api/admin/experts/import-csv with file
//   - On success: auto-trigger /api/admin/ingest/run (FAISS rebuild)
//   - Poll /api/admin/ingest/status until done
//   - Show result: N inserted, N updated, N skipped

// Drag-and-drop HTML5 pattern (no library needed):
function handleDrop(e: React.DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer.files?.[0]
  if (file && file.name.endsWith('.csv')) processFile(file)
}
```

### Pattern 6: Industry TagCloud Section
**What:** TagCloud.tsx currently renders one flat section of domain tags from `TOP_TAGS`. Extend to render a second labeled section with industry tags from `INDUSTRY_TAGS` constant, using the same TagPill component.
**When to use:** Extending TagCloud.tsx for DISC-02.

```typescript
// frontend/src/constants/industryTags.ts — new file:
export const INDUSTRY_TAGS = [
  'Finance', 'Technology', 'Healthcare', 'Real Estate', 'Marketing',
  'Sales', 'Operations', 'Legal', 'HR', 'Strategy', 'Sports', 'Media',
]

// frontend/src/store/filterSlice.ts — extend FilterSlice:
// Per STATE.md decision: "separate `industryTags: string[]` field in filterSlice,
//                          never share array with domain tags"
interface FilterSlice {
  // ... existing fields ...
  industryTags: string[]
  toggleIndustryTag: (tag: string) => void
  resetIndustryTags: () => void
}

// TagCloud.tsx — add second section:
export function TagCloud() {
  const toggleTag = useExplorerStore((s) => s.toggleTag)
  const tags = useExplorerStore((s) => s.tags)
  const toggleIndustryTag = useExplorerStore((s) => s.toggleIndustryTag)
  const industryTags = useExplorerStore((s) => s.industryTags)

  // ... existing domain tag rendering ...

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-3">
        {/* Domain tags — existing section */}
        <div className="flex flex-wrap gap-2" ...>
          {/* existing TagPills */}
        </div>

        {/* Industry tags — new labeled section */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1.5">Industry</p>
          <div className="flex flex-wrap gap-2" ...>
            {INDUSTRY_TAGS.map((tag) => (
              <TagPill
                key={tag}
                tag={tag}
                isSelected={industryTags.includes(tag)}
                ...
                onToggle={() => toggleIndustryTag(tag)}
              />
            ))}
          </div>
        </div>
      </div>
    </LayoutGroup>
  )
}
```

### Anti-Patterns to Avoid
- **Sharing `tags` array with `industryTags`:** STATE.md explicitly locks this — never merge domain + industry tags into one array. The explore API must accept two separate params.
- **Modifying existing `/api/admin/stats` response shape without adding fields:** OverviewPage.tsx destructures specific fields from `stats`; breaking the shape will crash the page. Add new fields rather than rename.
- **Triggering FAISS rebuild inline with CSV upload:** The rebuild takes 30-120 seconds. Fire it via `POST /api/admin/ingest/run` (background thread) after the DB upsert commits, then poll status as ExpertsPage already does.
- **Building a CSV parser from scratch:** For the preview step in the browser, `FileReader` + `text.split('\n').map(line => line.split(','))` is sufficient for a 5-row preview. Avoid adding papa-parse for this.
- **Adding industry_tags to the existing `tags` JSON column:** The `tags` column stores AI-generated domain tags. Industry tags need their own `industry_tags` column to remain independently queryable and separable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV streaming from backend | Custom chunk writer | `io.StringIO` + `StreamingResponse(iter([buf.getvalue()]))` | Already used in 5 export endpoints in admin.py |
| Background FAISS rebuild after import | Inline subprocess call | `POST /api/admin/ingest/run` + poll `/api/admin/ingest/status` | Already implemented; ExpertsPage already polls this |
| Drag-and-drop file upload | react-dropzone | HTML5 `onDrop` / `onDragOver` on a styled div | No dependency needed; existing file input pattern in ExpertsPage covers 95% of the behavior |
| Industry tag inference | Custom NLP | Keyword matching against `INDUSTRY_KEYWORDS` dict | Same approach as existing `CATEGORY_KEYWORDS` / `_auto_categorize()`; deterministic, instant, zero cost |
| Store persistence for industryTags | Custom localStorage hook | Zustand `persist` partialize extension | Store already uses persist middleware; just add `industryTags` to `partialize` |

**Key insight:** Every technical pattern needed in this phase already exists in the codebase. The work is extension and composition, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Card Clicks Not Linked to Email
**What goes wrong:** ADM-02 requires "card clicks per lead" in the export. But card clicks are stored in `user_events` table keyed by `session_id`, NOT by email. The `Conversation` table has email; `UserEvent` does not.
**Why it happens:** The email gate (email capture) and the event tracking (card clicks) use different identifiers. Sessions are not persisted against emails.
**How to avoid:** For the first implementation, export leads CSV with queries-per-email from `conversations` table only. For card clicks, either (a) include all `card_click` events as a separate aggregate (total clicks per session, not per email), or (b) add session_id to Conversation at email gate time (out of scope for this phase per REQUIREMENTS.md LEAD-01). Document this limitation clearly.
**Warning signs:** Trying to JOIN `conversations.email` with `user_events.session_id` will produce no results without a session→email mapping table that does not exist.

### Pitfall 2: Expert.industry_tags Column Missing on First Deploy
**What goes wrong:** Adding `industry_tags` to `Expert` model without a migration script causes `OperationalError: table experts has no column named industry_tags` on Railway.
**Why it happens:** SQLAlchemy `Base.metadata.create_all()` in main.py only creates new tables, does not ALTER existing ones.
**How to avoid:** Add an Alembic migration OR use the startup migration pattern already used in the codebase. Check `main.py` startup hook for the ALTER TABLE approach used in prior phases.
**Warning signs:** Railway logs show `OperationalError` on startup; admin experts endpoint returns 500.

### Pitfall 3: `explorer.py` Call Sites Not Updated
**What goes wrong:** Adding `industry_tags` param to `run_explore()` signature without updating the Search Lab call in `admin.py` (`_explore_for_lab()`) causes `TypeError: run_explore() missing argument`.
**Why it happens:** `run_explore()` is called from two places: `explore.py` router and `admin.py` `_explore_for_lab()`.
**How to avoid:** Add `industry_tags=[]` as default parameter, then update both call sites.
**Warning signs:** Search Lab A/B compare endpoint returns 500 after the change.

### Pitfall 4: FilterSlice Persist Version Not Bumped
**What goes wrong:** Adding `industryTags` to Zustand persist partialize without bumping `version` causes existing users' persisted state (missing `industryTags`) to hydrate successfully but with undefined behavior.
**Why it happens:** Zustand persist `migrate` function is not defined; old persisted state missing new keys loads as-is.
**How to avoid:** Bump `version: 1` to `version: 2` in `store/index.ts` and add a migrate function that seeds `industryTags: []` for v1 → v2 upgrade.
**Warning signs:** Console errors about undefined `.includes()` on `industryTags` for returning users.

### Pitfall 5: CSV Import Preview Breaks on Quoted Fields
**What goes wrong:** Manual CSV split with `line.split(',')` breaks on quoted fields containing commas (e.g., `"Smith, John"` in a name field).
**Why it happens:** The basic split does not handle RFC 4180 quoting.
**How to avoid:** For the preview-only step (5 rows), use a minimal regex-based splitter or just show raw line previews without splitting. The actual import is done server-side where Python's `csv.DictReader` handles quoting correctly.
**Warning signs:** Preview table shows garbled data for experts with commas in their name/bio.

### Pitfall 6: Stat Card Conversion Rate Has No Visitor Baseline
**What goes wrong:** "Conversion Rate (% visitors → leads)" cannot be computed — there is no visitor count in the DB. The closest metric is unique emails in conversations divided by total conversation rows.
**Why it happens:** The codebase tracks searches (email-gated) and events (session-based) but has no "page view" concept.
**How to avoid:** Define Conversion Rate as `(distinct emails in conversations) / (total conversation rows)` — this is "% of searches made by a named lead" which is a reasonable proxy. Label it "Lead Rate" rather than "Conversion Rate" to avoid confusion.
**Warning signs:** Attempting to query a `page_views` table or `pageview` event type that does not exist.

---

## Code Examples

Verified patterns from existing codebase:

### Existing CSV StreamingResponse Pattern (HIGH confidence)
```python
# Source: admin.py export_newsletter_csv (line 720-747)
buf = io.StringIO()
writer = csv.writer(buf)
writer.writerow(["# Export date", date.today().isoformat()])
writer.writerow(["# Total rows", len(rows)])
writer.writerow([])
writer.writerow(["email", "created_at", "source"])
for r in rows:
    writer.writerow([r.email, r.created_at.isoformat(), r.source])
filename = f"newsletter-subscribers-{date.today().isoformat()}.csv"
return StreamingResponse(
    iter([buf.getvalue()]),
    media_type="text/csv",
    headers={"Content-Disposition": f"attachment; filename={filename}"},
)
```

### Existing Frontend CSV Download Pattern (HIGH confidence)
```typescript
// Source: LeadsPage.tsx downloadNewsletterCsv() (line 36-50)
function downloadLeadsCsv() {
  const adminToken = sessionStorage.getItem('admin_token') || ''
  fetch(`${API_URL}/api/admin/export/leads.csv`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
}
```

### Existing Tag Filter in explorer.py (HIGH confidence)
```python
# Source: explorer.py run_explore() (line 177-178)
for tag in tags:
    stmt = stmt.where(Expert.tags.like(f'%"{tag.lower()}"%'))
# Same pattern applies to industry_tags:
for itag in industry_tags:
    stmt = stmt.where(Expert.industry_tags.like(f'%"{itag}"%'))
```

### Existing Ingest Trigger + Poll in ExpertsPage.tsx (HIGH confidence)
```typescript
// Source: ExpertsPage.tsx handleCsvUpload() and auto-refresh (line 178-204)
// After import, trigger rebuild:
await triggerRun('/ingest/run')  // starts background job, begins polling
// Auto-refresh on completion:
useEffect(() => {
  if (ingest.status === 'done') refetch()
}, [ingest.status, refetch])
```

### Distinct Email Count for Total Leads (HIGH confidence)
```python
# SQLAlchemy distinct count pattern:
from sqlalchemy import func, distinct
total_leads = db.scalar(
    select(func.count(distinct(Conversation.email))).select_from(Conversation)
) or 0
# 7-day window:
cutoff = datetime.utcnow() - timedelta(days=7)
leads_7d = db.scalar(
    select(func.count(distinct(Conversation.email)))
    .where(Conversation.created_at >= cutoff)
) or 0
```

### Zustand Slice Extension Pattern (HIGH confidence)
```typescript
// Source: filterSlice.ts pattern — extend FilterSlice interface and createFilterSlice
// New fields to add:
industryTags: string[]
toggleIndustryTag: (tag: string) => void
resetIndustryTags: () => void

// In createFilterSlice:
industryTags: [],
toggleIndustryTag: (tag) => {
  set((state) => ({
    industryTags: state.industryTags.includes(tag)
      ? state.industryTags.filter((t) => t !== tag)
      : [...state.industryTags, tag],
  }))
},
resetIndustryTags: () => set({ industryTags: [] }),

// In store/index.ts partialize — add industryTags to persisted fields:
partialize: (state) => ({
  query: state.query, rateMin: state.rateMin, rateMax: state.rateMax,
  tags: state.tags, industryTags: state.industryTags,  // ADD THIS
  sortBy: state.sortBy, sortOrder: state.sortOrder, viewMode: state.viewMode,
}),
// ALSO bump version: 2 and add migrate:
version: 2,
migrate: (persistedState: unknown, version: number) => {
  if (version === 1) return { ...(persistedState as object), industryTags: [] }
  return persistedState
},
```

---

## State of the Art

| Old Approach | Current Approach | Impact on This Phase |
|--------------|------------------|----------------------|
| Hidden `<input type="file">` + immediate upload | Multi-step modal (drag-drop → preview → map → confirm) | ADM-05 replaces ExpertsPage.tsx's handleCsvUpload with CsvImportModal |
| Single-dimension tag cloud (domain only) | Two-section tag cloud (domain + industry) | DISC-02: TagCloud.tsx extended, not replaced |
| `tags` param only on `/api/explore` | `tags` + `industry_tags` as separate params | DISC-03: two independent filter dimensions |

---

## Open Questions

1. **Card clicks in lead export (ADM-02)**
   - What we know: `user_events.card_click` records are keyed by `session_id`, not email. `Conversation` records are keyed by email.
   - What's unclear: Is there any session→email mapping in the DB that can join these tables?
   - Recommendation: On first implementation, export queries-only from `conversations` table. Add a note to the CSV: "Card clicks not included — no session-to-email mapping in current schema." Mark LEAD-01 (card click attribution) as the proper fix in v4.1.

2. **DB migration for `industry_tags` column**
   - What we know: `app/models.py` has `Expert` class; Railway SQLite uses `Base.metadata.create_all()` on startup (ADD TABLE only, not ALTER).
   - What's unclear: Does the codebase have an existing ALTER TABLE startup migration pattern, or does each phase that adds columns ship an Alembic migration?
   - Recommendation: Check `main.py` startup code for `ALTER TABLE` patterns from prior phases before choosing approach. If no pattern exists, add a startup migration function: `db.execute(text("ALTER TABLE experts ADD COLUMN industry_tags TEXT"))` wrapped in try/except for idempotency.

3. **Conversion Rate definition (ADM-01)**
   - What we know: No page-view tracking exists. Leads = distinct emails in conversations.
   - What's unclear: User may expect "% of page visitors who became leads" (requires GA4 data).
   - Recommendation: Use "Lead Rate = distinct_emails / total_searches" and label the card "Lead Rate" not "Conversion Rate." Add tooltip explaining the metric.

4. **Industry tags and FAISS/embedding alignment**
   - What we know: DISC-01 adds `industry_tags` for filtering; domain `tags` are used for FAISS embedding quality (findability_score).
   - What's unclear: Should industry tags be included in the text that gets embedded for FAISS (to improve semantic search for "find me a fintech expert")?
   - Recommendation: Do NOT include industry_tags in the embedding text for this phase. Embeddings are managed by `scripts/ingest.py` and changing the embedding strategy is separate scope. Industry tags are a filter-only feature in Phase 48.

---

## Sources

### Primary (HIGH confidence)
- `/Users/sebastianhamers/Documents/TCS/app/routers/admin.py` — existing endpoints, CSV export patterns, CATEGORY_KEYWORDS, import-csv endpoint
- `/Users/sebastianhamers/Documents/TCS/app/models.py` — Expert schema, Conversation schema, UserEvent schema
- `/Users/sebastianhamers/Documents/TCS/app/services/explorer.py` — run_explore() signature, tag filter pattern
- `/Users/sebastianhamers/Documents/TCS/frontend/src/admin/pages/OverviewPage.tsx` — StatCard component, existing stats layout
- `/Users/sebastianhamers/Documents/TCS/frontend/src/admin/pages/LeadsPage.tsx` — CSV download button pattern
- `/Users/sebastianhamers/Documents/TCS/frontend/src/admin/pages/ExpertsPage.tsx` — current CSV import pattern, ingest trigger
- `/Users/sebastianhamers/Documents/TCS/frontend/src/store/filterSlice.ts` — Zustand slice pattern for extension
- `/Users/sebastianhamers/Documents/TCS/frontend/src/store/index.ts` — persist middleware, partialize, version
- `/Users/sebastianhamers/Documents/TCS/frontend/src/components/sidebar/TagCloud.tsx` — TagPill component, TagCloud structure
- `/Users/sebastianhamers/Documents/TCS/frontend/src/components/sidebar/FilterSidebar.tsx` — filter sidebar structure
- `/Users/sebastianhamers/Documents/TCS/frontend/src/constants/tags.ts` — TOP_TAGS constant pattern
- `/Users/sebastianhamers/Documents/TCS/.planning/STATE.md` — locked decision: separate industryTags array
- `/Users/sebastianhamers/Documents/TCS/.planning/REQUIREMENTS.md` — exact requirement text for ADM-01/02/05, DISC-01/02/03

### Secondary (MEDIUM confidence)
- `.planning/phases/48-admin-features-and-industry-tags/48-CONTEXT.md` — user decisions on CSV format, taxonomy approach, stat card design

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns already in codebase
- Architecture: HIGH — all patterns traced to existing source files with line numbers
- Pitfalls: HIGH — pitfalls derived from direct inspection of schema and call sites

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (30 days — stable codebase, no fast-moving dependencies)
