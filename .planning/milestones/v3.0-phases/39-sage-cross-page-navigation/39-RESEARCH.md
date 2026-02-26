# Phase 39: Sage Cross-Page Navigation — Research

**Researched:** 2026-02-24
**Requirements:** SAGE-01, SAGE-02, SAGE-03

## Current Architecture Snapshot

### Routing (main.tsx)
- Flat route table: `/` = BrowsePage, `/explore` = MarketplacePage, `/marketplace` = redirect, `/chat` = redirect
- No layout wrapper — each page renders independently with its own Header, AuroraBackground, etc.
- React Router v7 via `createBrowserRouter` + `RouterProvider`

### Sage Components (Explorer-only today)
- **SageFAB** (`components/pilot/SageFAB.tsx`) — fixed bottom-right FAB with glow effects, tooltip on first visit. Only mounted inside MarketplacePage.
- **SagePanel** (`components/pilot/SagePanel.tsx`) — full-height side panel (380px wide, 70vh tall). Uses `useSage()` hook for send/receive. Only mounted inside MarketplacePage.
- **SageInput** (`components/pilot/SageInput.tsx`) — textarea + submit button, used by SagePanel.
- **SageMessage** (`components/pilot/SageMessage.tsx`) — chat message bubble component.

### State Management (Zustand)
- **pilotSlice** — `messages[]`, `isOpen`, `isStreaming`, `sessionId`, `resetPilot()`. NOT persisted.
- **navigationSlice** — `navigationSource` ('browse'|'sage'|'direct'), `pendingSageResults`, `pendingSearchQuery`. NOT persisted.
- **resultsSlice** — `experts[]`, `total`, `cursor`, `loading`, `sageMode`. NOT persisted.
- **filterSlice** — `query`, `tags`, `rateMin`, `rateMax`, `sortBy`. Persisted to localStorage.

### Navigation Flow (Browse → Explorer)
- BrowsePage calls `setNavigationSource('browse')` BEFORE `navigate()` — critical ordering.
- MarketplacePage reads `navigationSource` on mount: if `'direct'` → `resetPilot()`. If `'browse'` or `'sage'` → preserves pilot state.
- `useExplore()` hook: if `sageMode` is true → aborts /api/explore fetch, yields to Sage results.

### useSage Hook
- Calls `/api/pilot` with message, history (last 10 messages), current_filters.
- On `search_performed: true` → injects results directly into store (`setResults`, `setSageMode(true)`).
- On `search_performed: false` → applies filter changes via `validateAndApplyFilters()`.
- All messages stored in pilotSlice (Zustand, in-memory only).

### BrowsePage (current)
- No Sage components mounted — no FAB, no panel.
- Has AuroraBackground, HeroBanner, BrowseRow categories.
- No Header component (Browse has no search bar).

## What Needs to Change

### SAGE-01: FAB on Browse Page
**Problem:** SageFAB is only rendered inside MarketplacePage. Need it on BrowsePage too.

**Approach — Root Layout:**
The cleanest architecture is to lift Sage components to a shared layout that wraps both routes. React Router supports layout routes via `<Outlet>`.

**Key detail:** SageFAB currently reads filter-related store state (`query`, `tags`, `rateMin`, `rateMax`) for the filter-change glow. On Browse, these are irrelevant — the filter glow should be suppressed or the FAB should skip filter tracking when not on Explorer.

**Implementation:**
1. Create a `RootLayout` component that renders `<Outlet />` + SageFAB + Sage panel (popover on Browse, full panel on Explorer — or just one component that adapts).
2. Update main.tsx router to wrap `/` and `/explore` routes in this layout.
3. SageFAB stays identical — it just lives higher in the tree now.

### SAGE-02: Conversation Continuity
**Problem:** Conversation must survive Browse → Explorer navigation.

**Already solved by architecture:** pilotSlice stores messages in Zustand (not component state). As long as `resetPilot()` is NOT called during Browse→Explorer navigation, messages persist. The existing `navigationSource` gate in MarketplacePage already handles this — `resetPilot()` only fires when `navigationSource === 'direct'`.

**What needs attention:**
- When Sage is used on Browse and user navigates to Explorer, `navigationSource` must be set to `'sage'` (not `'browse'`).
- Actually, per CONTEXT.md: conversation is stored in Zustand only — clears on page refresh. Direct `/explore` URL visits start clean. This is ALREADY the behavior since pilotSlice is NOT persisted.
- The key action: set `navigationSource` to `'sage'` before auto-navigating from Browse to Explorer after a discovery response.

### SAGE-03: Discovery Search Auto-Navigation
**Problem:** When Sage performs a discovery search on Browse, it should show results briefly ("Found X experts. Taking you there..."), then auto-navigate to Explorer with results pre-loaded.

