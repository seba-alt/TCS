import { Search } from 'lucide-react'
import { useExplorerStore } from '../../store'
import { TOP_TAGS } from '../../constants/tags'

export function EmptyState() {
  const setOpen = useExplorerStore((s) => s.setOpen)
  const tags = useExplorerStore((s) => s.tags)
  const setTags = useExplorerStore((s) => s.setTags)
  const resetFilters = useExplorerStore((s) => s.resetFilters)

  // Suggest tags not currently active — up to 6 from TOP_TAGS
  const suggestions = TOP_TAGS.filter((t) => !tags.includes(t)).slice(0, 6)

  function handleTagSuggestion(tag: string) {
    // Replace current tags entirely — per CONTEXT.md: suggestions are redirects not additions
    setTags([tag])
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 text-center px-8">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
        <Search className="w-8 h-8 text-gray-400" />
      </div>

      {/* Message */}
      <div>
        <h3 className="font-semibold text-gray-700 text-base mb-1">No experts found</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Try a different tag or describe what you need to Sage.
        </p>
      </div>

      {/* Tag suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Try one of these</p>
          <div className="flex flex-wrap gap-2 justify-center max-w-sm">
            {suggestions.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagSuggestion(tag)}
                className="text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-3 py-1.5 hover:border-brand-purple hover:text-brand-purple transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sage CTA — prominent */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-gray-500">Not finding what you need?</p>
        <button
          onClick={() => setOpen(true)}
          className="text-sm text-brand-purple font-medium border border-brand-purple rounded-lg px-4 py-2 hover:bg-brand-purple hover:text-white transition-colors"
        >
          Try describing it to Sage
        </button>
      </div>

      {/* Clear all — secondary escape hatch */}
      <button
        onClick={resetFilters}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Clear all filters
      </button>
    </div>
  )
}
