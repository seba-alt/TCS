import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrowse } from '../hooks/useBrowse'
import { HeroBanner } from '../components/browse/HeroBanner'
import { SkeletonHeroBanner } from '../components/browse/SkeletonHeroBanner'
import { BrowseRow } from '../components/browse/BrowseRow'
import { SkeletonBrowseRow } from '../components/browse/SkeletonBrowseRow'
import { AuroraBackground } from '../components/AuroraBackground'
import { useExplorerStore } from '../store'

export default function BrowsePage() {
  const { data, loading, error } = useBrowse()
  const navigate = useNavigate()

  // CRITICAL: setNavigationSource MUST be called BEFORE navigate() in the same tick
  // to prevent MarketplacePage from reading stale navigationSource === 'direct'
  // and calling resetPilot() when loading from browse navigation.
  const setNavigationSource = useExplorerStore((s) => s.setNavigationSource)
  const resetFilters = useExplorerStore((s) => s.resetFilters)

  // Navigate to /explore with the row title pre-applied as a query filter
  const handleSeeAll = useCallback(
    (slug: string, title: string) => {
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
      <div className="min-h-screen pt-8 md:pt-12">
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
              />
            ))
          ) : null}
        </div>
      </div>
    </AuroraBackground>
  )
}
