---
status: diagnosed
trigger: "Investigate why the Clear All pill does not appear when Sage search is active in the Explorer."
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: Clear All condition only checks chips.length, and chips only form from filter fields (query, rateMin, rateMax, tags). Sage search bypasses all of these — it injects experts directly into the store via setResults() and sets sageMode=true, without touching any filter fields. So chips.length === 0, and Clear All never renders.
test: confirmed by reading FilterChips.tsx (line 94) and useSage.ts (lines 138-147)
expecting: n/a — root cause confirmed from static analysis
next_action: return diagnosis

## Symptoms

expected: Clear All pill is visible when Sage AI search results are shown
actual: Clear All pill is absent when Sage is active (sageMode=true), even though results are displayed
errors: none (no JS error — pure UI logic omission)
reproduction: Use Sage to search for experts on /explore. Sage results render. Clear All does not appear.
started: unknown — behaviour consistent from implementation

## Eliminated

- hypothesis: FilterChips is not rendering at all during sageMode
  evidence: The early-return guard is `if (chips.length === 0 && total === 0) return null` — when Sage returns results, total > 0, so the component DOES render. Only the Clear All button is absent.
  timestamp: 2026-02-25

## Evidence

- timestamp: 2026-02-25
  checked: FilterChips.tsx line 94
  found: `{chips.length > 0 && (<button onClick={resetFilters}>Clear all</button>)}`
  implication: Clear All only renders when at least one chip exists

- timestamp: 2026-02-25
  checked: FilterChips.tsx lines 29-44
  found: chips array is built from query, rateMin/rateMax delta, and tags only
  implication: No chip is ever created for sageMode being active

- timestamp: 2026-02-25
  checked: useSage.ts lines 138-147
  found: When search_performed=true on Explorer, Sage calls store.setResults(experts, total, null) then store.setSageMode(true). It does NOT call setQuery(), setTags(), or setRateRange().
  implication: sageMode=true but all filter fields remain at their defaults (query='', tags=[], rate unchanged). chips array stays empty. Clear All condition is never satisfied.

- timestamp: 2026-02-25
  checked: filterSlice.ts line 47 (setQuery), line 52 (setRateRange), line 57 (toggleTag)
  found: Every filter setter calls getSageMode(false) first, so these setters cannot be used to add a chip without also exiting sage mode
  implication: Cannot work around the issue by also setting a filter field — would immediately clear sageMode

## Resolution

root_cause: >
  FilterChips renders the Clear All button only when chips.length > 0, and chips are built exclusively from
  filter fields (query, rateMin/rateMax, tags). Sage search injects results directly via setResults() +
  setSageMode(true) without modifying any filter field, so chips.length remains 0 and Clear All never appears.

fix: >
  In FilterChips.tsx, change the Clear All condition from `chips.length > 0` to
  `chips.length > 0 || sageMode`. The sageMode value is already read from the store in line 26.
  The button's onClick (resetFilters) already calls setSageMode(false) inside filterSlice.ts, so
  clicking Clear All in sage mode will correctly exit sage mode and reset filters.

verification: []
files_changed:
  - frontend/src/components/marketplace/FilterChips.tsx
