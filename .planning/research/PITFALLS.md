# Pitfalls Research

**Project:** Tinrate AI Concierge Chatbot — v1.1 Expert Intelligence & Search Quality
**Domain:** Batch AI tagging + FAISS hot-swap + query expansion + sparse feedback learning on existing RAG system
**Researched:** 2026-02-21
**Confidence:** MEDIUM-HIGH — rate limit and FAISS thread-safety claims verified against official Google and FAISS documentation; feedback cold-start claims are well-established in recommender systems literature; Railway volume constraints verified against Railway docs.

---

## Critical Pitfalls

Mistakes that cause broken data pipelines, production downtime, or permanently degraded retrieval quality.

---

### Pitfall 1: Embedding API Silently Throttled During 1,558-Expert Re-ingest

**What goes wrong:**
The `google-genai` SDK's `embed_content()` call routes exclusively through the `batchEmbedContents` endpoint, which has a 150-request rate limit. When embedding all 1,558 experts sequentially in a tight loop (even with chunked batches), the process hits 429 errors mid-run. If errors are not caught and retried, the run silently produces a partial FAISS index — fewer than 1,558 vectors — with no warning. The index appears complete and loads successfully, but search quality is permanently degraded because a third of the expert pool is missing.

**Why it happens:**
Developers call `embed_content()` for each expert record in a loop without rate-limit handling, expecting the SDK to manage throttling. The SDK does not transparently handle 429s in embedding calls. The FAISS index write succeeds with however many vectors were generated before the quota error, so there is no crash to alert the developer.

**How to avoid:**
- Implement exponential backoff with jitter using `tenacity` around every embedding call:
  ```python
  from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
  import google.api_core.exceptions

  @retry(
      retry=retry_if_exception_type(Exception),
      wait=wait_exponential(multiplier=1, min=2, max=60),
      stop=stop_after_attempt(6)
  )
  def embed_one(client, text: str) -> list[float]:
      result = client.models.embed_content(model="text-embedding-004", contents=text)
      return result.embeddings[0].values
  ```
- Add a sleep between batches: `time.sleep(0.5)` between every 10 embeddings is safe for free tier; `time.sleep(0.2)` for paid.
- After generating all embeddings, assert `len(embeddings) == 1558` before writing the FAISS index. Abort and log if the count is wrong.
- Run re-ingest as an offline script (`scripts/reindex_experts.py`) not in-process. Write the index to a temp file first, then replace the live file only after the count assertion passes.
- If the SDK consistently throttles, bypass `embed_content()` and call `embedContent` (singular) via direct HTTP POST — this avoids the batch endpoint's tighter quota.

**Warning signs:**
- Script finishes in less than 3 minutes for 1,558 experts (embeddings take ~0.3s each; a full run should take at least 8 minutes)
- FAISS index file is smaller than the v1.0 index that held 530 vectors
- `faiss.read_index(path).ntotal` returns a value below 1,558 after the run

**Phase to address:** Phase 1 (batch tagging) — validate count before writing index. This check costs 1 line and saves debugging a silent data quality regression.

---

### Pitfall 2: Gemini LLM Produces Inconsistent Tags Across the Batch (Schema Drift)

**What goes wrong:**
When tagging 1,558 experts with a single LLM call per expert (or small batch), temperature > 0 and CUDA batch-size variation cause the same prompt to produce structurally different outputs across the run. Some experts get 3 tags, others get 7. Some tags are capitalized, others lowercase. Some are comma-separated strings, others are JSON arrays. The tag schema drifts across the run without any single call failing. The resulting `metadata.json` is inconsistent, FAISS embedding text varies in structure, and the admin tab displays garbled tag data.

**Why it happens:**
LLMs are non-deterministic. Research confirms that even `temperature=0` with identical prompts yields structurally different outputs when CUDA batch sizes vary (batch-sensitive nondeterminism). Long batch runs accumulate these structural variations silently. Without output validation after each call, bad tags are written to disk alongside good ones.

**How to avoid:**
- Use `response_mime_type="application/json"` and a `response_schema` with Gemini to enforce structured output:
  ```python
  from google.genai import types

  schema = types.Schema(
      type=types.Type.OBJECT,
      properties={
          "tags": types.Schema(
              type=types.Type.ARRAY,
              items=types.Schema(type=types.Type.STRING),
              min_items=3,
              max_items=6
          )
      },
      required=["tags"]
  )
  ```
