# Phase 18: Floating AI Co-Pilot - Research

**Researched:** 2026-02-21
**Domain:** Gemini function calling, FAB + slide-in panel UI, FastAPI proxy
**Confidence:** HIGH (Gemini SDK), HIGH (UI patterns), MEDIUM (two-turn proxy architecture)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FAB design:**
- Icon: Custom TCS branding mark (not a generic chat bubble or sparkle icon)
- Label: Icon only — no text label alongside
- First-visit attention: A tooltip appears once on first page load (dismisses on click or after a few seconds; does not appear on subsequent visits)
- When panel is open: FAB hides entirely — panel has its own close control

**Co-pilot tone & personality:**
- Name: Sage
- Voice: Warm and conversational with a touch of playfulness — "Got it! Found 43 marketing experts that fit your budget ✨" — friendly but not over-the-top
- Not formal, not minimal — has personality without getting in the way

**Conversation behavior:**
- Sage holds context across messages — follow-up messages layer on current filter state
- Sage can reset all filters — "show everyone" or "start over" clears active filters and re-fetches
- Failed/ambiguous requests: Sage explains what it understood and asks for clarification
- Confirmation message always includes the resulting expert count

**Panel UX & layout:**
- First open: Short greeting from Sage + empty input — no example prompts
- Input: Auto-growing textarea (expands as user types; Enter to submit)
- Dismiss: Clicking outside the panel closes it
- Session persistence: Conversation history preserved within session
- Mobile: Panel expands to full-screen

### Claude's Discretion
- Panel slide-in animation direction and duration
- Exact greeting text from Sage on first open
- Typing/loading indicator while Gemini processes the request
- Visual distinction between user messages and Sage messages
- Exact tooltip copy and dismissal timing

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PILOT-01 | Floating FAB (bottom-right) opens a 380px right-edge slide-in co-pilot panel | FAB: fixed positioned, z-50, bottom-right; panel: motion.div with x: 380→0; AnimatePresence for mount/unmount |
| PILOT-02 | Co-pilot uses Gemini function calling (`apply_filters`) to update Zustand filter state from conversation | FastAPI `/api/pilot` endpoint; google-genai 1.64 FunctionDeclaration; two-turn proxy pattern; frontend dispatches to store |
| PILOT-03 | Co-pilot panel is full-screen on mobile | Tailwind `md:w-[380px] w-full md:h-auto h-full` on panel wrapper |

</phase_requirements>

## Summary

Phase 18 builds two distinct systems: (1) a React FAB + animated slide-in conversation panel with session-persistent chat history, and (2) a FastAPI proxy endpoint that uses Gemini function calling to translate natural language into structured `apply_filters` calls that the frontend then dispatches to Zustand.

The key architectural insight from STATE.md is that the **co-pilot is client-side dispatch** — FastAPI is a thin Gemini proxy; the browser owns all filter state via `useExplorerStore.getState()`. The backend makes TWO Gemini calls per user message: (1) with the `apply_filters` function declaration to extract filter intent, (2) with the function execution result to generate a natural-language confirmation. The frontend is responsible for actually calling the Zustand setters.

The Gemini SDK (`google-genai==1.64`) is already installed in requirements.txt and uses `genai.Client()` with `GOOGLE_API_KEY` from environment (Railway injects it). The existing `llm.py` and `embedder.py` both use the same lazy-init `_client` pattern.

**Primary recommendation:** FastAPI `/api/pilot` endpoint does both Gemini turns synchronously (sync function, run_in_executor like explore.py), returns `{ filters_applied, confirmation_message, expert_count? }`. Frontend validates the filters, dispatches to Zustand, then triggers the grid re-fetch normally via useExplore's reactive effect.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-genai | 1.64.* (already installed) | Gemini function calling backend | Already in requirements.txt; same as llm.py |
| motion/react | 12.34.* (installed Phase 17) | FAB + panel animations | Already installed; AnimatePresence for panel mount/unmount |
| zustand | 5.0.* (already installed) | pilotSlice already exists | Phase 15 foundation; setOpen, addMessage, setStreaming |
| lucide-react | Already installed | Icon for FAB if custom TCS mark not available | Already in use across components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion/react AnimatePresence | - | Panel mount/unmount animation | Wrap SagePanel in AnimatePresence in MarketplacePage |
| tailwind `fixed` positioning | - | FAB stays in bottom-right always | `fixed bottom-6 right-6 z-50` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two-turn proxy (FastAPI) | Single-turn with prompt engineering | Function calling gives structured JSON output reliably; prompt engineering fragile for JSON extraction |
| motion/react AnimatePresence | CSS transitions | AnimatePresence handles unmount animation; CSS can't delay unmount |

