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
- ✅ **v5.1 Lead Insights & Overview** — Phases 60-62 (shipped 2026-03-03)
- 🚧 **v5.2 Email-First Gate & Admin See-All** — Phases 63-66 (in progress)

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

<details>
<summary>✅ v5.1 Lead Insights & Overview (Phases 60-62) — SHIPPED 2026-03-03</summary>

See `.planning/milestones/v5.1-ROADMAP.md`

- [x] Phase 60: Bug Fixes (1/1 plan) — completed 2026-03-03
- [x] Phase 61: Lead Journey Timeline (2/2 plans) — completed 2026-03-03
- [x] Phase 62: Overview Enhancements (2/2 plans) — completed 2026-03-03
- [x] Phase 62.1: Admin Bugs (1 plan) (completed 2026-03-04)
  Plans:
  - [ ] 62.1-01-PLAN.md — Unify card naming, merge duplicates, reorder overview grid
- [x] Phase 62.2: Loops Usergroup, OG Preview Image, Leads Timeline Context (1 plan) (completed 2026-03-04)
  **Goal:** Add Loops userGroup tagging, replace OG image with landscape format, link anonymous session searches to lead timeline
  **Requirements:** LOOPS-01, OG-01, SESSION-01
  **Plans:** 1 plan
  Plans:
  - [ ] 62.2-01-PLAN.md — Loops userGroup + OG image + session-linked lead timeline

</details>

### 🚧 v5.2 Email-First Gate & Admin See-All (In Progress)

**Milestone Goal:** Move email gate to page entry for upfront lead capture, attribute all user events directly to email, add See All expansion to admin overview cards, and install Vercel Speed Insights.

- [x] **Phase 63: Tracking Infrastructure** - Backend email column on user_events + frontend tracking enrichment (1 plan) (completed 2026-03-04)
- [x] **Phase 64: Email-First Gate** - Page-entry gate UI + lead timeline email attribution (2 plans) (completed 2026-03-04)
- [x] **Phase 65: Admin Enhancements** - See All expansion on overview cards + Vercel Speed Insights (1 plan) (completed 2026-03-04)
- [x] **Phase 66: Audit Gap Closure** - Fix payload key bug + Phase 64 verification (1 plan) **Gap Closure** (completed 2026-03-04)

## Phase Details

### Phase 63: Tracking Infrastructure
**Goal**: The backend accepts and persists email on every tracked event, and the frontend sends it automatically for identified users
**Depends on**: Phase 62.2 (last shipped phase)
**Requirements**: TRACK-01, TRACK-02
**Success Criteria** (what must be TRUE):
  1. A new nullable indexed `email` column exists on `user_events` after Railway redeploy (verified via admin DB or Railway logs)
  2. Events fired after a user has subscribed include their email in the POST body to `/api/events`
  3. Events fired before gate submission continue to work with `email: null` — no regressions on anonymous tracking
  4. The backend startup migration is idempotent — redeploying does not error if the column already exists
**Plans**: 1 plan
Plans:
- [ ] 63-01-PLAN.md — Backend email column + migration + API field + frontend trackEvent enrichment

### Phase 64: Email-First Gate
**Goal**: Every new visitor sees the email gate before browsing the Explorer, returning subscribers bypass it instantly, and lead timelines show post-gate search activity attributed by email
**Depends on**: Phase 63
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, TRACK-03
**Success Criteria** (what must be TRUE):
  1. A new visitor lands on the Explorer and sees the gate modal before any expert cards are visible
  2. Submitting a valid email dismisses the gate and unlocks the full Explorer immediately
  3. A returning subscriber who refreshes the page sees no gate flash — the Explorer loads directly
  4. The gate cannot be dismissed by clicking outside or pressing Escape — only email submission unlocks it
  5. After gate submission, the lead appears in Loops with source tagged as `page_entry` (not `gate`)
  6. Admin lead timeline shows search queries fired after gate submission, attributed to the lead's email
**Plans**: 2 plans
Plans:
- [ ] 64-01-PLAN.md — Email entry gate UI + MarketplacePage integration + old gate removal
- [ ] 64-02-PLAN.md — Admin lead timeline with email-attributed Explorer events

### Phase 65: Admin Enhancements
**Goal**: Admins can see the full ranked list on Top Experts and Top Searches cards, and Vercel Speed Insights reports frontend performance data
**Depends on**: Phase 63 (independent of Phase 64, sequenced last for focus)
**Requirements**: ADMOV-01, ADMOV-02, ADMOV-03, ANLYT-01
**Success Criteria** (what must be TRUE):
  1. Clicking "See All" on the Top Experts card expands it in-place to show the complete ranked list without navigating away
  2. Clicking "See All" on the Top Searches card expands it in-place to show all queries (up to 50) without navigating away
  3. Both expanded cards show a "Show less" control that collapses back to the top 5 view, preserving the period toggle selection
  4. Vercel Speed Insights data appears in the Vercel dashboard for the frontend deployment
**Plans**: 1 plan
Plans:
- [ ] 65-01-PLAN.md — Accordion expansion on Top Clicks & Top Searches cards + Speed Insights verification

### Phase 66: Audit Gap Closure
**Goal**: Close all gaps identified by v5.2 milestone audit — fix the explorer_click payload key bug and formally verify Phase 64 requirements
**Depends on**: Phase 65
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, TRACK-03
**Gap Closure:** Closes gaps from audit
**Success Criteria** (what must be TRUE):
  1. `explorer_click` entries in admin lead timeline show the correct expert name (not blank)
  2. Phase 64 VERIFICATION.md exists and confirms GATE-01–04 and TRACK-03 are satisfied
**Plans**: 1 plan
Plans:
- [ ] 66-01-PLAN.md — Fix explorer_click payload key bug + Phase 64 VERIFICATION.md + REQUIREMENTS.md update

## Progress

**Execution Order:** Phases execute in numeric order: 63 → 64 → 65 → 66

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 63. Tracking Infrastructure | 1/1 | Complete    | 2026-03-04 |
| 64. Email-First Gate | 2/2 | Complete    | 2026-03-04 |
| 65. Admin Enhancements | 1/1 | Complete    | 2026-03-04 |
| 66. Audit Gap Closure | 1/1 | Complete   | 2026-03-04 |
