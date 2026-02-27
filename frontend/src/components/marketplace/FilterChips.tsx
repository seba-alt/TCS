import { motion } from 'motion/react'
import { ArrowUpDown } from 'lucide-react'
import { useFilterSlice, useResultsSlice } from '../../store'
import { useExplorerStore } from '../../store'

const SORT_OPTIONS: { label: string; value: 'relevance' | 'rate_asc' | 'rate_desc' }[] = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Rate: Low → High', value: 'rate_asc' },
  { label: 'Rate: High → Low', value: 'rate_desc' },
]

const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000

interface Chip {
  label: string
  variant?: 'default' | 'industry'
  onDismiss: () => void
}

export function FilterChips() {
  const { query, rateMin, rateMax, tags, industryTags, sortBy, savedExperts, setQuery, setRateRange, toggleTag, toggleIndustryTag, setSortBy, resetFilters } =
    useFilterSlice()
  const { total } = useResultsSlice()
  const sageMode = useExplorerStore((s) => s.sageMode)
  const savedCount = savedExperts.length
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Relevance'

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
    chips.push({ label: tag, variant: 'industry', onDismiss: () => toggleIndustryTag(tag) })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-gray-100">
      {/* Sage mode indicator — fades in/out with opacity transition */}
      <motion.img
        src="/icon.png"
        alt="Sage results"
        animate={{ opacity: sageMode ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="w-4 h-4 object-contain"
        style={{ pointerEvents: 'none' }}
      />

      <span className="text-sm text-gray-500 shrink-0">{total} experts found</span>

      {chips.map((chip) => (
        <span
          key={chip.label}
          className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 ${
            chip.variant === 'industry'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-700'
          }`}
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

      {(chips.length > 0 || sageMode) && (
        <button
          onClick={resetFilters}
          className="inline-flex items-center text-xs bg-red-50 text-red-600 rounded-full px-2.5 py-0.5 hover:bg-red-100 transition-colors"
        >
          Clear all
        </button>
      )}

      {/* Sort dropdown — right-aligned */}
      <div className="ml-auto relative group">
        <button
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
        >
          <ArrowUpDown size={13} />
          {currentSortLabel}
        </button>
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 hidden group-hover:block min-w-[160px]">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value)}
              className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                sortBy === option.value
                  ? 'text-brand-purple font-medium bg-purple-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