- Set `temperature=0` to minimize variation (does not eliminate it, but reduces frequency).
- After each LLM response, validate: assert `isinstance(tags, list)`, assert `3 <= len(tags) <= 6`, assert all tags are non-empty strings. Retry once on validation failure before logging and skipping.
- Write tags to a staging file (`data/tags_staging.json`) rather than directly overwriting `metadata.json`. Review a sample (20–30 experts) before promoting to production.
- Run a post-processing normalization step: lowercase all tags, strip whitespace, deduplicate.

**Warning signs:**
- Sample of 10 tagged experts shows tags in mixed case and varying counts
- `metadata.json` has entries where `tags` is a string rather than a list
- Admin Expert tab shows some experts with 1 tag, others with 10+

**Phase to address:** Phase 1 (batch tagging) — enforce JSON schema and validate output before writing. Never write raw LLM output directly to the source-of-truth file.

---

### Pitfall 3: FAISS Index Hot-Swap Corrupts In-Flight Search Requests

**What goes wrong:**
The re-ingest script writes a new `faiss.index` file to the Railway volume and the FastAPI app detects this and reloads the global index variable in-process. However, FAISS is thread-safe for concurrent reads but NOT for write operations. If a user search request reads the global index at the same moment the reload writes to it, the behavior is undefined — the app may return garbage results, raise a segfault-style error, or silently return zero results. This is a race condition that is difficult to reproduce locally (single-threaded dev) but occurs in production under any real user load.

**Why it happens:**
Python global variables are shared across all request handler threads in FastAPI. Reassigning a global FAISS index object (`app.state.index = new_index`) is not an atomic operation. The old index object is not safely garbage-collected while search threads hold a reference to it.

**How to avoid:**
- Use a `threading.Lock` around the index replacement:
  ```python
  import threading
  import faiss

  _index_lock = threading.Lock()
  _current_index = None  # module-level global

  def get_index():
      return _current_index  # safe for reads (Python GIL protects reference reads)

  def replace_index(new_index_path: str):
      global _current_index
      new_index = faiss.read_index(new_index_path)
      with _index_lock:
          old = _current_index
          _current_index = new_index
          del old  # explicit release
  ```
- FAISS CPU index search is thread-safe for concurrent reads. Only the replacement itself needs the lock, and it is fast (microseconds for a 1,558-vector index).
- Write the new index to a temp file first (`faiss.index.tmp`), then use `os.replace()` (atomic on POSIX) to swap the file on disk: `os.replace("faiss.index.tmp", "faiss.index")`. This ensures the file on disk is never in a half-written state if the process restarts mid-write.
- The simplest safe approach for 1,558 vectors: trigger a Railway redeploy after re-indexing. Cold-start takes ~5 seconds at this scale, which is acceptable for a planned maintenance event. This avoids all in-process hot-swap complexity.

**Warning signs:**
- Search requests return 0 results immediately after index reload triggers
- FastAPI logs show AttributeError or segfault-adjacent errors during index reload
- Railway logs show simultaneous "reloading index" and "search request" log lines

**Phase to address:** Phase 2 (FAISS re-ingest) — decide on hot-swap vs. redeploy strategy before writing index reload code. At 1,558 vectors, redeploy is the safer default.

---

### Pitfall 4: Railway Volume Not Accessible During the Build/Pre-Deploy Phase

**What goes wrong:**
The re-ingest script is added as a Railway pre-deploy command to run before the server starts. The script attempts to write the new FAISS index to the persistent volume path. The command fails silently or with a permissions error because Railway does not mount persistent volumes during pre-deploy — volumes are only mounted during the start command (runtime).

**Why it happens:**
Railway's pre-deploy command executes in a separate container from the application, specifically without volume mounts. This is documented but easy to miss when setting up automated re-indexing workflows.

**How to avoid:**
- Run re-ingest as part of the application start sequence, not pre-deploy:
  ```python
  # In FastAPI lifespan or startup handler:
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Volume IS mounted here — safe to read/write FAISS index
      load_or_rebuild_index()
      yield
  ```
