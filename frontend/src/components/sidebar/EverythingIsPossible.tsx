import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useExplorerStore } from '../../store'

const EXAMPLE_TAGS = [
  'underwater basket weaving',
  'time travel consulting',
  'dragon taming',
  'moon logistics',
  'anti-gravity marketing',
  'telepathy training',
  'interdimensional real estate',
  'cloud whispering',
]

const CYCLE_INTERVAL_MS = 3500

export function EverythingIsPossible() {
  const toggleTag = useExplorerStore((s) => s.toggleTag)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % EXAMPLE_TAGS.length)
    }, CYCLE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const currentTag = EXAMPLE_TAGS[index]

  const handleActivate = useCallback(() => {
    toggleTag(currentTag)
  }, [currentTag, toggleTag])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleActivate()
      }
    },
    [handleActivate],
  )

  return (
    <div className="mt-3 px-1">
      <p className="text-xs text-gray-400 mb-1.5">Everything is possible —</p>
      <AnimatePresence mode="wait">
        <motion.button
          key={currentTag}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          onClick={handleActivate}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-label={`Add tag: ${currentTag}`}
          className="text-xs text-brand-purple italic hover:underline cursor-pointer bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple rounded"
        >
          {currentTag}
        </motion.button>
      </AnimatePresence>
    </div>
  )
}
