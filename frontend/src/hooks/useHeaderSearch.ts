import { useEffect, useRef, useState } from 'react'
import { useExplorerStore } from '../store'
import { trackEvent } from '../tracking'

const DEBOUNCE_MS = 350

const PLACEHOLDERS = [
  'Find a fintech strategist…',
  'Who builds Stripe integrations?',
  'Need a fractional CTO for a week?',
  'Show me healthcare product experts…',
  'Which consultant actually ships?',
  'Find someone who\'s done this before…',
  'Looking for a Berlin-based advisor…',
  'Who knows Shopify like their backyard?',
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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local value when store query changes externally
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

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value

    // Easter egg detection — before setting localValue
    if (value.toLowerCase().trim() === EASTER_EGG_PHRASE) {
      setLocalValue('')
      setQuery('')
      setTiltActive(true)
      setShowParticles(true)
      setTimeout(() => setTiltActive(false), 800)
      setTimeout(() => setShowParticles(false), 1000)
      return
    }

    setLocalValue(value)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setQuery(value)
      if (value.trim().length > 0) {
        void trackEvent('filter_change', { filter: 'query', value: value.trim() })
      }
    }, DEBOUNCE_MS)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current)
      setQuery(localValue)
    }
  }

  return {
    localValue,
    handleChange,
    handleKeyDown,
    placeholderIndex,
    placeholders: PLACEHOLDERS,
    total,
    isStreaming,
    sageMode,
    tiltActive,
    showParticles,
  }
}