- Alternatively, run re-ingest manually from a local script that uploads the index to the volume via Railway's volume UI or SSH, then redeploy the app (which reads the updated index from the volume at startup).
- Never put index write operations in Railway's `nixpacks.toml` build command or pre-deploy field.

**Warning signs:**
- Pre-deploy logs show `FileNotFoundError` or `PermissionError` on the volume path
- The FAISS index on the volume is not updated despite the pre-deploy script "succeeding" (it ran against a temp filesystem, not the volume)
- Railway deploy completes but the app starts with the old index

**Phase to address:** Phase 2 (FAISS re-ingest) — test index write in Railway's start command context, not pre-deploy, before building any automation around it.

---

### Pitfall 5: Query Expansion Causes Query Drift — Worse Results Than No Expansion

**What goes wrong:**
Query expansion is implemented by asking Gemini to generate 2–3 synonymous reformulations of the user's query, then running FAISS search for each and merging results. Gemini introduces semantically adjacent but domain-wrong terms. A user query "I need a UX designer for a mobile app" expands to include "product designer," "user researcher," and "app developer." The expansion retrieves mobile developers and market researchers who dominate the merged result set, pushing the UX specialists the user actually wanted further down. The Gemini response confidently recommends wrong experts.

**Why it happens:**
LLMs expand queries based on general language patterns, not domain-specific retrieval logic. They do not know which expansions will retrieve better-matching experts from THIS specific corpus. Over-expansion introduces hard negatives — semantically adjacent but contextually wrong passages — that dilute the retrieval signal. Research confirms this: "increasing retrieved passages does not consistently improve performance; hard negatives can mislead LLMs even when relevant passages are available."

**How to avoid:**
- Weight the original query more heavily than expansions. Run FAISS search with original query and get top-K. Only use expansion results to break ties or fill gaps when original query returns fewer than K results above the similarity threshold.
  ```python
  # Conservative expansion pattern:
  original_results = search(original_query, k=8)
  if len([r for r in original_results if r.score > THRESHOLD]) >= 3:
      return original_results  # original was good enough
  # Only expand if original retrieval is weak:
  expanded_results = [search(q, k=4) for q in expand_query(original_query)]
  ```
- Limit expansions to 2 maximum. More than 2 expansions dramatically increases noise.
- Test expansion on 20 representative queries BEFORE shipping. Compare results with and without expansion. If expansion reduces precision on more than 25% of test queries, disable it for that query type.
- Add a similarity ceiling: discard any expansion result with cosine similarity lower than the worst original result. Expansion should only add, not replace.
- Measure impact using the existing feedback signals: track thumbs-up rate per query, compare pre/post expansion.

**Warning signs:**
- Queries that returned accurate experts in v1.0 now return adjacent-but-wrong experts
- Gemini response includes hedging language about expert relevance
- Admin test lab shows lower thumbs-up rate after expansion is enabled

**Phase to address:** Phase 3 (search intelligence) — run A/B comparison on test set before enabling expansion in production. Have an env var flag to disable expansion independently: `QUERY_EXPANSION_ENABLED=true`.

---

### Pitfall 6: Sparse Feedback Signals Applied Too Early Create a Feedback Loop (Popularity Bias)

**What goes wrong:**
The system has collected thumbs feedback for a few weeks. A few popular experts (those with clear, well-written bios, prominent job titles, or who happen to match common query types) accumulate thumbs-up signals faster than niche experts. When feedback signals are used to boost expert ranking, the popular experts get promoted further, receive even more exposure, accumulate more thumbs-up, and get boosted further still. Niche experts who are legitimately best-matched for specific queries never get shown — they cannot accumulate feedback because they never rank high enough to receive impressions. The retrieval system degrades to a popularity contest.

**Why it happens:**
This is the classic cold-start / popularity bias problem in recommender systems. Feedback signals are inherently biased by position: experts shown in position 1 receive more clicks and thumbs-up than identical experts shown in position 3, purely due to presentation order, not quality.

**How to avoid:**
- Apply a minimum feedback threshold before promoting any expert based on signals: require at least 10 thumbs-up interactions (not just positive rate) before the feedback signal influences ranking. Below this threshold, fall back to pure semantic similarity.
  ```python
  MIN_FEEDBACK_INTERACTIONS = 10

  def get_score_boost(expert_id: int) -> float:
      stats = db.query(ExpertFeedback).filter_by(expert_id=expert_id).first()
      if not stats or stats.total_interactions < MIN_FEEDBACK_INTERACTIONS:
          return 0.0  # no boost — insufficient data
      positive_rate = stats.thumbs_up / stats.total_interactions
      return (positive_rate - 0.5) * 0.2  # max ±0.1 boost on similarity score
  ```
