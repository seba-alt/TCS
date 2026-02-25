import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { BrowseCard as BrowseCardType } from '../../hooks/useBrowse'

// Gradient placeholder palette for experts without photos
const HERO_GRADIENTS = [
  'from-purple-900 via-indigo-800 to-purple-700',
  'from-violet-900 via-purple-800 to-indigo-700',
  'from-indigo-900 via-purple-800 to-violet-700',
  'from-purple-800 via-violet-900 to-indigo-800',
  'from-indigo-800 via-violet-800 to-purple-900',
  'from-violet-800 via-indigo-900 to-purple-800',
]

interface HeroBannerProps {
  featured: BrowseCardType[]
  onExploreAll: () => void
}

export function HeroBanner({ featured, onExploreAll }: HeroBannerProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Safety guard — should not happen but prevents crash
  if (featured.length === 0) return null

  const current = featured[index]

  // Advance to next expert every 5 seconds unless paused
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % featured.length)
    }, 5000)
    return () => clearInterval(id)
  }, [paused, featured.length])

  const handleDotClick = useCallback((i: number) => {
    setIndex(i)
  }, [])

  // Deterministic placeholder gradient from username first char
  const gradientIdx = (current.username?.charCodeAt(0) ?? 0) % HERO_GRADIENTS.length

  return (
    <div
      className="relative overflow-hidden rounded-2xl mx-4 md:mx-8 mb-4 h-[180px] md:h-[300px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.username}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          {/* Background: abstract branded gradient (no profile photos — portrait images don't work as wide banners) */}
          <div
            className={`w-full h-full bg-gradient-to-br ${HERO_GRADIENTS[gradientIdx]}`}
          />

          {/* Dark readability overlay — fades from left */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

          {/* Expert info — bottom left */}
          <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12 z-10">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-1">
              {current.first_name} {current.last_name}
            </h2>
            <p className="text-sm md:text-base text-gray-300 mb-1">{current.job_title}</p>
            <p className="text-xs md:text-sm text-gray-400">{current.company}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Explore All Experts CTA — always visible, outside AnimatePresence */}
      <button
        onClick={onExploreAll}
        className="absolute bottom-8 right-8 md:bottom-12 md:right-12 z-10 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-purple-600/30"
      >
        Explore All Experts
      </button>

      {/* Carousel indicator dots — centered at bottom */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {featured.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to expert ${i + 1}`}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === index ? 'bg-white' : 'bg-white/30'
            }`}
            onClick={() => handleDotClick(i)}
          />
        ))}
      </div>
    </div>
  )
}
