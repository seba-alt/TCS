# Feature Research

**Domain:** AI Expert-Matching Chatbot — Admin Intelligence Layer (Tinrate / TCS v1.1)
**Milestone:** v1.1 Expert Intelligence & Search Quality
**Researched:** 2026-02-21
**Confidence:** MEDIUM-HIGH — tagging and scoring patterns are well-established in adjacent products (LinkedIn, CMS systems, content marketplaces); RAG feedback and query expansion patterns verified from 2025 web sources; implementation specifics for this exact stack (Gemini + FAISS in-memory) are training-data-derived and flagged accordingly.

---

## Context: What Already Exists (v1.0)

This milestone adds to a working v1.0 system. Relevant existing capabilities:

- **Thumbs up/down feedback:** Stored in SQLite with optional detail text and `expert_ids` array. This is the raw feedback signal the search intelligence features consume.
- **GAP tracking:** Logged when no experts match above threshold (0.60). This is pre-existing signal for domain coverage gaps.
- **Admin Expert tab:** Category-based filtering and expert listing. This is what gets enhanced.
- **FAISS index:** Currently 530 of 1,558 experts indexed. Re-ingest is a prerequisite for search quality features.
- **Expert data:** 1,558 profiles in SQLite, seeded from CSV. Fields include bio (variable quality), profile URL, job title, hourly rate.

All v1.1 features build on this foundation. Dependencies on existing data noted per feature below.

---

## Feature Landscape

### Table Stakes (Admins Expect These)

Features the admin user expects from an intelligence layer on top of an expert database. Missing these = the admin tab feels like a raw data dump, not a management tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tags displayed inline on expert row | Any tagging system that assigns tags must surface them — tags invisible to admins are operationally useless | LOW | Render as pill/chip elements; truncate beyond 4 with "+N more" tooltip |
| Findability score visible per expert | If a score exists, it must be the primary sort signal — burying it in a detail view defeats the purpose | LOW | Numeric 0-100, color-coded badge inline in the table row |
| Worst-first default sort | Admins use this view to find and fix problems, not to admire the best profiles — default sort must surface the actionable cases | LOW | ASC sort on findability score; column header click toggles direction |
| Color-coded score thresholds | Admins scan tables visually; color eliminates the need to read each number to know which rows need attention | LOW | Red: 0-39, Yellow: 40-69, Green: 70-100. Industry convention from LinkedIn strength meter and UX pattern libraries |
| Score breakdown / tooltip | A score without rationale is a black box; admins will distrust it or ignore it | LOW | Hover or click shows component breakdown: "Bio: missing (-30), Tags: present (+20), Profile URL: present (+10)" |
| Full name columns (first + last separate) | Name searching and alphabetical sorting requires separate fields; concatenated full name in one column is unfiltered | LOW | Depends on existing `First Name` + `Last Name` fields in SQLite (already present per metadata.json field names) |
| Bio preview truncated | Bio text is multi-sentence; showing full bio in a table row breaks layout and prevents scanning | LOW | Truncate to 120 chars with "…" — click row or expand icon to read full |
| Profile URL as clickable link | Admins need to verify profiles; a text URL that can't be clicked wastes time | LOW | Opens in new tab; show broken-link indicator if URL is empty |
| Tag count as data signal | Experts with zero tags are immediately identifiable as needing attention | LOW | Show tag count (e.g., "0 tags") in red when zero; this is a sub-signal of findability score |

---

### Differentiators (Competitive Advantage)

