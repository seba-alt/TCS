# Domain Pitfalls

**Project:** Tinrate AI Concierge Chatbot
**Domain:** RAG-based expert-matching chatbot (Google GenAI + Gemini, FastAPI, React, Vercel + Railway)
**Researched:** 2026-02-20
**Confidence:** MEDIUM — based on training knowledge (cutoff Aug 2025) covering this exact stack combination; external verification was unavailable in this session. Flag for validation before Phase 1 starts.

---

## Critical Pitfalls

Mistakes that cause rewrites, broken deployments, or fundamentally wrong outputs.

---

### Pitfall 1: API Key Leaked to Frontend or Version Control

**What goes wrong:** The `GOOGLE_API_KEY` ends up in the React bundle (committed to `.env` at repo root without `.gitignore`, or passed to the frontend via an unguarded API response) and becomes publicly extractable. This allows unlimited third-party usage billed to the project owner.

**Why it happens:** Developers add `.env` files for local dev and forget that Vite/CRA will embed any variable prefixed `VITE_` directly into the compiled JS bundle. Or the FastAPI backend logs/echoes the key in a debug endpoint left open in production.

**Consequences:**
- Google API key abuse and unexpected billing spikes
- Key revocation forces emergency redeploy
- If committed to git history, rotation alone is insufficient — history must be purged

**Prevention:**
- Keep `GOOGLE_API_KEY` only on the FastAPI backend (Railway env vars panel), never in the Vite/React build
- Never prefix it with `VITE_` — that prefix means "embed in bundle"
- Add `.env` and `.env.*` to `.gitignore` before the first commit
- Add a pre-commit hook or secret-scanning CI step (e.g., `detect-secrets` or GitHub secret scanning)
- Audit Railway environment variable settings — use Railway's encrypted secrets, not hardcoded values in `railway.toml`

**Detection (warning signs):**
- `VITE_GOOGLE_API_KEY` appears anywhere in the codebase
- `.env` file shows up in `git status` without being gitignored
- Network tab in browser DevTools shows the API key in any request or response payload

**Phase to address:** Phase 1 (project setup) — configure `.gitignore`, environment variable strategy, and Railway secrets before writing any API-calling code.

---

### Pitfall 2: CORS Misconfiguration Blocking the React Frontend

**What goes wrong:** FastAPI runs on Railway (e.g., `https://tinrate-backend.up.railway.app`) and the React app on Vercel (e.g., `https://tinrate.vercel.app`). Without explicit CORS middleware configuration, the browser blocks every API request with a CORS error — the app appears broken with zero useful error messages in the UI.

**Why it happens:** FastAPI does not enable CORS by default. `CORSMiddleware` must be added explicitly. Developers often test locally where frontend and backend share `localhost` and never encounter the issue, then ship to production and discover it immediately.

**Consequences:**
- The deployed app is completely non-functional — 100% of API calls fail
- The error appears in the browser console, not the backend logs, making it hard to diagnose without DevTools knowledge

**Prevention:**
```python
# main.py — add before route definitions
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = [
    "https://tinrate.vercel.app",        # production Vercel URL
    "https://*.vercel.app",              # preview deployments
    "http://localhost:5173",             # Vite dev server
    "http://localhost:3000",             # CRA dev server fallback
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,       # never use ["*"] in production
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)
```
- Do NOT use `allow_origins=["*"]` in production — it defeats CSRF protections
- Add the exact Vercel URL after first deployment; update if the project URL changes