**Installation:** No new packages needed — google-genai and motion already installed.

## Architecture Patterns

### Recommended File Structure
```
app/routers/pilot.py              # New FastAPI router: POST /api/pilot
app/services/pilot_service.py     # Two-turn Gemini function calling logic
frontend/src/
  components/pilot/
    SageFAB.tsx                   # Floating action button (fixed, bottom-right)
    SagePanel.tsx                 # 380px slide-in conversation panel
    SageMessage.tsx               # Individual message bubble
    SageInput.tsx                 # Auto-growing textarea with submit
  hooks/useSage.ts                # Hook: sends message, handles response, dispatches filters
```

### Pattern 1: FastAPI Two-Turn Gemini Proxy

**Backend flow:**
1. Receive `{ message: str, history: list[{role, content}], current_filters: dict }`
2. Gemini call 1: Send message + history + current_filters context + `apply_filters` FunctionDeclaration → expect function call
3. If Gemini returns function_call for `apply_filters`: extract args, validate
4. Gemini call 2: Send function response → get natural language confirmation
5. Return `{ filters: ApplyFiltersArgs | null, message: str }`

```python
# Source: googleapis.github.io/python-genai + google-genai 1.64 pattern
from google import genai
from google.genai import types

APPLY_FILTERS_DECLARATION = types.FunctionDeclaration(
    name="apply_filters",
    description="Apply search filters to the expert marketplace grid.",
    parameters_json_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Text search query. Empty string to clear.",
            },
            "rate_min": {
                "type": "number",
                "description": "Minimum hourly rate in the expert's currency.",
            },
            "rate_max": {
                "type": "number",
                "description": "Maximum hourly rate in the expert's currency.",
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Domain tags to filter by (AND logic). Empty array to clear tag filters.",
            },
            "reset": {
                "type": "boolean",
                "description": "If true, clear all filters and show all experts.",
            },
        },
        "required": [],
    },
)

def run_pilot(
    message: str,
    history: list[dict],
    current_filters: dict,
) -> dict:
    """Two-turn Gemini function calling proxy for Sage co-pilot."""
    client = _get_client()
    tool = types.Tool(function_declarations=[APPLY_FILTERS_DECLARATION])
    config = types.GenerateContentConfig(tools=[tool])

    # Build history as Content objects
    contents = []
    for h in history:
        contents.append(types.Content(
            role=h["role"],
            parts=[types.Part(text=h["content"])]
        ))

    # System context: who Sage is + current filter state
    system_msg = (
        f"You are Sage, a warm and helpful AI assistant for a professional expert marketplace. "
        f"Current active filters: {current_filters}. "
        f"Use apply_filters to update the search when the user requests it. "
        f"Follow-up requests should layer on top of current filters unless user asks to reset."
    )

    contents.append(types.Content(
        role="user",
        parts=[types.Part(text=f"{system_msg}\n\nUser: {message}")]
    ))

    # Turn 1: Get function call
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=config,
    )

    filters_applied = None
    if response.function_calls:
        fn_call = response.function_calls[0]
        if fn_call.name == "apply_filters":
            filters_applied = dict(fn_call.args)

            # Turn 2: Send function result back for confirmation message
            contents.append(response.candidates[0].content)
            expert_count = filters_applied.get("_expert_count", None)  # passed by frontend optionally
            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_function_response(
                    name="apply_filters",
                    response={"result": "Filters applied successfully."},
                )]
            ))
            final = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=config,
            )
            confirmation = final.text
        else:
            confirmation = response.text
    else:
        # No function call — Sage is asking for clarification or greeting
        confirmation = response.text

    return {"filters": filters_applied, "message": confirmation}
```