- Cap the maximum boost to a small fraction of the similarity score (10–20%). Feedback should refine retrieval, not override it.
- Separate feedback learning from retrieval so they can be toggled independently: `FEEDBACK_LEARNING_ENABLED=true`.
- Log which experts receive impressions vs. thumbs per query type. If impression distribution becomes highly concentrated (top 20 experts receiving 80% of all impressions), that's a signal of runaway popularity bias.
- Consider exploration: occasionally surface a lower-ranked expert (position 3 swap) to allow niche experts to collect feedback. A/B this carefully.

**Warning signs:**
- The same 20–30 experts appear in nearly all recommendations regardless of query content
- Niche experts with specific skills (e.g., "blockchain auditor," "marine biologist consultant") never appear despite existing in the database
- Thumbs-up rate initially improves then plateaus — the system is optimizing for a narrow popular slice

**Phase to address:** Phase 3 (search intelligence) — set the minimum threshold constraint and the boost cap BEFORE writing any feedback-weighting code. These are policy decisions, not implementation details.

---

## Moderate Pitfalls

---

### Pitfall 7: Findability Score Used as a Ranking Signal Introduces Circular Bias

**What goes wrong:**
The findability score (0–100, based on bio quality, tags, profile completeness) is computed and then used both for admin visibility AND as a retrieval ranking signal. Experts with high findability scores get recommended more often. Those recommendations generate thumbs-up feedback. The feedback further boosts those experts. Meanwhile, experts with low findability scores (incomplete bios, missing tags) get recommended less, never accumulate feedback, and their findability score never improves because the score depends on profile completeness — which only the platform owner can fix, not the algorithm.

**Why it happens:**
Conflating a data quality metric (findability) with a retrieval ranking signal creates a self-reinforcing loop. The score was designed to flag profiles that need improvement, not to function as a quality signal in retrieval.

**How to avoid:**
- Keep findability score as an admin-facing diagnostic only. Do not use it as a retrieval ranking signal in v1.1.
- Use findability scores to prioritize which expert profiles to enrich (admin workflow: worst-first queue), not to penalize those experts in search results.
- If findability must influence retrieval, apply it only as a soft filter (e.g., experts below score 20 are excluded from recommendations until their profile is fixed), never as a continuous ranking modifier.

**Phase to address:** Phase 1 (findability scoring) — document explicitly that findability score is an admin data quality metric, not a retrieval ranking signal.

---

### Pitfall 8: Re-ingest Script Overwrites Metadata.json Partially on Crash

**What goes wrong:**
The batch tagging script writes tags back to `metadata.json` as it processes experts, updating the file record-by-record. If the script crashes at expert #800, the file contains 800 tagged experts and 758 untagged experts in a mixed state. The FAISS re-ingest then runs against this partial file, producing an index where half the experts have enriched embeddings and half have impoverished ones. This split-quality index is worse than either the fully-tagged or fully-untagged version because the embedding space is incoherent.

**Why it happens:**
In-place file updates without transactional semantics mean any crash leaves the file in an intermediate state. The script is not idempotent — re-running it from the beginning may double-tag already-processed experts.

**How to avoid:**
- Write a separate staging file during the batch run: `data/tags_staging.json`. Only copy it to `metadata.json` after all 1,558 experts are processed and the count assertion passes.
- Make the script idempotent: check if each expert already has a valid `tags` field before calling the LLM. Skip if already tagged.
- Track progress: write a `data/tagging_progress.json` with `{"last_processed_index": 800}` after each expert. On restart, resume from `last_processed_index`.
- Command pattern:
  ```bash
  # Safe run:
  python scripts/tag_experts.py --resume --output data/tags_staging.json
  # After verification:
  python scripts/promote_tags.py  # copies staging → metadata.json
  ```

**Phase to address:** Phase 1 (batch tagging) — implement resume/idempotent pattern before starting the batch run on the full 1,558-expert set.

