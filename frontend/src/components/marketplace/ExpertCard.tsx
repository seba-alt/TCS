import type { Expert } from '../../store/resultsSlice'
import { useExplorerStore } from '../../store'
import { trackEvent } from '../../tracking'

interface ExpertCardProps {
  expert: Expert
  onViewProfile: (url: string) => void
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

export function ExpertCard({ expert, onViewProfile, context = 'grid', rank }: ExpertCardProps) {
  const toggleTag = useExplorerStore((s) => s.toggleTag)
  const query = useExplorerStore((s) => s.query)
  const tags = useExplorerStore((s) => s.tags)
  const badgeLabel = findabilityLabel(expert.findability_score)

  // Match reason only makes sense when a semantic filter is active (query or tags).
  // Price range is excluded — it provides no semantic context for a "match reason".
  const hasSemanticFilter = query.trim().length > 0 || tags.length > 0

  return (
    <div className="expert-card bg-white/90 rounded-xl border border-gray-100 p-4 flex flex-col gap-1.5 h-[180px] overflow-hidden">

      {/* Zone A: name/role/company — flex-shrink-0, content drives height (~52px) */}
      <div className="flex-shrink-0 min-w-0">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
          {expert.first_name} {expert.last_name}
        </h3>
        <p className="text-xs text-gray-500 truncate">{expert.job_title}</p>
        <p className="text-xs text-gray-400 truncate">{expert.company}</p>
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

      {/* Zone C: Domain tag pills — flex-shrink-0, hidden on mobile, no-wrap so partial tags
          are fully hidden (overflow-hidden + flex-nowrap = tags either fit or are invisible) */}
      <div className="flex-shrink-0 hidden sm:flex flex-nowrap gap-1 overflow-hidden">
        {expert.tags.slice(0, 2).map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className="flex-shrink-0 cursor-pointer text-xs bg-gray-100/80 text-gray-600 rounded-full px-2 py-0.5 hover:bg-brand-purple hover:text-white transition-colors whitespace-nowrap"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Zone D: match reason + View Profile — flex-1 min-h-0, bento separator, justify-between
          pins match reason to top and View Profile to bottom */}
      <div className="flex-1 min-h-0 flex flex-col justify-between border-t border-gray-100/60 pt-1.5">
        {hasSemanticFilter && expert.match_reason && (
          <p className="text-xs text-gray-500 line-clamp-2">
            {expert.match_reason}
          </p>
        )}

        {/* View Full Profile — always rendered, mt-auto self-start pins to bottom */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            // Track card click — fire-and-forget, never await
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
            onViewProfile(expert.profile_url)
          }}
          className="mt-auto cursor-pointer text-xs text-brand-purple font-medium hover:underline self-start"
        >
          View Full Profile →
        </button>
      </div>
    </div>
  )
}
