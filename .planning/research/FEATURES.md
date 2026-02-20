# Feature Landscape

**Domain:** AI Concierge / Expert-Matching Chatbot — Two-Sided Marketplace (Tinrate)
**Researched:** 2026-02-20
**Confidence:** MEDIUM — UX patterns and marketplace conventions are well-established; specific RAG chatbot conventions verified from training knowledge (August 2025 cutoff). No live web sources available during this session.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Natural language input field | Core interaction primitive; users arrive expecting to type a problem, not fill a form | Low | Single textarea, enter to submit, no character limit friction |
| Visible loading / thinking state | LLM calls take 2–8 seconds; silence = broken in user's mental model | Low | Streaming skeleton or animated typing indicator ("Finding your experts…") |
| AI-generated explanatory response | Users need to trust the match; raw card results alone feel like a search engine, not a concierge | Medium | Gemini text above the cards explaining why these three were chosen |
| Expert Cards (visual, styled) | Matching a name/title text list to a decision is cognitively expensive; cards = scannable | Medium | Name, title, company, hourly rate, link — per spec |
| Clickable card → profile link | Zero dead ends; every card must go somewhere actionable | Low | Target="\_blank" to Tinrate profile URL |
| Clarifying question flow | When query is too vague, silence or bad results kills trust permanently | Medium | Detects ambiguity, responds with ONE focused question, not a form |
| Error message on failure | API timeouts, embedding failures, and LLM errors happen; users need to know it's not their fault | Low | "Something went wrong — try rephrasing or try again" with retry affordance |
| Mobile-responsive layout | >60% of discovery traffic on marketplaces arrives on mobile; broken mobile = high bounce | Medium | Cards stack vertically, input stays thumb-reachable at bottom |
| Empty / no-match state | If semantic search returns nothing above threshold, a fallback message is essential | Low | "We couldn't find a strong match — try describing the problem differently" |
| Input persistence across states | User's typed query should remain visible during loading and after results appear | Low | Prevents "what did I type?" confusion |
| Accessible contrast and font size | Legal baseline in most markets; also basic quality signal for a B2B product | Low | WCAG AA minimum |

---

## Differentiators

Features that set Tinrate apart. Not universally expected, but meaningfully valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Why them" explanation per expert | Generic marketplaces surface profiles without justification; Tinrate explains the reasoning, building trust in the AI | Medium | Already in spec as "Why them:" field in Gemini response — must be rendered per-card, not just in the prose block |
| Exactly 3 results (not N) | Paradox of choice is real; curated decisiveness feels premium vs. showing 20 results with pagination | Low | Deliberate constraint — do not add "show more" in v1 |
| Rate visibility on the card | Most expert discovery tools hide pricing until late in the funnel; showing hourly rate upfront filters for fit instantly and signals transparency | Low | Already in spec; ensure it's visually prominent, not buried |
| Conversational context carryover within session | User can follow up ("what about someone cheaper?" or "more technical?") without re-explaining the problem | High | Requires message history sent to Gemini on each turn; substantial complexity — see note below |
| Suggested follow-up prompts | After results, 2–3 chip-style prompt suggestions ("Try: 'Someone with fintech experience'" ) reduce blank-canvas anxiety for next query | Medium | Gemini can generate these as part of its response; frontend renders as clickable chips |
| Semantic query reformulation feedback | Show user a short "Searching for: [paraphrased intent]" line below input after submit, so they know what the AI heard | Low | Gemini can return a brief "interpreted as" field; builds trust in opaque RAG |
| Smooth card reveal animation | Cards that appear with staggered fade-in feel premium vs. abrupt DOM insertion; signals quality | Low | CSS transition, stagger 100ms per card |
| Persona/use-case example prompts on empty state | First-time users don't know what to type; 3 example queries ("I need a tax expert for a startup", "Help with Series A pitch deck") lower activation friction | Low | Static suggestions, click to populate input |

**Note on conversational context carryover:** This is the single highest-complexity differentiator. It requires maintaining a `messages[]` array client-side, passing it to FastAPI on each request, and including it in the Gemini prompt. It also requires deciding how many turns to retain (cost and latency tradeoff). Recommend deferring to v2 and marking it as an explicit v1 out-of-scope decision.

---

## Anti-Features

