import { Search } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
        <Search className="w-8 h-8 text-gray-400" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-700 text-base mb-1">No experts found</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Try adjusting your filters, or describe what you need to the AI co-pilot.
        </p>
      </div>
      {/* Phase 18 will wire this CTA to open the co-pilot panel */}
      <button
        className="text-sm text-brand-purple font-medium border border-brand-purple rounded-lg px-4 py-2 hover:bg-brand-purple hover:text-white transition-colors"
        onClick={() => {/* co-pilot CTA — will be wired in Phase 18 */}}
      >
        Try the AI Co-Pilot
      </button>
    </div>
  )
}
