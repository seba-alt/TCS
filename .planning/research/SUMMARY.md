# Project Research Summary

**Project:** TCS RAG-Based AI Expert-Matching Concierge Chatbot (Tinrate)
**Domain:** RAG-based AI concierge / two-sided expert marketplace
**Researched:** 2026-02-20
**Confidence:** MEDIUM

## Executive Summary

This is a retrieval-augmented generation (RAG) chatbot that surfaces the right expert from a static CSV of ~1,600 profiles based on a user's natural-language query. The well-established pattern for this class of product is: pre-compute embeddings offline, load a lightweight vector store into memory at API startup, retrieve top-K candidates, inject them into a structured Gemini prompt, and stream the response back to a React frontend. The stack is Python/FastAPI on Railway + React/Vite on Vercel, using Google's `google-genai` SDK with `text-embedding-004` for embeddings and `gemini-2.0-flash` for generation. At 1,600 profiles, no external vector database is needed — a FAISS index on disk loaded into RAM is the correct, operationally simple choice.

The core product interaction is a three-step loop: user types a problem description, the AI returns a 2–3 sentence explanation and exactly 3 expert cards (name, title, company, rate, profile link, "why them"), and the user clicks through to the Tinrate profile to book. Every feature decision must protect this loop. The highest-value differentiators — the "why them" explanation per card, upfront rate visibility, and a clarifying-question flow for vague queries — are all achievable in v1. Multi-turn conversation history, suggested follow-up chips, and semantic reformulation feedback are real value-adds but carry enough complexity to warrant explicit deferral to v2.

The two most dangerous risks are (1) the Gemini LLM producing inconsistent response formats — solved by using JSON mode with a rigid schema in the system prompt plus server-side validation — and (2) re-embedding the CSV on every cold start — solved by pre-computing embeddings to a persisted file and loading from disk at startup. A third systemic risk is credential leakage: the `GOOGLE_API_KEY` must live only in Railway environment variables, never in the Vite bundle or git history. These three risks must be addressed in Phase 1 and Phase 2 before any UI work begins.

---

## Key Findings

### Recommended Stack

The backend is Python 3.11+ / FastAPI 0.111+ / Uvicorn with Pydantic v2 for request validation. LLM and embeddings use the new `google-genai` SDK (not the deprecated `google-generativeai`), calling `text-embedding-004` for 768-dim vectors and `gemini-2.0-flash` for generation. Streaming uses FastAPI's built-in `StreamingResponse` with SSE (`text/event-stream`). The vector layer is FAISS (`faiss-cpu`) loaded into memory at startup via a FastAPI lifespan singleton — no external vector database. Tenacity provides retry/backoff for Gemini API rate limit errors.

The frontend is React 18 / Vite / TypeScript with Tailwind CSS. Chat UI components are built custom (not a pre-built library) because streaming SSE is incompatible with most chat component libraries. `@microsoft/fetch-event-source` handles POST-based SSE from the browser. `react-markdown` + `remark-gfm` renders Gemini's Markdown output. State is local (`useState`/`useReducer`) — Redux/Zustand is unnecessary for a single-feature chatbot.

**Core technologies:**
- `google-genai` SDK: Gemini LLM + embeddings — Google's current SDK (deprecated `google-generativeai` replaced mid-2024)
- `gemini-2.0-flash`: LLM generation — low latency, streaming-capable, cost-efficient
- `text-embedding-004`: embeddings — 768-dim, Google's recommended retrieval model
- FastAPI + Uvicorn + Pydantic v2: backend API — async-native, SSE built-in, standard AI API stack
- FAISS (`faiss-cpu`): vector similarity — in-memory at startup, zero infra overhead at 1,600 profiles
- React 18 + Vite + TypeScript: frontend — standard stack, zero-config Vercel deploy
- Tailwind CSS: styling — utility-first, no runtime overhead, excellent for chat UI
- `@microsoft/fetch-event-source`: SSE over POST — required because native `EventSource` only supports GET
- Railway (backend) + Vercel (frontend): deployment — Railway handles Python natively; Vercel has first-class Vite support