**Detection (warning signs):**
- Browser console shows: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`
- API calls return `200` in Postman but fail in the browser
- Preflight `OPTIONS` requests return `403` or `404`

**Phase to address:** Phase 1 (backend scaffold) — add `CORSMiddleware` before writing any routes, with a placeholder for the Vercel URL.

---

### Pitfall 3: Embedding All 1,600 Experts on Every Cold Start

**What goes wrong:** The FastAPI startup routine calls the Google GenAI embedding API for all 1,600+ CSV rows every time the Railway container starts. With ~500ms per embedding batch call and rate limits, startup takes 3-10 minutes and often hits API quota limits before the service becomes ready.

**Why it happens:** Developers embed at startup for simplicity ("just compute them fresh each time") without realising cold starts happen frequently on Railway's free/hobby plans, and that 1,600 API calls consume a significant portion of daily free-tier quota.

**Consequences:**
- Service is unavailable for minutes after every deploy or container restart
- Embedding API quota exhausted before users can query
- Railway health checks time out, causing repeated restart loops

**Prevention:**
- Pre-compute embeddings once offline and persist them (two options, choose one):
  - **Option A (recommended for v1):** Embed all 1,600 rows locally, save as `experts_embedded.pkl` (pickle of numpy array + metadata), commit to repo or upload to Railway's persistent volume. Load from file at startup — takes ~2 seconds, zero API calls.
  - **Option B:** Store embeddings in a hosted vector DB (Supabase pgvector free tier). Query at runtime. More infra, better for v1 if data will grow.
- If re-embedding is needed (data update), make it a one-off management script (`scripts/embed_experts.py`), not part of application startup
- Cache the in-memory numpy array as a module-level singleton after first load

**Detection (warning signs):**
- Startup logs show 1,600+ embedding API calls
- Railway deploy takes more than 60 seconds to become healthy
- Google AI Studio dashboard shows embedding quota spike on every deploy

**Phase to address:** Phase 1 (data pipeline) — decide on embedding persistence strategy before writing the FastAPI startup handler.

---

### Pitfall 4: Gemini Prompt Engineering Fails to Produce Exactly 3 Experts Consistently

**What goes wrong:** The Gemini LLM is instructed to "recommend 3 experts" but sometimes returns 2, sometimes 4, sometimes a conversational response with no structured expert list, and sometimes hallucinates expert names not present in the retrieved context.

**Why it happens:** Gemini is a generative model — it does not follow format constraints reliably without explicit, rigid prompting. Without structured output enforcement, response format drifts based on phrasing of the user query.

**Consequences:**
- Frontend card rendering breaks when the response doesn't contain exactly 3 parseable expert entries
- Hallucinated experts link to non-existent profile URLs, destroying user trust
- Inconsistent UX — some queries produce cards, others produce plain text

**Prevention:**
- Use a strict system prompt that states the exact output format as a schema, not a description:
```
You are an expert-matching assistant. You MUST respond with exactly this JSON structure and nothing else:
{
  "message": "<conversational intro sentence>",
  "experts": [
    {
      "name": "<exact name from context>",
      "title": "<exact title from context>",
      "company": "<exact company from context>",
      "rate": "<exact rate from context>",
      "profile_url": "<exact URL from context>",
      "why": "<1-2 sentence explanation tailored to the user's query>"
    }
  ]
}
Return exactly 3 experts. Use only names, titles, companies, rates, and URLs that appear verbatim in the provided context. Do not invent any expert details.
```
- Use `response_mime_type="application/json"` in the Gemini API call to enforce JSON output mode (available in `gemini-1.5-flash` and `gemini-2.0-flash`)
- Add server-side validation: parse the JSON, assert `len(experts) == 3`, assert all URLs match known profile URL patterns before returning to frontend
- If validation fails, retry the generation once with a stricter prompt before returning an error

**Detection (warning signs):**
- Frontend console errors about undefined properties on expert cards
- Response text contains "Here are some experts..." instead of JSON
- Expert names in the response do not match any row in the CSV

**Phase to address:** Phase 2 (RAG pipeline) — define and test prompt schema before building frontend card rendering; frontend should never render without validation passing.

---

### Pitfall 5: Semantic Search Returns Irrelevant Experts Due to Poor Context Construction

**What goes wrong:** The top-K nearest-neighbor results from the embedding search include experts who are semantically adjacent but contextually wrong (e.g., a query for "machine learning engineer" returns "data entry specialist" because both appear in "technology" contexts). The Gemini response then recommends these irrelevant experts confidently.

**Why it happens:** The embedding is computed on the full CSV row concatenated naively (e.g., `f"{name} {title} {company} {bio}"`). If bio text is long and noisy, it dominates the embedding and dilutes the signal from title/specialisation.

**Consequences:**
- Users receive confidently-worded recommendations for wrong experts
- Trust in the product is immediately damaged — first impressions matter for a discovery tool

**Prevention:**
- Structure the embedding text deliberately, weighting important fields:
```python
def build_embedding_text(row):
    # Title and specialization carry more signal than bio length
    return f"{row['title']} at {row['company']}. {row['bio'][:300]}"
