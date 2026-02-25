import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrowse } from '../hooks/useBrowse'
import { HeroBanner } from '../components/browse/HeroBanner'
import { SkeletonHeroBanner } from '../components/browse/SkeletonHeroBanner'
import { BrowseRow } from '../components/browse/BrowseRow'
import { SkeletonBrowseRow } from '../components/browse/SkeletonBrowseRow'
import { AuroraBackground } from '../components/AuroraBackground'
import { NewsletterGateModal } from '../components/marketplace/NewsletterGateModal'
import { useExplorerStore } from '../store'
import { useNltrStore } from '../store/nltrStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function BrowsePage() {
  const { data, loading, error } = useBrowse()
  const navigate = useNavigate()

  // CRITICAL: setNavigationSource MUST be called BEFORE navigate() in the same tick
  // to prevent MarketplacePage from reading stale navigationSource === 'direct'
  // and calling resetPilot() when loading from browse navigation.
  const setNavigationSource = useExplorerStore((s) => s.setNavigationSource)
  const resetFilters = useExplorerStore((s) => s.resetFilters)

  // Email gate — same pattern as MarketplacePage (CONTEXT.md: reuse exact same component and trigger logic)
  const { subscribed, setSubscribed } = useNltrStore()
  const legacyUnlocked =
    localStorage.getItem('tcs_gate_email') !== null ||
    localStorage.getItem('tcs_email_unlocked') !== null
  const isUnlocked = subscribed || legacyUnlocked
  const [showGate, setShowGate] = useState(false)
  const [pendingProfileUrl, setPendingProfileUrl] = useState<string | null>(null)

  const handleViewProfile = useCallback((url: string) => {
    if (isUnlocked) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      setPendingProfileUrl(url)
      setShowGate(true)
    }
  }, [isUnlocked])

  async function handleSubscribe(email: string) {
    setSubscribed(email)
    setShowGate(false)
    fetch(`${API_URL}/api/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {})
    if (pendingProfileUrl) {
      window.open(pendingProfileUrl, '_blank', 'noopener,noreferrer')
      setPendingProfileUrl(null)
    }
  }

  function handleDismiss() {
    setShowGate(false)
  }

  // Navigate to /explore with the row title pre-applied as a query filter
  const handleSeeAll = useCallback(
    (_slug: string, title: string) => {
      setNavigationSource('browse')
      navigate(`/explore?q=${encodeURIComponent(title)}`)
    },
    [navigate, setNavigationSource]
  )

  // Navigate to /explore with no filters — show all 530 experts
  const handleExploreAll = useCallback(() => {
    setNavigationSource('browse')
    resetFilters()
    navigate('/explore')
  }, [navigate, setNavigationSource, resetFilters])

  return (
    <AuroraBackground>
      <div className="min-h-screen pt-10 md:pt-14">
        {/* Hero Banner */}
        {loading ? (
          <SkeletonHeroBanner />
        ) : data && data.featured.length > 0 ? (
          <HeroBanner featured={data.featured} onExploreAll={handleExploreAll} />
        ) : null}

        {/* Category Rows — gap-12 md:gap-16 (48px / 64px) for premium spacious feel */}
        <div className="flex flex-col gap-12 md:gap-16 pb-16">
          {loading ? (
            // 4 skeleton rows while data loads — no blank areas
            <>
              <SkeletonBrowseRow />
              <SkeletonBrowseRow />
              <SkeletonBrowseRow />
              <SkeletonBrowseRow />
            </>
          ) : error ? (
            // Error state — simple centered message with reload prompt
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">Something went wrong loading experts.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-purple-400 hover:text-purple-300 underline"
              >
                Try again
              </button>
            </div>
          ) : data ? (
            // Render backend rows; map "recently-added" slug to "Recently Joined" display label
            data.rows.map((row) => (
              <BrowseRow
                key={row.slug}
                title={row.slug === 'recently-added' ? 'Recently Joined' : row.title}
                slug={row.slug}
                experts={row.experts}
                total={row.total}
                onSeeAll={handleSeeAll}
                onViewProfile={handleViewProfile}
              />
            ))
          ) : null}
        </div>
      </div>

      {/* Email gate modal — same component as Explorer (CONTEXT.md: identical behavior) */}
      <NewsletterGateModal
        isOpen={showGate}
        onSubscribe={handleSubscribe}
        onDismiss={handleDismiss}
      />
    </AuroraBackground>
  )
}