**Version flags (must verify against PyPI/npm before pinning):** All version numbers in STACK.md are from training data (Aug 2025 cutoff). Confirm `google-genai` is the active SDK name, confirm `gemini-2.0-flash` is available on the API key tier, and confirm `@microsoft/fetch-event-source` is still maintained before starting.

### Expected Features

The non-negotiable core loop is: natural language input → loading state → AI narrative + 3 expert cards → clickable profile links. Every other feature is additive.

**Must have (table stakes):**
- Natural language input field — core interaction primitive; no query form
- Visible loading / thinking state — LLM calls take 2–8 seconds; silence is perceived as broken
- AI-generated explanatory response — trust signal; raw cards alone feel like a search engine
- Expert cards with name, title, company, rate, "why them", and profile link — the deliverable
- Clickable card → Tinrate profile — zero dead ends; every card must go somewhere actionable
- Clarifying question flow (one question only) — handles vague queries without breaking trust
- Error state (API failure) and empty/no-match state — users will hit these; no fallback = broken
- Mobile-responsive layout — >60% of discovery traffic is mobile; must be launch-day ready
- Input persistence across loading states — prevents "what did I type?" confusion
- Rate visibility on card, prominently displayed — transparency differentiator vs. typical marketplaces

**Should have (competitive differentiators for v1):**
- "Why them" explanation per card — trust signal that separates concierge from search
- Exactly 3 results (deliberate constraint, no "show more") — curated decisiveness feels premium
- Persona/use-case example prompts on empty state — reduces activation friction for cold visitors; low complexity, high impact

**Defer to v2:**
- Full conversational context carryover (multi-turn history) — highest complexity differentiator; messages array sent per-request, prompt cost growth, harder to debug; one clarifying question covers 90% of v1 needs
- Suggested follow-up prompt chips — requires Gemini to return `suggestions[]` in response schema; add when core loop is stable
- Semantic query reformulation feedback ("Searching for: X") — requires `interpreted_as` field in response schema
- Smooth card reveal animations — CSS polish, not a trust or conversion driver

**Never (explicit anti-features):**
- User accounts, authentication, saved experts — weeks of auth infrastructure for no v1 value
- Filters sidebar — defeats the concierge premise; natural language carries filter intent
- "Book now" / scheduling in-widget — booking happens on Tinrate; no duplication
- Feedback / thumbs up-down — data pipeline + storage + UI, no training loop in v1
- Pagination or "show more" — 3 results is a product decision, not a limitation

### Architecture Approach

The system has two distinct operating modes. Build-time: an offline ingestion script (`scripts/ingest.py`) reads `experts.csv`, constructs semantically rich embedding text per row, calls the Google GenAI embedding API in batches of ≤100, and writes a FAISS index + metadata JSON sidecar to disk. Runtime: FastAPI loads the FAISS index into memory at startup via a lifespan singleton, embeds each incoming query, retrieves top-8 candidates, injects them into a structured Gemini prompt (LLM writes narrative only; structured data comes from retrieval), and streams the response as SSE. The backend is stateless — conversation history lives client-side and is sent with each request.

**Major components:**
1. `scripts/ingest.py` (offline) — CSV validation, text construction, batch embedding, FAISS + metadata persistence
2. FastAPI backend (`app/`) — lifespan-managed FAISS singleton, `/api/chat` router, `/api/health` router, Pydantic schemas
3. `app/services/embedder.py` — wraps `google-genai` embed_content for both build-time and query-time use
4. `app/services/retriever.py` — wraps FAISS cosine search + metadata lookup, returns top-K profile dicts
5. `app/services/llm.py` — wraps Gemini generate_content with system prompt, JSON mode, streaming
6. `app/services/prompt_builder.py` — assembles system prompt + retrieved profiles + conversation history
7. React frontend — custom chat UI components (`ChatWindow`, `MessageBubble`, `ChatInput`, `useStreamingChat` hook), expert card rendering from structured retrieval data

