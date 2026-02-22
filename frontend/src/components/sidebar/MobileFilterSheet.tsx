import { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import { useExplorerStore } from '../../store'
import { TOP_TAGS } from '../../constants/tags'

interface Draft {
  query: string
  rateMin: number
  rateMax: number
  tags: string[]
}

interface MobileFilterSheetProps {
  open: boolean
  onClose: () => void
}

export function MobileFilterSheet({ open, onClose }: MobileFilterSheetProps) {
  const [snap, setSnap] = useState<number | string | null>(0.5)
  const [draft, setDraft] = useState<Draft>({ query: '', rateMin: 0, rateMax: 5000, tags: [] })
  const [tagSearch, setTagSearch] = useState('')

  // Initialize draft from store when sheet opens
  useEffect(() => {
    if (open) {
      const state = useExplorerStore.getState()
      setDraft({
        query: state.query,
        rateMin: state.rateMin,
        rateMax: state.rateMax,
        tags: [...state.tags],
      })
      setTagSearch('')
    }
  }, [open])

  function handleApply() {
    const state = useExplorerStore.getState()

    // Write query and rate directly
    state.setQuery(draft.query)
    state.setRateRange(draft.rateMin, draft.rateMax)

    // Compute tag diff and apply via toggleTag (avoids full reset)
    const currentTags = state.tags
    // Add tags in draft but not in store
    for (const tag of draft.tags) {
      if (!currentTags.includes(tag)) {
        state.toggleTag(tag)
      }
    }
    // Remove tags in store but not in draft
    for (const tag of currentTags) {
      if (!draft.tags.includes(tag)) {
        state.toggleTag(tag)
      }
    }

    onClose()
  }

  const filteredTags = TOP_TAGS.filter((t) => t.includes(tagSearch.toLowerCase()))

  function toggleDraftTag(tag: string) {
    setDraft((d) => ({
      ...d,
      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
    }))
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      snapPoints={[0.5, 1]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      snapToSequentialPoint
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 h-full max-h-[97%] bg-white rounded-t-2xl flex flex-col">
          {/* Drag handle */}
          <div className="mx-auto w-10 h-1 rounded-full bg-gray-300 mt-3 mb-2" />

          {/* Header */}
          <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
            <span className="font-medium text-gray-900">Filters</span>
            <button
              onClick={handleApply}
              className="text-sm font-medium text-brand-purple"
            >
              Apply
            </button>
          </div>

          {/* Scrollable filter body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* Text search */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500 uppercase">Search</span>
              <input
                type="search"
                value={draft.query}
                onChange={(e) => setDraft((d) => ({ ...d, query: e.target.value }))}
                placeholder="Search experts..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>

            {/* Rate range — number inputs for mobile (better than slider in bottom-sheet) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500 uppercase">Hourly Rate (EUR)</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={draft.rateMin}
                  onChange={(e) => setDraft((d) => ({ ...d, rateMin: Number(e.target.value) }))}
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                  placeholder="Min EUR"
                />
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={draft.rateMax}
                  onChange={(e) => setDraft((d) => ({ ...d, rateMax: Number(e.target.value) }))}
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                  placeholder="Max EUR"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500 uppercase">Domain Tags</span>
              <input
                type="text"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Filter tags..."
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-purple"
              />
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {filteredTags.map((tag) => {
                  const isSelected = draft.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleDraftTag(tag)}
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
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
