import { useCallback } from 'react'
import { useExplorerStore } from '../store'
import type { Expert } from '../store/resultsSlice'
import { useNltrStore } from '../store/nltrStore'
import { trackEvent } from '../tracking'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// Role mapping: pilotSlice uses 'user'/'assistant', Gemini needs 'user'/'model'
function toGeminiRole(role: 'user' | 'assistant'): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user'
}

const BARREL_ROLL_PHRASES = ['barrel roll', 'do a flip']
function isBarrelRoll(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return BARREL_ROLL_PHRASES.some(p => lower.includes(p))
}

function validateAndApplyFilters(filters: Record<string, unknown>) {
  const store = useExplorerStore.getState()

  if (filters.reset === true) {
    store.resetFilters()
    return
  }
  if (typeof filters.query === 'string') {
    store.setQuery(filters.query)
  }
  if (typeof filters.rate_min === 'number' && typeof filters.rate_max === 'number') {
    store.setRateRange(filters.rate_min, filters.rate_max)
  } else if (typeof filters.rate_min === 'number') {
    const current = store.rateMax
    store.setRateRange(filters.rate_min, current)
  } else if (typeof filters.rate_max === 'number') {
    const current = store.rateMin
    store.setRateRange(current, filters.rate_max)
  }
  if (Array.isArray(filters.tags) && filters.tags.every(t => typeof t === 'string')) {
    store.setTags(filters.tags)
  }
}

export function useSage() {
  // Individual Zustand selectors (Phase 16 pattern — NOT useShallow)
  const messages = useExplorerStore((s) => s.messages)
  const isStreaming = useExplorerStore((s) => s.isStreaming)
  const addMessage = useExplorerStore((s) => s.addMessage)
  const setStreaming = useExplorerStore((s) => s.setStreaming)
  const { triggerSpin } = useNltrStore()

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    // Barrel roll easter egg — intercept before API call
    if (isBarrelRoll(text)) {
      triggerSpin()
      addMessage({
        id: `${Date.now()}-user`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      })
      addMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: "Wheee! Hold on tight — spinning up the best experts for you!",
        timestamp: Date.now(),
      })
      return
    }

    // Add user message immediately
    addMessage({
      id: `${Date.now()}-user`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    })
    setStreaming(true)

    try {
      // Get current state snapshot (not reactive — snapshot for async handler)
      const storeState = useExplorerStore.getState()
      const history = storeState.messages
        .slice(-10) // Last 10 messages for context window
        .map(m => ({ role: toGeminiRole(m.role), content: m.content }))

      const currentFilters = {
        query: storeState.query,
        rate_min: storeState.rateMin,
        rate_max: storeState.rateMax,
        tags: storeState.tags,
      }

      const res = await fetch(`${API_BASE}/api/pilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history,
          current_filters: currentFilters,
          email: localStorage.getItem('tcs_gate_email') || undefined,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // PilotResponse API shape (matches backend pilot_service.py return)
      const data: {
        filters: Record<string, unknown> | null
        message: string
        search_performed?: boolean  // true when search_experts was called
        total?: number              // result count from search_experts
        experts?: Expert[]         // expert list returned by search_experts
      } = await res.json()

      // Track sage_query — fire-and-forget, never await
      void trackEvent('sage_query', {
        query_text: text.trim(),
        function_called: data.search_performed ? 'search_experts' : 'apply_filters',
        result_count: data.total ?? 0,
        zero_results: (data.total ?? 0) === 0,
      })

      // search_performed: true = search_experts was called → direct store injection
      // search_performed: false/undefined = apply_filters refinement → validateAndApplyFilters
      if (data.search_performed === true) {
        const store = useExplorerStore.getState()
        const experts = data.experts ?? []
        const total = data.total ?? 0
        store.setLoading(false)        // ensure loading=false before setResults (avoids skeleton flash if prior fetch was mid-flight)
        store.setResults(experts, total, null)
        store.setSageMode(true)
      } else if (data.filters && typeof data.filters === 'object') {
        // apply_filters refinement path — unchanged behavior
        validateAndApplyFilters(data.filters as Record<string, unknown>)
      }

      // Add Sage's confirmation/narration message
      addMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: data.message ?? "I've updated your search. Check the results!",
        timestamp: Date.now(),
      })
    } catch {
      addMessage({
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: "Sorry, I had trouble connecting. Please try again.",
        timestamp: Date.now(),
      })
    } finally {
      setStreaming(false)
    }
  }, [isStreaming, addMessage, setStreaming, triggerSpin])

  return { messages, isStreaming, handleSend }
}
