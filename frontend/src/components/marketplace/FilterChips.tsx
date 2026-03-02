import { useState, useRef, useEffect } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useFilterSlice, useResultsSlice } from '../../store'

const SORT_OPTIONS: { label: string; value: 'relevance' | 'rate_asc' | 'rate_desc' }[] = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Rate: Low → High', value: 'rate_asc' },
  { label: 'Rate: High → Low', value: 'rate_desc' },
]

const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000

interface Chip {
  label: string
  onDismiss: () => void
}

export function FilterChips() {
  const { query, rateMin, rateMax, tags, industryTags, sortBy, setQuery, setRateRange, toggleTag, toggleIndustryTag, setSortBy, resetFilters } =
    useFilterSlice()
  const { total } = useResultsSlice()
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Relevance'

  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    if (sortOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [sortOpen])

  const chips: Chip[] = []

  if (query) {
    chips.push({ label: `"${query}"`, onDismiss: () => setQuery('') })
  }

  if (rateMin !== DEFAULT_RATE_MIN || rateMax !== DEFAULT_RATE_MAX) {
    chips.push({
      label: `EUR ${rateMin}–${rateMax}`,
      onDismiss: () => setRateRange(DEFAULT_RATE_MIN, DEFAULT_RATE_MAX),
    })
  }

  for (const tag of tags) {
    chips.push({ label: tag, onDismiss: () => toggleTag(tag) })
  }

  for (const tag of industryTags) {
    chips.push({ label: tag, onDismiss: () => toggleIndustryTag(tag) })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-gray-100">
      <span className="text-sm text-gray-500 shrink-0">{total} experts found</span>

      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5"
        >
          {chip.label}
          <button
            onClick={chip.onDismiss}
            aria-label={`Remove ${chip.label} filter`}
            className="hover:text-gray-900 ml-0.5"
          >
            ×
          </button>
        </span>
      ))}

      {chips.length > 0 && (
        <button
          onClick={resetFilters}
          className="inline-flex items-center text-xs bg-red-50 text-red-600 rounded-full px-2.5 py-0.5 hover:bg-red-100 transition-colors"
        >
          Clear all
        </button>
      )}

      {/* Sort dropdown — click-based, right-aligned */}
      <div className="ml-auto relative" ref={sortRef}>
        <button
          onClick={() => setSortOpen(!sortOpen)}
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
            sortOpen
              ? 'border-brand-purple text-brand-purple bg-purple-50'
              : 'border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400'
          }`}
        >
          <ArrowUpDown size={13} />
          {currentSortLabel}
        </button>
        {sortOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[170px]">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setSortBy(option.value)
                  setSortOpen(false)
                }}
                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                  sortBy === option.value
                    ? 'text-brand-purple font-medium bg-purple-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
