import { useEffect, useRef, useState } from 'react'
import { useFilterSlice } from '../../store'

const DEBOUNCE_MS = 350
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function SearchInput() {
  const { query, setQuery } = useFilterSlice()
  const [localValue, setLocalValue] = useState(query)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local value when store query changes externally (e.g. chip dismiss, clear all, URL sync)
  useEffect(() => {
    setLocalValue(query)
  }, [query])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    }
  }, [])

  async function fetchSuggestions(value: string) {
    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort()

    if (value.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(
        `${API_BASE}/api/suggest?q=${encodeURIComponent(value.trim())}`,
        { signal: controller.signal }
      )
      if (res.ok) {
        const data: string[] = await res.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      // Other errors: silently ignore — suggestions are non-critical
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setLocalValue(value)

    // Fetch suggestions immediately (no debounce per CONTEXT.md)
    fetchSuggestions(value)

    // Debounced query update (triggers grid refetch)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setQuery(value)
    }, DEBOUNCE_MS)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current)
      setQuery(localValue)
      setShowSuggestions(false)
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setLocalValue(suggestion)
    setQuery(suggestion)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleBlur() {
    // Delay hiding dropdown to allow suggestion click to register first
    blurTimerRef.current = setTimeout(() => {
      setShowSuggestions(false)
    }, 150)
  }

  function handleFocus() {
    // Re-show suggestions if we have them and input has enough chars
    if (suggestions.length > 0 && localValue.trim().length >= 2) {
      setShowSuggestions(true)
    }
  }

  return (
    <div className="glass-surface relative rounded-md">
      <input
        type="search"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder="Search experts..."
        className="w-full px-3 py-2 text-sm bg-transparent text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-brand-purple focus:border-transparent focus:outline-none"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
