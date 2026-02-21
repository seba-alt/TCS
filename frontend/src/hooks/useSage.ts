import { useCallback } from 'react'
import { useExplorerStore } from '../store'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// Role mapping: pilotSlice uses 'user'/'assistant', Gemini needs 'user'/'model'
function toGeminiRole(role: 'user' | 'assistant'): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user'
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

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

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
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // Dispatch validated filter updates to store (triggers useExplore re-fetch)
      if (data.filters && typeof data.filters === 'object') {
        validateAndApplyFilters(data.filters as Record<string, unknown>)
      }

      // Add Sage's confirmation message
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
  }, [isStreaming, addMessage, setStreaming])

  return { messages, isStreaming, handleSend }
}
