import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { useExplorerStore } from '../store'
import { SageFAB } from '../components/pilot/SageFAB'
import { SagePanel } from '../components/pilot/SagePanel'

/**
 * Root layout wrapping the Explorer page.
 * Renders Sage FAB + panel above the route outlet so Sage
 * is always accessible and conversation persists within a session.
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

      {/* Sage panel with backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              key="sage-backdrop"
              className="fixed inset-0 z-30 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <SagePanel key="sage-panel" />
          </>
        )}
      </AnimatePresence>
    </>
  )
}
