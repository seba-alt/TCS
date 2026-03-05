import { useState, useEffect, useCallback, useRef } from 'react'
import { useAdminExpertsPaginated, useAdminDomainMap, useIngestStatus, adminPost, adminFetch, adminDelete } from '../hooks/useAdminData'
import CsvImportModal from '../components/CsvImportModal'
import type { ExpertRow, DomainMapEntry, LeadClicksByExpertResponse } from '../types'
import { AdminInput } from '../components/AdminInput'
import { AdminCard } from '../components/AdminCard'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminPagination } from '../components/AdminPagination'

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreZone(score: number | null | undefined): 'red' | 'yellow' | 'green' | 'none' {
  if (score === null || score === undefined) return 'none'
  if (score < 40) return 'red'
  if (score < 70) return 'yellow'
  return 'green'
}

const ZONE_STYLES: Record<string, string> = {
  red:    'bg-red-500/20 text-red-400 border border-red-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  green:  'bg-green-500/20 text-green-400 border border-green-500/30',
  none:   'bg-slate-700/40 text-slate-500 border border-transparent',
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null | undefined }) {
  const zone = scoreZone(score)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ZONE_STYLES[zone]}`}>
      {score !== null && score !== undefined ? Math.round(score) : '\u2014'}
    </span>
  )
}

function TagPills({ tags }: { tags: string[] }) {
  const visible = tags.slice(0, 2)
  const remaining = tags.length - visible.length
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map(tag => (
        <span key={tag} className="px-1.5 py-0.5 bg-slate-700/60 text-slate-300 text-xs rounded-md border border-slate-600/40 whitespace-nowrap">
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-slate-500">+{remaining}</span>
      )}
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────


interface AddFormState {
  first_name: string
  last_name: string
  username: string
  job_title: string
  company: string
  bio: string
  hourly_rate: string
  profile_url: string
}

const EMPTY_FORM: AddFormState = {
  first_name: '',
  last_name: '',
  username: '',
  job_title: '',
  company: '',
  bio: '',
  hourly_rate: '',
  profile_url: '',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExpertsPage() {
  // Server-side pagination state
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Debounce: apply search 300ms after input stops
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(0)
    }, 300)
  }, [])

  const { data, loading, error, refetch } = useAdminExpertsPaginated(page, search)
  const { data: domainData, loading: domainLoading, fetchData: fetchDomainMap } = useAdminDomainMap()
  const { ingest, triggerRun } = useIngestStatus()

  // Auto-classify state
  const [autoClassifying, setAutoClassifying] = useState(false)
  const [autoResult, setAutoResult] = useState<string | null>(null)

  // CSV import modal state
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Add expert form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Domain-map state
  const [showDomainMap, setShowDomainMap] = useState(false)

  // Lead clicks per-expert state
  const [expandedUsername, setExpandedUsername] = useState<string | null>(null)
  const [clickData, setClickData] = useState<Record<string, LeadClicksByExpertResponse['clicks']>>({})
  const [clicksLoading, setClicksLoading] = useState<Record<string, boolean>>({})

  // Expert deletion state
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk'; username?: string; name?: string; count?: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [rebuildNotice, setRebuildNotice] = useState<string | null>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAutoClassify() {
    setAutoClassifying(true)
    setAutoResult(null)
    try {
      // 1. Instant keyword-based category classification
      const res = await adminPost<{ classified: number; categories: Record<string, string> }>(
        '/experts/auto-classify',
        {},
      )
      setAutoResult(`Classified ${res.classified} expert${res.classified !== 1 ? 's' : ''} — tagging in background…`)
      refetch()
      // 2. Kick off background AI tagging + scoring (tag_experts.py)
      await triggerRun('/experts/tag-all')
    } catch (err) {
      setAutoResult(`Error: ${err}`)
    } finally {
      setAutoClassifying(false)
    }
  }

  async function handleAddExpert(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await adminPost('/experts', {
        ...form,
        hourly_rate: parseFloat(form.hourly_rate) || 0,
        profile_url: form.profile_url || undefined,
      })
      setForm(EMPTY_FORM)
      setShowAddForm(false)
      refetch()
    } catch (err) {
      setFormError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true)
    try {
      if (deleteConfirm?.type === 'single' && deleteConfirm.username) {
        await adminDelete(`/experts/${deleteConfirm.username}`)
      } else if (deleteConfirm?.type === 'bulk') {
        await adminPost('/experts/delete-bulk', {
          usernames: Array.from(selectedUsernames),
        })
      }
      setDeleteConfirm(null)
      setSelectedUsernames(new Set())
      setRebuildNotice('FAISS index is rebuilding in the background...')
      refetch()
      setTimeout(() => setRebuildNotice(null), 10000)
    } catch (err) {
      alert(`Delete failed: ${err}`)
    } finally {
      setDeleting(false)
    }
  }

  function handleToggleSelect(username: string) {
    setSelectedUsernames(prev => {
      const next = new Set(prev)
      if (next.has(username)) {
        next.delete(username)
      } else {
        next.add(username)
      }
      return next
    })
  }

  function handleToggleSelectAll() {
    if (selectedUsernames.size === pageData.length) {
      setSelectedUsernames(new Set())
    } else {
      setSelectedUsernames(new Set(pageData.map(e => e.username)))
    }
  }

  const handleToggleDomainMap = useCallback(() => {
    setShowDomainMap(v => !v)
    if (!domainData && !domainLoading) fetchDomainMap()
  }, [domainData, domainLoading, fetchDomainMap])

  async function handleExpandExpert(username: string) {
    if (expandedUsername === username) {
      setExpandedUsername(null)
      return
    }
    setExpandedUsername(username)
    if (!(username in clickData)) {
      setClicksLoading(prev => ({ ...prev, [username]: true }))
      try {
        const res = await adminFetch<LeadClicksByExpertResponse>(`/lead-clicks/by-expert/${username}`)
        setClickData(prev => ({ ...prev, [username]: res.clicks }))
      } catch {
        setClickData(prev => ({ ...prev, [username]: [] }))
      } finally {
        setClicksLoading(prev => ({ ...prev, [username]: false }))
      }
    }
  }

  // Auto-refresh expert list when ingest completes
  useEffect(() => {
    if (ingest.status === 'done') refetch()
  }, [ingest.status, refetch])

  // Clear selection when page changes
  useEffect(() => { setSelectedUsernames(new Set()) }, [page, search])

  // ── Derived data ──────────────────────────────────────────────────────────

  const experts = data?.experts ?? []
  const pageData = experts

  // Update indeterminate state on select-all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = pageData.length > 0 && selectedUsernames.size === pageData.length
      const someSelected = selectedUsernames.size > 0 && selectedUsernames.size < pageData.length
      selectAllRef.current.indeterminate = someSelected
      selectAllRef.current.checked = allSelected
    }
  }, [selectedUsernames, pageData])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-6">
      <AdminPageHeader
        title="Experts"
        subtitle={
          data
            ? `Showing ${experts.length} of ${data.total} experts`
            : 'Loading experts…'
        }
        action={
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Expert
          </button>
        }
      />

      {/* Name search + actions row */}
      <div className="flex flex-wrap items-center gap-3">
        <AdminInput
          type="search"
          placeholder="Search experts by name..."
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          className="!w-72"
        />

        {searchInput && (
          <button
            onClick={() => { handleSearchChange(''); setSearchInput('') }}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear
          </button>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={handleAutoClassify}
            disabled={autoClassifying}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {autoClassifying ? 'Classifying…' : 'Auto-classify all'}
          </button>
          {autoResult && <span className="text-sm text-slate-400">{autoResult}</span>}

          <button
            onClick={() => setImportModalOpen(true)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Import CSV
          </button>

          {selectedUsernames.size > 0 && (
            <button
              onClick={() => setDeleteConfirm({ type: 'bulk', count: selectedUsernames.size })}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg border border-red-500/30 transition-colors"
            >
              Delete selected ({selectedUsernames.size})
            </button>
          )}
        </div>
      </div>

      {/* FAISS rebuild notice */}
      {rebuildNotice && (
        <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg px-4 py-2 text-sm text-amber-300">
          {rebuildNotice}
        </div>
      )}

      {/* Add Expert form */}
      {showAddForm && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Add New Expert</h2>
          <form onSubmit={handleAddExpert} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'first_name', label: 'First Name', required: true },
              { key: 'last_name', label: 'Last Name', required: true },
              { key: 'username', label: 'Username', required: true },
              { key: 'job_title', label: 'Job Title', required: true },
              { key: 'company', label: 'Company', required: true },
              { key: 'hourly_rate', label: 'Hourly Rate (€)', required: true, type: 'number' },
            ].map(({ key, label, required, type }) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  type={type ?? 'text'}
                  value={form[key as keyof AddFormState]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required={required}
                  className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Profile URL (optional)</label>
              <input
                type="url"
                value={form.profile_url}
                onChange={e => setForm(f => ({ ...f, profile_url: e.target.value }))}
                placeholder="https://tinrate.com/u/username"
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                required
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
            {formError && (
              <div className="sm:col-span-2 text-red-400 text-sm">{formError}</div>
            )}
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {submitting ? 'Generating tags...' : 'Add Expert'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); setFormError(null) }}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expert table */}
      {loading && <p className="text-slate-500 text-sm animate-pulse">Loading experts…</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}

      {data && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="w-8 px-2 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-600 bg-slate-900 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="w-8 px-2 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Link</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageData.map((expert: ExpertRow) => (
                  <>
                    <tr
                      key={expert.username}
                      className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUsernames.has(expert.username)}
                          onChange={() => handleToggleSelect(expert.username)}
                          className="rounded border-slate-600 bg-slate-900 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => handleExpandExpert(expert.username)}
                          className="text-slate-500 hover:text-slate-300 transition-colors"
                          title="View lead clicks"
                          aria-label={`${expandedUsername === expert.username ? 'Hide' : 'Show'} lead clicks for ${expert.first_name} ${expert.last_name}`}
                        >
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedUsername === expert.username ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-200 font-medium whitespace-nowrap">
                        {expert.first_name} {expert.last_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs">
                        <span title={expert.bio || ''}>
                          {expert.bio ? (expert.bio.length > 120 ? expert.bio.slice(0, 120) + '…' : expert.bio) : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <TagPills tags={expert.tags || []} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-[120px] truncate" title={expert.company || ''}>
                        {expert.company || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {expert.profile_url && (
                          <a
                            href={expert.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-200 transition-colors"
                            title={expert.profile_url}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={expert.findability_score} />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => setDeleteConfirm({ type: 'single', username: expert.username, name: `${expert.first_name} ${expert.last_name}` })}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                          title={`Delete ${expert.first_name} ${expert.last_name}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {/* Lead clicks expanded row */}
                    {expandedUsername === expert.username && (
                      <tr key={`${expert.username}-clicks`} className="border-b border-slate-800/60">
                        <td colSpan={9} className="px-6 py-4 bg-slate-900/40">
                          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Lead Clicks</h4>
                          {clicksLoading[expert.username] ? (
                            <p className="text-sm text-slate-500 animate-pulse">Loading lead clicks…</p>
                          ) : (clickData[expert.username] ?? []).length === 0 ? (
                            <p className="text-sm text-slate-600">No lead clicks recorded</p>
                          ) : (
                            <div className="space-y-2">
                              {(clickData[expert.username] ?? []).map((click, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                  <span className="font-medium text-slate-200">{click.email}</span>
                                  {click.search_query && (
                                    <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400">
                                      {click.search_query}
                                    </span>
                                  )}
                                  <span className="text-slate-500 text-xs ml-auto">{timeAgo(click.created_at)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {pageData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">
                      {search ? `No experts match "${search}".` : 'No experts found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-800">
            <AdminPagination
              page={data?.page ?? 0}
              totalPages={data?.total_pages ?? 0}
              onPageChange={setPage}
            />
          </div>
        </AdminCard>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={() => refetch()}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Confirm Deletion</h3>
            <p className="text-sm text-slate-300 mb-6">
              {deleteConfirm.type === 'single'
                ? `Delete ${deleteConfirm.name ?? deleteConfirm.username}? This cannot be undone.`
                : `Delete ${deleteConfirm.count} expert${deleteConfirm.count !== 1 ? 's' : ''}? This cannot be undone.`
              }
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domain-map section */}
      {data && (
        <div className="mt-4">
          <button
            onClick={handleToggleDomainMap}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors font-medium"
          >
            <span>{showDomainMap ? '\u25BC' : '\u25BA'}</span>
            Domain Map — Top downvoted expert domains
          </button>

          {showDomainMap && (
            <div className="mt-3 bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
              {domainLoading && (
                <p className="text-sm text-slate-500">Loading domain map...</p>
              )}
              {!domainLoading && domainData && domainData.domains.length === 0 && (
                <p className="text-sm text-slate-500">No downvoted results recorded yet.</p>
              )}
              {!domainLoading && domainData && domainData.domains.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-3">
                    Showing top {domainData.domains.length} domains by downvote count.
                  </p>
                  <div className="space-y-1.5">
                    {domainData.domains.map((d: DomainMapEntry) => (
                      <div
                        key={d.domain}
                        className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-sm text-slate-300"
                      >
                        <span className="capitalize">{d.domain}</span>
                        <span className="text-xs text-slate-500 ml-4">{d.count} downvote{d.count !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
