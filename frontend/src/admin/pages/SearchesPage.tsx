import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAdminSearches } from '../hooks/useAdminData'
import { useAdminExport } from '../hooks/useAdminExport'
import SearchesTable from '../components/SearchesTable'
import ExportDialog from '../components/ExportDialog'
import type { SearchFilters } from '../types'

export default function SearchesPage() {
  const location = useLocation()
  const navEmail: string = location.state?.email ?? ''

  const [filters, setFilters] = useState<SearchFilters>({
    page: 0, page_size: 25,
    email: navEmail || undefined,
  })
  const [pageSize, setPageSize] = useState(25)
  const [showExport, setShowExport] = useState(false)
  const { data, loading, error } = useAdminSearches(filters)
  const { downloadCsv, exporting } = useAdminExport()

  const [emailFilter, setEmailFilter] = useState(navEmail)
  const [gapFilter, setGapFilter] = useState<'' | 'true' | 'false'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function applyFilters() {
    setFilters({
      email: emailFilter || undefined,
      gap_flag: gapFilter !== '' ? gapFilter === 'true' : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page: 0,
      page_size: pageSize,
    })
  }

  function clearFilters() {
    setEmailFilter(''); setGapFilter(''); setDateFrom(''); setDateTo('')
    setFilters({ page: 0, page_size: pageSize })
  }

  const hasFilters = !!(emailFilter || gapFilter || dateFrom || dateTo)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Searches</h1>
          <p className="text-slate-500 text-sm mt-1">All conversations, filterable by user, gap status and date</p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          disabled={exporting}
          className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">User email</label>
            <input
              type="text"
              value={emailFilter}
              onChange={e => setEmailFilter(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Gap flag</label>
            <select
              value={gapFilter}
              onChange={e => setGapFilter(e.target.value as '' | 'true' | 'false')}
              className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All</option>
              <option value="true">Gaps only</option>
              <option value="false">Non-gaps only</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">From date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">To date</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Apply Filters
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-slate-400 border border-slate-600 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm animate-pulse">Loading searches…</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}
      {data && (
        <>
          <div className="text-xs text-slate-600 -mb-2">{data.total} total results</div>
          <SearchesTable
            data={data.rows}
            pageSize={pageSize}
            onPageSizeChange={size => { setPageSize(size); setFilters(f => ({ ...f, page_size: size })) }}
          />
        </>
      )}

      {showExport && (
        <ExportDialog
          section="searches"
          hasFilters={hasFilters}
          onExport={filtered => downloadCsv('searches', filtered, filters)}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
