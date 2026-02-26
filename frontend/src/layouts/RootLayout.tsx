import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { useExplorerStore } from '../store'
import { SageFAB } from '../components/pilot/SageFAB'
import { SagePanel } from '../components/pilot/SagePanel'
import { SageMobileSheet } from '../components/pilot/SageMobileSheet'

/**
 * Root layout wrapping the Explorer page.
 * Renders Sage FAB + panel above the route outlet so Sage
 * is always accessible and conversation persists within a session.
 *
 * Responsive Sage rendering:
 * - Desktop (md+): SagePanel — fixed 380px side panel with backdrop
 * - Mobile (<md):  SageMobileSheet — Vaul bottom sheet at 60% height
 */
export default function RootLayout() {
  const isOpen = useExplorerStore((s) => s.isOpen)
  const setOpen = useExplorerStore((s) => s.setOpen)

  return (
    <>
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

      {/* Mobile: Vaul bottom sheet (hidden on desktop) */}
      <div className="md:hidden">
        <SageMobileSheet open={isOpen} onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
