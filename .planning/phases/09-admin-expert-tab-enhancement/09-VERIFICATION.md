---
phase: 09-admin-expert-tab-enhancement
verified: 2026-02-21T12:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open admin Expert tab in browser, confirm color-coded score badges render red/yellow/green correctly"
    expected: "Red badge for score 0-39, yellow for 40-69, green for 70-100, dash for null"
    why_human: "CSS class application and visual color rendering cannot be verified programmatically"
  - test: "Click 'Domain Map' toggle, verify lazy fetch fires only on first open (not on page load)"
    expected: "No network call to /api/admin/domain-map until toggle is clicked; fetch fires on first open only"
    why_human: "Lazy vs eager fetch behavior requires observing network tab in browser DevTools"
  - test: "Click a domain in the domain-map section and confirm expert table narrows to matching-tag experts"
    expected: "Table rows update immediately; tag filter indicator appears in actions bar showing active domain"
    why_human: "Filter chain behavior (domain-map click -> tagFilter state -> filtered memo -> table render) requires runtime observation"
---

# Phase 9: Admin Expert Tab Enhancement — Verification Report

**Phase Goal:** The admin Expert tab surfaces first name, last name, bio preview, profile URL, domain tags, and a color-coded findability score for every expert — sorted worst-first so the lowest-quality profiles are immediately visible

