import { useState, useMemo } from 'react'
import { useAdminLeads, useNewsletterSubscribers, useLeadTimeline } from '../hooks/useAdminData'
import type { LeadRow } from '../types'
import { AdminCard } from '../components/AdminCard'
import { AdminPageHeader } from '../components/AdminPageHeader'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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

function formatGap(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} minutes later`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} later`
  const days = Math.floor(hrs / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} later`
}

export default function LeadsPage() {
  const { data, loading, error } = useAdminLeads()
  const { data: nltrData, loading: nltrLoading } = useNewsletterSubscribers()

  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const timeline = useLeadTimeline(expandedEmail)

  // Sort state for click_count column
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedLeads = useMemo(() => {
    if (!data?.leads) return []
    if (sortField !== 'click_count') return data.leads
    return [...data.leads].sort((a, b) =>
      sortDir === 'desc' ? b.click_count - a.click_count : a.click_count - b.click_count
    )
  }, [data?.leads, sortField, sortDir])

  function handleRowExpand(email: string) {
    setExpandedEmail(prev => prev === email ? null : email)
  }

  function formatDate(iso: string | null) {
    if (!iso) return '\u2014'
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  function formatDateShort(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  }

  function downloadLeadsCsv() {
    const adminToken = sessionStorage.getItem('admin_token') || ''
    fetch(`${API_URL}/api/admin/export/leads.csv`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  function downloadNewsletterCsv() {
    const adminToken = sessionStorage.getItem('admin_token') || ''
    fetch(`${API_URL}/api/admin/export/newsletter.csv`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  return (
    <div className="p-8 space-y-6">
      <AdminPageHeader
        title="Leads"
        subtitle="All users grouped by email with search history and gap activity"
        action={
          <button
            onClick={downloadLeadsCsv}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Export CSV
          </button>
        }
      />

      {/* Leads (newsletter signups) section */}
      <AdminCard className="overflow-hidden">
        {/* Header row */}
        <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Leads</span>
            <span className="text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded-full">
              {nltrData?.count ?? 0} {(nltrData?.count ?? 0) === 1 ? 'lead' : 'leads'}
            </span>
          </div>
          <button
            onClick={downloadNewsletterCsv}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600 px-3 py-1.5 rounded transition-colors"
          >
            Export CSV
          </button>
        </div>

        {/* Lead list */}
        {nltrLoading ? (
          <p className="px-5 py-4 text-slate-500 text-sm animate-pulse">Loading leads...</p>
        ) : !nltrData || nltrData.subscribers.length === 0 ? (
          <p className="px-5 py-4 text-slate-600 text-sm">No leads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Signed Up
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {nltrData.subscribers.map((sub) => (
                  <tr key={sub.email} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                    <td className="px-5 py-3 text-white font-medium">{sub.email}</td>
                    <td className="px-5 py-3 text-slate-400">{formatDateShort(sub.created_at)}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{sub.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Existing leads section */}
      {loading && <p className="text-slate-500 text-sm animate-pulse">Loading leads...</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}

      {data && (
        <AdminCard className="overflow-hidden">
          {/* Summary row */}
          <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/60 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {data.leads.length} unique {data.leads.length === 1 ? 'user' : 'users'}
            </span>
            <span className="text-xs text-slate-600">Click a row to expand journey timeline</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Searches
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Gaps
                  </th>
                  <th
                    className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300 transition-colors"
                    onClick={() => toggleSort('click_count')}
                  >
                    Clicks {sortField === 'click_count' && (sortDir === 'desc' ? '\u2193' : '\u2191')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLeads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      No leads yet
                    </td>
                  </tr>
                )}
                {sortedLeads.map((lead: LeadRow) => (
                    <>
                      <tr
                        key={lead.email}
                        onClick={() => handleRowExpand(lead.email)}
                        className="border-b border-slate-700/40 cursor-pointer transition-colors hover:bg-slate-700/20"
                      >
                        <td className="px-5 py-3 text-white font-medium">
                          <div className="flex items-center gap-2">
                            <svg
                              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                                expandedEmail === lead.email ? 'rotate-90' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            {lead.email}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-300">{lead.total_searches}</td>
                        <td className="px-5 py-3 text-slate-400">{formatDate(lead.last_search_at)}</td>
                        <td className="px-5 py-3 text-right">
                          {lead.gap_count > 0 ? (
                            <span className="text-red-400 font-medium">{lead.gap_count}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {lead.click_count > 0 ? (
                            <span className="bg-purple-900/30 text-purple-400 font-medium px-2 py-0.5 rounded text-xs">
                              {lead.click_count}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded row — chronological timeline */}
                      {expandedEmail === lead.email && (
                        <tr key={`${lead.email}-expanded`} className="border-b border-slate-700/40">
                          <td colSpan={5} className="px-5 py-4 bg-slate-900/30">
                            {timeline.loading && !timeline.data ? (
                              <p className="text-sm text-slate-500 animate-pulse">Loading timeline...</p>
                            ) : timeline.error ? (
                              <p className="text-sm text-red-400">Error loading timeline</p>
                            ) : !timeline.data || timeline.data.events.length === 0 ? (
                              <p className="text-sm text-slate-600">No activity recorded</p>
                            ) : (
                              <div className="space-y-0">
                                {/* Timeline header */}
                                <p className="text-xs text-slate-500 mb-3">
                                  Journey timeline — {timeline.data.total} events
                                </p>

                                {/* Timeline events */}
                                <div className="relative pl-6 border-l-2 border-slate-700/60 space-y-0">
                                  {timeline.data.events.map((event, i, arr) => {
                                    // Time gap calculation — compare with PREVIOUS event (above = newer)
                                    const prevEvent = i > 0 ? arr[i - 1] : null
                                    const gapMs = prevEvent
                                      ? new Date(prevEvent.created_at).getTime() - new Date(event.created_at).getTime()
                                      : 0
                                    const showGap = gapMs >= 30 * 60 * 1000 // 30+ minutes
                                    const isLongGap = gapMs >= 24 * 60 * 60 * 1000 // 1+ day

                                    return (
                                      <div key={i}>
                                        {/* Gap label between events */}
                                        {showGap && (
                                          <div className={`flex items-center gap-2 py-2 -ml-6 pl-6 ${isLongGap ? 'border-t border-b border-slate-600/40 bg-slate-800/30 my-1' : 'my-1'}`}>
                                            <span className={`text-xs ${isLongGap ? 'text-amber-400/80 font-medium' : 'text-slate-500'}`}>
                                              {formatGap(gapMs)}
                                            </span>
                                          </div>
                                        )}

                                        {/* Event node */}
                                        <div className="relative flex items-start gap-3 py-2">
                                          {/* Timeline dot */}
                                          <div className={`absolute -left-[25px] top-3 w-2.5 h-2.5 rounded-full border-2 ${
                                            event.type === 'search'
                                              ? 'bg-blue-500/80 border-blue-400'
                                              : 'bg-purple-500/80 border-purple-400'
                                          }`} />

                                          {/* Event content */}
                                          <div className="flex-1 min-w-0">
                                            {event.type === 'search' ? (
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {/* Search icon */}
                                                <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <span className="text-sm text-slate-200">{event.query}</span>
                                                <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded">
                                                  {event.result_count} {event.result_count === 1 ? 'result' : 'results'}
                                                </span>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {/* Click/cursor icon */}
                                                <svg className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                                </svg>
                                                <a
                                                  href={`/admin/experts?search=${encodeURIComponent(event.expert_username)}`}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-sm font-medium text-purple-300 hover:text-purple-200 hover:underline"
                                                >{event.expert_name}</a>
                                                {event.search_query && (
                                                  <span className="text-xs bg-slate-800 border border-slate-700 text-slate-500 px-2 py-0.5 rounded truncate max-w-[200px]">
                                                    from: {event.search_query}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>

                                          {/* Timestamp — relative with exact on hover */}
                                          <span
                                            className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap"
                                            title={new Date(event.created_at).toLocaleString()}
                                          >
                                            {timeAgo(event.created_at)}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>

                                {/* Load earlier events button */}
                                {timeline.hasMore && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); timeline.loadMore() }}
                                    className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                  >
                                    {timeline.loading ? 'Loading...' : `Load earlier events (${timeline.data.total - timeline.data.events.length} more)`}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

    </div>
  )
}