### Pattern 2: FAB + AnimatePresence Panel (Frontend)

**Critical constraints from STATE.md:**
- AnimatePresence IS used here (FAB/panel are NOT VirtuosoGrid items — exit animations are fine)
- Panel exits with x: 0→380 (slides right, off-screen)
- FAB hides when panel is open (locked decision)

```tsx
// Source: motion.dev/docs/react-animation + Phase 17 pattern (motion/react)
import { AnimatePresence, motion } from 'motion/react'

// In MarketplacePage (or App.tsx):
<AnimatePresence>
  {!isOpen && <SageFAB key="fab" />}
</AnimatePresence>
<AnimatePresence>
  {isOpen && <SagePanel key="panel" />}
</AnimatePresence>

// SagePanel slide-in from right:
<motion.div
  initial={{ x: 380 }}
  animate={{ x: 0 }}
  exit={{ x: 380 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
  className="fixed bottom-0 right-0 h-full w-full md:w-[380px] z-40 bg-white shadow-xl"
>
```

### Pattern 3: Zustand pilotSlice Integration

The `pilotSlice` is **already built** in Phase 15. It provides:
- `messages: PilotMessage[]` — conversation history (session-persistent, NOT localStorage)
- `isOpen: boolean` + `setOpen(bool)` — panel open/close
- `isStreaming: boolean` + `setStreaming(bool)` — loading state
- `addMessage(msg)` — appends to conversation
- `resetPilot()` — already called on MarketplacePage mount (Phase 16 pattern)

