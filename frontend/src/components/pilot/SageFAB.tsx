import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useExplorerStore } from '../../store'

const TOOLTIP_KEY = 'sage-tooltip-shown'

export function SageFAB() {
  const setOpen = useExplorerStore((s) => s.setOpen)
  const [showTooltip, setShowTooltip] = useState(false)

  // First-visit tooltip — check localStorage after mount (Phase 16 email gate pattern)
  useEffect(() => {
    if (!localStorage.getItem(TOOLTIP_KEY)) {
      setShowTooltip(true)
      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => {
        setShowTooltip(false)
        localStorage.setItem(TOOLTIP_KEY, '1')
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClick = () => {
    setShowTooltip(false)
    localStorage.setItem(TOOLTIP_KEY, '1')
    setOpen(true)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Tooltip — first visit only */}
      {showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg"
        >
          Try the AI assistant
          <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-gray-900 rotate-45" />
        </motion.div>
      )}

      {/* FAB button — TCS branding mark (S in brand purple circle) */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className="w-14 h-14 rounded-full bg-brand-purple text-white shadow-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
        aria-label="Open Sage AI assistant"
      >
        <span className="text-xl font-bold tracking-tight">S</span>
      </motion.button>
    </div>
  )
}
