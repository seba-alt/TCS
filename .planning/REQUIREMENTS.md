# Requirements: Tinrate AI Concierge Chatbot

**Defined:** 2026-02-21
**Milestone:** v2.0 — Extreme Semantic Explorer
**Core Value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.

## v2.0 Requirements

### EXPL — Hybrid Search Backend

- [x] **EXPL-01**: System provides `/api/explore` endpoint returning paginated expert results (cursor, total, took_ms)
- [x] **EXPL-02**: System pre-filters experts by rate range and domain tags via SQLAlchemy → FAISS IDSelectorBatch before vector search
- [x] **EXPL-03**: System fuses FAISS semantic score (0.7) + FTS5 BM25 keyword score (0.3) into a single weighted rank
- [x] **EXPL-04**: System applies findability score and feedback boosts to fused rankings
- [x] **EXPL-05**: SQLite FTS5 virtual table is created at startup and synced with experts table on writes

### STATE — Global State & Routing

- [x] **STATE-01**: Zustand `useExplorerStore` manages filters, results, and pilot conversation slices
- [x] **STATE-02**: Filter slice persists to localStorage via `persist` middleware with `partialize` (results and pilot excluded)
- [x] **STATE-03**: Homepage `/` renders `MarketplacePage`; chat interface is removed

### MARKET — Marketplace UI

- [ ] **MARKET-01**: User sees faceted sidebar with rate range slider, domain tag multi-select, text search, and active filter chips
- [ ] **MARKET-02**: Expert grid renders via `react-virtuoso` with cursor-based pagination and scroll restoration
- [ ] **MARKET-03**: Expert cards display name, title, company, hourly rate, domain tag pills, findability badge, and match reason snippet
- [ ] **MARKET-04**: Clicking a domain tag pill on a card adds that tag to sidebar filters and re-fetches
- [ ] **MARKET-05**: Cards animate on mount via Framer Motion; `AnimatePresence` used only on sidebar and modal transitions
- [ ] **MARKET-06**: Sidebar collapses into a bottom-sheet on mobile viewports

### PILOT — Floating AI Co-Pilot

- [ ] **PILOT-01**: Floating FAB (bottom-right) opens a 380px right-edge slide-in co-pilot panel
- [ ] **PILOT-02**: Co-pilot uses Gemini function calling (`apply_filters`) to update Zustand filter state from conversation
- [ ] **PILOT-03**: Co-pilot panel is full-screen on mobile

### LEAD — Value-Driven Lead Capture

- [ ] **LEAD-01**: User can browse the expert grid freely without providing email
- [ ] **LEAD-02**: "View Full Profile" action gates behind a single-field email capture modal
- [ ] **LEAD-03**: "Download Match Report" gates behind email + project type (2 fields); AI generates in-app styled HTML report of top matches
- [ ] **LEAD-04**: Returning visitors with captured email bypass the gate automatically (localStorage)

### ROBUST — Robustness & Optimization

- [ ] **ROBUST-01**: Active filter state encodes to URL query params (shareable, bookmarkable)
- [ ] **ROBUST-02**: Search bar provides fuzzy/prefix suggestions via FTS5 prefix matching
- [ ] **ROBUST-03**: No-results state shows alternative query suggestions and nearby tag options

## Future Requirements

### Deferred to v2.1+

- HyDE in `/api/explore` — HyDE already exists in the chat endpoint; deferred here to reduce explore latency complexity
- Skeleton loaders on AI-triggered filter apply — deferred; standard loading state is sufficient for v2.0
- PDF/email delivery of Match Report — in-app HTML only for v2.0; email delivery requires SendGrid/Resend integration

## Out of Scope

| Feature | Reason |
|---------|--------|
| HyDE query expansion in /api/explore | Already in chat endpoint; adds latency to explore; excluded to keep explore <100ms |
| Levenshtein "Did you mean?" | FTS5 prefix matching sufficient; true spelling correction requires separate library |
| PDF generation for Match Report | WeasyPrint on Railway unvalidated; memory risk; in-app HTML achieves the same goal |
| Email delivery for Match Report | Requires SendGrid/Resend; out of current stack; deferred |
| User accounts / authentication | Users interact anonymously; admin uses session key — unchanged |
| Booking / payment flow | Cards link to Tinrate profiles where booking happens |
| Mobile native app | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXPL-01 | Phase 14 | Complete |
| EXPL-02 | Phase 14 | Complete |
| EXPL-03 | Phase 14 | Complete |
| EXPL-04 | Phase 14 | Complete |
| EXPL-05 | Phase 14 | Complete |
| STATE-01 | Phase 15 | Complete |
| STATE-02 | Phase 15 | Complete |
| STATE-03 | Phase 15 | Complete |
| MARKET-01 | Phase 16 | Pending |
| MARKET-02 | Phase 17 | Pending |
| MARKET-03 | Phase 17 | Pending |
| MARKET-04 | Phase 17 | Pending |
| MARKET-05 | Phase 17 | Pending |
| MARKET-06 | Phase 16 | Pending |
| PILOT-01 | Phase 18 | Pending |
| PILOT-02 | Phase 18 | Pending |
| PILOT-03 | Phase 18 | Pending |
| LEAD-01 | Phase 19 | Pending |
| LEAD-02 | Phase 19 | Pending |
| LEAD-03 | Phase 19 | Pending |
| LEAD-04 | Phase 19 | Pending |
| ROBUST-01 | Phase 19 | Pending |
| ROBUST-02 | Phase 19 | Pending |
| ROBUST-03 | Phase 19 | Pending |

**Coverage:**
- v2.0 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation (phases 14-19 confirmed)*