---

### Pitfall 9: Gemini Rate Limits Block Both Tagging AND User Queries Simultaneously

**What goes wrong:**
The batch tagging script runs on Railway (or locally with the same API key) while the production chatbot is receiving user queries. Both the tagging script and the user query handler share the same Google API project quota. The tagging script exhausts RPM or daily quota, causing user-facing queries to return 429 errors and the chatbot to appear broken — during a planned maintenance task.

**Why it happens:**
Google API rate limits are enforced per project, not per API key. Running a heavy batch job with the same credentials as the production service consumes shared quota.

**How to avoid:**
- Run the batch tagging script at a time of low user traffic (night/weekend) to minimize overlap.
- Add explicit rate limiting in the tagging script: never exceed 8 RPM for LLM calls (conservative for free tier), regardless of how fast the API accepts requests.
- Handle quota errors in the user-facing query handler independently of tagging errors:
  ```python
  # In query handler:
  except Exception as e:
      if "429" in str(e) or "quota" in str(e).lower():
          raise HTTPException(503, "Busy — please try again in a moment.")
  ```
- Consider using the Gemini Batch API for tagging: batch jobs run asynchronously, have separate rate limits from the interactive API, and cost 50% less. The 24-hour turnaround is acceptable for a one-time tagging job.

**Phase to address:** Phase 1 (batch tagging) — set the RPM cap in the tagging script before running it against the production API key. Run during off-peak hours.

---

### Pitfall 10: Query Expansion Adds Latency That Breaks the UX Contract

**What goes wrong:**
Each query expansion round-trips to Gemini to generate reformulations, then runs 2–3 additional FAISS searches, then merges and deduplicates results. Total added latency: 800ms–2s per query. The existing query handler already takes 2–4 seconds (embedding + FAISS + generation). With expansion enabled, queries take 4–6 seconds. Users experience the chatbot as "slow" or "frozen" — especially on mobile. The product's core UX value ("instant match") is compromised.

**Why it happens:**
Query expansion is implemented naively as a synchronous pre-step before the main retrieval, adding serial latency without parallelism.

**How to avoid:**
- Run expansion and original query in parallel using `asyncio.gather()`:
  ```python
  async def search_with_expansion(query: str) -> list:
      original_task = asyncio.create_task(search(query, k=8))
      expansion_task = asyncio.create_task(expand_and_search(query, k=4))
      original_results, expanded_results = await asyncio.gather(
          original_task, expansion_task
      )
      return merge_results(original_results, expanded_results)
  ```
- Set a timeout on expansion: if the expansion LLM call takes more than 1 second, skip it and use original results.
- Log per-query latency before and after enabling expansion. If p95 latency exceeds 5 seconds, disable expansion.

