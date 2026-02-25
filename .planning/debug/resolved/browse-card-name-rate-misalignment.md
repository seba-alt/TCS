---
status: resolved
trigger: "BrowseCards on the Browse page still have name and rate at different heights due to tags"
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — tags are BELOW name/rate in DOM order but visually appear after; justify-end anchors the whole overlay bottom but doesn't fix the ordering problem
test: read BrowseCard.tsx structure
expecting: tags below name/rate in DOM, with justify-end pinning everything to bottom as a block
next_action: RESOLVED — document root cause

## Symptoms

expected: name and rate appear at the same vertical position on every card regardless of how many tags each card has
actual: cards with 0 tags have name/rate lower than cards with 1-3 tags (or vice versa depending on hover state)
errors: none — visual misalignment only
reproduction: compare two Browse cards with different tag counts on hover
started: after tags were added to overlay

## Eliminated

- hypothesis: justify-end missing from overlay container
  evidence: line 94 already has `flex flex-col justify-end` on the overlay div
  timestamp: 2026-02-25

## Evidence

- timestamp: 2026-02-25
  checked: BrowseCard.tsx line 94-117 — overlay div structure
  found: |
    DOM order inside the overlay flex-col:
      1. <p> name        (line 95)
      2. <p> rate        (line 96-98)
      3. <div> tags      (line 101-116) — conditionally rendered, always occupies space when visible
    The overlay div has NO fixed height — it is sized by its content.
    `justify-end` aligns children toward the end of the flex container, but the
    container itself shrinks to fit its children. With no fixed/min height the
    container is always exactly as tall as its content, so justify-end does nothing.
  implication: |
    On hover the tags div becomes visible (opacity-100) but it uses `transition-opacity` —
    opacity changes don't affect layout. The tags div is ALWAYS in the DOM and ALWAYS
    takes up space (it is not display:none). So cards with 0 visible tags vs 1-3 tags
    have overlay divs of different heights, and since the overlay is `absolute bottom-0`
    the name/rate sit at different distances from the card bottom on different cards.

- timestamp: 2026-02-25
  checked: tags div opacity behavior (line 103-104)
  found: |
    `opacity-0 group-hover:opacity-100` — hidden via opacity, not via `hidden` or `h-0`.
    The tags div occupies layout space even when opacity-0. So a card with 3 tags has
    a taller overlay than a card with 0 tags at ALL times, not just on hover.
  implication: name/rate are pushed upward relative to the card bottom by tag height

## Resolution

root_cause: |
  The tags div is always present in the layout (hidden only via opacity) so the overlay
  height differs between cards with 0 tags vs 1+ tags. Because the overlay is
  `absolute bottom-0` with no fixed height, `justify-end` is meaningless — the
  container always fits its content exactly. Cards with tags have a taller overlay,
  pushing name/rate further from the actual card bottom than cards without tags.

fix: |
  Pin name and rate to the bottom independently of tags.
  Two viable approaches:

  A) Make tags absolutely positioned (best — zero layout impact):
     - Give the overlay div a fixed height (e.g. h-24) OR use `relative` on it
     - Position tags with `absolute bottom-0` inside an inner wrapper
     - Name/rate remain in normal flow at the overlay bottom

  B) Reverse DOM order + use flex-col-reverse (simplest change):
     - Put tags FIRST in DOM (before name/rate)
     - Change overlay to `flex flex-col-reverse`
     - justify-end then pins name/rate to the bottom and tags grow upward
     - Tags still need `opacity-0` handling but layout is stable

  C) Use a spacer / separate absolute layers:
     - Keep name/rate in the overlay as-is
     - Remove tags from the overlay entirely
     - Add a second `absolute` div for tags positioned above the overlay

  Recommended: Option B — minimal diff, no structural change needed.

files_changed: []
