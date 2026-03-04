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

type Step =
  | 'idle'
  | 'preview'
  | 'mapping'
  | 'syncing-preview'
  | 'sync-review'
  | 'applying'
  | 'done'
  | 'error'

interface PreviewData {
  headers: string[]
  preview_rows: Record<string, string>[]
  total_rows: number
}

interface SyncExpertAdd {
  username: string
  first_name: string
  last_name: string
  job_title: string
}

interface FieldChange {
  old: string | number
  new: string | number
}

interface SyncExpertUpdate {
  username: string
  first_name: string
  last_name: string
  changes: Record<string, FieldChange>
  reactivate: boolean
}

interface SyncExpertDelete {
  username: string
  first_name: string
  last_name: string
  job_title: string
}

interface SyncPlan {
  to_add: SyncExpertAdd[]
  to_update: SyncExpertUpdate[]
  to_delete: SyncExpertDelete[]
  summary: {
    total_csv_rows: number
    total_db_experts: number
    adds: number
    updates: number
    deletes: number
    reactivations: number
  }
}

interface ImportResult {
  inserted: number
  updated: number
  deleted: number
  reactivated: number
  skipped: number
  rebuilding: boolean
}

// Helper: pretty-print a field attribute name
function prettyField(attr: string): string {
  const MAP: Record<string, string> = {
    first_name: 'First Name',
    last_name: 'Last Name',
    job_title: 'Job Title',
    company: 'Company',
    bio: 'Bio',
    hourly_rate: 'Hourly Rate',
    currency: 'Currency',
    profile_url: 'Profile URL',
    profile_url_utm: 'Profile URL (UTM)',
    photo_url: 'Photo URL',
  }
  return MAP[attr] ?? attr
}