Features that make this admin layer genuinely useful rather than cosmetically complete.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI batch auto-tagging for all 1,558 experts | Manual tagging at this scale is infeasible — AI-assigned tags are the only way to get coverage without a human team. Industry standard for catalog enrichment since 2023. | HIGH | One-time batch job via Gemini (structured JSON output per expert). Use Gemini Batch API for 50% cost reduction. Tags stored in SQLite per expert. Rate: ~$0.0005/expert at Gemini 2.5 Flash pricing = ~$0.75 for 1,558 experts. |
| Tags included in FAISS embedding text | Tags that exist only in the DB but not in the FAISS index do not improve retrieval — they must be in the embedded text | HIGH | Re-ingest: concatenate `bio + job_title + tags.join(", ")` as the embedding string per expert. Raises all 1,558 from current 530. Prerequisite for all search quality features. |
| Findability score formula (explicit, documented) | Scores without documented formulas are technical debt — admins can't act on them and developers can't maintain them. | MEDIUM | Suggested formula: bio_present(20) + bio_length_score(0-20 by length/quality) + profile_url_present(15) + tag_count_score(0-25 by tag count, cap at 5 tags) + job_title_present(10) + hourly_rate_present(10) = max 100. Simple, deterministic, recomputable. |
| Feedback-weighted re-ranking (soft boost) | Thumbs up/down on retrieved experts is a strong relevance signal. Standard pattern in production RAG systems: positive votes boost, negative votes suppress — applied at retrieval time, not as embedding changes. | HIGH | Implementation: maintain a `feedback_score` per expert in SQLite (cumulative: +1 per thumbs-up vote, -1 per thumbs-down vote). At retrieval time: after FAISS returns top-K, apply soft re-rank: `adjusted_score = cosine_sim + (feedback_weight * feedback_score)`. feedback_weight suggested 0.1-0.2 to avoid over-indexing on sparse data. Do NOT re-embed; this is a post-retrieval adjustment. |
| Query expansion before FAISS search | Short or ambiguous user queries retrieve poorly against rich expert bios. Query expansion adds synonyms and related terms before embedding. Proven to improve recall in RAG systems. | MEDIUM | Two patterns: (1) HyDE — generate a hypothetical expert profile matching the query, embed that instead of the raw query; (2) Multi-query — generate 3 variants of the query, retrieve for each, union results, deduplicate. HyDE is the recommended pattern here because expert bios are longer documents — hypothetical document embeddings match the corpus distribution better. One extra Gemini call per search. |
| Expert domain pre-mapping (domain index) | Clustering experts into domains (e.g., "crypto", "tax law", "veterinary") enables GAP analysis: "We have 3 crypto experts and 0 veterinary oncologists" — not possible without explicit domain labels. | MEDIUM | Domain map is a by-product of the tagging step. After batch tagging, group tags into top-level domain clusters. Store domain as a field on expert. Enables future filtering and GAP enrichment. |
| Test lab: query → expert match evaluation | Feedback data is only useful if admins can see whether the system is improving. A test lab runs benchmark queries and shows which experts were returned, with their scores and feedback weights. | HIGH | This is a pure admin UI feature. Input: test query. Output: list of top-5 retrieved experts, cosine similarity score, feedback adjustment, final rank. Allows A/B comparison of before/after query expansion or re-ranking changes. Complexity is UI-side; retrieval logic is already the production path. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Manual tag editing by admin in the table | Admins want control over AI-assigned tags | At 1,558 experts, manual curation doesn't scale and creates inconsistency. Individual edits also don't propagate back to FAISS — the tag exists in the DB but the embedding is now stale. Maintaining embedding/DB sync for individual edits is disproportionate complexity. | Show AI tags, accept them as-is for v1.1. If quality is poor, re-run the batch tagging job with an improved prompt. Tag editing is a v2+ feature with a "mark as reviewed" workflow. |
| Real-time embedding update on tag change | Seems necessary for consistency | Re-embedding a single expert on tag change requires re-adding a vector to FAISS in-memory, then persisting the index. This is fragile and not how FAISS is typically used in production (batch re-index is the standard pattern). | Batch re-ingest on a schedule (or on-demand admin trigger). Not per-record. |
| Feedback-driven embedding fine-tuning | Sounds like the "correct" ML approach | Fine-tuning `text-embedding-004` is not supported by Google's API. Even if it were, a corpus of ~50-200 feedback signals (realistic for early months) is insufficient for meaningful fine-tuning. It's years of work dressed up as a v1.1 feature. | Soft re-ranking at retrieval time is the correct approach for this data volume and API surface. |
| Auto-tag confidence scores shown in admin | "Show how confident the AI is about each tag" is a reasonable intuition | Tag confidence from an LLM is not calibrated — a Gemini output of "0.9 confidence" is not statistically meaningful the way a logistic regression confidence is. Displaying it misleads admins into false precision. | Show tags only. If a tag is wrong, re-run the batch job with a better prompt. |
| Search query logging with PII | "Log everything to improve search" | User queries may contain sensitive personal context ("I need a therapist for PTSD", "my startup is being sued"). Logging raw queries creates GDPR/privacy risk for a product that promises anonymous sessions. | Log query intent patterns (domain cluster, query length, result count) rather than raw query text. Feedback signal (thumbs up/down) is already captured without PII. |
| Multi-model embedding (switch from text-embedding-004) | Tempting if retrieval quality seems low | Switching embedding models requires full re-ingest and invalidates the existing FAISS index. It's a non-trivial migration with uncertain payoff. The current model is competent for this domain. | Improve retrieval through query expansion and feedback re-ranking first. Only revisit embedding model after establishing a test lab baseline. |

