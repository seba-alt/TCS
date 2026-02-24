import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { useExplorerStore } from '../store'
import { SageFAB } from '../components/pilot/SageFAB'
import { SagePanel } from '../components/pilot/SagePanel'
import { SagePopover } from '../components/pilot/SagePopover'

/**
 * Shared layout wrapping Browse (/) and Explorer (/explore).
 * Renders Sage FAB + panel/popover above the route outlet so Sage
 * is visible on all pages and conversation survives navigation.
 */
export default function RootLayout() {
  const isOpen = useExplorerStore((s) => s.isOpen)
  const setOpen = useExplorerStore((s) => s.setOpen)
  const location = useLocation()
  const isExplorer = location.pathname === '/explore'

  // Close Sage popover when navigating back to Browse
  // Only fires on route transitions TO Browse — not on every render
  const prevPathRef = useRef(location.pathname)
  useEffect(() => {
    if (prevPathRef.current !== location.pathname && location.pathname === '/') {
      setOpen(false)
    }
    prevPathRef.current = location.pathname
  }, [location.pathname, setOpen])

  return (
    <>
      <Outlet />

      {/* Sage FAB — visible on all pages when panel/popover is closed */}
      <AnimatePresence>
        {!isOpen && <SageFAB key="sage-fab" />}
      </AnimatePresence>

      {/* Sage panel (Explorer) or popover (Browse) */}
      <AnimatePresence>
        {isOpen && isExplorer && (
          <>
            <div
              key="sage-backdrop"
              className="fixed inset-0 z-30 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <SagePanel key="sage-panel" />
          </>
        )}
        {isOpen && !isExplorer && (
          <SagePopover key="sage-popover" />
        )}
      </AnimatePresence>
    </>
  )
}
