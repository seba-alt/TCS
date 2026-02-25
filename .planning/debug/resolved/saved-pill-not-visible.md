---
status: diagnosed
trigger: "Investigate why the Saved (N) pill is not visible in the Explorer, and understand the user's requirement for a dedicated saved-experts button in the top right"
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: Three compounding conditions hide the Saved pill — rendering guard fires before save exists, chip strip itself is conditionally hidden, and mobile toolbar never shows it
test: Read FilterChips.tsx, ExpertCard.tsx, MarketplacePage.tsx in full
expecting: Confirmed — all three conditions confirmed in code
next_action: DIAGNOSED — report root causes and what's needed for dedicated button

## Symptoms

expected: "Saved (N)" pill is visible and clickable in the Explorer after bookmarking experts
actual: Pill is never seen by the user even after saving experts
errors: none (silent rendering omission)
reproduction: Bookmark any expert → pill does not appear visibly in the main toolbar area
started: Since implementation in phase 40.2

## Eliminated

- hypothesis: The Saved pill code doesn't exist at all
  evidence: FilterChips.tsx line 64-76 shows it IS implemented
  timestamp: 2026-02-25

- hypothesis: The savedCount logic is broken
  evidence: getSavedCount() correctly reads from localStorage using SAVED_KEY='tcs_saved_experts', same key ExpertCard uses for toggleSavedExpert
  timestamp: 2026-02-25

## Evidence

- timestamp: 2026-02-25
  checked: FilterChips.tsx line 47
  found: "if (chips.length === 0 && total === 0) return null" — entire component returns null when no filter chips AND total is zero
  implication: On first load before results come in, or if total=0, the entire strip including the Saved pill is hidden

- timestamp: 2026-02-25
  checked: FilterChips.tsx line 64
  found: "{savedCount > 0 && (...)}" — pill only renders if savedCount > 0
  implication: getSavedCount() reads localStorage at component MOUNT time (line 27: const savedCount = getSavedCount()). It is NOT reactive — it does NOT subscribe to localStorage changes. After user saves an expert (ExpertCard writes to localStorage), FilterChips never re-reads the count because it has no state or effect tied to localStorage.

- timestamp: 2026-02-25
  checked: ExpertCard.tsx line 54-58
  found: handleBookmark writes to localStorage via toggleSavedExpert(), then calls setIsSaved(nowSaved) — local state only
  implication: There is no global signal/store event dispatched when a bookmark is toggled. FilterChips has no way to know savedCount changed.

- timestamp: 2026-02-25
  checked: MarketplacePage.tsx line 111-125
  found: Mobile toolbar only contains "Experts" title + Filters button. FilterChips is rendered BELOW the mobile toolbar, inside main content.
  implication: On mobile the chip strip sits below the fold / below the filter toolbar, easy to miss or scroll past. The Saved pill is NOT in the mobile toolbar row.

- timestamp: 2026-02-25
  checked: FilterChips.tsx line 50
  found: Strip is always full-width, px-4 py-2, below the toolbar — no special mobile positioning
  implication: On mobile the strip is inside main content scroll area, not pinned/visible at top right

## Resolution

root_cause: |
  Three compounding issues:

  1. STALE READ (primary bug): FilterChips reads savedCount once at render time via getSavedCount()
     (line 27). This is a plain function call, NOT reactive state. When ExpertCard writes to
     localStorage, FilterChips is never notified and never re-renders. savedCount stays 0 forever
     in an existing FilterChips mount.

  2. EARLY RETURN GUARD (secondary bug): FilterChips returns null entirely when
     chips.length === 0 && total === 0 (line 47). On initial page load before the API responds
     (or if results are empty), the whole strip — including the Saved pill — is hidden.

  3. MOBILE PLACEMENT (UX issue): FilterChips is rendered inside the main content area,
     below the mobile toolbar row. The Saved pill is not in the top-right of the mobile toolbar.
     On mobile it is buried in the content strip, easily missed or below fold.

fix: |
  For the dedicated top-right button approach (user's preferred solution):

  A) Add savedCount as reactive state to the global Zustand store (explorerStore or a new
     savedSlice). ExpertCard calls a store action on bookmark toggle. The button subscribes to
     store state.

  B) OR: lift savedCount into a custom useSavedExperts() hook that uses useState + a
     window 'storage' event listener to stay reactive across components.

  C) Place the button inside MarketplacePage.tsx's mobile toolbar div (line 111-125) as a
     second icon-button at top right, next to the Filters button. On desktop it can sit in the
     FilterSidebar header or in the FilterChips strip as it does now.

files_changed: []

verification: n/a — diagnosis only
