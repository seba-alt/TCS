import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useMarketplaceDemand, useMarketplaceExposure, useMarketplaceTrend } from '../hooks/useAdminData'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminCard } from '../components/AdminCard'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const getAdminToken = () => sessionStorage.getItem('admin_token') ?? ''

// -- Date helpers --

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function datesToDays(from: string, to: string): number {
  if (!from && !to) return 0
  const now = new Date()
  const fromDate = from ? new Date(from) : new Date('2000-01-01')
  const toDate = to ? new Date(to) : now
  return Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)))
}

// -- Shared sub-components --

function Spinner() {
  return (
    <div className="flex items-center gap-3 py-8 justify-center">
      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-slate-400">Loading...</span>
    </div>
  )
}

function ColdStartBlock() {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-8 text-center space-y-2">
      <p className="text-slate-300 font-medium">No tracking data yet</p>
      <p className="text-slate-500 text-sm">
        Tracking started — insights appear after approximately 50 page views.
      </p>
    </div>
  )
}

async function downloadMarketplaceCsv(section: 'demand' | 'exposure', days: number) {
  const url = new URL(`${API_URL}/api/admin/export/${section}.csv`)
  if (days > 0) url.searchParams.set('days', String(days))

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${getAdminToken()}` },
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `${section}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

// -- Trend Section --

function TrendSection({ days }: { days: number }) {
  const { data, loading } = useMarketplaceTrend(days)

  if (loading) {
    return (
      <AdminCard className="p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Search Query Volume</h2>
        <Spinner />
      </AdminCard>
    )
  }

  if (data?.data_since === null) {
    return (
      <AdminCard className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Search Query Volume</h2>
        <ColdStartBlock />
      </AdminCard>
    )
  }

  const kpis = data?.kpis
  const totalQueries = kpis?.total_queries ?? 0
  const zeroResultRate = kpis?.zero_result_rate ?? 0
  const priorTotal = kpis?.prior_period_total ?? 0
  const changePct =
    priorTotal === 0
      ? 'N/A'
      : `${((totalQueries - priorTotal) / priorTotal * 100).toFixed(1)}%`
  const changeLabel = priorTotal === 0
    ? 'N/A vs prior period'
    : `${Number(changePct) >= 0 ? '+' : ''}${changePct} vs prior ${days}d`

  return (
    <AdminCard className="p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Search Query Volume</h2>
        <p className="text-xs text-slate-500 mt-1">Last {days} days — stacked by outcome</p>
      </div>

      {/* KPI pills */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-700/60 border border-slate-600/50 text-sm text-slate-200">
          <span className="font-bold text-white">{totalQueries}</span>
          <span className="text-slate-400">total queries</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-700/60 border border-slate-600/50 text-sm text-slate-200">
          <span className="font-bold text-red-400">{zeroResultRate.toFixed(1)}%</span>
          <span className="text-slate-400">zero-result rate</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-700/60 border border-slate-600/50 text-sm text-slate-200">
          <span className={`font-bold ${changePct !== 'N/A' && Number(((totalQueries - priorTotal) / priorTotal * 100).toFixed(1)) >= 0 ? 'text-green-400' : 'text-slate-400'}`}>
            {changePct === 'N/A' ? 'N/A' : changeLabel}
          </span>
        </span>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data?.daily ?? []}
          margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.slice(5)} // MM-DD
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
            labelStyle={{ color: '#cbd5e1', fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: '#cbd5e1' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '12px', color: '#94a3b8' }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="hits" name="Matched" fill="#6366f1" stackId="a" />
          <Bar dataKey="zero_results" name="Zero Results" fill="#f97316" stackId="a" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AdminCard>
  )
}

// -- Demand Section --

function DemandSection({ days }: { days: number }) {
  const [demandPage, setDemandPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const { data, loading } = useMarketplaceDemand(days, demandPage)

  const isColdStart = !loading && data?.data_since === null

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await downloadMarketplaceCsv('demand', days)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 25
  const currentPage = data?.page ?? 1
  const totalPages = Math.ceil(total / pageSize)
  const rowStart = (currentPage - 1) * pageSize + 1
  const rowEnd = Math.min(currentPage * pageSize, total)

  return (
    <AdminCard className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Zero-Result Queries</h2>
          <p className="text-xs text-slate-500 mt-0.5">Zero-result search queries sorted by frequency</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || isColdStart}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {exportError && (
        <p className="text-sm text-red-400">{exportError}</p>
      )}

      {loading ? (
        <Spinner />
      ) : isColdStart ? (
        <ColdStartBlock />
      ) : (data?.demand ?? []).length === 0 ? (
        <p className="text-slate-500 text-sm py-4 text-center">No zero-result queries in this period</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Query Text</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Frequency</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Seen</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unique Users</th>
                </tr>
              </thead>
              <tbody>
                {(data?.demand ?? []).map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-200 max-w-xs truncate">{row.query_text}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300">{row.frequency}</td>
                    <td className="px-5 py-3 text-right text-slate-400 text-xs">
                      {new Date(row.last_seen).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300">{row.unique_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {rowStart}–{rowEnd} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setDemandPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  onClick={() => setDemandPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AdminCard>
  )
}

// -- Exposure Section --

function ExposureSection({ days }: { days: number }) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const { data, loading } = useMarketplaceExposure(days)

  const isColdStart = !loading && data?.data_since === null

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await downloadMarketplaceCsv('exposure', days)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <AdminCard className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Expert Exposure</h2>
          <p className="text-xs text-slate-500 mt-0.5">Click activity by expert</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || isColdStart}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {exportError && (
        <p className="text-sm text-red-400">{exportError}</p>
      )}

      {loading ? (
        <Spinner />
      ) : isColdStart ? (
        <ColdStartBlock />
      ) : (data?.exposure ?? []).length === 0 ? (
        <p className="text-slate-500 text-sm py-4 text-center">No click activity in this period</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Expert</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Clicks</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grid Clicks</th>
              </tr>
            </thead>
            <tbody>
              {(data?.exposure ?? []).map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-5 py-3 text-slate-200 text-sm">{row.expert_name ?? row.expert_id}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-300">{row.total_clicks}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-400">{row.grid_clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  )
}

// -- Main DataPage --

export default function DataPage() {
  // Unified date state
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Derive marketplace days from date range
  const marketplaceDays = dateFrom || dateTo ? datesToDays(dateFrom, dateTo) : 30

  function setPresetRange(rangeDays: number) {
    if (rangeDays === 0) {
      setDateFrom('')
      setDateTo('')
    } else {
      setDateFrom(daysAgo(rangeDays))
      setDateTo(new Date().toISOString().slice(0, 10))
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 lg:p-8 space-y-6">
      <AdminPageHeader
        title="Data"
        subtitle="Marketplace trends, demand signals, and expert exposure"
      />

      {/* Date range picker + preset buttons */}
      <AdminCard className="p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date Range</span>
          <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
            {[
              { label: '7d', days: 7 },
              { label: '30d', days: 30 },
              { label: '90d', days: 90 },
              { label: 'All', days: 0 },
            ].map(p => {
              const isActive = p.days === 0
                ? (!dateFrom && !dateTo)
                : (dateFrom === daysAgo(p.days) && dateTo === new Date().toISOString().slice(0, 10))
              return (
                <button
                  key={p.days}
                  onClick={() => setPresetRange(p.days)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </AdminCard>

      {/* Trend Chart */}
      <TrendSection days={marketplaceDays} />

      {/* Demand + Exposure side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DemandSection days={marketplaceDays} />
        <ExposureSection days={marketplaceDays} />
      </div>
    </div>
  )
}
