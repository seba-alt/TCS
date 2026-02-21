import { useState, useEffect, useRef } from 'react'
import { useAdminSettings, adminPost } from '../hooks/useAdminData'
import type { AdminSetting } from '../types'

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
    case 'HYDE_TRIGGER_SENSITIVITY': return 'HyDE Trigger Sensitivity'
    case 'FEEDBACK_BOOST_CAP': return 'Feedback Boost Cap'
    default: return key
  }
}

const THRESHOLD_ORDER = ['SIMILARITY_THRESHOLD', 'HYDE_TRIGGER_SENSITIVITY', 'FEEDBACK_BOOST_CAP']

export default function IntelligenceDashboardPage() {
  const { data, loading, error, refetch } = useAdminSettings()

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
      await adminPost('/settings', { key, value: newValue })
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
