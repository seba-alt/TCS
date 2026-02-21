import { useEffect } from 'react'
import { useExplorerStore } from '../store'

export default function MarketplacePage() {
  const resetPilot = useExplorerStore((s) => s.resetPilot)

  // Reset pilot conversation state when user navigates to marketplace
  // (pilot state is not persisted — only in-memory reset needed on navigation)
  useEffect(() => {
    resetPilot()
  }, [resetPilot])

  return (
    <div className="min-h-screen bg-white">
      <p className="p-8 text-gray-400">Marketplace — coming in Phase 16</p>
    </div>
  )
}