Features to explicitly NOT build in v1. These are tempting but costly, and the project ships value without them.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts / authentication | Adds weeks of infra (auth provider, session management, DB users); v1 value is in the matching, not the account | Anonymous sessions only; no login wall |
| Saved / favorited experts | Requires auth; stateful sessions; backend persistence — all out of scope | Users can bookmark the Tinrate profile URL directly |
| Multi-turn conversation history (v1) | Complex state management, prompt size/cost growth, harder to debug; the one-shot + clarification model covers 90% of needs | One clarifying follow-up question only; full conversation history in v2 |
| Filters sidebar (price range, category, availability) | Replicates traditional search UX, defeats purpose of the AI concierge; users will stop typing and start filtering | Let natural language carry the filtering intent ("under $200/hr", "fintech expert") |
| Expert ratings / review display on card | Review data may not be in CSV; rendering reliably requires data hygiene work | Show hourly rate; link to Tinrate profile where reviews live |
| "Book now" / scheduling in-widget | Booking flow is on Tinrate — duplicating it creates a maintenance burden and scope creep | Card links to Tinrate profile; booking happens there |
| Feedback / thumbs up-down on results | Valuable for model improvement, but adds complexity (data pipeline, storage, UI); no training loop in v1 | Gather qualitative feedback from early users manually |
| Pagination / "show more results" | Fixed 3 results is a deliberate product decision, not a limitation to paper over | If results aren't right, offer the clarifying question path |
| Dark mode toggle | Nice-to-have UI polish that adds engineering time; not a trust or conversion driver for B2B | Ship with one polished theme |
| Chat history sidebar | Implies persistent identity and sessions; doesn't exist in anonymous mode | No sidebar; each session is standalone |

---

## Feature Dependencies

```
Natural language input
  → Loading state (must exist before input can submit)
  → Clarifying question flow (depends on input being rendered)
  → Expert Cards (rendered only after successful AI response)
      → "Why them" per card (part of Gemini response structure; card renders it)
      → Rate visibility (data from CSV; card renders it)
      → Clickable link to profile (data from CSV; card renders it)
  → Error state (alternative to Expert Cards on failure)
  → Empty/no-match state (alternative to Expert Cards on low-confidence)

Semantic query reformulation feedback
  → Requires Gemini to return a structured "interpreted_as" field alongside expert matches
  → Backend response schema must include this field

Suggested follow-up prompts
  → Requires Gemini to return chip suggestions as part of response
  → Backend response schema must include suggestions[] array

Persona/use-case example prompts (empty state)
  → No dependencies; static UI, ships with the input component
```

---

## MVP Recommendation

Prioritize in this order:

1. **Natural language input → loading state → Expert Cards → profile link** — the core loop; ship nothing else until this works end-to-end
2. **"Why them" explanation per card** — trust signal; without it the product is a filtered search, not a concierge
3. **Error state and empty/no-match state** — users will hit these; no graceful handling = product looks broken
4. **Clarifying question flow** — covers the ambiguous query case; affects a significant minority of queries
5. **Mobile-responsive layout** — must be there on launch day, not retrofitted
6. **Rate visibility on card** — already in spec; low cost, high signal to users
7. **Persona/use-case example prompts (empty state)** — low complexity, dramatically reduces activation friction for cold visitors

**Defer to v2:**
- Conversational context carryover (full multi-turn history)
- Suggested follow-up prompt chips (after results)
- Semantic query reformulation feedback ("Searching for: X")
- Smooth card reveal animation (nice-to-have polish after core is stable)

**Hardcoded never (v1):**
- User accounts, saved experts, filters sidebar, booking in-widget, feedback collection

---

## Chat UX Pattern Notes

These patterns are derived from established AI chat product conventions (ChatGPT, Claude.ai, Perplexity, Bing Chat) and marketplace UX standards (Toptal, Upwork, Clarity.fm):

**Input area:**
- Fixed to bottom on mobile (thumb reachable), inline on desktop below the response area
- Placeholder text that sets expectations: "Describe what you need help with…"
- Submit on Enter (desktop), button tap on mobile
- Disable input while loading to prevent duplicate requests

**Loading state:**
- Show within 100ms of submit; users perceive >200ms blank as broken
- Animated text preferred over spinner: "Searching 1,600+ experts…" or typing dots
- Skeleton cards (grey placeholder outlines) during loading communicate what's coming

**Response rendering:**
- Prose explanation first, cards below — not cards first
- Card grid: 3 columns on desktop, 1 column stacked on mobile
- Each card: name (bold, large), title, company (muted), rate (prominent, colored), CTA button "View Profile"

**Clarifying question flow:**
- Render as a chat bubble from the AI, not a form or modal
- Provide 2–4 clickable suggestion chips as quick answers (e.g., "B2B SaaS", "Consumer app", "Enterprise") alongside free-text input
- Only one clarifying question per session — more feels like interrogation

**Error handling:**
- Inline in the chat thread, not a page-level error or toast
- Always offer a recovery action: retry button or prompt rephrasing suggestion
- Never expose raw error messages (no "500 Internal Server Error" to end users)

---

## Sources

- Domain knowledge from AI chatbot UX conventions (ChatGPT, Perplexity, Claude.ai observed patterns; training data through August 2025)
- Marketplace expert-matching conventions (Toptal, Clarity.fm, Upwork, Expert360 product observations; training data through August 2025)
- Tinrate project spec: `/Users/sebastianhamers/Documents/TCS/.planning/PROJECT.md`
- Confidence: MEDIUM — UX patterns in this domain are stable and well-documented, but no live web verification was possible in this session. Verify clarifying question flow patterns and mobile layout norms against current Clarity.fm or Toptal live products before finalizing.
