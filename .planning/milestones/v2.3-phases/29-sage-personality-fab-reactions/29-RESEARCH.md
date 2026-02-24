# Phase 29 Research: Sage Personality + FAB Reactions

## ## RESEARCH COMPLETE

## Files Examined

- `app/services/pilot_service.py` — current system prompt lives in `run_pilot()` as `system_instruction` string
- `frontend/src/components/pilot/SageFAB.tsx` — current FAB: plain `div` wrapper + `motion.button` with `whileHover`/`whileTap` scale props
- `frontend/src/hooks/useSage.ts` — `handleSend()` controls the send/receive flow; `setStreaming(true/false)` brackets the API call
- `frontend/src/store/filterSlice.ts` — `setQuery`, `setRateRange`, `setTags`, `resetFilters` are the filter mutation actions
- `frontend/src/store/index.ts` — `useExplorerStore` is the combined Zustand store

## Backend: System Prompt

### Current state
The system prompt is a single string inside `run_pilot()`, injected via `types.GenerateContentConfig(system_instruction=...)`. It currently says:

> "You are Sage, a warm and helpful AI assistant for a professional expert marketplace. You have two tools: ..."

It's functional but clinical — no personality constraints, no clarifying question rules.

### What to change
Replace the entire `system_instruction` string. The new prompt must:
1. Establish the "smart funny friend" voice — contractions, concise, warm; humor rare and earned
2. Hard-limit: "You may ask at most ONE clarifying question per conversation. After the user responds to any question, you MUST call a function — never ask a second question."
3. Clarifying question format: always offer 2-3 concrete options, not open-ended
4. Narration templates for search_experts (already in place, just refine tone)
5. No-list: no "Absolutely!", "Great question!", "Of course!" — no filler affirmations
6. No over-explaining — Sage gets to the point

### Pitfall: f-string with current_filters
The current system prompt is an f-string with `{current_filters}` at the end. Any new prompt must preserve this as an f-string to keep the current filter state injection. Replace the full string literal but keep the f-string format.

### What NOT to change in this phase
- Function declarations (APPLY_FILTERS_DECLARATION, SEARCH_EXPERTS_DECLARATION)
- Turn 1 / Turn 2 function calling logic
- Handler functions `_handle_apply_filters()`, `_handle_search_experts()`
- GENERATION_MODEL constant

## Frontend: FAB Animation

### Current SageFAB.tsx structure
```tsx
<div className="fixed bottom-6 right-6 z-50 ...">
  {showTooltip && <motion.div ...>...</motion.div>}
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={handleClick}
    className="w-14 h-14 rounded-full bg-brand-purple ..."
    aria-label="Open Sage AI assistant"
  >
    <img src="/icon.png" ... />
  </motion.button>
</div>
```

### Required architecture change
The outer `div` becomes a `motion.div` that animates `boxShadow` ONLY. The inner `motion.button` retains its `whileHover`/`whileTap` scale props. Critical: NEVER add `scale` animation to the wrapper — it conflicts with the button's scale gestures and causes doubly-scaled renders.

```tsx
<motion.div
  className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 rounded-full"
  animate={{ boxShadow: isGlowing ? '0 0 20px 6px rgba(139, 92, 246, 0.5)' : '0 0 0 0 rgba(0,0,0,0)' }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
>
  {showTooltip && ...}
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    ...
  >
    ...
  </motion.button>
</motion.div>
```

### Glow trigger state
Need a local `isGlowing` state (or Zustand addition). Per CONTEXT.md decisions: triggers on Sage conversation events AND filter changes. Claude's discretion on exact timing.

**Recommended approach:**
- `isGlowing: boolean` in `pilotSlice.ts` (or local state in SageFAB.tsx)
- Since SageFAB is a standalone component and FAB is hidden when panel is open (existing behavior), local state with `useEffect` subscriptions is cleanest — no Zustand addition needed
- Subscribe to `messages.length` (new message → glow) and filter state changes (query/tags/rateMin/rateMax changes → glow with different color/intensity)
- `useExplorerStore.subscribe()` — Zustand's imperative subscribe API for non-reactive subscriptions (no re-render on change, just side effect)

### Subscription pattern for filter changes
```tsx
useEffect(() => {
  const unsub = useExplorerStore.subscribe(
    (state) => [state.query, state.tags, state.rateMin, state.rateMax],
    () => { /* trigger filter glow */ },
    { equalityFn: shallow }
  )
  return unsub
}, [])
```

BUT: `useExplorerStore.subscribe` with selector requires Zustand's `subscribeWithSelector` middleware, which is NOT in the current store setup (uses `persist` only).

