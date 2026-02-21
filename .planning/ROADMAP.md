# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- ✅ **v1.0 MVP** — Phases 1–7 (shipped 2026-02-20)
- 🚧 **v1.1 Expert Intelligence & Search Quality** — Phases 8–10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–7) — SHIPPED 2026-02-20</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-02-20
- [x] Phase 2: RAG API (4/4 plans) — completed 2026-02-20
- [x] Phase 3: Frontend (3/3 plans) — completed 2026-02-20
- [x] Phase 4: Deployment (3/3 plans) — completed 2026-02-20
- [x] Phase 5: Email Gate UX (3/3 plans) — completed 2026-02-20
- [x] Phase 6: Thumbs Up/Down Feedback (3/3 plans) — completed 2026-02-20
- [x] Phase 7: Analytics Dashboard v2 (4/4 plans) — completed 2026-02-20

Full phase details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Expert Intelligence & Search Quality (In Progress)

**Milestone Goal:** Transform the expert layer — auto-tag all 1,558 experts, score findability, enhance the admin Expert tab — then systematically improve retrieval using feedback signals and query expansion.

- [x] **Phase 8: Data Enrichment Pipeline** — AI batch-tag all 1,558 experts, compute findability scores, rebuild the full FAISS index — **4 plans** (completed 2026-02-21)
- [x] **Phase 9: Admin Expert Tab Enhancement** — Surface enriched data in the admin UI; human quality gate before retrieval changes go live (completed 2026-02-21)
- [ ] **Phase 10: Search Intelligence Layer** — HyDE query expansion and feedback-weighted re-ranking on the enriched index, gated by env var flags

## Phase Details

### Phase 8: Data Enrichment Pipeline
**Goal**: All 1,558 experts have AI-generated domain tags and findability scores stored in SQLite, and the FAISS index is rebuilt with all 1,558 experts using tag-enriched embedding text
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: TAGS-01, TAGS-02, TAGS-03, TAGS-04, TAGS-05, FIND-01, FIND-02, FIND-03
**Success Criteria** (what must be TRUE):
  1. Admin can run `scripts/tag_experts.py` offline and all 1,558 Expert rows in SQLite have a non-empty tags JSON column containing 3–8 domain strings each
  2. Running the tagging script a second time (re-run) produces no errors and skips already-tagged experts without overwriting valid data
  3. Running `scripts/ingest.py` after tagging produces a FAISS index where `index.ntotal == 1558` (verified by assertion before the index is written to disk)
  4. A sample of 30 random experts in the DB shows tags that correctly reflect their domain (e.g., a "machine learning" expert has an "machine learning" or "AI" tag, not generic filler)
  5. Each Expert row has a findability_score Float between 0 and 100, and experts with no bio and no profile URL score below 40
  6. When admin adds a new expert via the dashboard, that expert immediately receives auto-generated tags and a findability score (no manual batch run required)
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md — Expert model schema migration + shared tagging service (app/models.py, app/main.py, app/services/tagging.py)
- [ ] 08-02-PLAN.md — Batch tagging script with async concurrency + findability scoring (scripts/tag_experts.py)
- [ ] 08-03-PLAN.md — Ingest rewrite: DB-sourced + tag enrichment + crash-safe FAISS promotion (scripts/ingest.py)
- [ ] 08-04-PLAN.md — Auto-tag on expert create: sync Gemini + BackgroundTasks retry + UI status (app/routers/admin.py, ExpertTab.tsx)

### Phase 9: Admin Expert Tab Enhancement
**Goal**: The admin Expert tab surfaces first name, last name, bio preview, profile URL, domain tags, and a color-coded findability score for every expert — sorted worst-first so the lowest-quality profiles are immediately visible
**Depends on**: Phase 8 (tags and scores must exist in DB)
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, SEARCH-07
**Success Criteria** (what must be TRUE):
  1. Admin opens the Expert tab and sees a table with first name and last name in separate columns (not the raw Username field)
  2. Each expert row shows a bio preview truncated to ~120 characters and the profile URL as a clickable link that opens the Tinrate profile
  3. Each expert row shows domain tags as visual pills and a color-coded findability score badge: red for 0–39, yellow for 40–69, green for 70–100
  4. The Expert tab defaults to ascending findability score order so the worst-quality profiles (lowest scores) appear at the top of the list
  5. Admin can call `GET /api/admin/domain-map` and receive a ranked list of expert tag domains sorted by frequency of appearance in downvoted results
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md — Backend: enrich _serialize_expert() with tags+score, fix default sort, add GET /api/admin/domain-map (app/routers/admin.py)
- [ ] 09-02-PLAN.md — Frontend types + hook: update ExpertRow, add DomainMap interfaces, add useAdminDomainMap hook (types.ts, useAdminData.ts)
- [ ] 09-03-PLAN.md — Frontend table overhaul: sort/filter/pagination/domain-map section + human verification (ExpertsPage.tsx)

### Phase 10: Search Intelligence Layer
**Goal**: The retrieval pipeline applies HyDE query expansion on weak queries and feedback-weighted re-ranking on all results — both gated by environment variable flags so they can be enabled or disabled without a code change
**Depends on**: Phase 8 (enriched FAISS index with 1,558 vectors must be live), Phase 9 (admin visibility for quality verification)
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06
**Success Criteria** (what must be TRUE):
  1. Setting `QUERY_EXPANSION_ENABLED=true` in Railway env vars causes the backend to generate a hypothetical expert bio for queries that return weak original results, and FAISS search uses the blended embedding — setting it to `false` disables expansion without any code change
  2. A query that already returns 3 strong results above the similarity threshold does NOT trigger HyDE expansion (expansion is skipped, not applied unnecessarily)
  3. Setting `FEEDBACK_LEARNING_ENABLED=true` causes experts with 10+ feedback interactions and a positive thumbs ratio to receive a soft similarity score boost (capped at 20%), surfacing them higher in results — setting it to `false` disables re-ranking entirely
  4. An expert with fewer than 10 feedback interactions receives no boost regardless of thumbs ratio (cold-start threshold enforced)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-02-20 |
| 2. RAG API | v1.0 | 4/4 | Complete | 2026-02-20 |
| 3. Frontend | v1.0 | 3/3 | Complete | 2026-02-20 |
| 4. Deployment | v1.0 | 3/3 | Complete | 2026-02-20 |
| 5. Email Gate UX | v1.0 | 3/3 | Complete | 2026-02-20 |
| 6. Feedback | v1.0 | 3/3 | Complete | 2026-02-20 |
| 7. Analytics Dashboard v2 | v1.0 | 4/4 | Complete | 2026-02-20 |
| 8. Data Enrichment Pipeline | 4/4 | Complete   | 2026-02-21 | — |
| 9. Admin Expert Tab Enhancement | 3/3 | Complete   | 2026-02-21 | — |
| 10. Search Intelligence Layer | v1.1 | 0/? | Not started | — |