```
- Test retrieval quality manually before shipping: run 10 representative queries against the embedded CSV and inspect top-5 results
- Set K=8 (retrieve 8 candidates, pass all to Gemini, let LLM select best 3) rather than K=3 (retrieve exactly 3 and force the LLM's hand)
- Add a diversity filter: if top-3 results all have cosine similarity < 0.70, trigger the clarifying-question flow instead of forcing a match

**Detection (warning signs):**
- Manual test queries return experts with unrelated titles in top-3
- Users asking specific technical questions get generalist consultants
- Gemini response includes hedging language ("this expert may be relevant if...") despite confident prompt instructions

**Phase to address:** Phase 2 (RAG pipeline) — build embedding text constructor and validate retrieval quality before wiring to Gemini.

---

### Pitfall 6: Railway / Render Cold Starts Make the App Feel Broken

**What goes wrong:** Railway (hobby plan) and Render (free plan) spin down containers after ~15 minutes of inactivity. The first user request after a sleep period waits 20-60 seconds for the container to wake up. The React frontend shows a loading spinner for a minute then times out — users assume the app is broken.

**Why it happens:** Free/hobby tier serverless-style hosting uses aggressive container sleep policies to save resources. FastAPI has no built-in "warm-up" mechanism.

**Consequences:**
- First user of the day gets a terrible experience
- Product demonstrations fail if the backend is cold ("let me reload the page" moments)
- If the health check timeout is shorter than cold start time, Railway enters a restart loop

**Prevention:**
- **Short-term (v1):** Add a `/health` endpoint that returns `{"status": "ok"}` immediately. Use an external free uptime monitor (UptimeRobot, Better Stack free tier) to ping it every 14 minutes — prevents sleep on Railway.
- **Frontend UX:** Show a "Connecting..." state with a friendly message if the API takes >3 seconds to respond (not just a spinner)
- **Railway-specific:** Set `START_COMMAND` and ensure health check path is `/health` with a 60-second timeout in `railway.toml`
- **Medium-term:** Upgrade to Railway's $5/month "always-on" mode once the product is validated

**Detection (warning signs):**
- First request of the day takes 30-60 seconds
- Railway logs show container starting from cold on requests that should be instant
- Uptime monitor shows brief (30-60s) downtime windows

**Phase to address:** Phase 3 (deployment) — configure health endpoint and uptime pinger as part of the initial Railway deploy, not as an afterthought.

---

### Pitfall 7: Vercel Environment Variables Not Available at Runtime

**What goes wrong:** The React frontend needs to know the FastAPI backend URL (e.g., `VITE_API_URL=https://tinrate-backend.up.railway.app`). This variable is set in Vercel's dashboard but the deployed build still shows `undefined` for the API URL, causing all fetch calls to fail silently.

**Why it happens:** Vite requires env vars to be prefixed `VITE_` to be injected into the browser bundle at build time. Vercel must have the variable configured before the build runs — adding it after deployment does not retroactively update the static bundle. A redeploy is required after every environment variable change.

**Consequences:**
- All API calls go to `undefined/api/query` which returns a 404 or net::ERR_FAILED
- The bug is invisible in local dev (where `.env.local` is present) and only appears in production

**Prevention:**
- Set `VITE_API_URL` in Vercel dashboard → Settings → Environment Variables before the first deploy
- Add a runtime check at app startup:
```typescript
// src/lib/config.ts
const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  console.error("VITE_API_URL is not set — API calls will fail");
}
export { API_URL };
```
- Document in the repo's `README.md` that a redeploy is required after changing Vercel env vars
- Use Vercel's preview environment to test env var changes before promoting to production

**Detection (warning signs):**
- Network tab shows requests to `undefined/...` or `/undefined/...`
- `import.meta.env.VITE_API_URL` logs as `undefined` in browser console
- API calls work locally but fail in production Vercel deployment

**Phase to address:** Phase 3 (deployment) — set all Vercel env vars and verify them in a preview deployment before promoting to production domain.

---

## Moderate Pitfalls

---

### Pitfall 8: CSV Data Quality Breaks Embedding and Card Rendering

