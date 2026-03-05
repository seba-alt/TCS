# Phase 2: RAG API - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

An API endpoint (`POST /api/chat`) that accepts a natural language query and returns exactly 3 matched experts with explanations — retrieved via FAISS embedding search, generated via Gemini. Verified correct before any frontend work begins. Frontend prompt UI and expert card rendering are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### SSE Stream Structure
- Emit a `status: thinking` event immediately after receiving the request so the frontend knows processing has started
- Stream design (token order, event types, final payload structure): Claude's discretion — pick the most frontend-friendly, practical approach
- On Gemini call failure: **retry** before giving up — do not immediately surface an error to the caller
- SSE event typing (named events vs plain `data:` events): Claude's discretion

### Low-Confidence / Vague Query Handling
- Trigger: **both** a FAISS similarity score threshold check AND LLM judgment on borderline cases — score check runs first (fast), then Gemini evaluates match quality before committing to experts
- Clarifying question format (structured JSON vs streamed text): Claude's discretion — pick the cleanest approach for the frontend to consume
- Follow-up queries: sent as **POST with conversation history** (prior messages included as context for re-retrieval)
- History window: **last N messages, configurable** — sliding window; older messages dropped to keep embeddings focused

### Email Capture and Conversation Logging
- The API must **capture the user's email before returning expert recommendations** — email is a required field in the request (or a pre-chat step)
- All conversation data (email + query + response) is **stored in a database**
- Frontend (Phase 3) will prompt for email before the chat begins; API enforces that email is present
- This is a lead capture and analytics requirement — all conversations must be persisted

### "Why Them" Explanation Depth
- Length: **1-2 sentences per expert** — short and punchy
- Style: **query-specific and profile-grounded** — explicitly reference the expert's title, company, or domain and tie it directly to what the user asked; no hallucinated detail
- Response structure: **single combined narrative text** — one prose block that includes a brief intro (1-2 sentences) followed by all 3 expert explanations; not per-expert JSON fields
- The response JSON contains: `narrative` (the combined text), `experts` array (name, title, company, hourly_rate, profile_url), and `type` (e.g., `match` or `clarification`)

### Incomplete Expert Data Handling
- If a CSV row is missing required fields (name, title, company, hourly rate): **omit that expert from results** — do not surface partial or placeholder data
- Exception: if the **profile URL is missing**, still include the expert — just omit the link field
- Retrieval should continue to the next best match to fill the 3-expert quota when one is omitted

### Claude's Discretion
- SSE event type naming and stream ordering (token sequence, when experts are emitted vs narrative)
- Retry strategy for Gemini failures (number of retries, backoff)
- Clarifying question response format (structured vs streamed) — pick what's cleanest for Phase 3 frontend
- Cosine similarity threshold value for low-confidence detection
- Database schema for conversation logging

</decisions>

<specifics>
## Specific Ideas

- Email capture is primarily a **lead generation and analytics** feature — every conversation must be tied to an email so the business can follow up
- The `status: thinking` SSE event is important — the frontend should show a loading state the moment the request is received, not after the first token

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope (email capture was added to Phase 2 API scope and Phase 3 frontend scope)

</deferred>

---

*Phase: 02-rag-api*
*Context gathered: 2026-02-20*
