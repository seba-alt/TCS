---
phase: 19-extended-features
plan: "03"
status: complete
completed: 2026-02-21
---

# Summary: Plan 19-03 — Email Gate Modal

## What was built

Implemented email gate for "View Full Profile" on expert cards. Modal rendered at MarketplacePage level. Returning visitors (email in localStorage) bypass the modal.

## Tasks completed

### Task 1: Create ProfileGateModal component
- Created `frontend/src/components/marketplace/ProfileGateModal.tsx`
- Wraps v1.0 `EmailGate` component in a centered modal overlay
- Backdrop click and X button both call `onDismiss`
- `e.stopPropagation()` on inner card prevents backdrop dismiss on card click
- `AnimatePresence` + `motion.div` for enter/exit with scale + opacity

### Task 2: Add "View Full Profile" button to ExpertCard + onViewProfile prop
- Added `onViewProfile: (url: string) => void` to `ExpertCardProps`
- Added "View Full Profile →" button at bottom of card with `mt-auto self-start`
- `e.stopPropagation()` prevents tag pill click conflicts
- Card height constraint (`h-[180px]`) preserved — button fits in remaining space

### Task 3: Pass onViewProfile through ExpertGrid + wire modal in MarketplacePage
- Updated `ExpertGrid.tsx`: added `onViewProfile` to props, passes to each `ExpertCard`
- Updated `MarketplacePage.tsx`:
  - `useEmailGate()` — `isUnlocked` from localStorage (`STORAGE_KEY = 'tcs_gate_email'`)
  - `pendingProfileUrl: string | null` — gate state managed at page level
  - `handleViewProfile()`: if unlocked → open directly; else → set pendingProfileUrl
  - `handleEmailSubmit()`: calls `submitEmail()`, opens profile in new tab, clears pendingProfileUrl
  - `ProfileGateModal` rendered inside `AnimatePresence` at bottom of page JSX

## Key decisions

- Modal at MarketplacePage level (NOT inside ExpertCard) — ExpertCard has `h-[180px] overflow-hidden` which would clip the modal
- `STORAGE_KEY = 'tcs_gate_email'` reused from v1.0 — existing users already unlocked, no re-gate
- `window.open(url, '_blank', 'noopener,noreferrer')` for profile opens
- Dismissing modal: sets `pendingProfileUrl(null)` — modal re-appears on next profile click without email

## Files modified

- `frontend/src/components/marketplace/ProfileGateModal.tsx` (created)
- `frontend/src/components/marketplace/ExpertCard.tsx` (onViewProfile prop + button)
- `frontend/src/components/marketplace/ExpertGrid.tsx` (onViewProfile passed through)
- `frontend/src/pages/MarketplacePage.tsx` (gate state + modal + handleViewProfile)

## Verification

- Build: exits 0 with no TypeScript errors
- `grep -n "onViewProfile" ExpertCard.tsx ExpertGrid.tsx MarketplacePage.tsx` — flows through all three
- `grep -n "pendingProfileUrl" MarketplacePage.tsx` — gate state managed
- `grep -n "ProfileGateModal" MarketplacePage.tsx` — modal wired in AnimatePresence
