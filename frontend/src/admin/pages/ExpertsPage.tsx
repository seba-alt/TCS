import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAdminExperts, useAdminDomainMap, useIngestStatus, adminPost, adminFetch } from '../hooks/useAdminData'
import CsvImportModal from '../components/CsvImportModal'
import type { ExpertRow, DomainMapEntry, LeadClicksByExpertResponse } from '../types'

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

function SortHeader({ col, label, current, dir, onClick }: {
  col: string; label: string; current: string; dir: 'asc' | 'desc'; onClick: (col: string) => void
}) {
  const active = current === col
  return (
    <th
      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300"
      onClick={() => onClick(col)}
    >
      {label}
      {active && <span className="ml-1 opacity-70">{dir === 'asc' ? '\u2191' : '\u2193'}</span>}
    </th>
  )
}

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
  const { data, loading, error, refetch } = useAdminExperts()
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

  // Sort/filter/pagination state
  const [sortCol, setSortCol] = useState<string>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [zoneFilter, setZoneFilter] = useState<'red' | 'yellow' | 'green' | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [hideNoBio, setHideNoBio] = useState(false)
  const [pageIdx, setPageIdx] = useState(0)

  // Domain-map state
  const [showDomainMap, setShowDomainMap] = useState(false)

  // Lead clicks per-expert state
  const [expandedUsername, setExpandedUsername] = useState<string | null>(null)
  const [clickData, setClickData] = useState<Record<string, LeadClicksByExpertResponse['clicks']>>({})
  const [clicksLoading, setClicksLoading] = useState<Record<string, boolean>>({})

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

  const handleSort = useCallback((col: string) => {
    if (col === sortCol) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }, [sortCol])

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

  // handleCsvUpload replaced by CsvImportModal

  // Auto-refresh expert list when ingest completes
  useEffect(() => {
    if (ingest.status === 'done') refetch()
  }, [ingest.status, refetch])

  // ── Derived data ──────────────────────────────────────────────────────────

  const experts = data?.experts ?? []

  const sorted = useMemo(() => {
    return [...experts].sort((a, b) => {
      if (sortCol === 'score') {
        const aScore = a.findability_score ?? -1
        const bScore = b.findability_score ?? -1
        return sortDir === 'asc' ? aScore - bScore : bScore - aScore
      }
      if (sortCol === 'name') {
        const aName = `${a.first_name} ${a.last_name}`.toLowerCase()
        const bName = `${b.first_name} ${b.last_name}`.toLowerCase()
        return sortDir === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName)
      }
      if (sortCol === 'company') {
        const aC = (a.company || '').toLowerCase()
        const bC = (b.company || '').toLowerCase()
        return sortDir === 'asc' ? aC.localeCompare(bC) : bC.localeCompare(aC)
      }
      return 0
    })
  }, [experts, sortCol, sortDir])

  const filtered = useMemo(() => {
    let result = sorted
    // Always hide experts with no name
    result = result.filter(e => (e.first_name || '').trim() || (e.last_name || '').trim())
    if (hideNoBio) result = result.filter(e => (e.bio || '').trim())
    if (zoneFilter) result = result.filter(e => scoreZone(e.findability_score) === zoneFilter)
    if (tagFilter) result = result.filter(e => e.tags?.includes(tagFilter))
    return result
  }, [sorted, hideNoBio, zoneFilter, tagFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / 50))
  const pageData = filtered.slice(pageIdx * 50, (pageIdx + 1) * 50)

  // Reset page on filter/sort change
  useEffect(() => { setPageIdx(0) }, [hideNoBio, zoneFilter, tagFilter, sortCol, sortDir])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Experts</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage expert profiles, classification, and add new experts
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleAutoClassify}
          disabled={autoClassifying}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {autoClassifying ? 'Classifying…' : 'Auto-classify all'}
        </button>
        {autoResult && <span className="text-sm text-slate-400">{autoResult}</span>}

        {/* CSV Import button */}
        <button
          onClick={() => setImportModalOpen(true)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Import CSV
        </button>

        {/* Zone filter */}
        <div className="flex gap-1">
          {(['red', 'yellow', 'green'] as const).map(zone => (
            <button
              key={zone}
              onClick={() => setZoneFilter(zoneFilter === zone ? null : zone)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                zoneFilter === zone
                  ? zone === 'red'    ? 'bg-slate-800 border-red-500/50 text-red-400'
                  : zone === 'yellow' ? 'bg-slate-800 border-yellow-500/50 text-yellow-400'
                  :                     'bg-slate-800 border-green-500/50 text-green-400'
                  : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-400'
              }`}
            >
              {zone.charAt(0).toUpperCase() + zone.slice(1)}
            </button>
          ))}
          {(zoneFilter || tagFilter) && (
            <button
              onClick={() => { setZoneFilter(null); setTagFilter(null) }}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Hide no-bio toggle */}
        <button
          onClick={() => setHideNoBio(v => !v)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            hideNoBio
              ? 'bg-slate-800 border-slate-400/50 text-slate-200'
              : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-400'
          }`}
        >
          {hideNoBio ? 'Showing with bio' : 'Hide no bio'}
        </button>

        {tagFilter && (
          <span className="text-xs text-slate-400">
            Filtered by tag: <span className="text-slate-200 font-medium">{tagFilter}</span>
          </span>
        )}

        <div className="ml-auto">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Expert
          </button>
        </div>
      </div>

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
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="w-8 px-2 py-3" />
                  <SortHeader col="name"    label="Name"    current={sortCol} dir={sortDir} onClick={handleSort} />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</th>
                  <SortHeader col="company" label="Company" current={sortCol} dir={sortDir} onClick={handleSort} />
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Link</th>
                  <SortHeader col="score"   label="Score"   current={sortCol} dir={sortDir} onClick={handleSort} />
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
                        {expert.company || '—'}
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
                    </tr>

                    {/* Lead clicks expanded row */}
                    {expandedUsername === expert.username && (
                      <tr key={`${expert.username}-clicks`} className="border-b border-slate-800/60">
                        <td colSpan={7} className="px-6 py-4 bg-slate-900/40">
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
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                      {filtered.length === 0 ? 'No experts match the current filters.' : 'Loading experts...'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <span className="text-sm text-slate-500">{filtered.length} expert{filtered.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <button
                disabled={pageIdx === 0}
                onClick={() => setPageIdx(p => p - 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Prev
              </button>
              <span>Page {pageIdx + 1} of {totalPages}</span>
              <button
                disabled={pageIdx >= totalPages - 1}
                onClick={() => setPageIdx(p => p + 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={() => refetch()}
      />

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
                    Click a domain to filter the expert table. Showing top {domainData.domains.length} domains by downvote count.
                  </p>
                  <div className="space-y-1.5">
                    {domainData.domains.map((d: DomainMapEntry) => (
                      <button
                        key={d.domain}
                        onClick={() => setTagFilter(tagFilter === d.domain ? null : d.domain)}
                        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                          tagFilter === d.domain
                            ? 'bg-slate-700 text-slate-200'
                            : 'hover:bg-slate-700/50 text-slate-300'
                        }`}
                      >
                        <span className="capitalize">{d.domain}</span>
                        <span className="text-xs text-slate-500 ml-4">{d.count} downvote{d.count !== 1 ? 's' : ''}</span>
                      </button>
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
