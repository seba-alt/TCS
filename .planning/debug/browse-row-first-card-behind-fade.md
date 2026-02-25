---
status: diagnosed
trigger: "first card in Browse rows still not past left fade overlay edge despite increasing left padding"
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: Left fade overlay (w-16 = 64px) is wider than the scroll container left padding (pl-8 = 32px on mobile), so first card still sits under the gradient
test: Compare overlay width class vs padding value in pixels
expecting: Overlay width > padding = first card hidden; overlay width <= padding = first card clear
next_action: DONE — root cause confirmed

## Symptoms

expected: First card content fully visible, to the right of the left gradient fade overlay
actual: First card content still hidden behind the left gradient fade overlay
errors: none — visual regression only
reproduction: Open Browse page, observe first card in any row on mobile
started: After padding was changed from px-4 md:px-8 to pl-8 md:pl-16

## Eliminated

- hypothesis: Parent container is overriding or clipping padding
  evidence: BrowsePage wraps rows in <div className="flex flex-col gap-12 md:gap-16 pb-16"> — no overflow:hidden, no padding override
  timestamp: 2026-02-25

- hypothesis: RootLayout is adding constraints
  evidence: RootLayout only renders <Outlet /> + Sage FAB/panel — no container wrapping that could clip
  timestamp: 2026-02-25

## Evidence

- timestamp: 2026-02-25
  checked: BrowseRow.tsx line 54 — left fade overlay
  found: className="pointer-events-none absolute left-0 top-0 h-full w-16 z-10" — w-16 = 64px
  implication: Overlay covers first 64px of the scroll area

- timestamp: 2026-02-25
  checked: BrowseRow.tsx line 69 — scroll container
  found: className includes "pl-8 md:pl-16" — pl-8 = 32px on mobile, pl-16 = 64px on md+
  implication: Mobile: padding 32px < overlay 64px (first card hidden by 32px). Desktop md+: padding 64px = overlay 64px (card starts exactly at fade edge, not past it)

- timestamp: 2026-02-25
  checked: Tailwind spacing scale
  found: w-16 = 4rem = 64px; pl-8 = 2rem = 32px; pl-16 = 4rem = 64px; pl-20 = 5rem = 80px
  implication: On mobile pl-8 (32px) is half the overlay width (64px). On desktop pl-16 (64px) equals the overlay width exactly — card leading edge aligns with start of transparent portion, but the card is not fully clear because the gradient starts at 64px and only reaches full opacity at 0px; at the card's left edge the gradient is still partially opaque

## Resolution

root_cause: >
  The left fade overlay is w-16 (64px). The scroll padding on mobile is pl-8 (32px) — half the
  overlay width, so the first card starts 32px into the 64px gradient. On desktop md+ pl-16
  equals the overlay exactly so the card left edge aligns with the transparent end of the
  gradient, but the gradient is linear — it starts fully opaque at left:0 and only becomes fully
  transparent at left:64px, meaning the first card starts exactly where transparency begins but
  any slight rounding or sub-pixel difference can still clip it. The fix is to push the scroll
  padding beyond the overlay width so the first card starts comfortably past the gradient.

fix: empty — diagnosis only
verification: empty
files_changed: []
