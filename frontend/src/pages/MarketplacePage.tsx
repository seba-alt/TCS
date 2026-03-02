import { useState } from 'react'
import { Bookmark, LayoutGrid, List } from 'lucide-react'
import { useExplorerStore, useFilterSlice } from '../store'
import { useExplore } from '../hooks/useExplore'
import { useUrlSync } from '../hooks/useUrlSync'
import { useNltrStore } from '../store/nltrStore'
import { AuroraBackground } from '../components/AuroraBackground'
import Header from '../components/Header'
import { FilterSidebar } from '../components/sidebar/FilterSidebar'
import { FilterChips } from '../components/marketplace/FilterChips'
import { ExpertGrid } from '../components/marketplace/ExpertGrid'
import { ExpertList } from '../components/marketplace/ExpertList'
import { MobileInlineFilters } from '../components/marketplace/MobileInlineFilters'
import { NewsletterGateModal } from '../components/marketplace/NewsletterGateModal'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function MarketplacePage() {
  // Sync filter state to/from URL query params (ROBUST-01)
  useUrlSync()

  // Fetch hook — reads filter state from store, calls /api/explore, writes results back
  // Returns loadNextPage for VirtuosoGrid endReached (infinite scroll)
  const { loadNextPage } = useExplore()

  // Results state for conditional rendering
  const loading = useExplorerStore((s) => s.loading)
  const experts = useExplorerStore((s) => s.experts)
  const isFetchingMore = useExplorerStore((s) => s.isFetchingMore)

  // Filter summary for Saved button
  const { savedExperts, savedFilter, setSavedFilter, viewMode, setViewMode } = useFilterSlice()
  const savedCount = savedExperts.length

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
          {/* Mobile inline filters — visible only on mobile, replaces MobileFilterSheet drawer */}
          <MobileInlineFilters />

          {/* Desktop Saved button — above filter chips strip, right-aligned, only on desktop */}
          {savedCount > 0 && (
            <div className="hidden md:flex items-center justify-end px-4 py-2">
              <button
                onClick={() => setSavedFilter(!savedFilter)}
                className={`flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 transition-colors ${
                  savedFilter
                    ? 'bg-brand-purple text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-label={savedFilter ? 'Show all experts' : 'Show saved experts'}
              >
                <Bookmark size={16} className={savedFilter ? 'fill-current' : ''} />
                Saved ({savedCount})
              </button>
            </div>
          )}

          {/* Active filter chips strip — hidden on mobile (MobileInlineFilters has its own chips) */}
          <div className="hidden md:block">
            <FilterChips />
          </div>

          {/* View mode toggle — top-right of results area, separate from filter controls */}
          <div className="flex justify-end px-4 pb-1">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutGrid size={14} /> Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List size={14} /> List
              </button>
            </div>
          </div>

          {/* Results area — extra top padding so first row breathes below header */}
          <div className="flex-1 min-h-0 pt-2">
            {viewMode === 'grid' ? (
              <ExpertGrid
                experts={experts}
                loading={loading}
                isFetchingMore={isFetchingMore}
                onEndReached={loadNextPage}
                onViewProfile={handleViewProfile}
              />
            ) : (
              <ExpertList
                experts={experts}
                loading={loading}
                isFetchingMore={isFetchingMore}
                onEndReached={loadNextPage}
                onViewProfile={handleViewProfile}
              />
            )}
          </div>
        </main>
      </div>


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