**Phase to address:** Phase 3 (search intelligence) — benchmark latency with and without expansion before enabling in production.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Write tags directly to `metadata.json` in-place | Simpler code | Partial corruption on crash; non-idempotent | Never — always use staging file |
| Use same API key for batch tagging and production queries | No extra setup | Batch job exhausts production quota | Never — run batch at low-traffic time or use Batch API |
| Apply feedback boosts without a minimum interaction threshold | Faster "learning" | Popularity bias, niche expert suppression | Never — always require minimum 10 interactions |
| Skip FAISS index count assertion after re-ingest | Saves one line | Silent partial index — impossible to detect | Never — costs 1 line of code, prevents major data regression |
| Hot-swap FAISS index in-process without a lock | Simpler than redeploy | Race condition, undefined behavior under load | Acceptable only with proper threading.Lock — otherwise trigger redeploy |
| Enable query expansion for all queries regardless of original result quality | Simpler logic | Drift degrades queries that were already accurate | Never — gate expansion on weak original results only |
| Build findability score as retrieval signal (not just admin diagnostic) | More signals = better? | Circular bias, popular experts dominate niche queries | Never in v1.1 — keep as admin-only diagnostic |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google GenAI embeddings | Calling `embed_content()` in tight loop, hitting 150-req batch limit | Add `tenacity` retry with exponential backoff; sleep 0.2s between calls; validate count before writing index |
| Google Gemini LLM (tagging) | No output schema enforcement — tags arrive in mixed formats | Use `response_mime_type="application/json"` + `response_schema` with `min_items`/`max_items` constraints |
| Railway persistent volume | Writing index in pre-deploy command — volume not mounted there | Write index only in startup/lifespan handler (runtime), not pre-deploy |
| FAISS in-memory index | Replacing global index variable without a lock during live traffic | Use `threading.Lock` around reassignment, or trigger a redeploy instead |
| Gemini Batch API | Running two separate identical job submissions (non-idempotent) | Track job ID in a local file; check if job already exists before submitting |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous query expansion as serial pre-step | p95 latency 5–8s; users abandon | Parallelize with `asyncio.gather`; timeout after 1s | At any traffic level — latency is additive |
| Feedback-weighted ranking without impression normalization | Top 20 experts receive 80% of recommendations | Cap boost to 10–20% of similarity score; require minimum 10 interactions | After ~100 feedback events accumulate |
| Full FAISS re-ingest at container startup | 5–10 minute startup on rebuild | Pre-compute index offline; write to volume; startup reads from volume | At 1,558 vectors: ~30s acceptable. At 10k+: unacceptable |
| Expanding all queries regardless of original retrieval quality | Retrieval precision drops 20–30% | Gate expansion on weak original results (below similarity threshold) | From day 1 — drift affects even low-traffic systems |
| Writing tags to metadata.json record-by-record during batch run | Partial corruption on crash; half-enriched embeddings | Write to staging file; promote atomically after full run | At ~800th record if crash occurs |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using production GOOGLE_API_KEY for local batch tagging runs | Batch script exhausts production daily quota | Use a separate Google Cloud project or API key for batch jobs; or run via Railway environment |
| Storing raw user thumbs feedback without rate-limiting the feedback endpoint | Feedback poisoning — malicious actor repeatedly thumbs-down an expert to suppress them | Rate-limit feedback endpoint: 1 feedback per session per expert per query; validate session token |
| Exposing admin Expert tab with tags and findability scores to unauthenticated users | Competitive intelligence leak; exposes data quality weaknesses | Ensure all Expert tab endpoints require `X-Admin-Key` header — verify CORS + auth middleware order |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Batch tagging complete:** Tags in `metadata.json` — verify `len(experts_with_tags) == 1558` before marking done. Check 20 random experts for tag format consistency.
- [ ] **FAISS re-ingest complete:** New index loaded — verify `faiss.read_index(path).ntotal == 1558`. Check that `metadata.json` expert order matches index vector order exactly (ID alignment is critical).
- [ ] **Findability scores computed:** Scores visible in admin — verify score distribution is not all 100s (a bug in the scoring function that defaults to max is easy to miss).
- [ ] **Query expansion enabled:** Expansion logic merged — verify that queries that worked correctly in v1.0 still return the same top-3 experts. Run the 10-query regression test from Phase 2 research.
- [ ] **Feedback learning live:** Boost code merged — verify that an expert with zero feedback receives the same ranking as in v1.0 (no regression). Verify an expert with 20 thumbs-up receives a measurably higher ranking on relevant queries.
- [ ] **Admin Expert tab enriched:** Tag and score columns visible — verify that clicking "sort by findability score worst-first" works correctly for scores of 0.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Partial FAISS index (silent embedding failure) | MEDIUM | Re-run `scripts/reindex_experts.py` with resume flag; assert count before promoting; redeploy |
| Schema-drifted tags in `metadata.json` | LOW | Run tag normalization script: lowercase, deduplicate, validate schema; re-run tagging for experts with invalid format |
| FAISS hot-swap race condition caused bad results | LOW | Trigger Railway redeploy — app restarts with clean index load; race condition resolves on restart |
| Railway volume write failed (pre-deploy) | LOW | Move write operation to startup lifespan handler; redeploy |
| Query expansion degraded retrieval quality | LOW | Set `QUERY_EXPANSION_ENABLED=false` env var; redeploy; retrieval reverts to v1.0 behavior immediately |
| Feedback popularity bias locked in | HIGH | Reset all feedback boost weights to 0; rebuild scoring with higher minimum threshold and lower boost cap; manually audit top-20 most-recommended experts for quality |
| Gemini daily quota exhausted by batch job | MEDIUM | Wait for quota reset at midnight Pacific; run remaining batch during off-peak hours with tighter RPM cap; upgrade to paid tier if recurring |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Embedding API throttling → partial FAISS index | Phase 1: batch tagging | Assert `ntotal == 1558` before promoting index |
| LLM schema drift in tags | Phase 1: batch tagging | Validate tag format on every LLM response; sample 30 random experts before promoting |
| Crash leaves metadata.json partially updated | Phase 1: batch tagging | Use staging file + idempotent resume logic |
| Batch tagging exhausts production quota | Phase 1: batch tagging | Set 8 RPM cap; schedule for off-peak; handle 429 in query handler independently |
| Railway volume not mounted in pre-deploy | Phase 2: FAISS re-ingest | Test index write in lifespan startup handler before automating |
| FAISS hot-swap race condition | Phase 2: FAISS re-ingest | Use threading.Lock or trigger redeploy; verify no errors under concurrent load after index reload |
| Findability score misused as retrieval signal | Phase 2: findability scoring | Document as admin-only diagnostic; no retrieval weight assigned in v1.1 |
| ID alignment between metadata.json and FAISS index | Phase 2: FAISS re-ingest | Assert expert order before embedding; log `(index_position, expert_id)` pairs |
| Query expansion causing drift | Phase 3: search intelligence | Gate on weak original results; run 10-query regression before enabling; A/B with thumbs rate |
| Query expansion latency degradation | Phase 3: search intelligence | Parallelize with asyncio.gather; benchmark p95 latency before and after |
| Feedback cold-start / popularity bias | Phase 3: search intelligence | Require minimum 10 interactions before applying boost; cap boost at 20% of similarity score |
| Feedback loop suppresses niche experts | Phase 3: search intelligence | Monitor impression distribution; log if top-20 experts receive >70% of impressions |

