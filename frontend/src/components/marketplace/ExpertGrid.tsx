import { VirtuosoGrid } from 'react-virtuoso'
import type { Expert } from '../../store/resultsSlice'
import { ExpertCard } from './ExpertCard'
import { EmptyState } from './EmptyState'
import { SkeletonGrid } from './SkeletonGrid'

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
  // Initial load: show skeleton grid (built in Phase 16)
  if (loading && experts.length === 0) {
    return <SkeletonGrid />
  }

  // Zero results after load completes
  if (!loading && experts.length === 0) {
    return <EmptyState />
  }

  return (
    <VirtuosoGrid
      data={experts}
      endReached={onEndReached}
      overscan={200}
      // listClassName: CSS grid — 2 cols mobile, 3 cols desktop (CONTEXT.md decision)
      // gap-4 = 16px. Padding on container, NOT margin on items (Virtuoso scroll height constraint)
      listClassName="grid grid-cols-2 md:grid-cols-3 gap-4 p-4"
      // itemClassName: min-h-0 prevents grid row blowout on fixed card height
      itemClassName="min-h-0"
      computeItemKey={(_, expert) => expert.username}
      itemContent={(index, expert) => (
        <ExpertCard expert={expert} index={index} onViewProfile={onViewProfile} />
      )}
      components={{
        // Footer renders skeleton row while fetching next page
        Footer: () => isFetchingMore ? <SkeletonFooter /> : null,
      }}
      style={{ height: '100%' }}
    />
  )
}