**Verified:** 2026-02-21T12:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/admin/experts returns tags as a parsed JSON array (not raw string) for every expert | VERIFIED | `admin.py:114` — `"tags": json.loads(e.tags or "[]")` in `_serialize_expert()` |
| 2 | GET /api/admin/experts returns findability_score as a float or null for every expert | VERIFIED | `admin.py:115` — `"findability_score": e.findability_score` in `_serialize_expert()` |
| 3 | GET /api/admin/experts default order is ascending findability_score with nulls first | VERIFIED | `admin.py:424` — `select(Expert).order_by(Expert.findability_score.asc().nulls_first())` |
| 4 | GET /api/admin/domain-map returns top-10 tag domains by downvote frequency as a ranked list | VERIFIED | `admin.py:429-468` — endpoint exists, uses `Counter.most_common(10)`, returns `{"domains": [...]}` |
| 5 | GET /api/admin/domain-map returns empty domains array gracefully when no downvotes exist | VERIFIED | `admin.py:449-450` — early return `{"domains": []}` when `url_set` is empty |
| 6 | ExpertRow TypeScript interface includes tags (string array) and findability_score (number or null) | VERIFIED | `types.ts:79-80` — `tags: string[]` and `findability_score: number \| null` |
| 7 | useAdminDomainMap hook exists and can lazily fetch GET /api/admin/domain-map | VERIFIED | `useAdminData.ts:137-151` — exported, `loading=false` initial state, no `useEffect`, `fetchData()` exposed |
| 8 | DomainMapEntry and DomainMapResponse interfaces are exported from types.ts | VERIFIED | `types.ts:83-90` — both interfaces exported |
| 9 | Admin Expert tab shows merged Name column (First + Last) as the first column | VERIFIED | `ExpertsPage.tsx:356-358` — `{expert.first_name} {expert.last_name}` rendered in first `<td>` |
| 10 | Each row shows bio truncated to ~120 characters | VERIFIED | `ExpertsPage.tsx:361` — `expert.bio.length > 120 ? expert.bio.slice(0, 120) + '…' : expert.bio` |
| 11 | Each row shows profile URL as a clickable external-link icon only (no link text) | VERIFIED | `ExpertsPage.tsx:368-381` — `<a>` with SVG external-link icon, no text content beside icon |
| 12 | Each row shows up to 2 tag pills; remaining count shown as '+N' | VERIFIED | `ExpertsPage.tsx:47-62` — `TagPills` component slices to 2 visible, renders `+{remaining}` |
| 13 | Each row shows a color-coded findability score badge: red 0-39, yellow 40-69, green 70-100 | VERIFIED | `ExpertsPage.tsx:7-12` — `scoreZone()` helper; `ExpertsPage.tsx:14-19` — `ZONE_STYLES` constant wired to `ScoreBadge` |
| 14 | Table defaults to ascending findability score order (worst first) | VERIFIED | `ExpertsPage.tsx:107` — `useState<string>('score')` and `useState<'asc' \| 'desc'>('asc')` as defaults |
| 15 | Zone filter buttons (Red/Yellow/Green) appear above the table and filter rows by score band | VERIFIED | `ExpertsPage.tsx:224-248` — zone filter button group in actions bar; `filtered` memo applies `scoreZone` filter |
| 16 | Pagination controls (Prev / Page N of M / Next) appear below the table, 50 experts per page | VERIFIED | `ExpertsPage.tsx:195-196` — page slice at 50; `ExpertsPage.tsx:398-418` — pagination controls rendered |
| 17 | Page index resets to 0 whenever sort, zone filter, or tag filter changes | VERIFIED | `ExpertsPage.tsx:199` — `useEffect(() => { setPageIdx(0) }, [zoneFilter, tagFilter, sortCol, sortDir])` |
| 18 | Domain-map collapsible section appears below pagination; clicking a domain sets tag filter | VERIFIED | `ExpertsPage.tsx:422-467` — domain-map section with `handleToggleDomainMap`; click calls `setTagFilter(d.domain)` |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/routers/admin.py` | Updated `_serialize_expert()`, sorted GET /api/admin/experts, new GET /api/admin/domain-map | VERIFIED | All three changes present; file is 781 lines with no stub patterns |
| `frontend/src/admin/types.ts` | Updated ExpertRow with tags + findability_score, DomainMapEntry, DomainMapResponse | VERIFIED | Line 79-80 (ExpertRow fields), lines 83-90 (new interfaces), all exported |
| `frontend/src/admin/hooks/useAdminData.ts` | useAdminDomainMap hook with lazy fetchData pattern | VERIFIED | Lines 137-151; `loading=false` initial state, no `useEffect`, `fetchData()` exposed |
| `frontend/src/admin/pages/ExpertsPage.tsx` | Rebuilt Expert tab with sort/filter/pagination/domain-map | VERIFIED | 470 lines; contains `scoreZone`, `SortHeader`, `ScoreBadge`, `TagPills`, all state/memos/handlers |

**Artifact substantiveness:** All artifacts are fully implemented. No stubs, placeholders, or empty implementations found.

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `admin.py _serialize_expert()` | `Expert.tags column` | `json.loads(e.tags or '[]')` | WIRED | `admin.py:114` — exact pattern present |
| `admin.py get_domain_map()` | `Feedback.expert_ids column` | `select(Feedback.expert_ids).where(Feedback.vote == "down")` | WIRED | `admin.py:439-441` — query present |
| `admin.py get_domain_map()` | `Expert.profile_url` | `Expert.profile_url.in_(list(url_set))` | WIRED | `admin.py:454` — pattern present |
| `types.ts ExpertRow` | `admin.py _serialize_expert()` | `tags: string[]` matching API response shape | WIRED | `types.ts:79-80` matches `admin.py:114-115` exactly |
| `useAdminData.ts useAdminDomainMap` | `/api/admin/domain-map` | `adminFetch('/domain-map')` called lazily | WIRED | `useAdminData.ts:144` — path correct; no `useEffect` confirms lazy pattern |
| `ExpertsPage.tsx` | `useAdminExperts hook` | `const { data } = useAdminExperts()` | WIRED | `ExpertsPage.tsx:92` — imported and destructured |
| `ExpertsPage.tsx` | `useAdminDomainMap hook` | `const { data: domainData, fetchData: fetchDomainMap } = useAdminDomainMap()` | WIRED | `ExpertsPage.tsx:2,93` — imported and used |
| `ExpertsPage.tsx sort state` | `useMemo sorted derivation` | `useMemo(() => [...experts].sort(...), [experts, sortCol, sortDir])` | WIRED | `ExpertsPage.tsx:172-186` — sort useMemo present with correct deps |
| `ExpertsPage.tsx domain-map click` | `tagFilter state` | `onClick={() => setTagFilter(d.domain)}` | WIRED | `ExpertsPage.tsx:450` — `setTagFilter(tagFilter === d.domain ? null : d.domain)` (toggle pattern) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-01 | 09-01, 09-03 | Expert tab displays First Name and Last Name separately | SATISFIED | `ExpertsPage.tsx:357` — `{expert.first_name} {expert.last_name}` |
| ADMIN-02 | 09-01, 09-03 | Expert tab displays bio preview truncated to ~120 chars | SATISFIED | `ExpertsPage.tsx:361` — 120-char slice with ellipsis |
| ADMIN-03 | 09-01, 09-03 | Expert tab displays profile URL as a clickable link | SATISFIED | `ExpertsPage.tsx:368-381` — anchor with external-link SVG icon |
| ADMIN-04 | 09-01, 09-02, 09-03 | Expert tab displays domain tags as visual pills | SATISFIED | `ExpertsPage.tsx:47-62` — `TagPills` component; backed by `tags: string[]` in `ExpertRow` |
| ADMIN-05 | 09-01, 09-02, 09-03 | Expert tab displays color-coded findability score badge | SATISFIED | `ExpertsPage.tsx:7-19` — `scoreZone()` + `ZONE_STYLES` + `ScoreBadge` |
| ADMIN-06 | 09-01, 09-03 | Expert tab defaults to worst-first sort by findability score | SATISFIED | API: `admin.py:424` (nulls_first asc); UI: `ExpertsPage.tsx:107` (sortCol='score', sortDir='asc') |
| SEARCH-07 | 09-01, 09-02, 09-03 | Admin can view domain-map endpoint showing top downvoted tag domains | SATISFIED | `admin.py:429-468` — endpoint implemented; `ExpertsPage.tsx:422-467` — UI section implemented |

**All 7 requirement IDs claimed across plans are accounted for. No orphaned requirements found.**

REQUIREMENTS.md traceability cross-check:
- ADMIN-01 through ADMIN-06: marked Complete for Phase 9 — confirmed by code
- SEARCH-07: marked Complete for Phase 9 — confirmed by code

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ExpertsPage.tsx` | 299-300 | `placeholder=` HTML attribute on an input field | Info | Standard HTML form placeholder — not a code stub; no impact |

