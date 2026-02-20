import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAdminLeads } from '../hooks/useAdminData'
import type { LeadRow } from '../types'

export default function LeadsPage() {
  const { data, loading, error } = useAdminLeads()
  const navigate = useNavigate()
  const location = useLocation()
  const highlightEmail: string = location.state?.email ?? ''

  const [expandedEmail, setExpandedEmail] = useState<string | null>(highlightEmail || null)
  const highlightRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (highlightEmail && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightEmail, data])

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leads</h1>
        <p className="text-slate-500 text-sm mt-1">
          All users grouped by email with search history and gap activity
        </p>
      </div>

      {loading && <p className="text-slate-500 text-sm animate-pulse">Loading leads…</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}

      {data && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          {/* Summary row */}
          <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/60 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {data.leads.length} unique {data.leads.length === 1 ? 'user' : 'users'}
            </span>
            <span className="text-xs text-slate-600">Click a row to expand queries</span>
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
                  return (
                    <>
                      <tr
                        key={lead.email}
                        ref={isHighlighted ? highlightRef : null}
                        onClick={() =>
                          setExpandedEmail(expandedEmail === lead.email ? null : lead.email)
                        }
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
                              navigate('/admin/searches', { state: { email: lead.email } })
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
