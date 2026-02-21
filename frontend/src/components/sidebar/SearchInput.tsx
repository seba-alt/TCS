import { useEffect, useRef, useState } from 'react'
import { useFilterSlice } from '../../store'

const DEBOUNCE_MS = 350

export function SearchInput() {
  const { query, setQuery } = useFilterSlice()
  const [localValue, setLocalValue] = useState(query)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local value when store query changes externally (e.g. chip dismiss, clear all)
  useEffect(() => {
    setLocalValue(query)
  }, [query])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setLocalValue(value)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setQuery(value)
    }, DEBOUNCE_MS)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current)
      setQuery(localValue)
    }
  }

  return (
    <input
      type="search"
      value={localValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Search experts..."
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
    />
  )
}