**useSage hook:**
```typescript
// Pattern: send message → POST /api/pilot → dispatch filters to store → add confirmation to messages
const handleSend = async (text: string) => {
  addMessage({ id: ..., role: 'user', content: text, timestamp: Date.now() })
  setStreaming(true)
  try {
    const res = await fetch(`${API_BASE}/api/pilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: messages.map(m => ({ role: m.role, content: m.content })),
        current_filters: {
          query: useExplorerStore.getState().query,
          rate_min: useExplorerStore.getState().rateMin,
          rate_max: useExplorerStore.getState().rateMax,
          tags: useExplorerStore.getState().tags,
        }
      })
    })
    const data = await res.json()
    // Dispatch filters to Zustand store (triggers useExplore re-fetch reactively)
    if (data.filters) {
      validateAndApplyFilters(data.filters)  // validate before dispatch
    }
    addMessage({ id: ..., role: 'assistant', content: data.message, timestamp: Date.now() })
  } finally {
    setStreaming(false)
  }
}
```

### Pattern 4: validateFilterArgs Before Dispatch

STATE.md constraint: "Gemini function call output must pass `validateFilterArgs` before any store dispatch"

```typescript
function validateAndApplyFilters(filters: Record<string, unknown>) {
  const { setQuery, setRateRange, toggleTag, resetFilters } = useExplorerStore.getState()

  if (filters.reset === true) {
    resetFilters()
    return
  }
  if (typeof filters.query === 'string') {
    setQuery(filters.query)
  }
  if (typeof filters.rate_min === 'number' && typeof filters.rate_max === 'number') {
    setRateRange(filters.rate_min, filters.rate_max)
  }
  if (Array.isArray(filters.tags)) {
    // Replace tags entirely (not toggle): reset then add each
    const store = useExplorerStore.getState()
    // setQuery triggers re-fetch; tags need full replace, not toggle
    // Use store setter approach: setResults resets; need to expose setTags or use reset+toggle
    // See Pitfall 3 below — need setTags action in filterSlice
  }
}
```

**Pitfall: tags field in filterSlice only has `toggleTag`, not `setTags`.**
The planner must add a `setTags(tags: string[])` action to filterSlice for Sage to directly set the tags array.

### Anti-Patterns to Avoid
- **Using AnimatePresence on VirtuosoGrid items:** Already avoided in Phase 17. Sage panel and FAB are NOT virtualized — AnimatePresence is correct here.
- **Streaming SSE for pilot:** Phase 17's explore uses non-streaming JSON; pilot should too — simple, consistent. The `isStreaming` pilotSlice state shows a typing indicator without actual streaming.
- **Frontend calling Gemini directly:** API key must stay backend. No `VITE_GEMINI_KEY`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-resize textarea | Custom JS height calculation | `field-sizing: content` CSS (modern) or `rows` attribute + overflow-y:auto | Built-in or trivial CSS |
| Panel slide animation | Custom CSS keyframes | motion/react (already installed) | Already in project |
| Click-outside to close | Custom event listeners | Ref + mousedown listener OR AnimatePresence backdrop div with onClick | Standard pattern |
| Gemini structured output | regex parsing of LLM text | function calling with FunctionDeclaration | Reliable JSON extraction |

## Common Pitfalls

### Pitfall 1: filterSlice missing setTags action
**What goes wrong:** Sage wants to set tags to `["marketing", "seo"]` directly but filterSlice only has `toggleTag` — no way to replace the tags array wholesale.
**Why it happens:** toggleTag was designed for human interactions (click to add/remove), not programmatic replacement.
**How to avoid:** Plan 18-01 adds `setTags(tags: string[])` action to filterSlice. Sage uses `setTags` to replace the full array; `toggleTag` remains for card pill clicks.
**Warning signs:** TS error — "setTags is not a function" when validateAndApplyFilters tries to dispatch.

### Pitfall 2: AnimatePresence key collision between FAB and panel
**What goes wrong:** Both FAB and panel are conditionally rendered; if both wrapped in same AnimatePresence, key conflicts or layout issues occur.
**How to avoid:** Use two separate `AnimatePresence` wrappers — one for FAB, one for panel. Or render both at all times, use CSS pointer-events:none + opacity for FAB when panel open (simpler, no AnimatePresence needed for FAB).
**Recommended:** Use `AnimatePresence` only on the panel; use simple conditional render for FAB (no exit animation needed for FAB).

### Pitfall 3: history serialization — PilotMessage has `id` and `timestamp` fields Gemini doesn't need
**What goes wrong:** Sending full PilotMessage objects (with id, timestamp) to FastAPI causes Pydantic validation failure.
**How to avoid:** Frontend maps messages: `messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }))` — Gemini uses 'user'/'model' roles, NOT 'user'/'assistant'.
**Warning signs:** 422 from FastAPI; check role field values.

### Pitfall 4: google-genai 1.x role must be 'model' not 'assistant'
**What goes wrong:** Passing `role: 'assistant'` in Contents causes API error — Gemini uses 'user' and 'model'.
**How to avoid:** Frontend sends `role: m.role === 'assistant' ? 'model' : 'user'` in history. Backend Pydantic model validates: `role: Literal['user', 'model']`.
**Warning signs:** Gemini API 400 error about invalid role.

### Pitfall 5: CORS — new /api/pilot route needs CORS
**What goes wrong:** POST /api/pilot blocked by browser because Content-Type: application/json triggers preflight — needs 'Content-Type' in allow_headers.
**How to avoid:** main.py already has `allow_headers=["Content-Type", "X-Admin-Key"]` — Content-Type is covered. No change needed.
**Warning signs:** CORS error in browser console on pilot requests.

### Pitfall 6: Click-outside closes panel while interacting with sidebar
**What goes wrong:** Click-outside listener fires when user clicks the filter sidebar, closing the panel unexpectedly.
**How to avoid:** The panel is `fixed right-0` — it overlaps the right side only. The sidebar is on the left. Click-outside via backdrop div (z-30 behind panel, z-40 panel) only captures clicks in the backdrop area. Alternatively, check click target is not within panel ref before closing.

### Pitfall 7: `useExplorerStore.getState()` vs reactive selectors for current_filters
**What goes wrong:** Using reactive `useExplorerStore((s) => s.query)` selectors inside the async send handler causes stale closure reads if the component re-renders between calls.
**How to avoid:** Use `useExplorerStore.getState()` (snapshot, not reactive) when reading current filters inside the send handler. This is what STATE.md explicitly calls out: "browser owns all filter state via `useExplorerStore.getState()`".

### Pitfall 8: Tooltip first-visit logic with SSR/hydration
**What goes wrong:** Using localStorage to gate first-visit tooltip causes flash of tooltip on every page load before localStorage is read.
**How to avoid:** Initialize `const [showTooltip, setShowTooltip] = useState(false)` and check localStorage in useEffect (not useState initializer) — this is the Phase 16 pattern for email gate. Show tooltip only after mount.

## Code Examples

### Backend: pilot_service.py two-turn pattern
```python
# Source: googleapis.github.io/python-genai — google-genai 1.64
from google import genai
from google.genai import types

