# Phase 8: Data Enrichment Pipeline - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Offline batch tagging of all 1,558 experts using Gemini 2.5 Flash structured output, storing tags and findability scores in SQLite, rebuilding the FAISS index with tag-enriched embeddings, and auto-tagging new experts when created via the admin dashboard. This phase does not include admin UI to manage or display tags beyond auto-tagging on create.

</domain>

<decisions>
## Implementation Decisions

### Tagging source fields
- Prompt Gemini with **Bio + Job Title + Username** per expert
- If an expert has **no bio (empty or null)**: skip tagging entirely — mark as untagged, do not call Gemini
- Untagged experts (no bio) **still receive a findability score** — computed with 0 points for the tags component (per FIND-01 formula)
- Untagged experts are **excluded from the FAISS index rebuild** — index total may be under 1,558 (planner must reconcile with TAGS-04's `index.ntotal == 1558` assertion or adjust it to reflect actual tagged count)

### Batch script behavior
- Show a **progress bar with count** (e.g., `423/1558`) while running
- On individual expert failure (Gemini timeout, API error): **retry once, then skip and log** — do not abort the entire run
- Print a run summary **only if there were failures or skips** (silent on clean success)
- **No --dry-run flag** — keep the script simple

### Auto-tag integration
- Auto-tagging on expert creation is **synchronous** — admin waits ~1-2s while Gemini runs; expert is fully enriched before the API response returns
- If Gemini fails during synchronous call: **save the expert (tags = null), then retry tagging in background** — hybrid graceful degradation
- Admin dashboard should show a **spinner or status message** ("Generating tags...") while the synchronous tagging is in progress
- Auto-tagging **only updates the DB** — FAISS is not hot-updated; new experts won't appear in search until the next manual ingest run

### Tag normalization
- Tags are **guided free-form**: provide Gemini with example tags in the prompt (e.g., "machine learning", "tax law", "veterinary") but allow it to generate new ones
- **Always lowercase and trim whitespace** before storing in SQLite (e.g., "Machine Learning" → "machine learning")
- Batch script re-runs **always skip already-tagged experts** — no --force overwrite flag; immutable once tagged
- **Accept any non-empty tag list** from Gemini — do not strictly enforce 3–8 minimum; edge cases with sparse experts may produce fewer tags

### Claude's Discretion
- Exact Gemini prompt structure and example tag selection
- Background retry mechanism implementation (FastAPI BackgroundTasks or similar)
- Specific progress bar library (tqdm or equivalent)
- FAISS assertion adjustment strategy (planner decides whether to assert == actual_tagged_count vs original 1558)

</decisions>

<specifics>
## Specific Ideas

- Admin should see "Generating tags..." (not just a generic spinner) so they understand the wait is AI tagging, not just saving
- The batch script should feel like a standard data pipeline tool — clear progress, clear failure reporting, idempotent by default

</specifics>

<deferred>
## Deferred Ideas

- **"Trigger Ingest" button in admin settings** — admin-initiated FAISS rebuild from the UI (likely Phase 9 scope, which covers the admin dashboard)
- **Tag editing in admin UI** — ability to manually correct or override AI-generated tags (separate feature, not in this phase)

</deferred>

---

*Phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality*
*Context gathered: 2026-02-21*
