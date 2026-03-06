import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import type { Expert } from '../../store/resultsSlice'
import { useExplorerStore, useFilterSlice } from '../../store'
import { useNltrStore } from '../../store/nltrStore'
import { trackEvent } from '../../tracking'
import { currencySymbol } from '../../utils/currency'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface ExpertCardProps {
  expert: Expert
  onViewProfile: (url: string) => void
  context?: 'grid' | 'chat_panel'
  rank?: number
}

// Findability badge label — thresholds from Phase 14 (score range 50-100, neutral at 75)
function findabilityLabel(score: number | null): 'Top Match' | 'Good Match' | null {
  if (score === null) return null
  if (score >= 88) return 'Top Match'
  if (score >= 75) return 'Good Match'
  return null
}

export function ExpertCard({ expert, onViewProfile, context = 'grid', rank }: ExpertCardProps) {
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

  // Card-level click: always navigate directly to profile (no expand state on any viewport)
  function handleCardClick() {
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

  // Match reason only makes sense when a semantic filter is active (query or tags).
  // Price range is excluded — it provides no semantic context for a "match reason".
  const hasSemanticFilter = query.trim().length > 0 || tags.length > 0

  const initials = `${expert.first_name?.[0] ?? ''}${expert.last_name?.[0] ?? ''}`

  return (
    <div
      className={`expert-card rounded-xl border cursor-pointer transition-all duration-150 relative overflow-hidden
        flex flex-col items-center p-3 h-[200px]
        md:flex-row md:items-start md:p-3 md:h-[180px] md:gap-3
        hover:shadow-lg hover:shadow-brand-purple/10 hover:-translate-y-0.5
        ${isSaved ? 'bg-purple-50 border-purple-200' : 'bg-white/90 border-gray-100'}`}
      onClick={handleCardClick}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() }}
      role="button"
    >

      {/* Bookmark icon — absolute top-right corner on both layouts */}
      <button
        onClick={handleBookmark}
        className="absolute top-2 right-2 p-0.5 text-gray-400 hover:text-brand-purple transition-colors z-10"
        aria-label={isSaved ? 'Remove bookmark' : 'Bookmark expert'}
      >
        <Bookmark size={16} className={isSaved ? 'fill-current text-brand-purple' : ''} />
      </button>

      {/* ===== MOBILE LAYOUT (<768px): vertical, photo-centric ===== */}
      <div className="md:hidden flex flex-col items-center w-full h-full">
        {/* Match badge — top-left corner ribbon (only when search/tag active) */}
        {hasSemanticFilter && badgeLabel && (
          <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold bg-green-50 text-green-700 rounded-full px-1.5 py-0.5 z-10">
            {badgeLabel}
          </span>
        )}

        {/* Photo — large centered circle */}
        <div className="mt-3 mb-1.5">
          {showPhoto ? (
            <img
              src={expert.photo_url!.startsWith('http') ? expert.photo_url! : `${API_BASE}${expert.photo_url!}`}
              alt=""
              className="w-20 h-20 rounded-full object-cover shrink-0"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-brand-purple/10 text-brand-purple font-semibold text-lg flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
        </div>

        {/* Name — 2 lines max */}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug text-center line-clamp-2 px-3 w-full">
          {expert.first_name} {expert.last_name}
        </h3>

        {/* Company name */}
        {expert.company && (
          <p className="text-[11px] text-gray-400 text-center line-clamp-1 px-3 w-full mt-0.5">
            {expert.company}
          </p>
        )}

        {/* Rate — pushed to bottom with mt-auto */}
        <span className="text-xs font-semibold text-brand-purple whitespace-nowrap mt-auto mb-2">
          {currencySymbol(expert.currency)}{expert.hourly_rate}/hr
        </span>
      </div>

      {/* ===== DESKTOP LAYOUT (>=768px): horizontal, photo-left ===== */}
      {/* Photo — left side, larger circle */}
      <div className="hidden md:flex shrink-0">
        {showPhoto ? (
          <img
            src={expert.photo_url!.startsWith('http') ? expert.photo_url! : `${API_BASE}${expert.photo_url!}`}
            alt=""
            className="w-16 h-16 rounded-full object-cover shrink-0"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-brand-purple/10 text-brand-purple font-semibold text-base flex items-center justify-center shrink-0">
            {initials}
          </div>
        )}
      </div>

      {/* Right side info — desktop only */}
      <div className="hidden md:flex flex-col flex-1 min-w-0 gap-1 pr-5">
        {/* Name */}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
          {expert.first_name} {expert.last_name}
        </h3>

        {/* Job title */}
        <p className="text-xs text-gray-500 truncate">{expert.job_title}</p>

        {/* Company */}
        <p className="text-xs text-gray-400 truncate">{expert.company}</p>

        {/* Rate + findability badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-brand-purple whitespace-nowrap">
            {currencySymbol(expert.currency)}{expert.hourly_rate}/hr
          </span>
          {hasSemanticFilter && badgeLabel && (
            <span className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5 whitespace-nowrap">
              {badgeLabel}
            </span>
          )}
        </div>

        {/* Domain tag pills — first 2 */}
        <div className="flex flex-nowrap overflow-hidden gap-1">
          {expert.tags.slice(0, 2).map((tag) => (
            <button
              key={tag}
              onClick={(e) => { e.stopPropagation(); toggleTag(tag) }}
              className="flex-shrink-0 cursor-pointer text-xs bg-gray-100/80 text-gray-600 rounded-full px-2 py-0.5 hover:bg-brand-purple hover:text-white transition-colors whitespace-nowrap"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Match reason */}
        {hasSemanticFilter && expert.match_reason && (
          <p className="text-xs text-gray-500 line-clamp-2">{expert.match_reason}</p>
        )}

        {/* View Full Profile link */}
        <p className="mt-auto cursor-pointer text-xs text-brand-purple font-medium hover:underline self-start">
          View Full Profile →
        </p>
      </div>
    </div>
  )
}