No blocker or warning anti-patterns found. No TODO/FIXME/HACK comments. No empty implementations. No `return null` stubs. No `console.log`-only handlers.

---

### Human Verification Required

#### 1. Color-coded score badge rendering

**Test:** Open admin Expert tab in browser. Find an expert with a score under 40 (should be first in the list), one between 40-69, and one above 70 (or with a null score). Confirm badge colors match the specification.
**Expected:** Red badge (score 0-39), yellow badge (40-69), green badge (70-100), dash (—) for null scores
**Why human:** CSS Tailwind classes `bg-red-500/20`, `bg-yellow-500/20`, `bg-green-500/20` are applied dynamically via `ZONE_STYLES` but visual correctness requires a browser render

#### 2. Lazy domain-map fetch timing

**Test:** Open admin Expert tab. Open browser DevTools Network tab. Do not click Domain Map. Observe — no request to `/api/admin/domain-map` should appear. Then click the "Domain Map" toggle. Observe network tab.
**Expected:** `/api/admin/domain-map` request fires only after clicking the toggle, not on page load
**Why human:** The lazy pattern (`loading=false`, no `useEffect`) prevents auto-fetch at the code level, but confirming the actual network behavior requires browser DevTools observation

#### 3. Domain-map click-to-filter flow

**Test:** Expand the domain-map section (requires at least one downvoted feedback in DB). Click on a domain entry. Observe the expert table.
**Expected:** Expert table narrows to show only experts whose `tags` array includes the clicked domain; tag filter indicator appears ("Filtered by tag: [domain]"); clicking same domain again clears the filter
**Why human:** The filter chain (click -> `setTagFilter` -> `filtered` memo -> `pageData` -> table render) requires runtime interaction to confirm the full round-trip

---

### Gaps Summary

No gaps. All 18 must-have truths verified against the actual codebase. All 4 artifacts exist, are substantive, and are correctly wired. All 7 requirement IDs are satisfied with code evidence. All 9 key links are wired.

The phase goal is fully achieved: the admin Expert tab surfaces first name, last name, bio preview (120-char truncated), profile URL (external-link icon), domain tags (up to 2 pills + overflow count), and a color-coded findability score badge — sorted worst-first by default. The domain-map section provides click-to-filter navigation from downvoted domains to the expert table.

Three human verification items remain (visual color rendering, lazy fetch timing, click-to-filter runtime behavior) — all are expected for UI phases and none block the goal assessment.

---

_Verified: 2026-02-21T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
