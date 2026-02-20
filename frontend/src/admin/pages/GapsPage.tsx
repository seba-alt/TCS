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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gaps</h1>
          <p className="text-sm text-gray-500 mt-1">Queries where the system couldn't find a confident match — ranked by frequency.</p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          disabled={exporting}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-purple rounded-lg hover:bg-brand-purple/90 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading gaps…</div>}
      {error && <div className="text-red-500 text-sm">Error: {error}</div>}
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