// Collapsible section component
function Section({
  title,
  count,
  accentClass,
  icon,
  badge,
  defaultOpen,
  children,
}: {
  title: string
  count: number
  accentClass: string
  icon: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? count > 0)
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors text-left"
      >
        <span className={accentClass}>{icon}</span>
        <span className="text-sm font-medium text-white flex-1">
          {count} {title}
        </span>
        {badge}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="bg-slate-900/50 px-4 py-3 space-y-2">{children}</div>}
    </div>
  )
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
  const [syncPlan, setSyncPlan] = useState<SyncPlan | null>(null)
  const [skipDeletes, setSkipDeletes] = useState<Set<string>>(new Set())
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('idle')
    setFile(null)
    setPreview(null)
    setColumnMap({})
    setSyncPlan(null)
    setSkipDeletes(new Set())
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
        headers: { Authorization: `Bearer ${getAdminToken()}` },
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

  // Called from the mapping step — replaces old handleImport
  const handleSyncPreview = useCallback(async () => {
    if (!file) return
    setStep('syncing-preview')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('column_mapping', JSON.stringify(columnMap))
      const res = await fetch(`${API_URL}/api/admin/experts/sync-preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAdminToken()}` },
        body: fd,
      })
      if (!res.ok) throw new Error(`Sync preview failed: ${res.status}`)
      const plan: SyncPlan = await res.json()
      setSyncPlan(plan)
      setSkipDeletes(new Set())
      setStep('sync-review')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }, [file, columnMap])

  // Toggle a username in/out of the skip-delete set
  const toggleSkipDelete = useCallback((username: string) => {
    setSkipDeletes((prev) => {
      const next = new Set(prev)
      if (next.has(username)) {
        next.delete(username)
      } else {
        next.add(username)
      }
      return next
    })
  }, [])

  // Called from sync-review step
  const handleSyncApply = useCallback(async () => {
    if (!file) return
    setStep('applying')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('column_mapping', JSON.stringify(columnMap))
      fd.append('skip_deletes', JSON.stringify(Array.from(skipDeletes)))
      const res = await fetch(`${API_URL}/api/admin/experts/sync-apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAdminToken()}` },
        body: fd,
      })
      if (!res.ok) throw new Error(`Sync apply failed: ${res.status}`)
      const result: ImportResult = await res.json()
      setImportResult(result)
      setStep('done')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }, [file, columnMap, skipDeletes])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <h2 className="text-lg font-semibold text-white">Import Experts CSV</h2>
          <button
            onClick={() => {
              reset()
              onClose()
            }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
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
                <svg
                  className="w-10 h-10 mx-auto text-slate-500 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
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
                Previewing 5 of {preview.total_rows} rows from{' '}
                <span className="text-white font-medium">{file?.name}</span>
              </p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {preview.headers.map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview_rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        {preview.headers.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-2 text-slate-300 max-w-[150px] truncate"
                            title={row[h] || ''}
                          >
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
                  onClick={() => reset()}
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
                    <label className="text-sm text-slate-300 w-32 flex-shrink-0">
                      {field}
                    </label>
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
                  onClick={handleSyncPreview}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                >
                  Preview Sync
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Syncing-preview spinner */}
          {step === 'syncing-preview' && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Analyzing sync changes...</p>
            </div>
          )}

          {/* Step 5: Sync Review */}
          {step === 'sync-review' && syncPlan && (
            <div>
              <p className="text-sm text-slate-400 mb-4">
                Review the changes that will be applied to the expert database.
              </p>

              <div className="space-y-3 mb-5">
                {/* Section 1: Additions */}
                <Section
                  title="expert(s) to add"
                  count={syncPlan.to_add.length}
                  accentClass="text-emerald-400"
                  defaultOpen={syncPlan.to_add.length > 0}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  }
                >
                  {syncPlan.to_add.length === 0 ? (
                    <p className="text-xs text-slate-500">No new experts to add.</p>
                  ) : (
                    syncPlan.to_add.map((e) => (
                      <div key={e.username} className="text-xs text-slate-300">
                        <span className="font-medium text-white">
                          {e.first_name} {e.last_name}
                        </span>
                        {e.job_title && (
                          <span className="text-slate-500"> — {e.job_title}</span>
                        )}
                      </div>
                    ))
                  )}
                </Section>

                {/* Section 2: Updates */}
                <Section
                  title="expert(s) to update"
                  count={syncPlan.to_update.length}
                  accentClass="text-blue-400"
                  defaultOpen={syncPlan.to_update.length > 0}
                  badge={
                    syncPlan.summary.reactivations > 0 ? (
                      <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                        {syncPlan.summary.reactivations} reactivation
                        {syncPlan.summary.reactivations > 1 ? 's' : ''}
                      </span>
                    ) : undefined
                  }
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  }
                >
                  {syncPlan.to_update.length === 0 ? (
                    <p className="text-xs text-slate-500">No experts to update.</p>
                  ) : (
                    syncPlan.to_update.map((e) => (
                      <div key={e.username} className="text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white">
                            {e.first_name} {e.last_name}
                          </span>
                          {e.reactivate && (
                            <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">
                              Reactivating
                            </span>
                          )}
                        </div>
                        {Object.entries(e.changes).length > 0 && (
                          <div className="ml-3 space-y-0.5">
                            <p className="text-slate-500 text-xs mb-0.5">Changes:</p>
                            {Object.entries(e.changes).map(([field, diff]) => (
                              <div key={field} className="text-slate-400">
                                <span className="text-slate-500">{prettyField(field)}:</span>{' '}
                                <span className="line-through text-slate-600">
                                  {String(diff.old).substring(0, 40)}
                                  {String(diff.old).length > 40 ? '…' : ''}
                                </span>{' '}
                                <span className="text-slate-300">
                                  {String(diff.new).substring(0, 40)}
                                  {String(diff.new).length > 40 ? '…' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </Section>

                {/* Section 3: Deletions (with checkboxes) */}
                <Section
                  title="expert(s) to remove"
                  count={syncPlan.to_delete.length}
                  accentClass="text-red-400"
                  defaultOpen={syncPlan.to_delete.length > 0}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  }
                >
                  {syncPlan.to_delete.length === 0 ? (
                    <p className="text-xs text-slate-500">No experts to remove.</p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 mb-2">
                        Uncheck to keep an expert active (they won't be soft-deleted).
                      </p>
                      {syncPlan.to_delete.map((e) => (
                        <label
                          key={e.username}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={!skipDeletes.has(e.username)}
                            onChange={() => toggleSkipDelete(e.username)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 accent-purple-500 cursor-pointer"
                          />
                          <span
                            className={`text-xs transition-colors ${
                              skipDeletes.has(e.username)
                                ? 'text-slate-600 line-through'
                                : 'text-slate-300'
                            }`}
                          >
                            <span className="font-medium">
                              {e.first_name} {e.last_name}
                            </span>
                            {e.job_title && (
                              <span className="text-slate-500"> — {e.job_title}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </Section>
              </div>

              {/* Summary bar */}
              <div className="bg-slate-900 rounded-lg px-4 py-3 mb-4 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <span className="text-emerald-400 font-semibold">{syncPlan.to_add.length}</span> adds
                </span>
                <span>
                  <span className="text-blue-400 font-semibold">{syncPlan.to_update.length}</span> updates
                </span>
                <span>
                  <span className="text-red-400 font-semibold">
                    {syncPlan.to_delete.length - skipDeletes.size}
                  </span>{' '}
                  removals
                  {skipDeletes.size > 0 && (
                    <span className="text-slate-500 ml-1">
                      ({skipDeletes.size} expert{skipDeletes.size > 1 ? 's' : ''} kept)
                    </span>
                  )}
                </span>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSyncApply}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                >
                  Apply Sync
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Applying spinner */}
          {step === 'applying' && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Applying sync...</p>
            </div>
          )}

          {/* Step 7: Done */}
          {step === 'done' && importResult && (
            <div className="text-center py-6">
              <svg
                className="w-12 h-12 mx-auto text-emerald-400 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-white font-semibold mb-3">Sync Complete</p>
              <div className="flex justify-center gap-6 mb-3 text-sm">
                <div className="text-center">
                  <p className="text-emerald-400 font-bold text-lg">{importResult.inserted}</p>
                  <p className="text-slate-500 text-xs">added</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-400 font-bold text-lg">{importResult.updated}</p>
                  <p className="text-slate-500 text-xs">updated</p>
                </div>
                <div className="text-center">
                  <p className="text-red-400 font-bold text-lg">{importResult.deleted}</p>
                  <p className="text-slate-500 text-xs">removed</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-400 font-bold text-lg">{importResult.reactivated}</p>
                  <p className="text-slate-500 text-xs">reactivated</p>
                </div>
              </div>
              {importResult.rebuilding && (
                <p className="text-xs text-slate-500 mb-4">
                  FAISS rebuild started in background
                </p>
              )}
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
              <svg
                className="w-12 h-12 mx-auto text-red-400 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <p className="text-white font-semibold mb-2">Error</p>
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