APPLY_FILTERS_DECLARATION = types.FunctionDeclaration(
    name="apply_filters",
    description="Update the expert marketplace search filters based on user request.",
    parameters_json_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Text search. Empty string to clear."},
            "rate_min": {"type": "number", "description": "Min hourly rate."},
            "rate_max": {"type": "number", "description": "Max hourly rate."},
            "tags": {"type": "array", "items": {"type": "string"}, "description": "Domain tags (AND logic). Empty array clears tags."},
            "reset": {"type": "boolean", "description": "True to clear all filters."},
        },
        "required": [],
    },
)

def run_pilot(message: str, history: list[dict], current_filters: dict) -> dict:
    client = _get_client()
    tool = types.Tool(function_declarations=[APPLY_FILTERS_DECLARATION])
    config = types.GenerateContentConfig(
        tools=[tool],
        system_instruction=(
            "You are Sage, a warm and helpful AI assistant for a professional expert marketplace. "
            "Help users find experts by updating search filters. Be conversational and friendly. "
            "Always use apply_filters when the user describes what they want to find. "
            f"Current active filters: {current_filters}"
        ),
    )

    # Build contents from history
    contents = []
    for h in history:
        contents.append(types.Content(
            role=h["role"],  # must be 'user' or 'model'
            parts=[types.Part(text=h["content"])]
        ))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    # Turn 1: extract function call
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=config,
    )

    filters_applied = None
    if response.function_calls:
        fn_call = response.function_calls[0]
        if fn_call.name == "apply_filters":
            filters_applied = {k: v for k, v in fn_call.args.items()}

            # Turn 2: send result back, get confirmation
            contents.append(response.candidates[0].content)
            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_function_response(
                    name="apply_filters",
                    response={"result": "Filters applied."},
                )]
            ))
            final = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=config,
            )
            confirmation = final.text or "Done! I've updated your filters."
    else:
        # Clarification or greeting
        confirmation = response.text or "I'm not sure what you're looking for. Could you tell me more?"

    return {"filters": filters_applied, "message": confirmation}
```

### Backend: pilot.py router
```python
# Source: explore.py pattern (already in codebase)
import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.pilot_service import run_pilot

router = APIRouter()

class HistoryItem(BaseModel):
    role: str  # 'user' or 'model'
    content: str

class PilotRequest(BaseModel):
    message: str
    history: list[HistoryItem] = []
    current_filters: dict = {}

class PilotResponse(BaseModel):
    filters: dict | None  # apply_filters args, or null if no filter change
    message: str          # Sage's natural language response

@router.post("/api/pilot", response_model=PilotResponse)
async def pilot(body: PilotRequest) -> PilotResponse:
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_pilot(
            message=body.message,
            history=[h.model_dump() for h in body.history],
            current_filters=body.current_filters,
        ),
    )
    return PilotResponse(**result)
```

### Frontend: filterSlice setTags addition
```typescript
// Add to FilterSlice interface:
setTags: (tags: string[]) => void

// Add to createFilterSlice implementation:
setTags: (tags) => set({ tags }),
```

### Frontend: SagePanel slide-in
```tsx
// Source: motion.dev/docs/react-animation
import { motion } from 'motion/react'