---

## Feature Dependencies

```
[FAISS re-ingest with all 1,558 experts]
    └──prerequisite──> [Feedback-weighted re-ranking]
    └──prerequisite──> [Query expansion (HyDE)]
    └──prerequisite──> [Search quality test lab]
    └──prerequisite──> [Enhanced admin Expert tab accuracy]

[AI batch auto-tagging]
    └──prerequisite──> [FAISS re-ingest with tags in embedding text]
    └──prerequisite──> [Findability score (tag_count component)]
    └──prerequisite──> [Expert domain pre-mapping]

[Findability score]
    └──requires──> [Expert data in SQLite with bio, profile URL, tags, job_title fields]
    └──enhances──> [Enhanced admin Expert tab (score column, sort, color)]

[Thumbs up/down feedback (v1.0, already built)]
    └──feeds──> [Feedback-weighted re-ranking (cumulative feedback_score per expert)]

[GAP tracking (v1.0, already built)]
    └──enhances──> [Expert domain pre-mapping (identifies which domains have coverage gaps)]

[Expert domain pre-mapping]
    └──enhances──> [GAP tracking (richer gap reports with domain labels)]

[Query expansion (HyDE)]
    └──independent of──> [Feedback-weighted re-ranking]
    (can be deployed separately; both improve retrieval through different mechanisms)

[Test lab]
    └──requires──> [Baseline FAISS retrieval working end-to-end]
    └──requires──> [At least one of: query expansion OR feedback re-ranking deployed]
    (otherwise there's nothing to compare against)
```

### Dependency Notes

- **FAISS re-ingest is the critical blocker:** Tags improve retrieval only if they are embedded. Score improvements that don't include FAISS re-ingest are cosmetic (admin display only). Do this first.
- **Tagging before scoring:** The findability score's tag component requires tags to exist. Run batch tagging, store results in SQLite, then compute scores.
- **Feedback re-ranking requires a feedback corpus:** With very few votes, the `feedback_score` signal will be noisy. Apply a minimum vote threshold (e.g., require at least 3 votes before adjusting score) to avoid a single thumbs-down burying a good expert.
- **Test lab requires a working retrieval baseline:** Build it last, after query expansion and re-ranking are deployed, so it can show delta improvement.

---

## MVP Definition (for v1.1 Milestone)

### Launch With (v1.1 core)

These are the features that deliver the stated milestone goal — admin visibility + retrieval quality improvement.

- [x] **AI batch auto-tagging** — prerequisite for everything else; run once, store in SQLite
- [x] **FAISS re-ingest with all 1,558 experts + tags** — raises index from 530 to 1,558; tags improve semantic retrieval
- [x] **Findability score (deterministic formula)** — score all 1,558 experts; store in SQLite
- [x] **Enhanced admin Expert tab** — first name, last name, bio (truncated), profile URL, tags (pills), findability score (color-coded badge), worst-first sort

### Add After Core Works (v1.1 extended)

These improve search quality but can be layered on top once the data layer is solid.

- [ ] **Feedback-weighted re-ranking** — requires feedback corpus; implement after tagging/re-ingest are stable
- [ ] **Query expansion (HyDE)** — one extra Gemini call per search; implement after FAISS re-ingest; A/B measure impact via test lab
- [ ] **Expert domain pre-mapping** — by-product of tagging; group tags into domain clusters; enriches GAP reports

### Future Consideration (v2+)

- [ ] **Search quality test lab** — high-value but high UI complexity; defer until feedback corpus is large enough to show meaningful signal
- [ ] **Manual tag editing with FAISS sync** — requires a "mark as reviewed" workflow and scheduled re-ingest; not worth building until tag quality proves insufficient
- [ ] **Personalized query expansion** — adapts query expansion to user history; requires user identity, which does not exist in the current anonymous session model

---

## Feature Prioritization Matrix

