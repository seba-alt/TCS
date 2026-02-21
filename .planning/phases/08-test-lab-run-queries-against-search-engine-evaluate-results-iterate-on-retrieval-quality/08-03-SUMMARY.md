---
phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality
plan: "03"
subsystem: database
tags: [faiss, sqlalchemy, embeddings, gemini, ingest, crash-safe]

# Dependency graph
requires:
  - phase: 08-01
    provides: Expert model with tags and findability_score columns; tagging.py writes tags to DB
provides:
  - scripts/ingest.py reads Expert rows from SQLite (not CSV), filters to tagged-only, embeds with tag-enriched text, writes FAISS index via crash-safe staging promotion
affects:
  - Phase 8 plan 04 (tag_experts.py), Phase 9 (retrieval quality evaluation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Staging-then-rename promotion: write to .staging, assert ntotal == actual_count, then Path.rename() to production path"
    - "DB-sourced ingest: read from SQLAlchemy Expert table so tag_experts.py-written tags are always included"
    - "Tag-enriched embeddings: 'Domains: tag1, tag2.' appended to expert_to_text output"

key-files:
  created: []
  modified:
    - scripts/ingest.py

key-decisions:
  - "Removed pandas entirely from ingest.py — SQLAlchemy SessionLocal replaces CSV loading"
  - "Only tagged experts (tags IS NOT NULL) are indexed — untagged experts have no bio and cannot be semantically embedded"
  - "Assertion uses actual_count from DB query (not hardcoded 1558) — future-proof as expert roster grows"
  - "Metadata dict preserves 'First Name'/'Last Name' key names (capital + spaced) for retriever.py/llm.py compatibility"

patterns-established:
  - "Crash-safe FAISS promotion: .staging write + count assertion + rename — never leaves production index in partial state"
  - "Stale staging cleanup at script start: prevents confusion if previous run crashed after writing staging file"

requirements-completed: [TAGS-03, TAGS-04]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 8 Plan 03: Ingest Rewrite Summary

**DB-sourced FAISS ingestion with tag-enriched embeddings ('Domains: tag1, tag2.') and crash-safe staging promotion via count assertion before rename**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T00:20:31Z
- **Completed:** 2026-02-21T00:23:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced pandas/CSV loading with SQLAlchemy SessionLocal query filtering to tagged experts only
- Added 'Domains: tag1, tag2, tag3.' suffix in expert_to_text for richer semantic signal in embeddings
- Implemented crash-safe FAISS index promotion: write to .staging path, assert ntotal == actual_count, then Path.rename() to production — partial writes can never corrupt the live index
- Stale .staging file deleted at script start to prevent confusion from prior interrupted runs
- metadata.json now includes tags per expert record, preserving retriever.py lookup compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite scripts/ingest.py — DB-sourced with tag enrichment and crash-safe promotion** - `fc98733` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `scripts/ingest.py` - Completely rewritten: removes pandas, adds load_tagged_experts() querying Expert table, extends expert_to_text with Domains tag line, implements STAGING_PATH write + assertion + rename in main()

## Decisions Made

- Removed pandas entirely — no CSV reading needed once the Expert table is the authoritative source
- Assertion uses `actual_count` from DB query result (not hardcoded 1558) so the script remains correct as expert count changes
- Metadata dicts use "First Name", "Last Name" (capital + spaced) keys to match existing retriever.py/llm.py field lookups
- SessionLocal used as context manager (with block) for clean session lifecycle in the offline script

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — `python` binary not in PATH locally (macOS uses `python3`); verification commands adapted to use `python3`. No impact on the shipped code.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- scripts/ingest.py is ready to run after scripts/tag_experts.py has populated tags in the Expert table
- Run order: `python3 scripts/tag_experts.py` then `python3 scripts/ingest.py`
- No blockers for Phase 8 Plan 04 (tag_experts.py script creation)

---
*Phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: scripts/ingest.py (219 lines, exceeds 80-line minimum)
- FOUND: commit fc98733
- FOUND: 08-03-SUMMARY.md
