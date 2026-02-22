import { useState } from 'react'
import { useFilterSlice } from '../../store'
import { TOP_TAGS } from '../../constants/tags'
import { trackEvent } from '../../tracking'

export function TagMultiSelect() {
  const { tags, toggleTag } = useFilterSlice()
  const [search, setSearch] = useState('')

  const filtered = TOP_TAGS.filter((t) => t.includes(search.toLowerCase()))

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter tags..."
        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-purple"
      />
      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
        {filtered.map((tag) => {
          const isSelected = tags.includes(tag)
          return (
            <button
              key={tag}
              onClick={() => {
              if (!isSelected) {
                // Only track tag ADD, not tag remove — reduces noise
                void trackEvent('filter_change', {
                  filter: 'tag',
                  value: tag,
                })
              }
              toggleTag(tag)
            }}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                isSelected
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-brand-purple'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
