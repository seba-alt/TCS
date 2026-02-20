# Roadmap: Tinrate AI Concierge Chatbot

## Overview

Four phases that follow the hard dependency chain of this RAG system: pre-compute the expert embedding index first, build and validate the retrieval and generation API second, wire the React frontend to the stable API third, and push to production last. No phase can begin until the one before it is verified — the FAISS index is a hard dependency for the API, the API is a hard dependency for the frontend, and all three must be stable before deployment is meaningful.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Project scaffold, CSV data pipeline, FAISS index, FastAPI skeleton with CORS and health endpoint
- [ ] **Phase 2: RAG API** - Embedding-based retrieval, Gemini generation with JSON mode, streaming SSE endpoint
- [ ] **Phase 3: Frontend** - React chat UI, Expert Cards, mobile-responsive layout, connected to streaming API
- [ ] **Phase 4: Deployment** - Vercel + Railway production deploy, environment variables, keep-alive, production CORS

## Phase Details

### Phase 1: Foundation
**Goal**: The FAISS index exists on disk and a running FastAPI server confirms it can load — all infrastructure that every downstream phase depends on is in place
**Depends on**: Nothing (first phase)
**Requirements**: REC-01
**Success Criteria** (what must be TRUE):
  1. Running `scripts/ingest.py` against the expert CSV produces a FAISS index and metadata sidecar on disk without errors
  2. FastAPI server starts, loads the FAISS index into memory, and responds to `GET /api/health` with 200
  3. No secrets exist in source files or git history — `GOOGLE_API_KEY` lives only in `.env` which is gitignored
  4. A direct Python call to the embedder service returns a 768-dim vector for a test query string
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold: .gitignore, requirements.txt, scripts/validate_csv.py
- [x] 01-02-PLAN.md — Embedder service and offline ingestion pipeline (CSV → FAISS index)
- [x] 01-03-PLAN.md — FastAPI server with lifespan FAISS loading, CORS, and health endpoint

### Phase 2: RAG API
**Goal**: An API endpoint accepts a natural language query and returns exactly 3 matched experts with "why them" explanations — verified correct before any frontend work begins
**Depends on**: Phase 1
**Requirements**: REC-02
**Success Criteria** (what must be TRUE):
  1. `POST /api/chat` with a test query returns a valid JSON body containing exactly 3 experts, each with name, title, company, hourly rate, profile URL, and a "why them" explanation
  2. The same endpoint streams its response as SSE — the browser receives tokens progressively rather than waiting for the full response
  3. Ten manual test queries covering different problem domains each return 3 plausible, non-hallucinated experts whose data matches the source CSV
  4. A vague or zero-match query triggers a clarifying question response rather than a forced low-confidence match
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — SQLite database setup, SQLAlchemy ORM, Conversation model, DB wired into lifespan
- [ ] 02-02-PLAN.md — Retriever service (FAISS search + expert filtering) and LLM service (Gemini JSON mode)
- [ ] 02-03-PLAN.md — POST /api/chat non-streaming endpoint with email validation, retrieval, generation, DB logging
- [ ] 02-04-PLAN.md — SSE streaming upgrade: status:thinking event, streamed result, human verification

### Phase 3: Frontend
**Goal**: A user can open the chatbot in a browser, describe their problem, and see three clickable Expert Cards appear below the AI response — on both desktop and mobile
**Depends on**: Phase 2
**Requirements**: CHAT-01, CHAT-02, REC-03, REC-04
**Success Criteria** (what must be TRUE):
  1. User can type a problem description into the chat input and submit it — the input field is touch-friendly and works on a 375px mobile viewport
  2. Three Expert Cards appear below the AI narrative response, each displaying the expert's name, job title, company, and hourly rate
  3. Clicking any Expert Card navigates the user directly to that expert's profile page on Tinrate (no dead-end cards)
  4. On mobile, Expert Cards stack vertically and the chat input remains accessible without horizontal scrolling
**Plans**: TBD

### Phase 4: Deployment
**Goal**: The application is live at a public URL — anyone can open it, ask a question, and receive expert recommendations without any local setup
**Depends on**: Phase 3
**Requirements**: DEPL-01
**Success Criteria** (what must be TRUE):
  1. Visiting the public Vercel URL loads the chatbot and a query returns 3 expert recommendations end-to-end
  2. The Railway backend responds to `GET /api/health` from the public internet and does not cold-start-drop requests during normal use
  3. Production CORS is locked to the exact Vercel domain — no wildcard origins
  4. `GOOGLE_API_KEY` and `VITE_API_URL` are set as environment variables in Railway and Vercel respectively and are not present in any committed file
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-02-20 |
| 2. RAG API | 1/4 | In progress | - |
| 3. Frontend | 0/TBD | Not started | - |
| 4. Deployment | 0/TBD | Not started | - |
