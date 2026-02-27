import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import type { Expert } from '../../store/resultsSlice'
import { useExplorerStore, useFilterSlice } from '../../store'
import { useNltrStore } from '../../store/nltrStore'
import { trackEvent } from '../../tracking'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface ExpertCardProps {
  expert: Expert
  onViewProfile: (url: string) => void
  isExpanded?: boolean
  onExpand?: (username: string) => void
  context?: 'grid' | 'sage_panel'
  rank?: number
}

// Findability badge label — thresholds from Phase 14 (score range 50-100, neutral at 75)
function findabilityLabel(score: number | null): 'Top Match' | 'Good Match' | null {
  if (score === null) return null
  if (score >= 88) return 'Top Match'
  if (score >= 75) return 'Good Match'
  return null
}

export function ExpertCard({ expert, onViewProfile, isExpanded = false, onExpand, context = 'grid', rank }: ExpertCardProps) {
  const toggleTag = useExplorerStore((s) => s.toggleTag)
  const query = useExplorerStore((s) => s.query)
  const tags = useExplorerStore((s) => s.tags)
  const badgeLabel = findabilityLabel(expert.findability_score)

  // Profile photo state
  const [imgError, setImgError] = useState(false)
  const showPhoto = Boolean(expert.photo_url) && !imgError

  // Bookmark state — reactive via Zustand (no local state needed)
  const { savedExperts, toggleSavedExpert } = useFilterSlice()
  const isSaved = savedExperts.includes(expert.username)

  function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    toggleSavedExpert(expert.username)
  }

  // Fires a lead-click POST when the user is email-identified (fire-and-forget)
  function _fireLeadClick(searchQuery: string) {
    const nltrEmail = useNltrStore.getState().email
    if (nltrEmail) {
      void fetch(`${API_BASE}/api/admin/lead-clicks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          email: nltrEmail,
          expert_username: expert.username,
          search_query: searchQuery,
        }),
      })
    }
  }

  // Card-level click: desktop opens profile directly; mobile uses two-tap expand flow
  function handleCardClick() {
    // Desktop: skip expand, open profile directly
    if (window.innerWidth >= 768) {
      const storeState = useExplorerStore.getState()
      void trackEvent('card_click', {
        expert_id: expert.username,
        context,
        rank,
        active_filters: {
          query: storeState.query,
          rate_min: storeState.rateMin,
          rate_max: storeState.rateMax,
          tags: storeState.tags,
        },
      })
      _fireLeadClick(storeState.query)
      onViewProfile(expert.profile_url)
      return
    }
    // Mobile: two-tap expand behavior
    if (!isExpanded) {
      onExpand?.(expert.username)
    } else {
      const storeState = useExplorerStore.getState()
      void trackEvent('card_click', {
        expert_id: expert.username,
        context,
        rank,
        active_filters: {
          query: storeState.query,
          rate_min: storeState.rateMin,
          rate_max: storeState.rateMax,
          tags: storeState.tags,
        },
      })
      _fireLeadClick(storeState.query)
      onViewProfile(expert.profile_url)
    }
  }

  // Match reason only makes sense when a semantic filter is active (query or tags).
  // Price range is excluded — it provides no semantic context for a "match reason".
  const hasSemanticFilter = query.trim().length > 0 || tags.length > 0

  return (
    <div
      className={`expert-card bg-white/90 rounded-xl border border-gray-100 p-3 sm:p-4 flex flex-col gap-1.5 ${isExpanded ? 'min-h-[180px] ring-2 ring-brand-purple/30' : 'h-[180px] overflow-hidden'} cursor-pointer transition-all duration-150`}
      onClick={handleCardClick}
      tabIndex={0}
      onBlur={() => onExpand?.('')}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() }}
      role="button"
      aria-expanded={isExpanded}
    >

      {/* Zone A: photo + name/role/company + bookmark — flex-shrink-0, content drives height (~52px) */}
      <div className="flex-shrink-0 min-w-0 flex items-start gap-2">
        {/* Profile photo — 32px circle, hidden entirely when no photo (no placeholder) */}
        {showPhoto && (
          <img
            src={`${API_BASE}${expert.photo_url!}`}
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
            {expert.first_name} {expert.last_name}
          </h3>
          <p className="text-xs text-gray-500 truncate">{expert.job_title}</p>
          <p className="text-xs text-gray-400 truncate">{expert.company}</p>
        </div>
        {/* Bookmark icon — outline fills when saved (CONTEXT.md: bookmark icon at right edge) */}
        <button
          onClick={handleBookmark}
          className="shrink-0 p-0.5 text-gray-300 hover:text-brand-purple transition-colors"
          aria-label={isSaved ? 'Remove bookmark' : 'Bookmark expert'}
        >
          <Bookmark size={16} className={isSaved ? 'fill-current text-brand-purple' : ''} />
        </button>
      </div>

      {/* Zone B: Rate + Findability badge — flex-shrink-0 */}
      <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-brand-purple whitespace-nowrap">
          {expert.currency} {expert.hourly_rate}/hr
        </span>
        {hasSemanticFilter && badgeLabel && (
          <span className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5 whitespace-nowrap">
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Zone C: Domain tag pills — hidden on mobile by default, shown when expanded.
          On mobile expanded: wrap tags so they don't get cut off; show only first tag to save space */}
      <div className={`flex-shrink-0 ${isExpanded ? 'flex flex-wrap' : 'hidden sm:flex flex-nowrap overflow-hidden'} gap-1`}>
        {expert.tags.slice(0, isExpanded ? 2 : 2).map((tag) => (
          <button
            key={tag}
            onClick={(e) => { e.stopPropagation(); toggleTag(tag) }}
            className="flex-shrink-0 cursor-pointer text-xs bg-gray-100/80 text-gray-600 rounded-full px-2 py-0.5 hover:bg-brand-purple hover:text-white transition-colors whitespace-nowrap"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Zone D: match reason + View Profile — flex-1 min-h-0, bento separator, justify-between
          pins match reason to top and View Profile to bottom */}
      <div className="flex-1 min-h-0 flex flex-col justify-between border-t border-gray-100/60 pt-1.5">
        {/* Match reason: always show on desktop; show on mobile only when expanded */}
        {hasSemanticFilter && expert.match_reason && (
          <p className="text-xs text-gray-500 line-clamp-2 hidden sm:block">
            {expert.match_reason}
          </p>
        )}

        {/* View Full Profile — text changes on mobile when expanded to guide second tap */}
        <p className="mt-auto cursor-pointer text-xs text-brand-purple font-medium hover:underline self-start">
          {isExpanded ? 'Tap again to view profile →' : 'View Full Profile →'}
        </p>
      </div>
    </div>
  )
}
