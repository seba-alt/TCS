interface ExportDialogProps {
  section: 'searches' | 'gaps'
  onExport: (filtered: boolean) => void
  onClose: () => void
  hasFilters: boolean   // If false, "filtered" option is greyed out / hidden
}

export default function ExportDialog({ section, onExport, onClose, hasFilters }: ExportDialogProps) {
  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Export {section === 'searches' ? 'Searches' : 'Gaps'}</h2>
        <p className="text-sm text-gray-500 mb-5">Choose what to include in the CSV download.</p>

        <div className="space-y-3">
          {hasFilters && (
            <button
              onClick={() => { onExport(true); onClose() }}
              className="w-full text-left px-4 py-3 rounded-lg border border-brand-purple bg-brand-purple/5 hover:bg-brand-purple/10 transition-colors"
            >
              <p className="text-sm font-medium text-brand-purple">Filtered results only</p>
              <p className="text-xs text-gray-500 mt-0.5">Export rows matching current filters</p>
            </button>
          )}
          <button
            onClick={() => { onExport(false); onClose() }}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-800">All data</p>
            <p className="text-xs text-gray-500 mt-0.5">Export complete {section} history</p>
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    </div>
  )
}