**Key architectural rules:**
- Never embed CSV at API startup — pre-compute and load from disk
- Never ask Gemini to produce expert data as JSON — retrieval metadata populates cards; LLM writes narrative only
- Never maintain server-side session state — frontend sends `history[]` with each request
- Retrieve K=8 candidates, let Gemini select the best 3 — avoids forcing the LLM's hand with a too-small candidate set
- Apply a cosine similarity floor (0.70) — trigger clarifying question instead of a forced low-confidence match

### Critical Pitfalls

1. **API key leakage to frontend or git history** — Keep `GOOGLE_API_KEY` in Railway env vars only. Never prefix with `VITE_`. Add `.env` to `.gitignore` before the first commit. Add pre-commit secret scanning. Address in Phase 1 before writing any API-calling code.

2. **Embedding 1,600 experts on every cold start** — Pre-compute to `experts_embedded.pkl` or `faiss.index` + `metadata.json`. Load from disk at startup in ~2 seconds. Make re-embedding a one-off script. Address in Phase 1 during data pipeline design.

3. **Gemini producing inconsistent response formats** — Use `response_mime_type="application/json"` (JSON mode). Use a rigid system prompt with exact schema. Add server-side validation: parse JSON, assert `len(experts) == 3`, assert URLs match known patterns. Retry once on failure before returning error. Address in Phase 2 before wiring the frontend.

4. **CORS blocking the React frontend in production** — Add `CORSMiddleware` to FastAPI before writing any routes with explicit Vercel domain; never use `["*"]` in production. Address in Phase 1 backend scaffold.

5. **Railway cold starts making the app feel broken** — Add `/api/health` endpoint. Configure UptimeRobot to ping every 14 minutes to prevent container sleep. Set Railway health check timeout to 60 seconds. Show "Connecting..." state in frontend if API takes >3 seconds. Address in Phase 3 deployment.

---

## Implications for Roadmap

Based on the hard dependencies discovered in research, the build order is forced: data pipeline must exist before the API can be built, the API must work before the frontend can be wired, and deployment is last because it requires all components to be stable.

### Phase 1: Foundation — Project Setup, Data Pipeline, Backend Scaffold

**Rationale:** The FAISS index is the dependency everything else requires. Before writing a single API route, the project must have: correct `.gitignore` + secret strategy (Pitfall 1), a validated and cleaned CSV (Pitfall 8 / moderate), pre-computed embeddings persisted to disk (Pitfall 3), and a running FastAPI server with CORS configured (Pitfall 2). These are all low-risk, well-documented tasks that unblock every downstream phase.

**Delivers:** Working FAISS index on disk, FastAPI health endpoint, CORS configured, `.gitignore` + environment variable strategy locked in, CSV validation script.

**Addresses:** Input/output infrastructure; no user-facing features yet.

**Must avoid:** Embedding at startup, committing secrets, skipping CSV validation.

**Research flag:** Standard patterns — skip phase research. FastAPI scaffold, CORS setup, FAISS ingestion are all well-documented. The only uncertainty is confirming the `google-genai` SDK name before writing import statements.

### Phase 2: RAG Pipeline — Retrieval, Prompt Engineering, LLM Integration

**Rationale:** This is the highest-risk phase. Pitfall 4 (inconsistent Gemini response format) and Pitfall 5 (irrelevant retrieval) must both be solved before any UI work begins. Building and validating retrieval + prompt engineering as a standalone service layer (testable via direct Python calls and curl) lets the team verify output quality without frontend noise. Non-streaming endpoint first; streaming upgrade after retrieval and response format are confirmed correct.

**Delivers:** `embedder.py`, `retriever.py`, `llm.py`, `prompt_builder.py` with validated retrieval quality (10 manual test queries), `/api/chat` endpoint returning valid JSON with exactly 3 experts, rate limit error handling (Pitfall 10).

**Uses:** FAISS index from Phase 1, `google-genai` SDK, `tenacity` for retry logic.

**Implements:** Query embedding → top-8 retrieval → prompt construction → Gemini JSON mode → server-side response validation.

**Must avoid:** Asking Gemini to produce expert data (hallucination risk), retrieving K=3 instead of K=8, skipping manual retrieval quality testing.

