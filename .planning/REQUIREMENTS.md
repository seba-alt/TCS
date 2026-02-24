# Requirements: Tinrate AI Concierge — v3.0

**Defined:** 2026-02-24
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v1 Requirements

Requirements for v3.0 Netflix Browse & Agentic Navigation. Each maps to roadmap phases.

### Browse Page

- [x] **BROWSE-01**: User sees a Netflix-style Browse page as the landing experience at `/` with horizontal category rows
- [x] **BROWSE-02**: User can horizontally scroll through 4-6 category rows (trending tags, recently joined, most clicked, highest findability) with snap scroll and skeleton loading
- [x] **BROWSE-03**: User sees glassmorphic expert cards with large photos or monogram fallback, name + rate overlay, and hover reveals tags
- [x] **BROWSE-04**: User can click "See All" on any category row to navigate to Explorer filtered by that category

### Photos

- [x] **PHOTO-01**: Admin can bulk import expert photo URLs from a new CSV into the Expert model
- [x] **PHOTO-02**: Backend serves expert photos via GET /api/photos/{username} proxy endpoint with CORS-safe headers and 24h cache
- [x] **PHOTO-03**: Frontend displays monogram initials fallback when no photo is available for an expert

### Navigation

- [x] **NAV-01**: Routes reorganized: `/` → BrowsePage, `/explore` → Explorer, `/marketplace` redirects to `/explore`, `/chat` redirects appropriately
- [x] **NAV-02**: User can click "Explore All Experts" button on Browse page to navigate to Explorer with all experts visible

### Sage Cross-Page

- [ ] **SAGE-01**: Sage floating action button is visible on Browse page (mounted at root layout level above route outlet)
- [ ] **SAGE-02**: Sage conversation history is preserved when navigating from Browse to Explorer
- [ ] **SAGE-03**: Sage discovery search on Browse auto-navigates to Explorer and displays search results in the grid
- [x] **SAGE-04**: Single Zustand store with navigationSlice powers both Browse and Explorer pages for cross-page state handoff

## v2 Requirements

Deferred to v3.1+. Tracked but not in current roadmap.

### Browse Enhancements

- **BROWSE-05**: Billboard Hero section with full-width featured expert, photo, holographic badge, and "Start Discovery" CTA
- **BROWSE-06**: Admin billboard control (is_featured flag on Expert model with admin UI)
- **BROWSE-07**: Netflix-style card hover expand (scale 115% + info overlay)

### Transitions

- **NAV-03**: Aurora "Loading Mesh" page transition effect (AnimatePresence blur/fade between Browse and Explorer)
- **NAV-04**: "Continue Browsing" breadcrumb above ExpertGrid when arriving from Browse

### Sage Navigation

- **SAGE-05**: Sage `navigate_to` Gemini function for explicit cross-page navigation intent (requires 15-query validation test)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Algorithmic billboard personalization | No per-user identity model before newsletter gate |
| Video preview on card hover | No video assets exist for any expert |
| Infinite horizontal scroll in rows | Anti-feature — "See All" is the escape valve |
| TCS-native expert profile deep links | Canonical URL is already the Tinrate profile page |
| Cloudinary/CDN image optimization | Photo proxy is sufficient at current scale |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BROWSE-01 | Phase 38 | Complete |
| BROWSE-02 | Phase 38 | Complete |
| BROWSE-03 | Phase 38 | Complete |
| BROWSE-04 | Phase 38 | Complete |
| PHOTO-01 | Phase 37 | Complete |
| PHOTO-02 | Phase 37 | Complete |
| PHOTO-03 | Phase 38 | Complete |
| NAV-01 | Phase 36 | Complete |
| NAV-02 | Phase 38 | Complete |
| SAGE-01 | Phase 40 | Pending |
| SAGE-02 | Phase 40 | Pending |
| SAGE-03 | Phase 40 | Pending |
| SAGE-04 | Phase 36 | Complete |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 — 10/13 v1 requirements complete, 3 pending verification (SAGE-01/02/03)*
