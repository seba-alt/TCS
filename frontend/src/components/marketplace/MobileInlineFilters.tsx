import { useState } from 'react'
import { Tag, ArrowUpDown, Bookmark, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useExplorerStore, useFilterSlice, useResultsSlice } from '../../store'
import { TOP_TAGS } from '../../constants/tags'

const SORT_OPTIONS: { label: string; value: 'relevance' | 'rate_asc' | 'rate_desc' }[] = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Rate: Low to High', value: 'rate_asc' },
  { label: 'Rate: High to Low', value: 'rate_desc' },
]

export function MobileInlineFilters() {
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')

  const {
    tags,
    sortBy,
    savedExperts,
    savedFilter,
    toggleTag,
    setSortBy,
    setSavedFilter,
    resetFilters,
  } = useFilterSlice()

  const { total } = useResultsSlice()
  const loading = useExplorerStore((s) => s.loading)

  const savedCount = savedExperts.length

  const filteredTags = TOP_TAGS.filter((t) =>
    tagSearch ? t.includes(tagSearch.toLowerCase()) : true
  )

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Relevance'

  return (
    <div className="md:hidden flex flex-col shrink-0">
      {/* Filter row */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 overflow-x-auto shrink-0">
        {/* Tags button */}
        <button
          onClick={() => {
            setTagSearch('')
            setTagPickerOpen(true)
          }}
          className={`flex items-center gap-1.5 text-sm rounded-md px-2.5 py-1.5 shrink-0 transition-colors ${
            tags.length > 0
              ? 'bg-brand-purple text-white'
              : 'border border-gray-300 text-gray-700'
          }`}
          aria-label="Open tag picker"
        >
          <Tag size={15} />
          {tags.length > 0 ? `Tags (${tags.length})` : 'Tags'}
        </button>

        {/* Sort button */}
        <button
          onClick={() => setSortOpen(true)}
          className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-md px-2.5 py-1.5 shrink-0 text-gray-700 transition-colors"
          aria-label="Open sort options"
        >
          <ArrowUpDown size={15} />
          {currentSortLabel}
        </button>

        {/* Saved button — only shown when bookmarks exist */}
        {savedCount > 0 && (
          <button
            onClick={() => setSavedFilter(!savedFilter)}
            className={`flex items-center gap-1 text-sm rounded-md px-2.5 py-1.5 shrink-0 transition-colors ${
              savedFilter
                ? 'bg-brand-purple text-white'
                : 'border border-gray-300 text-gray-700'
            }`}
            aria-label={savedFilter ? 'Show all experts' : 'Show saved experts'}
          >
            <Bookmark size={15} className={savedFilter ? 'fill-current' : ''} />
            {savedCount}
          </button>
        )}

        {/* Result count — right-aligned spacer */}
        <span className="ml-auto text-xs text-gray-500 shrink-0">
          {loading ? '…' : `${total} experts`}
        </span>
      </div>

      {/* Active tag chips row — only shown when tags are selected */}
      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap px-4 py-2 border-b border-gray-100">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1"
            >
              {tag}
              <button
                onClick={() => toggleTag(tag)}
                aria-label={`Remove ${tag} filter`}
                className="hover:text-gray-900 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            onClick={resetFilters}
            className="bg-brand-purple text-white font-medium text-xs rounded-full px-3 py-1 shadow-sm"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Full-screen Tag Picker */}
      <AnimatePresence>
        {tagPickerOpen && (
          <motion.div
            key="tag-picker"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 bg-white flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <span className="font-semibold text-gray-900 text-base">Select Tags</span>
              <button
                onClick={() => setTagPickerOpen(false)}
                aria-label="Close tag picker"
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tag search input */}
            <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
              <input
                type="text"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search tags..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple/40"
                autoFocus
              />
            </div>

            {/* Scrollable tag list */}
            <div className="flex-1 overflow-y-auto">
              {filteredTags.map((tag) => {
                const isSelected = tags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-sm w-full text-left transition-colors hover:bg-gray-50"
                  >
                    {/* Selected indicator */}
                    <span
                      className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-brand-purple'
                          : 'border-2 border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          width="10"
                          height="8"
                          viewBox="0 0 10 8"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className={isSelected ? 'text-brand-purple font-medium' : 'text-gray-700'}>
                      {tag}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Done button */}
            <div className="shrink-0 p-4 border-t border-gray-100">
              <button
                onClick={() => setTagPickerOpen(false)}
                className="bg-brand-purple text-white w-full py-3 font-medium text-sm rounded-xl"
              >
                Done{tags.length > 0 ? ` (${tags.length} selected)` : ''}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sort Sheet */}
      <AnimatePresence>
        {sortOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sort-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setSortOpen(false)}
            />

            {/* Bottom panel */}
            <motion.div
              key="sort-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl"
            >
              {/* Drag handle */}
              <div className="mx-auto w-10 h-1 rounded-full bg-gray-300 mt-3 mb-2" />

              <div className="px-4 pb-2 border-b border-gray-100">
                <span className="font-semibold text-gray-900 text-base">Sort by</span>
              </div>

              <div className="pb-safe">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value)
                      setSortOpen(false)
                    }}
                    className={`flex items-center justify-between w-full px-4 py-4 text-sm border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                      sortBy === option.value
                        ? 'text-brand-purple font-medium'
                        : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                    {sortBy === option.value && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 8L6.5 11.5L13 4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
