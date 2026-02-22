import type { Expert } from '../../store/resultsSlice'
import { useExplorerStore } from '../../store'

interface ExpertCardProps {
  expert: Expert
  onViewProfile: (url: string) => void
}

// Findability badge label — thresholds from Phase 14 (score range 50-100, neutral at 75)
function findabilityLabel(score: number | null): 'Top Match' | 'Good Match' | null {
  if (score === null) return null
  if (score >= 88) return 'Top Match'
  if (score >= 75) return 'Good Match'
  return null
}

export function ExpertCard({ expert, onViewProfile }: ExpertCardProps) {
  const toggleTag = useExplorerStore((s) => s.toggleTag)
  const query = useExplorerStore((s) => s.query)
  const tags = useExplorerStore((s) => s.tags)
  const badgeLabel = findabilityLabel(expert.findability_score)

  // Match reason only makes sense when a semantic filter is active (query or tags).
  // Price range is excluded — it provides no semantic context for a "match reason".
  const hasSemanticFilter = query.trim().length > 0 || tags.length > 0

  return (
    <div className="expert-card bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-2 h-[180px] overflow-hidden">

      {/* Primary hierarchy: name (large) + job title + company */}
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
          {expert.first_name} {expert.last_name}
        </h3>
        <p className="text-xs text-gray-500 truncate">{expert.job_title}</p>
        <p className="text-xs text-gray-400 truncate">{expert.company}</p>
      </div>

      {/* Rate + Findability badge (text label, not numeric score) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-brand-purple whitespace-nowrap">
          {expert.currency} {expert.hourly_rate}/hr
        </span>
        {hasSemanticFilter && badgeLabel && (
          <span className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5 whitespace-nowrap">
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Domain tag pills — hidden on mobile, max 2 on desktop, no-wrap so partial tags are
          fully hidden (overflow-hidden + flex-shrink-0 = tags either fit or are invisible) */}
      <div className="hidden sm:flex flex-nowrap gap-1 overflow-hidden">
        {expert.tags.slice(0, 2).map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className="flex-shrink-0 cursor-pointer text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 hover:bg-brand-purple hover:text-white transition-colors whitespace-nowrap"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Match reason — only when a semantic filter (query or tag) is active.
          Price-only filtering produces no meaningful semantic match reason. */}
      {hasSemanticFilter && expert.match_reason && (
        <p className="text-xs text-gray-500 line-clamp-2 border-t border-gray-100 pt-1.5 mt-auto">
          {expert.match_reason}
        </p>
      )}

      {/* View Full Profile — triggers email gate or direct open */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onViewProfile(expert.profile_url)
        }}
        className="mt-auto cursor-pointer text-xs text-brand-purple font-medium hover:underline self-start"
      >
        View Full Profile →
      </button>
    </div>
  )
}