| Feature | Admin Value | Implementation Cost | Priority |
|---------|-------------|---------------------|----------|
| AI batch auto-tagging | HIGH | MEDIUM (one-time Gemini batch job) | P1 |
| FAISS re-ingest (all 1,558 + tags) | HIGH | MEDIUM (script, not real-time) | P1 |
| Findability score (compute + store) | HIGH | LOW (deterministic formula, SQL) | P1 |
| Enhanced admin Expert tab (display) | HIGH | LOW (React table columns + badges) | P1 |
| Feedback-weighted re-ranking | MEDIUM | MEDIUM (retrieval layer change) | P2 |
| Query expansion (HyDE) | MEDIUM | MEDIUM (extra Gemini call + prompt) | P2 |
| Expert domain pre-mapping | LOW-MEDIUM | LOW (group existing tags) | P2 |
| Search quality test lab | HIGH (long-term) | HIGH (admin UI, query runner) | P3 |

**Priority key:**
- P1: Must ship in v1.1 core — delivers the milestone value
- P2: Should ship in v1.1 extended — improves retrieval measurably
- P3: Defer to v1.2 or later

---

## UX Pattern Notes by Feature Area

### Tagging UX (Admin Table)

**Display pattern:** Pill/chip elements with muted background. Established by every CMS and content platform (WordPress, AEM, Contentful). Do not use comma-separated text — pills are scannable, text is not.

**Overflow pattern:** Show first 4 tags, then "+N" overflow badge. Click or hover reveals all tags in a tooltip or expanded row. Established pattern (GitHub label lists, Notion tags).

**Auto vs. manual:** Industry consensus (2025 sources, Numerous.ai, vue.ai, pixyle.ai) is AI-assigned with admin override capability. For v1.1, AI-assigned is sufficient. Manual editing is a v2 feature.

**Tag taxonomy size:** Best practice from SentiSum (2023) and GTM Buddy (2025): 30-50 tags maximum for a taxonomy to remain manageable. The TCS domain covers many verticals, so targeting 40-80 unique domain tags across 1,558 experts is appropriate — individual experts carry 3-8 tags.

### Findability Score Display (Admin Table)

**Color convention:** Red/Yellow/Green (traffic light) is the universal convention for health scores. LinkedIn uses blue gradient; GitHub uses red/yellow/green for status; Vercel uses red/yellow/green for deployment health. For a "problem finding" use case, traffic light is more appropriate than LinkedIn's aspirational gradient.

**Score thresholds:** 0-39 red, 40-69 yellow, 70-100 green. Derived from standard grading conventions (F/C/B-A). Avoid equal thirds (33/66) — they feel mechanical; 40/70 is cognitively intuitive.

**Completeness meter pattern (ui-patterns.com):** The pattern divides a goal into sub-tasks and shows progress toward 100%. The key UX requirement is that each sub-task links to a remediation action. For TCS admins, the remediation is "this expert's Tinrate profile needs updating" — the profile URL column provides that link.

**Default sort:** Worst-first (ASC) is the correct default for a quality improvement tool. This is consistent with enterprise task management tools (Jira bugs sorted by severity, PageSpeed Insights showing lowest scores first). Admins are here to fix problems, not celebrate good profiles.

### Feedback Loop Mechanics (RAG Retrieval)

**What thumbs up/down actually signals:** A thumbs-up means "these 3 experts were a good match for this query." A thumbs-down means "at least one of these experts was wrong for this query." This is noisy at the individual expert level — the `expert_ids` array in the stored feedback helps attribute signal to specific experts.

**Correct implementation pattern (2025 RAG best practices):** Post-retrieval soft re-ranking, NOT embedding modification. After FAISS returns top-K candidates by cosine similarity, apply `adjusted_score = cosine_sim + (feedback_weight * cumulative_feedback_score)`. The `feedback_weight` (0.1-0.2) ensures the feedback signal nudges but does not override semantic relevance.

**Minimum votes before adjusting:** Apply a minimum threshold (n >= 3 votes) before the feedback score affects ranking. Without this, a single thumbs-down from an outlier query permanently demotes an expert. This is standard practice in recommendation systems.

**What feedback cannot do:** Fix fundamentally bad expert embeddings. If an expert's bio is empty or generic ("I help businesses grow"), no amount of positive feedback will make their embedding semantically useful. This is why FAISS re-ingest with richer text (bio + tags) is the higher-leverage action.

