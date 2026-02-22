---
phase: 19-extended-features
plan: "05"
status: complete
completed: 2026-02-21
---

# Summary: Plan 19-05 — Search Suggestions Dropdown in SearchInput

## What was built

Updated `SearchInput.tsx` with a live suggestions dropdown powered by `GET /api/suggest`. Suggestions appear on 2+ characters, are fetched on every keystroke (no debounce), and use AbortController to cancel stale requests.

## Tasks completed

### Task 1: Add suggestions dropdown to SearchInput
- Added `suggestions: string[]` and `showSuggestions: boolean` state
- Added `abortRef` and `blurTimerRef` refs alongside existing `timerRef`
- `fetchSuggestions(value)`: aborts previous request, calls `GET /api/suggest?q=...`, shows dropdown if results returned; returns early for < 2 chars
- `handleChange()`: calls `fetchSuggestions` immediately (no debounce); `setQuery` remains debounced at 350ms
- `handleKeyDown()`: Enter submits immediately (clears debounce timer, hides dropdown); Escape hides dropdown
- `handleSuggestionClick(suggestion)`: sets localValue, calls setQuery immediately, hides dropdown
- `handleBlur()`: 150ms delay before hiding (allows suggestion mousedown to register)
- `handleFocus()`: re-shows suggestions if available and input has 2+ chars
- `onMouseDown={(e) => e.preventDefault()}` on suggestion buttons — prevents blur before click (cleaner than setTimeout approach)
- Wrapped in `<div className="relative">`, dropdown is `absolute top-full` with `z-20`

## Key decisions

- `onMouseDown={(e) => e.preventDefault()}` chosen over `blurTimerRef` approach for blur/click race — more reliable and eliminates the 150ms window
- `AbortController` per-request — cancels in-flight fetch when user types next character
- Suggestions are non-critical: errors are silently ignored, empty array shown on failure
- `API_BASE = import.meta.env.VITE_API_URL ?? ''` — empty string = same-origin (production proxy)
- `setQuery` remains debounced at 350ms (unchanged from Phase 16) — suggestions are separate from grid refetch

## Files modified

- `frontend/src/components/sidebar/SearchInput.tsx` (enhanced with suggestions dropdown)

## Verification

- Build: exits 0 with no TypeScript errors
- `grep -n "api/suggest|AbortController|suggestions|onMouseDown" SearchInput.tsx` — all present
- `grep -n "handleSuggestionClick|setShowSuggestions" SearchInput.tsx` — both present
