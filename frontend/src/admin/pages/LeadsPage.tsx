import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAdminLeads, useNewsletterSubscribers, adminFetch } from '../hooks/useAdminData'
import type { LeadRow, LeadClicksResponse, LeadClickEntry } from '../types'

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

export default function LeadsPage() {
  const { data, loading, error } = useAdminLeads()
  const { data: nltrData, loading: nltrLoading } = useNewsletterSubscribers()
  const navigate = useNavigate()
  const location = useLocation()
  const highlightEmail: string = location.state?.email ?? ''

  const [expandedEmail, setExpandedEmail] = useState<string | null>(highlightEmail || null)
  const highlightRef = useRef<HTMLTableRowElement | null>(null)

  // Lead clicks cache: email -> clicks array
  const [leadClicks, setLeadClicks] = useState<Record<string, LeadClickEntry[]>>({})
  const [clicksLoading, setClicksLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (highlightEmail && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightEmail, data])

  async function handleRowExpand(email: string) {
    const isExpanding = expandedEmail !== email
    setExpandedEmail(isExpanding ? email : null)

    // Lazy-load clicks on expand if not cached
    if (isExpanding && !(email in leadClicks)) {
      setClicksLoading(prev => ({ ...prev, [email]: true }))
      try {
        const clickData = await adminFetch<LeadClicksResponse>('/lead-clicks')
        const match = clickData.leads.find(l => l.email === email)
        setLeadClicks(prev => ({ ...prev, [email]: match?.clicks ?? [] }))
      } catch {
        setLeadClicks(prev => ({ ...prev, [email]: [] }))
      } finally {
        setClicksLoading(prev => ({ ...prev, [email]: false }))
      }
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-slate-500 text-sm mt-1">
            All users grouped by email with search history and gap activity
          </p>
        </div>
        <button
          onClick={downloadLeadsCsv}
          className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Newsletter Subscribers section */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Newsletter Subscribers</span>
            <span className="text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded-full">
              {nltrData?.count ?? 0} {(nltrData?.count ?? 0) === 1 ? 'subscriber' : 'subscribers'}
            </span>
          </div>
          <button
            onClick={downloadNewsletterCsv}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600 px-3 py-1.5 rounded transition-colors"
          >
            Export CSV
          </button>
        </div>

        {/* Subscriber list */}
        {nltrLoading ? (
          <p className="px-5 py-4 text-slate-500 text-sm animate-pulse">Loading subscribers…</p>
        ) : !nltrData || nltrData.subscribers.length === 0 ? (
          <p className="px-5 py-4 text-slate-600 text-sm">No subscribers yet.</p>
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
      </div>

      {/* Existing leads section */}
      {loading && <p className="text-slate-500 text-sm animate-pulse">Loading leads…</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}

      {data && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          {/* Summary row */}
          <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/60 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {data.leads.length} unique {data.leads.length === 1 ? 'user' : 'users'}
            </span>
            <span className="text-xs text-slate-600">Click a row to expand queries and clicks</span>
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
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.leads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      No leads yet
                    </td>
                  </tr>
                )}
                {data.leads.map((lead: LeadRow) => {
                  const isHighlighted = lead.email === highlightEmail
                  const clicks = leadClicks[lead.email] ?? []
                  const isLoadingClicks = clicksLoading[lead.email] ?? false
                  return (
                    <>
                      <tr
                        key={lead.email}
                        ref={isHighlighted ? highlightRef : null}
                        onClick={() => handleRowExpand(lead.email)}
                        className={`border-b border-slate-700/40 cursor-pointer transition-colors ${
                          isHighlighted
                            ? 'bg-purple-900/20 hover:bg-purple-900/30'
                            : 'hover:bg-slate-700/20'
                        }`}
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
                            {isHighlighted && (
                              <span className="text-xs bg-purple-900/50 text-purple-400 border border-purple-800/50 px-1.5 py-0.5 rounded">
                                from search
                              </span>
                            )}
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
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              navigate('/admin/data#searches', { state: { email: lead.email } })
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
                          >
                            Searches →
                          </button>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {expandedEmail === lead.email && (
                        <tr key={`${lead.email}-expanded`} className="border-b border-slate-700/40">
                          <td colSpan={5} className="px-5 py-3 bg-slate-900/30">
                            <div className="space-y-4">
                              {/* Recent queries section */}
                              <div>
                                <p className="text-xs text-slate-500 mb-2">Recent queries</p>
                                {lead.recent_queries.length === 0 ? (
                                  <p className="text-slate-600 text-xs">No queries recorded</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {lead.recent_queries.map((q, i) => (
                                      <span
                                        key={i}
                                        className="inline-block bg-slate-800 border border-slate-700 text-slate-300 text-xs px-3 py-1 rounded-full"
                                      >
                                        {q}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Expert Clicks section */}
                              <div>
                                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                  Expert Clicks
                                </h4>
                                {isLoadingClicks ? (
                                  <p className="text-sm text-slate-500 animate-pulse">Loading clicks…</p>
                                ) : clicks.length === 0 ? (
                                  <p className="text-sm text-slate-600">No expert clicks recorded</p>
                                ) : (
                                  <div className="space-y-2">
                                    {clicks.map((click, i) => (
                                      <div key={i} className="flex items-center gap-3 text-sm">
                                        <span className="font-medium text-slate-200">{click.expert_name}</span>
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
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