**What goes wrong:** The 1,600-row CSV contains inconsistent data: missing bios, malformed profile URLs (no `https://` prefix, trailing spaces), rate fields with mixed formats (`$150/hr` vs `150` vs `$150 per hour`), and special characters in names that break JSON serialization.

**Why it happens:** CSVs exported from databases or assembled manually accumulate inconsistencies over time. The expert CSV is the single source of truth — garbage in means garbage recommendations and broken card links out.

**Consequences:**
- Embedding a row with an empty bio produces a near-zero embedding that matches everything weakly
- A card with a malformed URL opens a broken link — users cannot contact experts
- Rate display inconsistency looks unprofessional

**Prevention:**
- Write a CSV validation script (`scripts/validate_csv.py`) that runs before embedding:
  - Assert required columns exist: `name`, `title`, `company`, `bio`, `hourly_rate`, `profile_url`
  - Flag rows with empty `bio` (< 20 characters)
  - Validate `profile_url` starts with `https://tinrate.com/`
  - Normalize `hourly_rate` to integer or `"$X/hr"` format
- Run this script as part of the data pipeline, not as an afterthought
- Do not embed rows that fail validation — log them and skip

**Detection (warning signs):**
- `pandas.read_csv()` throws encoding errors on load
- Expert cards in the UI show `$NaN/hr` or empty rate fields
- Profile URL links return 404

**Phase to address:** Phase 1 (data pipeline) — validate and clean CSV before embedding. Never embed raw, unvalidated data.

---

### Pitfall 9: No Request Timeout Causes Frontend Hanging Indefinitely

**What goes wrong:** The React frontend calls the FastAPI `/query` endpoint. If the backend is slow (embedding lookup, Gemini generation), the fetch call hangs indefinitely with no timeout. Users stare at a spinner. If the backend is unreachable, the browser waits the full TCP timeout (90+ seconds) before showing any error.

**Why it happens:** The native `fetch` API has no built-in timeout. Developers don't add one because it "works fine" in local dev where latency is near-zero.

**Prevention:**
```typescript
// Use AbortController for fetch timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

try {
  const response = await fetch(`${API_URL}/query`, {
    method: "POST",
    signal: controller.signal,
    body: JSON.stringify({ query: userMessage }),
    headers: { "Content-Type": "application/json" },
  });
  clearTimeout(timeoutId);
} catch (err) {
  if (err.name === "AbortError") {
    // Show timeout message to user
  }
}
```
- Display a user-friendly message: "This is taking longer than expected — try again in a moment"

**Phase to address:** Phase 2 (frontend integration) — add timeout handling when wiring the chat UI to the API.

---

### Pitfall 10: Gemini API Rate Limits on Free Tier Cause Silent Failures

**What goes wrong:** Gemini's free tier (`gemini-2.0-flash`) has rate limits: 15 requests per minute (RPM) and 1,500 RPD (requests per day) as of early 2025. If multiple users query simultaneously, or a test loop hammers the API, requests silently fail with a 429 error that the backend doesn't handle gracefully.

**Why it happens:** Free tier limits are generous enough for solo testing but break under simultaneous user load. Error handling for 429 is often omitted in early development.

**Prevention:**
- Add explicit 429 error handling in FastAPI:
```python
import google.generativeai as genai
from fastapi import HTTPException

try:
    response = model.generate_content(prompt)
except Exception as e:
    if "429" in str(e) or "quota" in str(e).lower():
        raise HTTPException(status_code=503, detail="Service temporarily busy. Please try again.")
    raise
```
- Return a user-friendly 503 with `Retry-After` header
- Log quota errors separately so they're visible in Railway logs
- Consider upgrading to pay-as-you-go tier once validated (cost per query is very low at this scale)

**Phase to address:** Phase 2 (RAG pipeline) — add rate limit error handling before any load testing or sharing the URL publicly.

---

## Minor Pitfalls

---

### Pitfall 11: Hardcoded Backend URL in React Code

**What goes wrong:** The Railway backend URL is hardcoded as a string literal in the React fetch call. When the Railway project is recreated or the URL changes, the frontend breaks and requires a code change + redeploy.

