import { useState } from 'react'

export function pageWindow(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current < 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current, current + 1, current + 2, '...', total]
}

interface AdminPaginationProps {
  page: number          // 0-indexed
  totalPages: number
  onPageChange: (page: number) => void
}

export function AdminPagination({ page, totalPages, onPageChange }: AdminPaginationProps) {
  const [jumpValue, setJumpValue] = useState('')

  if (totalPages <= 1) return null

  const displayPage = page + 1 // 1-indexed for display
  const pages = pageWindow(displayPage, totalPages)

  function handleJump(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = parseInt(jumpValue, 10)
      if (val >= 1 && val <= totalPages) {
        onPageChange(val - 1) // convert back to 0-indexed
        setJumpValue('')
      }
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      {/* Prev */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Prev
      </button>

      {/* Page number buttons */}
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-slate-500">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange((p as number) - 1)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              p === displayPage
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>

      {/* Jump input */}
      <div className="flex items-center gap-1.5 ml-2">
        <span className="text-slate-500 text-xs">Go to</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={e => setJumpValue(e.target.value)}
          onKeyDown={handleJump}
          placeholder="#"
          className="w-16 bg-slate-900 border border-slate-600 text-white text-sm rounded-lg
                     px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500
                     placeholder-slate-500"
        />
      </div>
    </div>
  )
}
