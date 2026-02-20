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

  // Filter panel state
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Searches</h1>
        <button
          onClick={() => setShowExport(true)}
          disabled={exporting}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-purple rounded-lg hover:bg-brand-purple/90 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">User email</label>
            <input
              type="text"
              value={emailFilter}
              onChange={e => setEmailFilter(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Gap flag</label>
            <select
              value={gapFilter}
              onChange={e => setGapFilter(e.target.value as '' | 'true' | 'false')}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="true">Gaps only</option>
              <option value="false">Non-gaps only</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To date</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={applyFilters} className="px-3 py-1.5 text-sm font-medium text-white bg-gray-800 rounded hover:bg-gray-700">
            Apply Filters
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading searches…</div>}
      {error && <div className="text-red-500 text-sm">Error: {error}</div>}
      {data && (
        <SearchesTable
          data={data.rows}
          pageSize={pageSize}
          onPageSizeChange={size => { setPageSize(size); setFilters(f => ({ ...f, page_size: size })) }}
        />
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