**Flow:**
1. User asks discovery question in Browse popover.
2. `useSage()` calls `/api/pilot`, gets `search_performed: true` + `experts[]`.
3. Instead of directly setting results in the store (Explorer isn't mounted yet), store them in `pendingSageResults` via `setPendingSageResults()`.
4. Show Sage's response in popover ("Found 5 AI experts. Taking you there...").
5. After ~2 second delay, call `setNavigationSource('sage')` + `navigate('/explore')`.
6. On Explorer mount, `useExplore()` detects `pendingSageResults` → uses those instead of fetching 530 experts.
7. Explorer consumes and clears pending results.

**Critical race condition prevention:**
- `sageMode` must be set to `true` BEFORE navigate, so `useExplore()` doesn't start a competing fetch.
- `pendingSageResults` must be populated BEFORE navigate.
- The existing `useExplore()` sageMode guard already aborts fetches when sageMode is true.

**Discovery vs. non-discovery classification:**
- Already handled by backend: `search_performed: true` = discovery, `search_performed: false` = filter refinement.
- On Browse: if `search_performed: true` → trigger navigation flow. If false → stay on Browse (apply no filters since there's no grid on Browse, just show the response).

### Browse Popover vs. Explorer Panel
**CONTEXT.md decision:** Browse uses a "compact popover" (not the full-height side panel). Explorer keeps the existing full panel.

**Implementation approach:**
- Create a `SagePopover` component — lighter version of SagePanel, same message rendering, smaller dimensions.
- Or: make SagePanel responsive — detect current route and render as popover or panel.
- Simplest: one `SagePanel` component with a `variant` prop ('popover' | 'panel'). Popover = smaller, different positioning. Panel = current 380px x 70vh.

**Where to mount:**
- RootLayout renders: `{isOnExplorer ? <SagePanel variant="panel" /> : <SagePanel variant="popover" />}`
- Or: RootLayout always renders the popover version, and MarketplacePage renders the full panel (replacing the popover when on Explorer). This is messier.
- Best: Single SagePanel in RootLayout, adapts via route detection.

### Navigation Source Management
**Current:** BrowsePage sets `navigationSource = 'browse'` on "See All" / "Explore All" clicks. MarketplacePage checks on mount.

**New flow:** Need a third trigger — Sage auto-navigation sets `navigationSource = 'sage'`.

**Back-navigation:** CONTEXT.md says: "On back-navigation (Browse <- Explorer), Sage popover always starts closed." Need to close the popover when navigating back to Browse. Can detect route change and set `isOpen = false` when entering Browse.

## Existing Patterns to Follow

1. **Zustand individual selectors** — NOT useShallow for reactive state in components (Phase 16 pattern).
2. **setNavigationSource BEFORE navigate()** — critical ordering pattern established in Phase 36.
3. **sageMode guard in useExplore()** — prevents competing fetches.
4. **pendingSageResults stores full Expert objects** — matches resultsSlice pattern.
5. **AnimatePresence for panel enter/exit** — existing pattern in MarketplacePage.

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Competing fetch on Explorer mount after Sage navigate | HIGH | Set sageMode=true + pendingSageResults BEFORE navigate() |
| Stale pilot state on direct /explore visit | MEDIUM | Existing navigationSource='direct' gate handles this |
| Filter glow on SageFAB when on Browse (no filters active) | LOW | Skip filter tracking when not on /explore route |
| Back-navigation leaves popover open | LOW | Close popover on route change to / |

## File Impact Analysis

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/main.tsx` | MODIFY | Add RootLayout wrapper for / and /explore routes |
| `frontend/src/components/pilot/SagePanel.tsx` | MODIFY | Add variant prop for popover vs panel mode |
| `frontend/src/components/pilot/SageFAB.tsx` | MODIFY | Minor — may need route-aware filter glow suppression |
| `frontend/src/hooks/useSage.ts` | MODIFY | Add discovery auto-navigation logic (detect search_performed, set pending results, delay + navigate) |
| `frontend/src/pages/MarketplacePage.tsx` | MODIFY | Remove SageFAB/SagePanel (moved to RootLayout), consume pendingSageResults |
| `frontend/src/pages/BrowsePage.tsx` | MINOR | Remove standalone rendering concerns now handled by layout |
| `frontend/src/hooks/useExplore.ts` | MODIFY | Consume pendingSageResults on mount |
| NEW: `frontend/src/layouts/RootLayout.tsx` | CREATE | Shared layout with Outlet + Sage components |

## Requirement Coverage

| Requirement | How Addressed |
|-------------|---------------|
| SAGE-01 | RootLayout mounts SageFAB above route outlet — visible on all pages |
| SAGE-02 | pilotSlice already in Zustand (persists across navigation), navigationSource gate prevents reset |
| SAGE-03 | useSage detects search_performed on Browse, stores pendingSageResults, auto-navigates after delay |

## RESEARCH COMPLETE