**Simpler approach:** Use a `useEffect` that watches `messages.length` for Sage activity glow, and watch filter state via individual selectors for filter glow. The component already re-renders on `messages` changes — just derive `isGlowing` from those changes.

**Cleanest approach for SageFAB:**
- Import `isStreaming` from store — when `isStreaming` flips to false (API response received), trigger Sage glow
- Import filter state snapshot at render time — when filter state changes, SageFAB re-renders (it subscribes via selectors), trigger filter glow on change

Actually the FAB is hidden when panel is open (per existing SagePanel/ExplorerPage pattern). So filter-change glow only needs to work when panel is closed.

### Color differentiation (Claude's discretion)
- Sage message glow: `rgba(139, 92, 246, 0.6)` — brand purple, matches FAB color
- Filter change glow: `rgba(99, 179, 237, 0.5)` — cool blue, contrasts with purple to signal "grid changed"
- Auto-fade: 1.5s duration, then back to no glow

### Framer Motion `animate` on `boxShadow`
Framer Motion v10+ supports animating `boxShadow` directly via `animate` prop. The initial value must be set to avoid "undefined → value" jump. Use CSS `0px 0px 0px 0px rgba(0,0,0,0)` as the "off" state.

**Pitfall:** `motion.div` must have a `borderRadius` matching the button for the glow to look circular. The button is `rounded-full` (50%). Add `borderRadius: '50%'` or `rounded-full` to the `motion.div` wrapper as well — but the wrapper contains the tooltip which sits above the button. Solution: wrap only the button in `motion.div`, not the entire flex container.

**Revised structure:**
```tsx
<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
  {showTooltip && <motion.div ...>...</motion.div>}

  {/* Glow wrapper — surrounds button only, not tooltip */}
  <motion.div
    className="rounded-full"
    animate={{ boxShadow: glowStyle }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
  >
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className="w-14 h-14 rounded-full bg-brand-purple ..."
      aria-label="Open Sage AI assistant"
    >
      <img src="/icon.png" ... />
    </motion.button>
  </motion.div>
</div>
```

This keeps the outer `div` as the fixed positioning container (tooltip + button column), and inserts `motion.div` as glow wrapper around the button only.

## Glow Trigger Logic

**On Sage message received (isStreaming goes false after API call):**
```tsx
const prevStreamingRef = useRef(isStreaming)
useEffect(() => {
  if (prevStreamingRef.current === true && isStreaming === false) {
    // Sage response just received
    setGlowColor('sage')
    setIsGlowing(true)
    const t = setTimeout(() => setIsGlowing(false), 1500)
    return () => clearTimeout(t)
  }
  prevStreamingRef.current = isStreaming
}, [isStreaming])
```

**On filter change:**
```tsx
const query = useExplorerStore((s) => s.query)
const tags = useExplorerStore((s) => s.tags)
const rateMin = useExplorerStore((s) => s.rateMin)
const rateMax = useExplorerStore((s) => s.rateMax)
const filterKey = `${query}|${rateMin}|${rateMax}|${tags.join(',')}`
const prevFilterKey = useRef(filterKey)
useEffect(() => {
  if (prevFilterKey.current !== filterKey) {
    prevFilterKey.current = filterKey
    setGlowColor('filter')
    setIsGlowing(true)
    const t = setTimeout(() => setIsGlowing(false), 1500)
    return () => clearTimeout(t)
  }
}, [filterKey])
```

**Note:** Skip filter glow on initial mount (first render — filterKey isn't "changing", it just loaded).

## Key Pitfalls

1. **motion.div scale on wrapper:** NEVER — only `boxShadow` on wrapper div
2. **Glow wrapper must be `rounded-full`** to match button shape — otherwise glow is rectangular
3. **Filter glow on initial mount:** Must skip first render to avoid spurious glow on page load
4. **f-string in system_instruction:** New system prompt must remain an f-string with `{current_filters}` at the end
5. **No-list words in system prompt:** Gemini tends to use "Absolutely!" and "Great!" — must explicitly ban them in the prompt
6. **One clarifying question hard cap:** Must be stated as a hard rule in the prompt, not a guideline — "You MUST call a function after the user responds to any question. Never ask a second question."
7. **`motion` import from 'motion/react':** Already in use in the codebase — same import required

## Files to Modify

1. `app/services/pilot_service.py` — `system_instruction` string in `run_pilot()`
2. `frontend/src/components/pilot/SageFAB.tsx` — add `motion.div` glow wrapper, glow trigger logic

No other files need changes. No new Zustand slice fields needed.
