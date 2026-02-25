import { motion } from 'motion/react'
import { Bookmark } from 'lucide-react'
import { useFilterSlice, useResultsSlice } from '../../store'
import { useExplorerStore } from '../../store'

const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000
const SAVED_KEY = 'tcs_saved_experts'

function getSavedCount(): number {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as string[]).length : 0
  } catch { return 0 }
}

interface Chip {
  label: string
  onDismiss: () => void
}

export function FilterChips() {
  const { query, rateMin, rateMax, tags, savedFilter, setQuery, setRateRange, toggleTag, setSavedFilter, resetFilters } =
    useFilterSlice()
  const { total } = useResultsSlice()
  const sageMode = useExplorerStore((s) => s.sageMode)
  const savedCount = getSavedCount()

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

      {/* Saved filter toggle — only shows when bookmarks exist */}
      {savedCount > 0 && (
        <button
          onClick={() => setSavedFilter(!savedFilter)}
          className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 transition-colors ${
            savedFilter
              ? 'bg-brand-purple text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Bookmark size={12} className={savedFilter ? 'fill-current' : ''} />
          Saved ({savedCount})
        </button>
      )}

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

      {(chips.length > 0 || sageMode) && (
        <button
          onClick={resetFilters}
          className="inline-flex items-center text-xs bg-red-50 text-red-600 rounded-full px-2.5 py-0.5 hover:bg-red-100 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
