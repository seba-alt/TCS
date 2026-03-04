import { useState } from 'react'
import { useNewsletterSubscribers, useLeadTimeline } from '../hooks/useAdminData'
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

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export default function LeadsPage() {
  const { data: nltrData, loading: nltrLoading } = useNewsletterSubscribers()
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const timeline = useLeadTimeline(expandedEmail)

  function downloadLeadsCsv() {
    const adminToken = sessionStorage.getItem('admin_token') || ''
    fetch(`${API_URL}/api/admin/export/newsletter.csv`, {
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

  function handleRowExpand(email: string) {
    setExpandedEmail(prev => prev === email ? null : email)
  }

  return (
    <div className="p-8 space-y-6">
      <AdminPageHeader
        title="Leads"
        subtitle="All lead signups with activity"
        action={
          <button
            onClick={downloadLeadsCsv}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Export CSV
          </button>
        }
      />

      <AdminCard className="overflow-hidden">
        <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Leads</span>
            <span className="text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded-full">
              {nltrData?.count ?? 0} {(nltrData?.count ?? 0) === 1 ? 'lead' : 'leads'}
            </span>
          </div>
          <span className="text-xs text-slate-600">Click a row to expand activity</span>
        </div>

        {nltrLoading ? (
          <p className="px-5 py-4 text-slate-500 text-sm animate-pulse">Loading leads...</p>
        ) : !nltrData || nltrData.subscribers.length === 0 ? (
          <p className="px-5 py-4 text-slate-600 text-sm">No leads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Signed Up</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {nltrData.subscribers.map((sub) => (
                  <>
                    <tr
                      key={sub.email}
                      onClick={() => handleRowExpand(sub.email)}
                      className="border-b border-slate-700/40 hover:bg-slate-700/20 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 text-white font-medium">
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expandedEmail === sub.email ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          {sub.email}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{formatDateShort(sub.created_at)}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{sub.source}</td>
                      <td className="px-5 py-3 text-right">
                        {sub.click_count > 0 ? (
                          <span className="bg-purple-900/30 text-purple-400 font-medium px-2 py-0.5 rounded text-xs">{sub.click_count}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                    </tr>

                    {expandedEmail === sub.email && (
                      <tr key={`${sub.email}-expanded`} className="border-b border-slate-700/40">
                        <td colSpan={4} className="px-5 py-4 bg-slate-900/30">
                          {timeline.loading && !timeline.data ? (
                            <p className="text-sm text-slate-500 animate-pulse">Loading activity...</p>
                          ) : timeline.error ? (
                            <p className="text-sm text-red-400">Error loading activity</p>
                          ) : !timeline.data || timeline.data.events.length === 0 ? (
                            <p className="text-sm text-slate-600">No activity recorded</p>
                          ) : (
                            <div className="space-y-0">
                              <p className="text-xs text-slate-500 mb-3">
                                Activity timeline — {timeline.data.total} events
                              </p>
                              <div className="relative pl-6 border-l-2 border-slate-700/60 space-y-0">
                                {timeline.data.events.map((event, i, arr) => {
                                  const prevEvent = i > 0 ? arr[i - 1] : null
                                  const gapMs = prevEvent
                                    ? new Date(prevEvent.created_at).getTime() - new Date(event.created_at).getTime()
                                    : 0
                                  const showGap = gapMs >= 30 * 60 * 1000
                                  const isLongGap = gapMs >= 24 * 60 * 60 * 1000

                                  return (
                                    <div key={i}>
                                      {showGap && (
                                        <div className={`flex items-center gap-2 py-2 -ml-6 pl-6 ${isLongGap ? 'border-t border-b border-slate-600/40 bg-slate-800/30 my-1' : 'my-1'}`}>
                                          <span className={`text-xs ${isLongGap ? 'text-amber-400/80 font-medium' : 'text-slate-500'}`}>
                                            {formatGap(gapMs)}
                                          </span>
                                        </div>
                                      )}
                                      <div className="relative flex items-start gap-3 py-2">
                                        <div className={`absolute -left-[25px] top-3 w-2.5 h-2.5 rounded-full border-2 ${
                                          event.type === 'search'
                                            ? 'bg-blue-500/80 border-blue-400'
                                            : 'bg-purple-500/80 border-purple-400'
                                        }`} />
                                        <div className="flex-1 min-w-0">
                                          {event.type === 'search' ? (
                                            <div className="flex items-center gap-2 flex-wrap">
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
                                              <svg className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                              </svg>
                                              <span className="text-sm font-medium text-purple-300">{event.expert_name}</span>
                                              {event.search_query && (
                                                <span className="text-xs bg-slate-800 border border-slate-700 text-slate-500 px-2 py-0.5 rounded truncate max-w-[200px]">
                                                  from: {event.search_query}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <span className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap" title={new Date(event.created_at).toLocaleString()}>
                                          {timeAgo(event.created_at)}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
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
        )}
      </AdminCard>
    </div>
  )
}
