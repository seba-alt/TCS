# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 4 (Foundation)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-20 — Completed 01-02: embedder service + FAISS ingestion pipeline

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 2.5 min
- Total execution time: 5 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 5 min | 2.5 min |

**Recent Trend:**
- Last 5 plans: 2.5 min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: RAG over fine-tuning — CSV data changes; retrieval is more maintainable
- [Roadmap]: CSV as vector source — 1,600 profiles fits in-memory FAISS; no vector DB for v1
- [Roadmap]: Streaming upgrade folded into Phase 2 (not a separate phase) — quick depth + same delivery boundary
- [Roadmap]: Non-streaming validation first, streaming upgrade second within Phase 2
- [01-01]: google-genai==1.64.* confirmed as active SDK on PyPI (not deprecated google-generativeai); import path is `from google import genai`
- [01-01]: CSV column names treated as unknown until validate_csv.py runs against real data — ingest.py field names must be set after first run
- [01-01]: utf-8-sig encoding used for CSV loads to handle Excel BOM characters; chardet as fallback
- [01-02]: Lazy genai.Client() initialization in embedder.py — deferred to first call so module imports without GOOGLE_API_KEY (critical for CI and testability)
- [01-02]: L2 normalization required in both ingest.py and embedder.py — 768-dim truncated vectors are NOT pre-normalized by Google API
- [01-02]: Task type asymmetry enforced — RETRIEVAL_DOCUMENT for ingest, RETRIEVAL_QUERY for runtime embed_query()

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 - RESOLVED]: google-genai confirmed as active SDK — locked in requirements.txt as google-genai==1.64.*
- [Phase 2]: Verify Gemini JSON mode parameters (`response_mime_type`, `response_schema`) against current Google GenAI Python SDK docs before implementing LLM service
- [Phase 2]: Confirm `gemini-2.0-flash` is available on the project API key tier; fall back to `gemini-1.5-flash` if not
- [Phase 1 - PENDING]: CSV not yet available — run scripts/validate_csv.py then ingest.py when experts.csv and GOOGLE_API_KEY are provided to build faiss.index and metadata.json

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 01-02-PLAN.md — embedder service (app/services/embedder.py), config (app/config.py), ingest pipeline (scripts/ingest.py) committed
Resume file: None
