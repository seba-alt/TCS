# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-02-20)
- ✅ **v1.1 Expert Intelligence & Search Quality** — Phases 8-10 (shipped 2026-02-21)
- ✅ **v1.2 Intelligence Activation & Steering Panel** — Phases 11-13 (shipped 2026-02-21)
- ✅ **v2.0 Extreme Semantic Explorer** — Phases 14-21 (shipped 2026-02-22)
- ✅ **v2.2 Evolved Discovery Engine** — Phases 22-27 (shipped 2026-02-22)
- ✅ **v2.3 Sage Evolution & Marketplace Intelligence** — Phases 28-35 (shipped 2026-02-24)
- ✅ **v3.0 Netflix Browse & Agentic Navigation** — Phases 36-40.3.1 (shipped 2026-02-26)
- ✅ **v3.1 Launch Prep** — Phases 41-44 (shipped 2026-02-26)
- ✅ **v4.0 Public Launch** — Phases 45-50 (shipped 2026-02-27)
- ✅ **v4.1 UX Polish & Mobile Overhaul** — Phases 51-54 (shipped 2026-03-03)
- ✅ **v5.0 Platform Polish & Admin Overhaul** — Phases 55-59 (shipped 2026-03-03)
- 🚧 **v5.1 Lead Insights & Overview** — Phases 60-62 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-02-20</summary>

See `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Expert Intelligence & Search Quality (Phases 8-10) — SHIPPED 2026-02-21</summary>

See `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Intelligence Activation & Steering Panel (Phases 11-13) — SHIPPED 2026-02-21</summary>

See `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Extreme Semantic Explorer (Phases 14-21) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.2 Evolved Discovery Engine (Phases 22-27) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.3 Sage Evolution & Marketplace Intelligence (Phases 28-35) — SHIPPED 2026-02-24</summary>

See `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Netflix Browse & Agentic Navigation (Phases 36-40.3.1) — SHIPPED 2026-02-26</summary>

See `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>✅ v3.1 Launch Prep (Phases 41-44) — SHIPPED 2026-02-26</summary>

See `.planning/milestones/v3.1-ROADMAP.md`

</details>

<details>
<summary>✅ v4.0 Public Launch (Phases 45-50) — SHIPPED 2026-02-27</summary>

See `.planning/milestones/v4.0-ROADMAP.md`

</details>

<details>
<summary>✅ v4.1 UX Polish & Mobile Overhaul (Phases 51-54) — SHIPPED 2026-03-03</summary>

See `.planning/milestones/v4.1-ROADMAP.md`

</details>

<details>
<summary>✅ v5.0 Platform Polish & Admin Overhaul (Phases 55-59) — SHIPPED 2026-03-03</summary>

See `.planning/milestones/v5.0-ROADMAP.md`

- [x] Phase 55: Explorer Bug Fixes (2/2 plans) — completed 2026-03-03
- [x] Phase 56: Backend Performance & Admin Refactor (3/3 plans) — completed 2026-03-03
- [x] Phase 57: Admin Frontend Overhaul (4/4 plans) — completed 2026-03-03
- [x] Phase 58: Audit Gap Closure (2/2 plans) — completed 2026-03-03
- [x] Phase 58.1: Admin Dashboard Improvements (3/3 plans) — completed 2026-03-03
- [x] Phase 59: Tech Debt Cleanup (1/1 plan) — completed 2026-03-03

</details>

### 🚧 v5.1 Lead Insights & Overview (In Progress)

**Milestone Goal:** Surface lead journey data and enriched overview signals so admins can understand engagement patterns and demand gaps at a glance.

- [x] **Phase 60: Bug Fixes** - Fix clear-all button visibility and remove unused build-breaking variable (completed 2026-03-03)
- [x] **Phase 61: Lead Journey Timeline** - Expandable lead rows with chronological search and click history (completed 2026-03-03)
- [x] **Phase 62: Overview Enhancements** - Add top experts, top searches, and zero-result gap cards to Overview (completed 2026-03-03)

## Phase Details

### Phase 60: Bug Fixes
**Goal**: Users see a clean, correctly-behaving Explorer and Vercel builds pass without warnings
**Depends on**: Nothing (first phase of v5.1)
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. The clear-all button is not visible on the Explorer when no filters are active (page load with no tags, no query, default rate)
  2. The clear-all button appears as soon as any filter becomes active (tag selected, query entered, or rate changed)
  3. Vercel build completes without TypeScript errors or unused-variable warnings from MobileInlineFilters.tsx
**Plans**: 1 plan
Plans:
- [ ] 60-01-PLAN.md — Fix clear-all button visibility (FIX-01) and remove unused totalTagCount variable (FIX-02)

### Phase 61: Lead Journey Timeline
**Goal**: Admin can inspect the full chronological history of any lead's interaction with the marketplace
**Depends on**: Phase 60
**Requirements**: LEAD-01, LEAD-02, LEAD-03
**Success Criteria** (what must be TRUE):
  1. Admin can click to expand any lead row and see a timeline of that lead's searches and expert clicks in chronological order
  2. Each search event in the timeline shows the query text and how many results were returned
  3. Each click event in the timeline shows the expert name and which search query preceded that click
  4. Time gaps between consecutive events are shown as labels (e.g., "2 hours later") so engagement pacing is visible
**Plans**: 2 plans
Plans:
- [ ] 61-01-PLAN.md — Backend lead-timeline endpoint + TypeScript types
- [ ] 61-02-PLAN.md — Frontend timeline UI in LeadsPage expanded rows

### Phase 62: Overview Enhancements
**Goal**: The Overview page gives admins immediate signal on what experts are popular, what users search for, and where demand goes unmet
**Depends on**: Phase 61
**Requirements**: OVER-01, OVER-02, OVER-03
**Success Criteria** (what must be TRUE):
  1. Overview page shows a ranked list of experts by card click volume for the selected time period
  2. Overview page shows a ranked list of the most frequent search queries for the selected time period
  3. Overview page shows zero-result queries as unmet demand signals for the selected time period
  4. All three new cards respect the existing period toggle (Today / 7d / 30d / All)
**Plans**: 2 plans
Plans:
- [ ] 62-01-PLAN.md — Backend top-queries endpoint + TypeScript types
- [ ] 62-02-PLAN.md — Frontend overview cards (Top Experts, Top Searches, Unmet Demand)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 60. Bug Fixes | 1/1 | Complete    | 2026-03-03 | - |
| 61. Lead Journey Timeline | 2/2 | Complete    | 2026-03-03 | - |
| 62. Overview Enhancements | 2/2 | Complete   | 2026-03-03 | - |