### Query Expansion Approaches

**HyDE (Hypothetical Document Embedding) — recommended:**
Generate a hypothetical expert profile that would be a perfect match for the user's query. Embed the hypothetical profile, not the raw query. Retrieve against the expert FAISS index. The hypothetical profile is in the same linguistic register as real bios — this reduces the query-document distributional gap that causes poor retrieval on short, colloquial queries.

Example: User query "I need help with my startup's legal stuff" → HyDE generates: "Expert with extensive experience in startup legal advisory, specializing in incorporation, cap table management, founder agreements, IP protection, and Series A term sheet negotiations..." → embed that → retrieve similar experts.

**Multi-query (alternative, lower priority):** Generate 3 variants of the original query, retrieve top-5 for each, union and deduplicate, take top-5 by score. Good for ambiguous queries. More Gemini calls (3x vs 1x for HyDE). Implement as a secondary option if HyDE alone proves insufficient.

**Do NOT implement both simultaneously in v1.1:** Combining HyDE + multi-query doubles the Gemini call overhead and makes it harder to measure which technique improved what. Pick HyDE first, measure with test lab, then consider multi-query.

---

## Implementation Complexity Notes

| Feature | Key Complexity Driver | Estimated Effort |
|---------|----------------------|-----------------|
| AI batch auto-tagging | Prompt engineering for consistent structured output; one-time job, not real-time | 1-2 days |
| FAISS re-ingest | Script to re-embed 1,558 experts; straightforward but must handle rate limits on embedding API | 0.5-1 day |
| Findability score | Deterministic formula applied in Python; no ML complexity | 0.5 day |
| Enhanced admin Expert tab | React table with new columns, color-coded badges, pill tags; no backend complexity | 1-2 days |
| Feedback-weighted re-ranking | Retrieval path change in FastAPI; requires cumulative score maintenance in SQLite | 1 day |
| Query expansion (HyDE) | Extra Gemini call in retrieval path; prompt design is the main work | 1 day |
| Expert domain pre-mapping | Group tags post-tagging; mostly a data transformation | 0.5 day |
| Search quality test lab | Admin UI with query runner and result display; highest UI complexity in this milestone | 2-3 days |

---

## Sources

- [Completeness meter design pattern — ui-patterns.com](https://ui-patterns.com/patterns/CompletenessMeter) — MEDIUM confidence
- [Top 5 AI Content Tagging Tools 2025 — Numerous.ai](https://numerous.ai/blog/ai-content-tagging) — MEDIUM confidence
- [RAG Techniques: Retrieval with Feedback Loop — NirDiamant/RAG_Techniques (GitHub)](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/retrieval_with_feedback_loop.ipynb) — MEDIUM confidence
- [Advanced RAG: Query Expansion — Haystack / deepset](https://haystack.deepset.ai/blog/query-expansion) — MEDIUM confidence
- [How Query Expansion (HyDE) Boosts RAG Accuracy — Chitika](https://www.chitika.com/hyde-query-expansion-rag/) — MEDIUM confidence
- [Enhancing RAG Pipelines with Re-Ranking — NVIDIA Technical Blog](https://developer.nvidia.com/blog/enhancing-rag-pipelines-with-re-ranking/) — HIGH confidence
- [Gemini Batch API — Google AI for Developers](https://ai.google.dev/gemini-api/docs/batch-api) — HIGH confidence
- [LinkedIn Profile Strength Levels — Career Confidential](https://careerconfidential.com/linkedins-profile-strength-indicator-how-do-you-measure-up/) — HIGH confidence
- [Best practice for building a tagging taxonomy — SentiSum](https://www.sentisum.com/insights-article/best-practice-for-building-a-tagging-taxonomy) — MEDIUM confidence
- [Data Table Design UX Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — MEDIUM confidence
- [Beyond Basic RAG 2025 — Medium / Jay Kim](https://medium.com/@bravekjh/beyond-basic-rag-exploring-advanced-retrieval-augmented-generation-rag-in-2025-08dbb3df5ca3) — LOW-MEDIUM confidence (web-only, unverified against official sources)
- Training data (August 2025 cutoff): RAG feedback patterns, HyDE, FAISS in-memory behavior, Gemini structured output

---

*Feature research for: TCS v1.1 Expert Intelligence & Search Quality*
*Researched: 2026-02-21*