---

## Sources

- Google Gemini API rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Google Gemini Batch API documentation: https://ai.google.dev/gemini-api/docs/batch-api
- google-genai SDK batch embedding rate limit issue (GitHub #427): https://github.com/googleapis/python-genai/issues/427
- FAISS thread safety documentation: https://github.com/facebookresearch/faiss/wiki/Threads-and-asynchronous-calls
- FAISS write_index persistence (GitHub issue #2078): https://github.com/facebookresearch/faiss/issues/2078
- Railway volumes documentation (volumes not mounted during pre-deploy): https://docs.railway.com/volumes
- Railway pre-deploy command documentation: https://docs.railway.com/guides/pre-deploy-command
- FastAPI concurrent global variable race conditions: https://datasciocean.com/en/other/fastapi-race-condition/
- Google Cloud 429 error handling guide: https://cloud.google.com/blog/products/ai-machine-learning/learn-how-to-handle-429-resource-exhausted-errors-in-your-llms
- LLM batch-sensitive nondeterminism research (Thinking Machines Lab): https://superintelligencenews.com/research/thinking-machines-llm-nondeterminism-inference/
- Query expansion pitfalls in RAG (query drift): https://medium.com/@sahin.samia/query-expansion-in-enhancing-retrieval-augmented-generation-rag-d41153317383
- Query expansion challenges (Haystack): https://haystack.deepset.ai/blog/query-expansion
- Hard negatives degrading RAG performance: https://arxiv.org/html/2506.00054v1
- Cold start and sparse signals in recommender systems: https://medium.com/data-scientists-handbook/cracking-the-cold-start-problem-in-recommender-systems-a-practitioners-guide-069bfda2b800
- LLM consistency and output drift 2025: https://www.keywordsai.co/blog/llm_consistency_2025
- tenacity retry library for Python: https://pypi.org/project/tenacity/

**Confidence assessment by area:**
- LLM rate limiting and batch tagging: HIGH — verified against Google official docs and confirmed SDK bug (GitHub issue)
- FAISS thread safety and hot-swap: HIGH — verified against FAISS official wiki
- Railway volume constraints: HIGH — verified against Railway official documentation
- Query expansion drift: MEDIUM — verified against multiple RAG research papers and practitioner guides
- Sparse feedback cold-start: MEDIUM — well-established recommender systems literature; specific thresholds (10 interactions, 20% cap) are informed heuristics, not empirically proven for this exact system

---
*Pitfalls research for: v1.1 Expert Intelligence & Search Quality (Tinrate AI Concierge)*
*Researched: 2026-02-21*
