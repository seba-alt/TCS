import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useExplorerStore, useFilterSlice } from '../store'
import { useExplore } from '../hooks/useExplore'
import { FilterSidebar } from '../components/sidebar/FilterSidebar'
import { FilterChips } from '../components/marketplace/FilterChips'
import { ExpertGrid } from '../components/marketplace/ExpertGrid'
import { MobileFilterSheet } from '../components/sidebar/MobileFilterSheet'

export default function MarketplacePage() {
  // Fetch hook — reads filter state from store, calls /api/explore, writes results back
  // Returns loadNextPage for VirtuosoGrid endReached (infinite scroll)
  const { loadNextPage } = useExplore()

  // Preserve Phase 15 pilot reset behavior
  const resetPilot = useExplorerStore((s) => s.resetPilot)
  useEffect(() => {
    resetPilot()
  }, [resetPilot])

  // Results state for conditional rendering
  const loading = useExplorerStore((s) => s.loading)
  const experts = useExplorerStore((s) => s.experts)
  const isFetchingMore = useExplorerStore((s) => s.isFetchingMore)

  // Mobile filter sheet state
  const [sheetOpen, setSheetOpen] = useState(false)

  // Filter summary for mobile toolbar badge
  const { tags, query } = useFilterSlice()
  const activeFilterCount = tags.length + (query ? 1 : 0)

  return (
    // CRITICAL: No overflow wrapper around FilterSidebar — sticky fails with ancestor overflow (Pitfall 1)
    <div className="flex min-h-screen bg-white">
      {/* Desktop sticky sidebar — hidden on mobile */}
      <FilterSidebar />

      {/* Main content area */}
      <main className="flex-1 flex flex-col" style={{ height: '100vh' }}>
        {/* Mobile toolbar — visible only on mobile */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Experts</h1>
          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-md px-3 py-1.5"
          >
            <SlidersHorizontal size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-brand-purple text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop header — visible only on desktop */}
        <div className="hidden md:flex items-center px-6 py-4 border-b border-gray-100 shrink-0">
          <h1 className="text-xl font-semibold text-gray-900">Find an Expert</h1>
        </div>

        {/* Active filter chips strip */}
        <FilterChips />

        {/* Results area — ExpertGrid with VirtuosoGrid for infinite scroll */}
        {/* flex-1 + min-h-0 gives VirtuosoGrid a known height to virtualize against */}
        <div className="flex-1 min-h-0">
          <ExpertGrid
            experts={experts}
            loading={loading}
            isFetchingMore={isFetchingMore}
            onEndReached={loadNextPage}
          />
        </div>
      </main>

      {/* Mobile filter bottom-sheet */}
      <MobileFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
