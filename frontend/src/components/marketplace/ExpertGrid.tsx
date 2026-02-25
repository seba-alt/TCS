import { useRef, useEffect, useMemo } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { animate } from 'motion/react'
import type { Expert } from '../../store/resultsSlice'
import { useFilterSlice } from '../../store'
import { ExpertCard } from './ExpertCard'
import { EmptyState } from './EmptyState'
import { SkeletonGrid } from './SkeletonGrid'
import { useNltrStore } from '../../store/nltrStore'


interface ExpertGridProps {
  experts: Expert[]
  loading: boolean
  isFetchingMore: boolean
  onEndReached: () => void
  onViewProfile: (url: string) => void
}

// Skeleton footer row — 3 pulsing cards shown while next page loads
function SkeletonFooter() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 px-4 pb-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 h-[180px] animate-pulse" />
      ))}
    </div>
  )
}

export function ExpertGrid({ experts, loading, isFetchingMore, onEndReached, onViewProfile }: ExpertGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { spinTrigger, resetSpin } = useNltrStore()
  const { savedFilter, savedExperts } = useFilterSlice()

  // When "Saved" filter is active, show only bookmarked experts from loaded list
  const displayExperts = useMemo(() => {
    if (!savedFilter) return experts
    const saved = new Set(savedExperts)
    return experts.filter(e => saved.has(e.username))
  }, [experts, savedFilter, savedExperts])

  useEffect(() => {
    if (!spinTrigger || !containerRef.current) return
    animate(
      containerRef.current,
      { rotate: 360 },
      { duration: 0.7, ease: 'easeInOut' }
    ).then(() => {
      // Reset rotation to 0 without visual transition (prevents additive rotation on next trigger)
      animate(containerRef.current!, { rotate: 0 }, { duration: 0 })
      resetSpin()
    })
  }, [spinTrigger, resetSpin])

  // Initial load: show skeleton grid (built in Phase 16)
  if (loading && experts.length === 0) {
    return <SkeletonGrid />
  }

  // Zero results after load completes (or saved filter yields nothing)
  if (!loading && displayExperts.length === 0) {
    return <EmptyState />
  }

  return (
    <div ref={containerRef} style={{ height: '100%' }}>
      <VirtuosoGrid
        data={displayExperts}
        endReached={onEndReached}
        overscan={200}
        // listClassName: CSS grid — 2 cols mobile, 3 cols desktop (CONTEXT.md decision)
        // gap-4 = 16px. Padding on container, NOT margin on items (Virtuoso scroll height constraint)
        listClassName="grid grid-cols-2 md:grid-cols-3 gap-4 px-4 pb-4 pt-4"
        // itemClassName: min-h-0 prevents grid row blowout on fixed card height
        itemClassName="min-h-0"
        computeItemKey={(_, expert) => expert.username}
        itemContent={(index, expert) => (
          <ExpertCard expert={expert} onViewProfile={onViewProfile} rank={index} />
        )}
        components={{
          // Header spacer — VirtuosoGrid measures this correctly, pushing first row below the filter bar
          Header: () => <div style={{ height: '20px' }} />,
          // Footer renders skeleton row while fetching next page
          Footer: () => isFetchingMore ? <SkeletonFooter /> : null,
        }}
        style={{ height: '100%' }}
      />
    </div>
  )
}
