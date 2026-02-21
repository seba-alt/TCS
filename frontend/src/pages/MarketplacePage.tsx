import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useExplorerStore, useFilterSlice } from '../store'
import { useExplore } from '../hooks/useExplore'
import { useUrlSync } from '../hooks/useUrlSync'
import { useEmailGate } from '../hooks/useEmailGate'
import { FilterSidebar } from '../components/sidebar/FilterSidebar'
import { FilterChips } from '../components/marketplace/FilterChips'
import { ExpertGrid } from '../components/marketplace/ExpertGrid'
import { MobileFilterSheet } from '../components/sidebar/MobileFilterSheet'
import { SageFAB } from '../components/pilot/SageFAB'
import { SagePanel } from '../components/pilot/SagePanel'
import { ProfileGateModal } from '../components/marketplace/ProfileGateModal'

export default function MarketplacePage() {
  // Sync filter state to/from URL query params (ROBUST-01)
  useUrlSync()

  // Fetch hook — reads filter state from store, calls /api/explore, writes results back
  // Returns loadNextPage for VirtuosoGrid endReached (infinite scroll)
  const { loadNextPage } = useExplore()

  // Pilot panel state
  const isOpen = useExplorerStore((s) => s.isOpen)
  const setOpen = useExplorerStore((s) => s.setOpen)

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

  // Email gate state — LEAD-01/02/04
  const { isUnlocked, submitEmail } = useEmailGate()
  const [pendingProfileUrl, setPendingProfileUrl] = useState<string | null>(null)

  function handleViewProfile(url: string) {
    if (isUnlocked) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      setPendingProfileUrl(url)
    }
  }

  async function handleEmailSubmit(email: string) {
    await submitEmail(email)
    if (pendingProfileUrl) {
      window.open(pendingProfileUrl, '_blank', 'noopener,noreferrer')
      setPendingProfileUrl(null)
    }
  }

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
            onViewProfile={handleViewProfile}
          />
        </div>
      </main>

      {/* Mobile filter bottom-sheet */}
      <MobileFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* Sage Co-Pilot — FAB hides when panel is open (per CONTEXT.md locked decision) */}
      <AnimatePresence>
        {!isOpen && <SageFAB key="sage-fab" />}
      </AnimatePresence>

      {/* Sage Panel + mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop — click to close (desktop panel doesn't need full backdrop) */}
            <div
              key="sage-backdrop"
              className="fixed inset-0 z-30 bg-black/20 md:hidden"
              onClick={() => setOpen(false)}
            />
            <SagePanel key="sage-panel" />
          </>
        )}
      </AnimatePresence>

      {/* Email gate modal — rendered at page level to avoid ExpertCard overflow-hidden constraint */}
      <AnimatePresence>
        {pendingProfileUrl && (
          <ProfileGateModal
            key="profile-gate"
            onSubmit={handleEmailSubmit}
            onDismiss={() => setPendingProfileUrl(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
