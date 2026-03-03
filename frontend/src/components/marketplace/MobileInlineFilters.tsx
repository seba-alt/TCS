import { useState } from 'react'
import { Tag, Bookmark, X, Building2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useExplorerStore, useFilterSlice, useResultsSlice } from '../../store'
import { TOP_TAGS } from '../../constants/tags'
import { INDUSTRY_TAGS } from '../../constants/industryTags'

export function MobileInlineFilters() {
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [industryPickerOpen, setIndustryPickerOpen] = useState(false)

  const {
    tags,
    industryTags,
    savedExperts,
    savedFilter,
    toggleTag,
    toggleIndustryTag,
    setSavedFilter,
  } = useFilterSlice()

  const { total } = useResultsSlice()
  const loading = useExplorerStore((s) => s.loading)

  const savedCount = savedExperts.length

  const totalTagCount = tags.length + industryTags.length

  return (
    <div className="md:hidden flex flex-col shrink-0">
      {/* Filter row — overflow-x-auto with iOS smooth scroll and hidden scrollbar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 overflow-x-auto shrink-0 flex-nowrap"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      >
        {/* Filter controls — grayed out when in saved view to signal they are inactive */}
        <div className={`flex items-center gap-2 flex-nowrap ${savedFilter ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Industry button */}
          <button
            onClick={() => setIndustryPickerOpen(true)}
            className={`flex items-center gap-1.5 text-sm rounded-md px-2.5 py-1.5 shrink-0 transition-colors ${
              industryTags.length > 0
                ? 'bg-brand-purple text-white'
                : 'border border-gray-300 text-gray-700'
            }`}
            aria-label="Open industry picker"
          >
            <Building2 size={15} />
            {industryTags.length > 0 ? `Industry (${industryTags.length})` : 'Industry'}
          </button>

          {/* Tags button (domain only) */}
          <button
            onClick={() => setTagPickerOpen(true)}
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
        </div>

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

        {/* Exit saved view button — shown only when in saved mode */}
        {savedFilter && (
          <button
            onClick={() => setSavedFilter(false)}
            className="flex items-center gap-1 text-sm rounded-md px-2.5 py-1.5 shrink-0 transition-colors border border-gray-300 text-gray-700"
            aria-label="Exit saved view"
          >
            <X size={14} />
            Exit
          </button>
        )}

        {/* Result count — right-aligned spacer */}
        <span className="ml-auto text-xs text-gray-500 shrink-0">
          {loading ? '…' : `${total} experts`}
        </span>
      </div>

      {/* Active tag chips row — only shown when tags are selected */}
      {totalTagCount > 0 && (
        <div className="flex gap-1.5 flex-wrap px-4 py-2 border-b border-gray-100">
          {tags.map((tag) => (
            <span
              key={`d-${tag}`}
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
          {industryTags.map((tag) => (
            <span
              key={`i-${tag}`}
              className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 rounded-full px-2.5 py-1"
            >
              {tag}
              <button
                onClick={() => toggleIndustryTag(tag)}
                aria-label={`Remove ${tag} industry filter`}
                className="hover:text-purple-900 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Full-screen Tag Picker (domain only) */}
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

            {/* Scrollable tag list */}
            <div className="flex-1 overflow-y-auto">
              {TOP_TAGS.map((tag) => {
                const isSelected = tags.includes(tag)
                return (
                  <button
                    key={`d-${tag}`}
                    onClick={() => toggleTag(tag)}
                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-sm w-full text-left transition-colors hover:bg-gray-50"
                  >
                    <span
                      className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-brand-purple'
                          : 'border-2 border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* Full-screen Industry Picker */}
      <AnimatePresence>
        {industryPickerOpen && (
          <motion.div
            key="industry-picker"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 bg-white flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <span className="font-semibold text-gray-900 text-base">Select Industry</span>
              <button
                onClick={() => setIndustryPickerOpen(false)}
                aria-label="Close industry picker"
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable industry list */}
            <div className="flex-1 overflow-y-auto">
              {INDUSTRY_TAGS.map((tag) => {
                const isSelected = industryTags.includes(tag)
                return (
                  <button
                    key={`i-${tag}`}
                    onClick={() => toggleIndustryTag(tag)}
                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-sm w-full text-left transition-colors hover:bg-gray-50"
                  >
                    <span
                      className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-brand-purple'
                          : 'border-2 border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                onClick={() => setIndustryPickerOpen(false)}
                className="bg-brand-purple text-white w-full py-3 font-medium text-sm rounded-xl"
              >
                Done{industryTags.length > 0 ? ` (${industryTags.length} selected)` : ''}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