**Research flag:** Needs deeper research on Gemini JSON mode configuration (`response_mime_type`, `response_schema`) — verify against current Google GenAI docs before implementing. Prompt engineering for consistent structured output is domain-specific and may require iteration.

### Phase 3: Streaming Upgrade

**Rationale:** SSE streaming is a polish step that dramatically improves perceived UX but adds complexity. It must be added after the non-streaming endpoint is confirmed correct, not during initial integration. Backend change is straightforward (swap response type); the complexity is frontend SSE consumption.

**Delivers:** `/api/chat` endpoint upgraded to SSE streaming, `useStreamingChat` React hook consuming SSE via `@microsoft/fetch-event-source`.

**Uses:** FastAPI `StreamingResponse`, `@microsoft/fetch-event-source`.

**Research flag:** Standard patterns — FastAPI StreamingResponse + SSE is well-documented. `@microsoft/fetch-event-source` usage for POST-based SSE is a known pattern. Verify the library is still maintained before depending on it.

### Phase 4: React Frontend — Chat UI and Expert Cards

**Rationale:** The frontend can only be built productively after the API is stable and streaming. Start with the core loop (input → loading → cards → link) before adding any differentiators. Mobile-responsive layout must be built in from the start, not retrofitted.

**Delivers:** `ChatWindow.tsx`, `MessageBubble.tsx`, `ChatInput.tsx`, `ExpertCard.tsx`, streaming integration, mobile-responsive layout, error state, empty/no-match state, example prompts on empty state.

**Addresses features:** Natural language input, loading state, AI narrative + expert cards, "why them" per card, rate visibility, clickable profile links, clarifying question flow, error/empty states, mobile layout, input persistence.

**Must avoid:** Pre-built chat libraries (incompatible with streaming SSE), hardcoding the backend URL (use `import.meta.env.VITE_API_URL`), missing `AbortController` timeout on fetch (Pitfall 9), missing `Content-Type: application/json` header (Pitfall 12).

**Research flag:** Standard patterns — React + Tailwind chat UI is well-trodden territory. No phase research needed.

### Phase 5: Deployment and Hardening

**Rationale:** Deployment comes last because it requires all components to be stable. The three deployment-specific pitfalls (Railway cold starts, Vercel env vars not in bundle, CORS wildcard in production) all have clear prevention steps that can only be executed when the full system exists.

**Delivers:** Railway deployment with `/api/health`, UptimeRobot ping configured, Vercel deployment with `VITE_API_URL` set before first build, production CORS locked to exact Vercel domain, `structlog` JSON logging for Railway's log viewer.

**Must avoid:** Setting `allow_origins=["*"]` in production, forgetting to set Vercel env vars before build, short Railway health check timeout.

**Research flag:** Standard patterns — Railway Procfile + $PORT convention, Vercel Vite build config, and UptimeRobot setup are all straightforward. Verify Railway's Python 3.11 support and Procfile syntax in Railway docs before deploy.

### Phase Ordering Rationale

