import { useFilterSlice, useResultsSlice } from '../../store'

const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000

interface Chip {
  label: string
  onDismiss: () => void
}

export function FilterChips() {
  const { query, rateMin, rateMax, tags, setQuery, setRateRange, toggleTag, resetFilters } =
    useFilterSlice()
  const { total } = useResultsSlice()

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

  // No chips and no results to display — render nothing
  if (chips.length === 0 && total === 0) return null

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
          className="text-xs text-brand-purple hover:underline ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
