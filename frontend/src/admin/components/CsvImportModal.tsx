import { useState, useRef, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const getAdminToken = () => sessionStorage.getItem('admin_token') ?? ''

const EXPECTED_FIELDS = [
  'Username',
  'First Name',
  'Last Name',
  'Job Title',
  'Company',
  'Bio',
  'Hourly Rate',
]

type Step = 'idle' | 'preview' | 'mapping' | 'importing' | 'done' | 'error'

interface PreviewData {
  headers: string[]
  preview_rows: Record<string, string>[]
  total_rows: number
}

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
}

export default function CsvImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}) {
  const [step, setStep] = useState<Step>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('idle')
    setFile(null)
    setPreview(null)
    setColumnMap({})
    setImportResult(null)
    setErrorMsg('')
    setIsDragging(false)
  }, [])

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(`${API_URL}/api/admin/experts/preview-csv`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAdminToken()}` },
        body: fd,
      })
      if (!res.ok) throw new Error(`Preview failed: ${res.status}`)
      const data: PreviewData = await res.json()
      setPreview(data)

      // Auto-detect column mapping
      const autoMap: Record<string, string> = {}
      for (const expected of EXPECTED_FIELDS) {
        const match = data.headers.find(
          (h) => h.toLowerCase().trim() === expected.toLowerCase()
        )
        if (match) autoMap[expected] = match
      }
      setColumnMap(autoMap)
      setStep('preview')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files?.[0]
      if (f && f.name.endsWith('.csv')) handleFile(f)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleBrowse = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleImport = useCallback(async () => {
    if (!file) return
    setStep('importing')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('column_mapping', JSON.stringify(columnMap))
      const res = await fetch(`${API_URL}/api/admin/experts/import-csv`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAdminToken()}` },
        body: fd,
      })
      if (!res.ok) throw new Error(`Import failed: ${res.status}`)
      const result: ImportResult = await res.json()
      setImportResult(result)

      // Auto-trigger FAISS rebuild
      try {
        await fetch(`${API_URL}/api/admin/ingest/run`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAdminToken()}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        })
      } catch {
        // FAISS rebuild is best-effort
      }

      setStep('done')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }, [file, columnMap])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Import Experts CSV</h2>
          <button
            onClick={() => { reset(); onClose() }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Step 1: Upload (idle) */}
          {step === 'idle' && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  isDragging
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <svg className="w-10 h-10 mx-auto text-slate-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-slate-400 mb-2">
                  Drag and drop a CSV file here, or
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Browse files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleBrowse}
                />
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <div>
              <p className="text-sm text-slate-400 mb-3">
                Previewing 5 of {preview.total_rows} rows from <span className="text-white font-medium">{file?.name}</span>
              </p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {preview.headers.map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview_rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        {preview.headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-slate-300 max-w-[150px] truncate" title={row[h] || ''}>
                            {row[h] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { reset() }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                >
                  Next: Map Columns
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Column Mapping */}
          {step === 'mapping' && preview && (
            <div>
              <p className="text-sm text-slate-400 mb-4">
                Map your CSV columns to the expected expert fields.
              </p>
              <div className="space-y-3 mb-5">
                {EXPECTED_FIELDS.map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <label className="text-sm text-slate-300 w-32 flex-shrink-0">{field}</label>
                    <select
                      value={columnMap[field] || ''}
                      onChange={(e) =>
                        setColumnMap((m) => ({ ...m, [field]: e.target.value }))
                      }
                      className="flex-1 bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">-- Select column --</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                >
                  Import
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Importing experts...</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && importResult && (
            <div className="text-center py-6">
              <svg className="w-12 h-12 mx-auto text-emerald-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-white font-semibold mb-2">Import Complete</p>
              <p className="text-sm text-slate-400 mb-1">
                {importResult.inserted} added, {importResult.updated} updated, {importResult.skipped} skipped
              </p>
              <p className="text-xs text-slate-500 mb-4">FAISS rebuild started in background</p>
              <button
                onClick={() => {
                  onImportComplete()
                  reset()
                  onClose()
                }}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Error state */}
          {step === 'error' && (
            <div className="text-center py-6">
              <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-white font-semibold mb-2">Import Error</p>
              <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
              <button
                onClick={reset}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
