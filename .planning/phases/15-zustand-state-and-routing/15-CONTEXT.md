# Phase 15: Zustand State & Routing - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up a Zustand global store (`useExplorerStore`) with filter, results, and pilot slices. Configure localStorage persistence for filters only. Reroute `/` to `MarketplacePage`. This phase defines the data contract and state layer — no real API calls are wired in this phase (that comes later). Every subsequent UI phase builds on top of this foundation.

</domain>

<decisions>
## Implementation Decisions

### Old interface fate
- Claude's discretion — decide whether to move the old chat homepage to `/chat` or remove it entirely
- No explicit links from the new UI to the old interface — it should not be discoverable

### Persistence on load
- Persist to localStorage: `query`, `rateMin`, `rateMax`, `tags`, **and `sortBy` / sort order**
- On page load with restored filters: **auto-trigger a search** with the restored filter state (seamless UX — lands with both filters and results)
- localStorage syncs **immediately on every filter change** (including when filters are cleared/reset)
- Stale/schema-mismatch data: **clear it silently** and start fresh

### Pilot slice scope
- The pilot slice backs the **AI chat/assistant panel** on the marketplace
- Slice holds: message history (user + assistant messages), loading/streaming flag, session ID or thread reference, open/closed panel state
- Pilot state resets **when the user navigates away from the page** (survives in-session tab switches, not reloads)
- Pilot slice **can read current filter state** and suggest filter updates — tight integration with filter slice is intentional this phase

### Store boundaries
- `useExplorerStore` is the one store for explorer/marketplace state — admin/auth store structure is Claude's discretion
- Export pattern and slice accessor design (one hook vs named slice hooks) is **Claude's discretion**
- Results slice scope (whether to include loading/error/pagination alongside expert array) is **Claude's discretion**
- This phase is **store shape only** — no API calls wired; the store is the data contract, real fetching comes in a later phase

### Claude's Discretion
- Whether old interface moves to `/chat` or is removed entirely
- Store export pattern (single `useExplorerStore` vs named slice hooks)
- Results slice shape (array only vs full loading/error/pagination)
- Admin/auth store structure (separate store or Claude decides)

</decisions>

<specifics>
## Specific Ideas

- Pilot can read filter slice and surface AI suggestions that update filters — this coupling is intentional
- `sortBy` / sort order should persist alongside the other four named filter fields

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-zustand-state-and-routing*
*Context gathered: 2026-02-21*
