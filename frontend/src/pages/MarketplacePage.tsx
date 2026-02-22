import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useExplorerStore, useFilterSlice } from '../store'
import { useExplore } from '../hooks/useExplore'
import { useUrlSync } from '../hooks/useUrlSync'
import { useNltrStore } from '../store/nltrStore'
import { AuroraBackground } from '../components/AuroraBackground'
import Header from '../components/Header'
import { FilterSidebar } from '../components/sidebar/FilterSidebar'
import { FilterChips } from '../components/marketplace/FilterChips'
import { ExpertGrid } from '../components/marketplace/ExpertGrid'
import { MobileFilterSheet } from '../components/sidebar/MobileFilterSheet'
import { SageFAB } from '../components/pilot/SageFAB'
import { SagePanel } from '../components/pilot/SagePanel'
import { NewsletterGateModal } from '../components/marketplace/NewsletterGateModal'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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

  // Newsletter gate state — NLTR-01/03
  const { subscribed, setSubscribed } = useNltrStore()

  // Legacy bypass: check BOTH possible keys from v2.0 returning users
  const legacyUnlocked =
    localStorage.getItem('tcs_gate_email') !== null ||
    localStorage.getItem('tcs_email_unlocked') !== null

  const isUnlocked = subscribed || legacyUnlocked

  const [showGate, setShowGate] = useState(false)
  const [pendingProfileUrl, setPendingProfileUrl] = useState<string | null>(null)

  function handleViewProfile(url: string) {
    if (isUnlocked) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      setPendingProfileUrl(url)
      setShowGate(true)
    }
  }

  async function handleSubscribe(email: string) {
    // Write Zustand store FIRST — this is the source of truth for unlock
    setSubscribed(email)
    setShowGate(false)

    // Fire-and-forget backend call (silent failure — user already unlocked via Zustand)
    fetch(`${API_URL}/api/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {})

    // Open the pending profile
    if (pendingProfileUrl) {
      window.open(pendingProfileUrl, '_blank', 'noopener,noreferrer')
      setPendingProfileUrl(null)
    }
  }

  function handleDismiss() {
    setShowGate(false)
    // DO NOT clear pendingProfileUrl — next click will re-open modal
    // DO NOT set any session storage — modal re-appears on next "View Full Profile" click
  }

  return (
    <AuroraBackground>
    <div className="flex flex-col h-screen">
      {/* Desktop top header — Command Center glassmorphic header */}
      <Header />

      {/* Body row — sidebar + main */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar — hidden on mobile, fills body row height */}
        <FilterSidebar />

        {/* Main content area */}
        <main className="flex-1 flex flex-col min-h-0">
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

          {/* Active filter chips strip */}
          <FilterChips />

          {/* Results area — extra top padding so first row breathes below header */}
          <div className="flex-1 min-h-0 pt-2">
            <ExpertGrid
              experts={experts}
              loading={loading}
              isFetchingMore={isFetchingMore}
              onEndReached={loadNextPage}
              onViewProfile={handleViewProfile}
            />
          </div>
        </main>
      </div>

      {/* Mobile filter bottom-sheet */}
      <MobileFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* Sage Co-Pilot — FAB hides when panel is open */}
      <AnimatePresence>
        {!isOpen && <SageFAB key="sage-fab" />}
      </AnimatePresence>

      {/* Sage Panel popup + full-screen backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              key="sage-backdrop"
              className="fixed inset-0 z-30 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <SagePanel key="sage-panel" />
          </>
        )}
      </AnimatePresence>

      {/* Newsletter gate modal */}
      <NewsletterGateModal
        isOpen={showGate}
        onSubscribe={handleSubscribe}
        onDismiss={handleDismiss}
      />
    </div>
    </AuroraBackground>
  )
}
