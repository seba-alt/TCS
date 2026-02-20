import { useState } from 'react'
import { useAdminGaps } from '../hooks/useAdminData'
import { useAdminExport } from '../hooks/useAdminExport'
import GapsTable from '../components/GapsTable'
import ExportDialog from '../components/ExportDialog'

export default function GapsPage() {
  const { data, loading, error, refetch } = useAdminGaps()
  const [showExport, setShowExport] = useState(false)
  const { downloadCsv, exporting } = useAdminExport()

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gaps</h1>
          <p className="text-slate-500 text-sm mt-1">
            Queries where the system couldn't find a confident match — ranked by frequency.
          </p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          disabled={exporting}
          className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {loading && <p className="text-slate-500 text-sm animate-pulse">Loading gaps…</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}
      {data && <GapsTable data={data.gaps} onResolved={refetch} />}

      {showExport && (
        <ExportDialog
          section="gaps"
          hasFilters={false}
          onExport={filtered => downloadCsv('gaps', filtered)}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
