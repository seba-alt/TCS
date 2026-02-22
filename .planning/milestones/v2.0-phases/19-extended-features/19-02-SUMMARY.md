---
phase: 19-extended-features
plan: "02"
status: complete
completed: 2026-02-21
---

# Summary: Plan 19-02 — Shareable Filter URLs + Copy Link

## What was built

Extracted TOP_TAGS to a shared constant, created bidirectional URL ↔ Zustand filter sync hook, and added a "Copy link" button to FilterSidebar.

## Tasks completed

### Task 1: Extract TOP_TAGS to constants/tags.ts + update TagMultiSelect
- Created `frontend/src/constants/tags.ts` with exported `TOP_TAGS` array (30 tags)
- Updated `TagMultiSelect.tsx` to import from `../../constants/tags` instead of inline array

### Task 2: Create useUrlSync hook + wire into MarketplacePage
- Created `frontend/src/hooks/useUrlSync.ts`
- URL → Store: runs once on mount (`initialized` ref guard), URL params win over localStorage rehydration
- Store → URL: fires on every filter change (`replace: true` — no history spam), skips first render cycle
- Default values (rateMin=0, rateMax=5000, empty query, empty tags) NOT encoded in URL (clean URLs)
- Wired into `MarketplacePage.tsx` with `useUrlSync()` call

### Task 3: Add Copy link button to FilterSidebar
- Added `Link` icon from lucide-react to `FilterSidebar.tsx`
- `handleCopyLink()` uses `navigator.clipboard.writeText(window.location.href)`
- `copied` state shows "Copied!" for 2s then resets to "Copy link"
- Button placed at bottom of `FilterControls` with border-t separator

## Key decisions

- `useSearchParams` from react-router-dom (v7) for URL param management
- `replace: true` on `setSearchParams` — prevents browser history bloat on every keystroke
- `skipFirst` ref pattern avoids URL being overwritten with localStorage state before URL→Store runs
- Copy link button is in `FilterControls` (expanded sidebar only) — collapsed sidebar shows icon strip

## Files modified

- `frontend/src/constants/tags.ts` (created)
- `frontend/src/hooks/useUrlSync.ts` (created)
- `frontend/src/components/sidebar/TagMultiSelect.tsx` (import updated)
- `frontend/src/components/sidebar/FilterSidebar.tsx` (Copy link added)
- `frontend/src/pages/MarketplacePage.tsx` (useUrlSync wired)

## Verification

- Build: exits 0 with no TypeScript errors
- `grep -n "TOP_TAGS" constants/tags.ts` — exported
- `grep -n "import.*TOP_TAGS" TagMultiSelect.tsx` — import from constants
- `grep -n "useUrlSync" MarketplacePage.tsx` — hook called
- `grep -n "replace.*true" useUrlSync.ts` — no history spam
- `grep -n "Copy link" FilterSidebar.tsx` — button present
