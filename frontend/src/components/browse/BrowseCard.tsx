import { useState, memo } from 'react'
import { motion } from 'motion/react'
import type { BrowseCard as BrowseCardType } from '../../hooks/useBrowse'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// Deterministic gradient selection based on first initial
// Uses brand-aligned purple/violet/indigo palette
const GRADIENTS = [
  'from-purple-500 to-indigo-600',
  'from-violet-500 to-purple-700',
  'from-indigo-400 to-purple-600',
  'from-purple-600 to-violet-800',
  'from-indigo-500 to-violet-600',
  'from-purple-400 to-pink-600',
]

function MonogramFallback({ initials }: { initials: string }) {
  const idx = initials.charCodeAt(0) % GRADIENTS.length
  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[idx]} flex items-center justify-center`}
    >
      <span className="text-white text-3xl font-bold tracking-wider select-none">
        {initials}
      </span>
    </div>
  )
}

interface BrowseCardProps {
  expert: BrowseCardType
}

export const BrowseCard = memo(function BrowseCard({ expert }: BrowseCardProps) {
  const [imgError, setImgError] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Compute initials — guard against empty strings
  const firstInitial = expert.first_name?.[0] ?? '?'
  const lastInitial = expert.last_name?.[0] ?? ''
  const initials = `${firstInitial}${lastInitial}`.toUpperCase()

  const name = `${expert.first_name} ${expert.last_name}`
  const showPhoto = Boolean(expert.photo_url) && !imgError

  // Limit tags to 3 to prevent overflow
  const visibleTags = expert.tags.slice(0, 3)

  function handleClick() {
    if (expanded) {
      // Second tap: open profile in new tab
      if (expert.profile_url) {
        window.open(expert.profile_url, '_blank', 'noopener,noreferrer')
      }
      setExpanded(false)
    } else {
      setExpanded(true)
    }
  }

  return (
    <motion.div
      className="relative rounded-xl overflow-hidden cursor-pointer group"
      style={{ width: 160 }}
      initial={{ height: 220 }}
      whileHover={{ scale: 1.04 }}
      animate={{ height: expanded ? 260 : 220 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={handleClick}
    >
      {/* Photo layer */}
      {showPhoto ? (
        <img
          src={`${API_BASE}${expert.photo_url!}`}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />
      ) : (
        <MonogramFallback initials={initials} />
      )}

      {/* Frosted overlay at bottom — dark gradient (not .glass-surface; card root has overflow:hidden) */}
      {/* Pitfall 1: backdrop-filter breaks inside overflow:hidden, use dark gradient instead */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/85 via-black/55 to-transparent">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <p className="text-xs text-purple-200 font-medium">
          ${expert.hourly_rate}/hr
        </p>

        {/* Tags row — visible on hover (group-hover) or when mobile-expanded */}
        {visibleTags.length > 0 && (
          <div
            className={`mt-1 flex flex-wrap gap-1 transition-opacity duration-200 ${
              expanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/30 text-white"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
})
