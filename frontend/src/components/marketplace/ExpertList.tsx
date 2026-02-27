import { useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import type { Expert } from '../../store/resultsSlice'
import { useExplorerStore, useFilterSlice } from '../../store'
import { EmptyState } from './EmptyState'

interface ExpertListProps {
  experts: Expert[]
  loading: boolean
  isFetchingMore: boolean
  onEndReached: () => void
  onViewProfile: (url: string) => void
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3.5 bg-gray-200 rounded w-32" />
        <div className="h-3 bg-gray-100 rounded w-48" />
      </div>
      <div className="h-3.5 bg-gray-200 rounded w-16 shrink-0" />
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="pt-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <SkeletonListRow key={i} />
      ))}
    </div>
  )
}

function ListFooter({ isFetchingMore }: { isFetchingMore: boolean }) {
  if (!isFetchingMore) return null
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-brand-purple rounded-full animate-spin" />
        Loading more...
      </div>
    </div>
  )
}

export function ExpertList({ experts, loading, isFetchingMore, onEndReached, onViewProfile }: ExpertListProps) {
  const { savedFilter, savedExperts } = useFilterSlice()
  const toggleTag = useExplorerStore((s) => s.toggleTag)

  // When "Saved" filter is active, show only bookmarked experts from loaded list
  const displayExperts = useMemo(() => {
    if (!savedFilter) return experts
    const saved = new Set(savedExperts)
    return experts.filter(e => saved.has(e.username))
  }, [experts, savedFilter, savedExperts])

  // Initial load: show skeleton
  if (loading && experts.length === 0) {
    return <SkeletonList />
  }

  // Zero results
  if (!loading && displayExperts.length === 0) {
    return <EmptyState />
  }

  return (
    <div style={{ height: '100%' }}>
      <Virtuoso
        data={displayExperts}
        endReached={onEndReached}
        overscan={200}
        computeItemKey={(_, expert) => expert.username}
        itemContent={(_, expert) => {
          const initials = `${expert.first_name?.[0] ?? ''}${expert.last_name?.[0] ?? ''}`
          return (
            <div
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onViewProfile(expert.profile_url)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewProfile(expert.profile_url) }}
            >
              {/* Photo with fallback initials */}
              {expert.photo_url ? (
                <div className="w-8 h-8 rounded-full shrink-0 relative">
                  <img
                    src={`${API_BASE}${expert.photo_url}`}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                  <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple text-xs font-semibold items-center justify-center absolute inset-0 hidden">
                    {initials}
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}

              {/* Name + job title */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">
                  {expert.first_name} {expert.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{expert.job_title}</p>
              </div>

              {/* Rate */}
              <span className="text-xs font-semibold text-brand-purple whitespace-nowrap shrink-0">
                {expert.currency} {expert.hourly_rate}/hr
              </span>

              {/* Domain tags — first 3 */}
              <div className="hidden sm:flex gap-1 shrink-0">
                {expert.tags.slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => { e.stopPropagation(); toggleTag(tag) }}
                    className="text-xs bg-gray-100/80 text-gray-600 rounded-full px-2 py-0.5 hover:bg-brand-purple hover:text-white transition-colors whitespace-nowrap"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )
        }}
        components={{
          Header: () => <div style={{ height: '8px' }} />,
          Footer: () => <ListFooter isFetchingMore={isFetchingMore} />,
        }}
        style={{ height: '100%' }}
      />
    </div>
  )
}
