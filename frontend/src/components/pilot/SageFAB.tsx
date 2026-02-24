import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import { useExplorerStore } from '../../store'

const TOOLTIP_KEY = 'sage-tooltip-shown'

type GlowType = 'none' | 'sage' | 'filter'

const GLOW_SHADOWS: Record<GlowType, string> = {
  none: '0 0 0 0 rgba(0,0,0,0)',
  sage: '0 0 22px 8px rgba(139, 92, 246, 0.55)',    // brand purple — Sage reply
  filter: '0 0 18px 6px rgba(99, 179, 237, 0.45)',  // cool blue — filter change
}

export function SageFAB() {
  const setOpen = useExplorerStore((s) => s.setOpen)
  const isStreaming = useExplorerStore((s) => s.isStreaming)
  const query = useExplorerStore((s) => s.query)
  const tags = useExplorerStore((s) => s.tags)
  const rateMin = useExplorerStore((s) => s.rateMin)
  const rateMax = useExplorerStore((s) => s.rateMax)

  // Route detection — filter glow only relevant on Explorer
  const location = useLocation()
  const isExplorer = location.pathname === '/explore'

  const [showTooltip, setShowTooltip] = useState(false)
  const [glowType, setGlowType] = useState<GlowType>('none')

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

  // Sage activity glow — fires when isStreaming flips false (Sage response received)
  // prevStreamingRef initialized to current value to avoid glow on first mount
  const prevStreamingRef = useRef(isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current === true && isStreaming === false) {
      setGlowType('sage')
      const t = setTimeout(() => setGlowType('none'), 1500)
      return () => clearTimeout(t)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming])

  // Filter change glow — only on Explorer, skip first render to avoid spurious glow on page load
  const filterKey = `${query}|${rateMin}|${rateMax}|${tags.join(',')}`
  const prevFilterKey = useRef<string | null>(null)
  useEffect(() => {
    if (!isExplorer) return  // Skip filter glow on non-Explorer pages (Browse has no grid)
    if (prevFilterKey.current === null) {
      // Initialize on first render without glowing
      prevFilterKey.current = filterKey
      return
    }
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey
      setGlowType('filter')
      const t = setTimeout(() => setGlowType('none'), 1500)
      return () => clearTimeout(t)
    }
  }, [filterKey, isExplorer])

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

      {/* Glow wrapper — surrounds button only, not tooltip. animates boxShadow ONLY — no scale/transform */}
      <motion.div
        className="rounded-full"
        animate={{ boxShadow: GLOW_SHADOWS[glowType] }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* FAB button — inner motion.button retains whileHover/whileTap scale (no conflict with wrapper boxShadow) */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          className="w-14 h-14 rounded-full bg-brand-purple text-white shadow-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
          aria-label="Open Sage AI assistant"
        >
          <img src="/icon.png" alt="Tinrate" className="w-8 h-8 object-contain brightness-0 invert" />
        </motion.button>
      </motion.div>
    </div>
  )
}
