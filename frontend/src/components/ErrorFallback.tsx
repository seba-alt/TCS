import type { FallbackProps } from 'react-error-boundary'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Shared error boundary fallback UI.
 * Used by app-level (main.tsx) and page-level (MarketplacePage.tsx) error boundaries.
 * Matches ExpertGrid's existing error state styling for brand consistency.
 */
export function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
      <AlertCircle size={40} className="text-gray-300" />
      <div>
        <p className="text-gray-600 font-medium">Something went wrong</p>
        <p className="text-sm text-gray-400 mt-1">
          An unexpected error occurred. Please try again.
        </p>
      </div>
      <button
        onClick={resetErrorBoundary}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple/90 transition-colors"
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  )
}

export default ErrorFallback
