import { useEffect, useRef, useState } from 'react'
import { useExplorerStore } from '../store'
import { trackEvent } from '../tracking'
import { TOP_TAGS } from '../constants/tags'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const SUGGEST_DEBOUNCE_MS = 300

const PLACEHOLDERS = [
  'Name, company, keyword...',
]

const EASTER_EGG_PHRASE = 'tinrate'

export function useHeaderSearch() {
  const query = useExplorerStore((s) => s.query)
  const setQuery = useExplorerStore((s) => s.setQuery)
  const total = useExplorerStore((s) => s.total)
  const isStreaming = useExplorerStore((s) => s.isStreaming)
  const sageMode = useExplorerStore((s) => s.sageMode)

  const [localValue, setLocalValue] = useState(query)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [tiltActive, setTiltActive] = useState(false)
  const [showParticles, setShowParticles] = useState(false)

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local value when store query changes externally (e.g. Sage sets query)
  useEffect(() => {
    setLocalValue(query)
  }, [query])

  // Placeholder rotation — pauses when input has text
  useEffect(() => {
    if (localValue) return
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [localValue])

  // Cleanup suggest timer on unmount
  useEffect(() => {
    return () => {
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    }
  }, [])

  async function fetchSuggestions(value: string) {
    if (value.trim().length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    // Client-side tag matches
    const tagMatches = TOP_TAGS.filter((t) =>
      t.includes(value.toLowerCase())
    ).slice(0, 3)

    let backendResults: string[] = []
    try {
      const res = await fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(value)}`)
      if (res.ok) {
        backendResults = await res.json() as string[]
      }
    } catch {
      // Fall back to local tag matches only on fetch error
    }

    // Merge: backend first, then tag matches, deduplicate, limit to 5
    const merged: string[] = []
    const seen = new Set<string>()
    for (const item of [...backendResults, ...tagMatches]) {
      if (!seen.has(item)) {
        seen.add(item)
        merged.push(item)
      }
      if (merged.length >= 5) break
    }

    setSuggestions(merged)
    setShowDropdown(merged.length > 0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value

    // Easter egg detection — before setting localValue
    if (value.toLowerCase().trim() === EASTER_EGG_PHRASE) {
      setLocalValue('')
      setQuery('')
      setSuggestions([])
      setShowDropdown(false)
      setTiltActive(true)
      setShowParticles(true)
      setTimeout(() => setTiltActive(false), 800)
      setTimeout(() => setShowParticles(false), 1000)
      return
    }

    setLocalValue(value)

    // Debounce suggestions only — grid does NOT update live while typing
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    suggestTimerRef.current = setTimeout(() => {
      void fetchSuggestions(value)
    }, SUGGEST_DEBOUNCE_MS)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1))
      return
    }

    if (e.key === 'Escape') {
      setShowDropdown(false)
      setSelectedIndex(-1)
      return
    }

    if (e.key === 'Enter') {
      // If a suggestion is highlighted, select it
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex])
        return
      }
      // Otherwise commit the typed value to trigger grid update
      setSuggestions([])
      setShowDropdown(false)
      setSelectedIndex(-1)
      setQuery(localValue)
      if (localValue.trim().length > 0) {
        void trackEvent('filter_change', { filter: 'query', value: localValue.trim() })
      }
    }
  }

  function handleSelectSuggestion(suggestion: string) {
    setLocalValue(suggestion)
    setSuggestions([])
    setShowDropdown(false)
    setSelectedIndex(-1)
    setQuery(suggestion)
    void trackEvent('filter_change', { filter: 'query', value: suggestion })
  }

  function handleClear() {
    setLocalValue('')
    setSuggestions([])
    setShowDropdown(false)
    setSelectedIndex(-1)
    setQuery('')
  }

  function handleBlur() {
    // 150ms delay allows onMouseDown on suggestion items to fire before dropdown unmounts
    setTimeout(() => setShowDropdown(false), 150)
  }

  return {
    localValue,
    handleChange,
    handleKeyDown,
    handleSelectSuggestion,
    handleClear,
    handleBlur,
    placeholderIndex,
    placeholders: PLACEHOLDERS,
    total,
    isStreaming,
    sageMode,
    tiltActive,
    showParticles,
    suggestions,
    showDropdown,
    selectedIndex,
  }
}
