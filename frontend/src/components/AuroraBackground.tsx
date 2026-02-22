import { useEffect, useRef } from 'react'

interface AuroraBackgroundProps {
  children: React.ReactNode
}

/**
 * Renders the animated aurora mesh gradient background behind page content.
 * Pauses animation when tab is hidden (visibilitychange) to conserve resources.
 * CSS handles prefers-reduced-motion via @media query in index.css.
 *
 * Phase 22 — VIS-01
 */
export function AuroraBackground({ children }: AuroraBackgroundProps) {
  const auroraRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleVisibilityChange() {
      if (!auroraRef.current) return
      if (document.hidden) {
        auroraRef.current.classList.add('aurora-paused')
      } else {
        auroraRef.current.classList.remove('aurora-paused')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return (
    <div className="relative min-h-screen">
      {/* Aurora background — position:fixed in CSS, behind all content */}
      <div ref={auroraRef} className="aurora-bg" aria-hidden="true" />
      {children}
    </div>
  )
}
