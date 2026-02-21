import { useState, useRef } from 'react'
import { adminPost } from '../hooks/useAdminData'
import type { CompareResponse, CompareColumn, CompareExpert, LabConfigKey, LabOverrides } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIG_OPTIONS: { key: LabConfigKey; label: string; description: string }[] = [
  { key: 'baseline', label: 'Baseline',           description: 'No intelligence features' },
  { key: 'hyde',     label: 'HyDE Only',          description: 'Query expansion on weak queries' },
  { key: 'feedback', label: 'Feedback Only',       description: 'Re-ranking by thumbs feedback' },
  { key: 'full',     label: 'Full Intelligence',   description: 'Both HyDE + feedback re-ranking' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

interface CompareColumnCardProps {
  column: CompareColumn
  diffMode: boolean
  baselineColumn: CompareColumn | undefined
  allColumns: CompareColumn[]
}

function CompareColumnCard({ column, diffMode, baselineColumn, allColumns }: CompareColumnCardProps) {
  const maxRank = Math.max(...allColumns.map(c => c.experts.length), 1)

  return (
    <div className="flex flex-col w-64 bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Column header */}
      <div className="px-4 py-3 border-b border-slate-700/60 bg-slate-900/40">
        <p className="text-sm font-semibold text-white">{column.label}</p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
              column.intelligence.hyde_triggered
                ? 'bg-purple-900/50 text-purple-300 border-purple-700/50'
                : 'bg-slate-800 text-slate-500 border-slate-700/50'
            }`}
          >
            <span
              className={`w-1 h-1 rounded-full ${
                column.intelligence.hyde_triggered ? 'bg-purple-400' : 'bg-slate-600'
              }`}
            />
            HyDE
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
              column.intelligence.feedback_applied
                ? 'bg-blue-900/50 text-blue-300 border-blue-700/50'
                : 'bg-slate-800 text-slate-500 border-slate-700/50'
            }`}
          >
            <span
              className={`w-1 h-1 rounded-full ${
                column.intelligence.feedback_applied ? 'bg-blue-400' : 'bg-slate-600'
              }`}
            />
            Feedback
          </span>
        </div>
      </div>

      {/* Expert rows */}
      <div className="flex-1 divide-y divide-slate-700/40">
        {Array.from({ length: maxRank }, (_, i) => {
          const rank = i + 1
          const expert: CompareExpert | undefined = column.experts.find(e => e.rank === rank)

          if (!expert) {
            // Ghost placeholder row
            return (
              <div key={rank} className="px-4 py-2.5 flex items-center gap-2 opacity-30">
                <span className="text-xs font-mono text-slate-600 w-4 shrink-0 text-right">{rank}</span>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-slate-600 rounded w-3/4" />
                  <div className="h-2 bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            )
          }

          // Diff calculation
          let delta: number | null = null
          let isNew = false
          let rowClass = ''
          let deltaBadge: React.ReactNode = null

          if (diffMode && baselineColumn && column.config !== 'baseline') {
            const baselineRank = baselineColumn.experts.find(e => e.name === expert.name)?.rank ?? null
            isNew = baselineRank === null
            delta = baselineRank !== null ? baselineRank - expert.rank : null

            if (delta !== null && delta > 0) {
              rowClass = 'bg-amber-950/40 border-l-2 border-amber-600'
              deltaBadge = (
                <span className="text-xs font-semibold text-amber-400 bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 rounded ml-auto shrink-0">
                  +{delta}
                </span>
              )
            } else if (delta !== null && delta < 0) {
              rowClass = 'bg-blue-950/40 border-l-2 border-blue-700'
              deltaBadge = (
                <span className="text-xs font-semibold text-blue-400 bg-blue-900/40 border border-blue-700/40 px-1.5 py-0.5 rounded ml-auto shrink-0">
                  {delta}
                </span>
              )
            } else if (isNew) {
              rowClass = 'bg-emerald-950/30 border-l-2 border-emerald-700'
              deltaBadge = (
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-1.5 py-0.5 rounded ml-auto shrink-0">
                  new
                </span>
              )
            }
          }

          return (
            <div key={rank} className={`px-4 py-2.5 flex items-start gap-2 ${rowClass}`}>
              <span className="text-xs font-mono text-slate-600 w-4 shrink-0 text-right mt-0.5">{rank}</span>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs font-semibold text-white truncate">{expert.name}</p>
                {expert.title && (
                  <p className="text-xs text-slate-500 truncate">{expert.title}</p>
                )}
                <p className="text-xs font-mono text-slate-500">{expert.score.toFixed(3)}</p>
              </div>
              {deltaBadge}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SearchLabPage() {
  const [query, setQuery]                     = useState('')
  const [panelOpen, setPanelOpen]             = useState(true)
  const [selectedConfigs, setSelectedConfigs] = useState<LabConfigKey[]>(['baseline', 'hyde', 'feedback', 'full'])
  const [resultCount, setResultCount]         = useState(20)
  const [overrides, setOverrides]             = useState<LabOverrides>({})
  const [compareResult, setCompareResult]     = useState<CompareResponse | null>(null)
  const [diffMode, setDiffMode]               = useState(false)
  const [status, setStatus]                   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError]                     = useState<string | null>(null)
  const abortRef                              = useRef<AbortController | null>(null)

  async function runCompare() {
    if (!query.trim() || status === 'loading' || selectedConfigs.length < 2) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus('loading')
    setCompareResult(null)
    setError(null)
    try {
      const result = await adminPost<CompareResponse>('/compare', {
        query: query.trim(),
        configs: selectedConfigs,
        result_count: resultCount,
        overrides,
      })
      setCompareResult(result)
      setStatus('done')
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runCompare()
  }

  function toggleConfig(key: LabConfigKey) {
    setSelectedConfigs(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 2) return prev // minimum 2 required
        return prev.filter(k => k !== key)
      }
      return [...prev, key]
    })
  }

  function setOverrideFlag(flagKey: keyof LabOverrides, value: boolean) {
    setOverrides(prev => {
      if (value) {
        return { ...prev, [flagKey]: true }
      }
      const next = { ...prev }
      delete next[flagKey]
      return next
    })
  }

  const hasOverrides = overrides.QUERY_EXPANSION_ENABLED || overrides.FEEDBACK_LEARNING_ENABLED
  const canCompare   = query.trim().length > 0 && status !== 'loading' && selectedConfigs.length >= 2

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Search Lab</h1>
        <p className="text-slate-500 text-sm mt-1">
          Run a query across multiple intelligence configurations and compare ranked results side by side.
        </p>
      </div>

      {/* Query input */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
        <textarea
          className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-slate-600"
          rows={3}
          placeholder="Describe a problem or need... e.g. 'I need help structuring a Series A fundraise for a SaaS company'"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">Cmd + Enter to run</span>
          <div className="flex items-center gap-3">
            {selectedConfigs.length < 2 && (
              <span className="text-xs text-amber-500">Select at least 2 configs</span>
            )}
            <button
              onClick={runCompare}
              disabled={!canCompare}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading' ? 'Comparing...' : 'Compare'}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible config panel */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
        <button
          onClick={() => setPanelOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-700/30 transition-colors"
        >
          <span className="text-sm font-semibold text-slate-300">Configuration</span>
          <span className="text-slate-500 text-xs select-none">{panelOpen ? '▲ Collapse' : '▼ Expand'}</span>
        </button>

        {panelOpen && (
          <div className="px-5 pb-5 pt-1 space-y-5 border-t border-slate-700/60">
            {/* Preset config checkboxes */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Preset Configs
                {selectedConfigs.length <= 2 && (
                  <span className="ml-2 text-amber-500 normal-case font-normal">(min 2 required)</span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CONFIG_OPTIONS.map(opt => {
                  const checked = selectedConfigs.includes(opt.key)
                  return (
                    <label
                      key={opt.key}
                      className="flex items-start gap-3 p-3 rounded-lg border border-slate-700/60 bg-slate-900/40 cursor-pointer hover:bg-slate-700/30 transition-colors select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleConfig(opt.key)}
                        className="mt-0.5 accent-purple-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{opt.label}</p>
                        <p className="text-xs text-slate-500">{opt.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Result count */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-slate-400 shrink-0">Results per config</label>
              <input
                type="number"
                min={1}
                max={50}
                value={resultCount}
                onChange={e => setResultCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20 bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Per-run override checkboxes */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Per-run Overrides
                <span className="ml-2 text-slate-600 normal-case font-normal">(overrides preset configs, does not change global settings)</span>
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={overrides.QUERY_EXPANSION_ENABLED === true}
                    onChange={e => setOverrideFlag('QUERY_EXPANSION_ENABLED', e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Force HyDE ON for this run
                    <span className="text-slate-600 text-xs ml-1.5">(overrides all preset configs)</span>
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={overrides.FEEDBACK_LEARNING_ENABLED === true}
                    onChange={e => setOverrideFlag('FEEDBACK_LEARNING_ENABLED', e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Force Feedback ON for this run
                    <span className="text-slate-600 text-xs ml-1.5">(overrides all preset configs)</span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active overrides banner */}
      {hasOverrides && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-amber-400 font-semibold text-sm">Overrides active:</span>
          {overrides.QUERY_EXPANSION_ENABLED && (
            <span className="text-xs bg-amber-800/40 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded">
              HyDE forced ON
            </span>
          )}
          {overrides.FEEDBACK_LEARNING_ENABLED && (
            <span className="text-xs bg-amber-800/40 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded">
              Feedback forced ON
            </span>
          )}
          <span className="text-xs text-amber-600 ml-auto">Global settings unchanged</span>
        </div>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex items-center gap-3 text-slate-400 text-sm animate-pulse">
          <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          Running {selectedConfigs.length} configs in parallel...
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-5 py-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {compareResult && (
        <div className="space-y-4">
          {/* Diff mode toggle + results header */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Results — {compareResult.columns.length} configs
              </p>
              <p className="text-xs text-slate-600 font-mono">"{compareResult.query}"</p>
            </div>
            <button
              onClick={() => setDiffMode(d => !d)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                diffMode
                  ? 'bg-purple-700/50 text-purple-200 border-purple-600/60 hover:bg-purple-700/70'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60 hover:bg-slate-700/60'
              }`}
            >
              Diff Mode {diffMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Side-by-side column results */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {compareResult.columns.map(col => (
                <CompareColumnCard
                  key={col.config}
                  column={col}
                  diffMode={diffMode}
                  baselineColumn={compareResult.columns.find(c => c.config === 'baseline')}
                  allColumns={compareResult.columns}
                />
              ))}
            </div>
          </div>

          {diffMode && (
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-950/80 border-l-2 border-amber-600 inline-block" />
                Moved up vs. baseline
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-950/80 border-l-2 border-blue-700 inline-block" />
                Moved down vs. baseline
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-950/60 border-l-2 border-emerald-700 inline-block" />
                New in this config
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
