import { useState, useEffect, useRef, useMemo } from 'react'
import { useAdminSettings, useIntelligenceMetrics, adminPost, useEmbeddingMap } from '../hooks/useAdminData'
import type { AdminSetting, EmbeddingPoint } from '../types'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function otrColor(avg: number | null): string {
  if (avg === null) return 'text-slate-400'
  if (avg >= 0.75) return 'text-green-400'
  if (avg >= 0.60) return 'text-yellow-400'
  return 'text-red-400'
}

function timeAgo(unixTs: number | null): string {
  if (unixTs === null) return '—'
  const diffSec = Math.floor(Date.now() / 1000 - unixTs)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`
  return `${Math.floor(diffSec / 86400)} days ago`
}

function SourceBadge({ source }: { source: AdminSetting['source'] }) {
  if (source === 'db') return (
    <span className="text-xs font-mono bg-purple-900/50 text-purple-300 border border-purple-700/40 px-1.5 py-0.5 rounded">DB</span>
  )
  if (source === 'env') return (
    <span className="text-xs font-mono bg-slate-700/60 text-slate-400 border border-slate-600/40 px-1.5 py-0.5 rounded">env</span>
  )
  return (
    <span className="text-xs font-mono bg-slate-800/60 text-slate-600 border border-slate-700/40 px-1.5 py-0.5 rounded">default</span>
  )
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? 'bg-purple-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function TooltipIcon({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-700 text-slate-400 text-xs cursor-help hover:bg-slate-600 hover:text-slate-200 transition-colors flex-shrink-0"
      aria-label={text}
    >
      i
    </span>
  )
}

function friendlyLabel(key: string): string {
  switch (key) {
    case 'SIMILARITY_THRESHOLD': return 'Similarity Threshold'
    case 'STRONG_RESULT_MIN': return 'HyDE Trigger Sensitivity'
    case 'FEEDBACK_BOOST_CAP': return 'Feedback Boost Cap'
    default: return key
  }
}

const THRESHOLD_ORDER = ['SIMILARITY_THRESHOLD', 'STRONG_RESULT_MIN', 'FEEDBACK_BOOST_CAP']

// Aurora-adjacent jewel-tone palette — complement the v2.2 purple/teal/green/pink aurora
const CATEGORY_COLORS: Record<string, string> = {
  'Tech':         '#a855f7',   // vivid purple
  'Finance':      '#06b6d4',   // cyan-teal
  'Marketing':    '#10b981',   // emerald green
  'Sales':        '#f472b6',   // hot pink
  'Strategy':     '#818cf8',   // indigo-purple
  'HR':           '#34d399',   // mint green
  'Operations':   '#2dd4bf',   // teal
  'Legal':        '#c084fc',   // lavender purple
  'Healthcare':   '#38bdf8',   // sky blue
  'Real Estate':  '#fb7185',   // rose pink
  'Sports':       '#a3e635',   // lime green
  'Unknown':      '#475569',   // slate neutral
}

const DEFAULT_COLOR = '#6366f1'  // fallback indigo for uncategorized

function EmbeddingTooltip({ active, payload }: { active?: boolean; payload?: { payload: EmbeddingPoint }[] }) {
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-white font-medium">{pt.name || pt.username}</p>
      <p className="text-slate-400">{pt.category}</p>
    </div>
  )
}

export default function IntelligenceDashboardPage() {
  const { data: metrics, loading: metricsLoading } = useIntelligenceMetrics()
  const { data, loading, error, refetch } = useAdminSettings()
  const { data: embeddingData, status: embeddingStatus } = useEmbeddingMap()

  const byCategory = useMemo(() => {
    const groups: Record<string, EmbeddingPoint[]> = {}
    for (const pt of embeddingData?.points ?? []) {
      const cat = pt.category || 'Unknown'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(pt)
    }
    return groups
  }, [embeddingData])

  // Local threshold state — initialized from fetched data
  const [thresholds, setThresholds] = useState<Record<string, string>>({})
  // Track original fetched values to detect dirty state
  const [originalThresholds, setOriginalThresholds] = useState<Record<string, string>>({})

  // Inline save feedback
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize threshold state when data loads
  useEffect(() => {
    if (!data) return
    const vals: Record<string, string> = {}
    for (const s of data.settings) {
      if (s.type !== 'bool') {
        vals[s.key] = String(s.raw)
      }
    }
    setThresholds(vals)
    setOriginalThresholds(vals)
  }, [data])

  // Cleanup on unmount
  useEffect(() => () => { if (fadeTimer.current) clearTimeout(fadeTimer.current) }, [])

  function showSaveResult(status: 'success' | 'error', message: string) {
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    setSaveStatus(status)
    setSaveMessage(message)
    fadeTimer.current = setTimeout(() => setSaveStatus('idle'), 4000)
  }

  async function handleToggle(key: string, newValue: boolean) {
    try {
      await adminPost('/settings', { key, value: String(newValue) })
      refetch()
    } catch (e) {
      // On error, refetch to restore original state (revert)
      refetch()
      showSaveResult('error', `Failed to update ${key}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  const isDirty = Object.keys(thresholds).some(
    key => thresholds[key] !== originalThresholds[key]
  )

  async function handleSave() {
    const changed = Object.keys(thresholds).filter(
      key => thresholds[key] !== originalThresholds[key]
    )
    if (changed.length === 0) return

    try {
      for (const key of changed) {
        const setting = data!.settings.find(s => s.key === key)!
        const numVal = setting.type === 'int'
          ? parseInt(thresholds[key], 10)
          : parseFloat(thresholds[key])
        if (isNaN(numVal)) throw new Error(`Invalid value for ${key}`)
        await adminPost('/settings', { key, value: numVal })
      }
      await refetch()
      showSaveResult('success', `${changed.length} setting${changed.length > 1 ? 's' : ''} saved`)
    } catch (e) {
      showSaveResult('error', e instanceof Error ? e.message : 'Save failed')
    }
  }

  // Derive categorized settings from data
  const hydeSetting = data?.settings.find(s => s.key === 'QUERY_EXPANSION_ENABLED')
  const feedbackSetting = data?.settings.find(s => s.key === 'FEEDBACK_LEARNING_ENABLED')
  const thresholdSettings = data
    ? THRESHOLD_ORDER
        .map(key => data.settings.find(s => s.key === key))
        .filter((s): s is AdminSetting => s !== undefined)
    : []

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      {/* Intelligence Metrics Cards — OTR@K + Index Drift */}
      <div className="grid grid-cols-2 gap-4">
        {/* OTR@K Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
          <p className="text-xs text-slate-400">On-Topic Rate (7-day)</p>
          <p className={`text-2xl font-bold ${otrColor(metrics?.otr.rolling_avg_7d ?? null)}`}>
            {metricsLoading
              ? '—'
              : metrics?.otr.rolling_avg_7d !== null && metrics?.otr.rolling_avg_7d !== undefined
                ? `${Math.round(metrics.otr.rolling_avg_7d * 100)}%`
                : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {metricsLoading
              ? ''
              : (metrics?.otr.query_count_7d ?? 0) > 0
                ? `based on ${metrics!.otr.query_count_7d} queries`
                : 'no data yet'}
          </p>
        </div>

        {/* Index Drift Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
          <p className="text-xs text-slate-400">Index Drift</p>
          <p className="text-sm text-slate-200">
            Last rebuilt: {metricsLoading ? '—' : timeAgo(metrics?.index_drift.last_rebuild_at ?? null)}
          </p>
          {!metricsLoading && metrics && (
            <p className="text-xs text-slate-500">
              {metrics.index_drift.expert_count_at_rebuild !== null && metrics.index_drift.expert_delta !== null
                ? <>
                    {metrics.index_drift.current_expert_count} experts{' '}
                    {metrics.index_drift.expert_delta > 0
                      ? <span className="text-green-400">+{metrics.index_drift.expert_delta} since rebuild</span>
                      : metrics.index_drift.expert_delta < 0
                        ? <span className="text-red-400">{metrics.index_drift.expert_delta} since rebuild</span>
                        : <span>no change since rebuild</span>}
                  </>
                : <>{metrics.index_drift.current_expert_count} experts — no rebuild recorded</>}
            </p>
          )}
        </div>
      </div>

      {/* Embedding Map — t-SNE scatter plot of expert embeddings */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Expert Embedding Map</h2>
          <p className="text-xs text-slate-500 mt-1">
            t-SNE projection of all {embeddingData?.count ?? '—'} expert embeddings — clusters indicate semantic similarity. Recomputes after index rebuild.
          </p>
        </div>

        {embeddingStatus === 'loading' || embeddingStatus === 'computing' ? (
          <div className="flex items-center gap-3 py-12 justify-center">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">
              {embeddingStatus === 'computing' ? 'Computing t-SNE projection… (up to 30s)' : 'Loading…'}
            </span>
          </div>
        ) : embeddingStatus === 'error' ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Failed to load embedding map. Refresh to retry.
          </div>
        ) : embeddingData && Object.keys(byCategory).length > 0 ? (
          <ResponsiveContainer width="100%" height={480}>
            <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <XAxis dataKey="x" type="number" domain={['auto', 'auto']} hide />
              <YAxis dataKey="y" type="number" domain={['auto', 'auto']} hide />
              <Tooltip content={<EmbeddingTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                iconSize={8}
              />
              {Object.entries(byCategory).map(([cat, pts]) => (
                <Scatter
                  key={cat}
                  name={cat}
                  data={pts}
                  fill={CATEGORY_COLORS[cat] ?? DEFAULT_COLOR}
                  opacity={0.85}
                  r={4}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">No embedding data available.</div>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Search Intelligence</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage feature flags and retrieval thresholds in real time. Changes take effect on the next chat request without redeploying.
        </p>
      </div>

      {loading && (
        <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-5 py-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {data && hydeSetting && feedbackSetting && (
        <>
          {/* Feature Flags card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Feature Flags</h2>
              <p className="text-xs text-slate-500 mt-1">Changes apply immediately — no redeploy needed.</p>
            </div>

            {/* HyDE toggle row */}
            <div className="flex items-center justify-between py-3 border-b border-slate-700/40">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">HyDE Query Expansion</span>
                  <SourceBadge source={hydeSetting.source} />
                </div>
                <span className="text-xs text-slate-500">Generates a hypothetical expert bio for weak queries before re-searching FAISS</span>
              </div>
              <ToggleSwitch
                checked={hydeSetting.value as boolean}
                onChange={val => handleToggle(hydeSetting.key, val)}
              />
            </div>

            {/* Feedback toggle row */}
            <div className="flex items-center justify-between py-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">Feedback Re-ranking</span>
                  <SourceBadge source={feedbackSetting.source} />
                </div>
                <span className="text-xs text-slate-500">Boosts experts with 10+ interactions and positive feedback ratio (up to cap)</span>
              </div>
              <ToggleSwitch
                checked={feedbackSetting.value as boolean}
                onChange={val => handleToggle(feedbackSetting.key, val)}
              />
            </div>
          </div>

          {/* Thresholds card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Thresholds</h2>
              <p className="text-xs text-slate-500 mt-1">Numeric tuning parameters for search intelligence.</p>
            </div>

            {/* One row per threshold setting */}
            {thresholdSettings.map(s => (
              <div key={s.key} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-white">{friendlyLabel(s.key)}</label>
                    <TooltipIcon text={s.description} />
                    <SourceBadge source={s.source} />
                  </div>
                  <p className="text-xs text-slate-500">
                    Range: {s.min} to {s.max}{s.key === 'FEEDBACK_BOOST_CAP' ? '%' : ''}
                  </p>
                </div>
                <input
                  type="number"
                  value={thresholds[s.key] ?? ''}
                  onChange={e => setThresholds(prev => ({ ...prev, [s.key]: e.target.value }))}
                  min={s.min}
                  max={s.max}
                  step={s.type === 'float' ? 0.05 : 1}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white text-right font-mono focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            ))}

            {/* Save row */}
            <div className="pt-3 border-t border-slate-700/40 flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                  isDirty
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Save Changes
              </button>
              {isDirty && (
                <span className="text-xs text-purple-400">Unsaved changes</span>
              )}
            </div>

            {/* Inline save feedback — fades after 4s */}
            {saveStatus !== 'idle' && (
              <div className={`rounded-lg px-4 py-3 text-sm ${
                saveStatus === 'success'
                  ? 'bg-green-950/40 border border-green-800/50 text-green-300'
                  : 'bg-red-950/40 border border-red-800/50 text-red-400'
              }`}>
                {saveMessage}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