**Prevention:** Always read the backend URL from `import.meta.env.VITE_API_URL`. Never hardcode `https://tinrate-backend.up.railway.app` in source code.

**Phase to address:** Phase 2 (frontend) — enforce via code review before first commit of fetch logic.

---

### Pitfall 12: Missing `Content-Type: application/json` Header on Frontend Requests

**What goes wrong:** FastAPI's JSON body parsing fails silently or returns a `422 Unprocessable Entity` when the React frontend sends a `POST` without `Content-Type: application/json`. FastAPI's Pydantic models cannot parse the body.

**Prevention:** Always set `headers: { "Content-Type": "application/json" }` in every `fetch` POST call. Validate with a Postman or curl test before building the UI.

**Phase to address:** Phase 2 (API integration).

---

### Pitfall 13: CSV Encoding Issues (Non-UTF-8 Characters in Expert Names/Bios)

**What goes wrong:** Expert names with accented characters (é, ü, ñ) or bios with smart quotes cause `pandas.read_csv()` to raise `UnicodeDecodeError` if the CSV was saved in Windows-1252 encoding.

**Prevention:**
```python
df = pd.read_csv("experts.csv", encoding="utf-8-sig")  # handles BOM + UTF-8
# Or detect encoding:
import chardet
with open("experts.csv", "rb") as f:
    enc = chardet.detect(f.read())["encoding"]
df = pd.read_csv("experts.csv", encoding=enc)
```

**Phase to address:** Phase 1 (data pipeline) — test CSV load with the actual file before any other work.

---

### Pitfall 14: Vercel Serverless Function Timeout for Slow Gemini Responses

**What goes wrong:** If the React app is ever set up with a Vercel API route (not the Railway backend), Vercel's default function timeout is 10 seconds. Gemini generation can take 5-12 seconds under load. This is a non-issue if the backend is on Railway (no timeout), but becomes critical if someone moves API logic to Vercel functions.

**Prevention:** Keep all AI logic on Railway/Render backend. Do not move Gemini calls to Vercel API routes. Document this constraint explicitly in `ARCHITECTURE.md`.

**Phase to address:** Phase 1 (architecture decision) — document and enforce the Railway-for-AI-logic constraint.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Project setup | API key in `.env` committed to git | Add `.gitignore` and secret scanning before first commit |
| CSV data pipeline | Encoding errors, empty bios, malformed URLs | Run `validate_csv.py` before embedding; fix data first |
| Embedding generation | 1,600 API calls on every startup | Pre-compute embeddings to `.pkl` file; load from disk at startup |
| FastAPI CORS setup | Browser blocks all cross-origin requests | Add `CORSMiddleware` with explicit Vercel domain before any routes |
| Gemini integration | Non-JSON or wrong-count responses | Use JSON mode, strict schema prompt, server-side validation |
| Semantic retrieval | Irrelevant experts in top-K | Test retrieval manually with 10 queries; retrieve K=8, select 3 |
| Frontend fetch | Hanging requests on cold starts | Add 15-second `AbortController` timeout; show user-friendly message |
| Railway deployment | Cold start delays | Add `/health` endpoint; configure UptimeRobot ping every 14 minutes |
| Vercel deployment | Env vars not in bundle | Set `VITE_API_URL` in Vercel dashboard before first build; redeploy after changes |
| Rate limits | Silent 429 failures under load | Handle 429 explicitly; return 503 to frontend; log quota errors |

---

## Sources

**Note:** External web search and documentation fetch were unavailable in this session. The following sources informed this document through training knowledge (cutoff August 2025). Each claim should be verified against current official documentation before implementation.

- Google AI Developer documentation: https://ai.google.dev/gemini-api/docs
- Google GenAI Python SDK: https://github.com/google-gemini/generative-ai-python
- FastAPI CORS documentation: https://fastapi.tiangolo.com/tutorial/cors/
- Vite environment variables: https://vitejs.dev/guide/env-and-mode
- Railway deployment documentation: https://docs.railway.app
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Gemini API rate limits (verify current): https://ai.google.dev/gemini-api/docs/rate-limits
- Confidence level: MEDIUM — all pitfalls are grounded in well-established patterns for this stack; specific rate limit numbers and API behaviors should be verified against current Google AI documentation before Phase 1 begins
