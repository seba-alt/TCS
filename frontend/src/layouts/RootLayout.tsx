import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { useExplorerStore } from '../store'
import { SageFAB } from '../components/pilot/SageFAB'
import { SagePanel } from '../components/pilot/SagePanel'
import { SageMobileSheet } from '../components/pilot/SageMobileSheet'
import { Analytics } from '../analytics'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}

/**
 * Root layout wrapping the Explorer page.
 * Renders Sage FAB + panel above the route outlet so Sage
 * is always accessible and conversation persists within a session.
 *
 * Responsive Sage rendering:
 * - Desktop (md+): SagePanel — fixed 380px side panel with backdrop
 * - Mobile (<md):  SageMobileSheet — Vaul bottom sheet at 60% height
 *
 * SageMobileSheet uses JS conditional (useMediaQuery) instead of CSS md:hidden
 * to prevent Vaul's Drawer.Portal from mounting on document.body on desktop.
 */
export default function RootLayout() {
  const isOpen = useExplorerStore((s) => s.isOpen)
  const setOpen = useExplorerStore((s) => s.setOpen)
  const isMobile = useMediaQuery('(max-width: 767px)')

  return (
    <>
      <Analytics />
      <Outlet />

      {/* Sage FAB — visible when panel is closed */}
      <AnimatePresence>
        {!isOpen && <SageFAB key="sage-fab" />}
      </AnimatePresence>

      {/* Desktop: SagePanel + backdrop (hidden on mobile) */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              key="sage-backdrop"
              className="hidden md:block fixed inset-0 z-30 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <div className="hidden md:block" key="sage-panel-wrapper">
              <SagePanel key="sage-panel" />
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile: Vaul bottom sheet — JS conditional prevents portal leak on desktop */}
      {isMobile && (
        <SageMobileSheet open={isOpen} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