- Data pipeline before API: The FAISS index is a hard dependency for every API route. There is no way to test retrieval without it.
- Retrieval + prompt engineering before frontend: Bad retrieval or inconsistent LLM output discovered after the UI is built forces a context switch back to the backend. Validate the AI layer in isolation first.
- Non-streaming before streaming: Streaming adds a full layer of async complexity to both backend and frontend. Confirming correct non-streaming behavior first isolates bugs to the streaming layer when they appear.
- Frontend after stable API: Building UI against an unstable API wastes iteration cycles. Wait until `/api/chat` is confirmed correct.
- Deployment last: Railway and Vercel configuration is low-complexity but has sharp pitfall edges (cold starts, env var timing). Address after all components are stable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (RAG Pipeline):** Gemini JSON mode configuration (`response_mime_type`, `response_schema` enforcement) — verify current Google GenAI Python SDK docs before writing the LLM service. Also verify current rate limits for `gemini-2.0-flash` on the project's API tier.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** FastAPI scaffold, CORS, FAISS ingestion, CSV/pandas data pipeline are all well-documented standard patterns. Only verification needed: confirm `google-genai` is the current SDK name.
- **Phase 3 (Streaming):** FastAPI SSE + `@microsoft/fetch-event-source` is a documented pattern. Verify library is maintained.
- **Phase 4 (Frontend):** React + Tailwind + TypeScript chat UI is standard. No novel patterns.
- **Phase 5 (Deployment):** Railway Procfile + Vercel Vite deploy are standard. Verify Railway Python 3.11 support in docs.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core choices (FastAPI, React, FAISS, Gemini Flash) are HIGH confidence. The `google-genai` vs `google-generativeai` SDK transition and exact model names are MEDIUM — verify on PyPI and Google AI docs before pinning. |
| Features | MEDIUM | UX patterns from AI chat products and expert marketplaces are well-established. Feature priority list is opinionated but grounded in domain conventions. No live product testing possible in this session. |
| Architecture | HIGH | RAG pipeline structure (pre-compute → FAISS → prompt injection → stream) is a well-established, stable pattern. FAISS at 1,600 profiles is trivially small. FastAPI lifespan singletons are stable. |
| Pitfalls | MEDIUM | All 14 pitfalls are grounded in real failure modes for this exact stack. Rate limit numbers (RPM/RPD) should be verified against current Google AI docs — they change. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Gemini JSON mode specifics:** The exact API parameters for enforcing JSON output (`response_mime_type="application/json"`, `response_schema`) should be verified in current Google GenAI Python SDK docs before Phase 2 begins. If JSON mode is unavailable or behaves differently, the prompt-only approach with regex validation is the fallback.

- **`google-genai` SDK name and version:** The SDK rename from `google-generativeai` to `google-genai` was announced mid-2024 and was in-progress at the August 2025 training cutoff. Confirm on PyPI (`pip index versions google-genai`) and the Google AI quickstart page before writing any imports.

- **Gemini model availability on project API key tier:** `gemini-2.0-flash` may require a paid API key tier. Confirm before building the LLM service; fall back to `gemini-1.5-flash` if unavailable.

- **Railway PostgreSQL + pgvector availability:** If the expert dataset grows or the team wants persistent embedding storage, Railway's managed Postgres with pgvector is an upgrade path. Verify pgvector extension availability on Railway's Postgres add-on before committing to that path.

- **CSV data quality (unknown until file is opened):** The actual `experts.csv` file quality is unknown. Run `scripts/validate_csv.py` as the very first action in Phase 1 — missing fields, encoding issues, or malformed URLs could change the Phase 1 scope.

---

## Sources

### Primary (HIGH confidence)
- FastAPI official docs (fastapi.tiangolo.com) — StreamingResponse, CORS middleware, lifespan events, Pydantic v2 integration
- FAISS (github.com/facebookresearch/faiss) — IndexFlatIP for cosine similarity on L2-normalized vectors
- RAG architecture patterns — Lewis et al. 2020, "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"; well-established industry pattern
- Vite official docs (vitejs.dev) — environment variable injection (`VITE_` prefix), Vercel compatibility

### Secondary (MEDIUM confidence)
- Google AI Python SDK docs (ai.google.dev) — `text-embedding-004` model, `text-embedding-004` batch limits, Gemini Flash model selection, JSON mode; based on training knowledge through August 2025
- Gemini API rate limits (ai.google.dev/gemini-api/docs/rate-limits) — 15 RPM / 1,500 RPD free tier; verify current limits before load testing
- Railway deployment docs (docs.railway.app) — Procfile + `$PORT` convention, Python runtime support; verify Python 3.11 support
- `@microsoft/fetch-event-source` (npmjs.com) — SSE over POST; verify package is still actively maintained
- AI chat UX conventions — ChatGPT, Perplexity, Claude.ai product observations; training data through August 2025

### Tertiary (LOW confidence)
- Marketplace expert-matching UX conventions — Toptal, Clarity.fm, Upwork, Expert360 product observations; no live verification in this session; use as directional guidance only

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
