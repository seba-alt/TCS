interface AuroraBackgroundProps {
  children: React.ReactNode
}

/**
 * Renders the static aurora gradient background behind page content.
 * Animation removed for performance — static gradient is visually clean.
 */
export function AuroraBackground({ children }: AuroraBackgroundProps) {
  return (
    <div className="relative min-h-screen">
      <div className="aurora-bg" aria-hidden="true" />
      {children}
    </div>
  )
}
