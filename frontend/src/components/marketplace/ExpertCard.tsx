import type { Expert } from '../../store/resultsSlice'
import { motion } from 'motion/react'
import { useExplorerStore } from '../../store'

interface ExpertCardProps {
  expert: Expert
  index: number  // Required for stagger delay
}

// Findability badge label — thresholds from Phase 14 (score range 50-100, neutral at 75)
function findabilityLabel(score: number | null): 'Top Match' | 'Good Match' | null {
  if (score === null) return null
  if (score >= 88) return 'Top Match'
  if (score >= 75) return 'Good Match'
  return null
}

export function ExpertCard({ expert, index }: ExpertCardProps) {
  const toggleTag = useExplorerStore((s) => s.toggleTag)
  const badgeLabel = findabilityLabel(expert.findability_score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.05, 0.4),
        ease: 'easeOut',
      }}
      // NO exit prop — entry-only animation (STATE.md Phase 17 architectural constraint:
      // exit animations break VirtuosoGrid virtualization)
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 h-[180px] overflow-hidden"
    >
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
        {badgeLabel && (
          <span className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5 whitespace-nowrap">
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Domain tag pills — clicking adds tag to sidebar filters (MARKET-04 locked decision) */}
      <div className="flex flex-wrap gap-1 overflow-hidden">
        {expert.tags.slice(0, 3).map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 hover:bg-brand-purple hover:text-white transition-colors whitespace-nowrap"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Match reason — shown only when present (active search query produces match_reason) */}
      {expert.match_reason && (
        <p className="text-xs text-gray-500 line-clamp-2 border-t border-gray-100 pt-1.5 mt-auto">
          {expert.match_reason}
        </p>
      )}
    </motion.div>
  )
}