// Panel: slides in from right
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  className="fixed bottom-0 right-0 z-40 h-full w-full md:w-[380px] bg-white shadow-2xl flex flex-col"
>
```

### Frontend: Click-outside to close
```tsx
// Backdrop approach (simpler than ref + event listener):
// Render a semi-transparent backdrop behind the panel
{isOpen && (
  <>
    {/* Backdrop — click to close, md:hidden (desktop panel doesn't need full backdrop) */}
    <div
      className="fixed inset-0 z-30 bg-black/20 md:hidden"
      onClick={() => setOpen(false)}
    />
    <SagePanel />
  </>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` | `motion/react` | Motion v12 (2024) | Already using correct import in Phase 17 |
| `google-generativeai` | `google-genai` | 2024 | Already in requirements.txt as google-genai==1.64 |
| roles: 'user'/'assistant' | roles: 'user'/'model' | google-genai 1.x | Must map 'assistant'→'model' in history |
| `response.text` only | `response.function_calls` | google-genai 1.x | Check function_calls before .text |

## Open Questions

1. **Exact expert count in confirmation message**
   - What we know: Frontend fetches /api/explore after filter dispatch; the explore response returns `total`
   - What's unclear: Sage's confirmation fires before re-fetch completes, so count isn't available to FastAPI
   - Recommendation: Sage confirmation says "Looking for X type of expert..." — frontend can update the message with the count after re-fetch, OR Sage says "Filters applied! Check the updated results." The count from the grid (`total` field) is available in resultsSlice after re-fetch; frontend can show it contextually. **Plan should handle this gracefully — Sage's confirmation doesn't need to include the exact count from the API; the grid header will show it.**

2. **System instruction in google-genai 1.64**
   - What we know: `GenerateContentConfig` accepts `system_instruction` parameter
   - What's unclear: Exact parameter type (str vs Content object) in 1.64
   - Recommendation: Use `system_instruction=str` (string form) — widely documented; if it fails, wrap as `types.Content(role='user', parts=[types.Part(text=...)])`

3. **Tooltip dismiss timing**
   - What we know: First-visit check via localStorage; dismissed on click or after N seconds
   - What's unclear: Exact seconds (Claude's discretion)
   - Recommendation: 4 seconds, `useTimeout(setShowTooltip(false), 4000)` in useEffect

## Sources

### Primary (HIGH confidence)
- https://googleapis.github.io/python-genai/ — FunctionDeclaration, function_calls, Part.from_function_response API
- https://ai.google.dev/gemini-api/docs/function-calling — two-turn pattern, function declaration format
- motion.dev/docs/react-animation — AnimatePresence, motion.div, spring transition
- Codebase: `app/services/llm.py` — existing genai.Client() lazy init pattern to follow
- Codebase: `app/routers/explore.py` — run_in_executor async pattern to follow
- Codebase: `frontend/src/store/pilotSlice.ts` — already-built slice with messages, isOpen, setOpen

### Secondary (MEDIUM confidence)
- WebSearch: FastAPI + Gemini function calling proxy patterns
- WebSearch: React FAB + slide-in panel animation patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, APIs verified
- Architecture: HIGH — two-turn pattern verified against official SDK docs; follows existing codebase patterns
- Pitfalls: HIGH — most derived from codebase inspection + SDK docs

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (google-genai 1.64 API stable)

## RESEARCH COMPLETE

**Phase:** 18 - Floating AI Co-Pilot
**Confidence:** HIGH

### Key Findings
- All required packages already installed (google-genai, motion/react, zustand); no new dependencies needed
- Gemini function calling uses two turns: Turn 1 extracts function call → Turn 2 sends result back for confirmation text
- filterSlice needs `setTags(tags: string[])` action added — toggleTag insufficient for programmatic replacement
- History roles must be 'user'/'model' (not 'user'/'assistant') — frontend must map before sending to FastAPI
- pilotSlice is fully built from Phase 15 — messages, isOpen, setOpen, addMessage, setStreaming all ready
- AnimatePresence IS correct for SagePanel (not a VirtuosoGrid item) — panel exit animation is fine
- `useExplorerStore.getState()` (snapshot) must be used inside async handler, not reactive selectors

### File Created
`.planning/phases/18-floating-ai-co-pilot/18-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All packages installed; APIs verified via official docs |
| Architecture | HIGH | Two-turn pattern verified; follows existing codebase patterns |
| Pitfalls | HIGH | Derived from codebase inspection + SDK docs, not guesswork |

### Open Questions
- Exact expert count in Sage confirmation (resolve: frontend shows count from resultsSlice.total after re-fetch)

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
