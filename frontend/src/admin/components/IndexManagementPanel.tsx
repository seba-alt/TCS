import { useIngestStatus } from '../hooks/useAdminData'

const STATUS_CONFIG = {
  idle:    { label: 'Idle',           cls: 'text-slate-400 bg-slate-700/40 border-slate-600/40' },
  running: { label: 'Rebuilding\u2026', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 animate-pulse' },
  done:    { label: 'Complete',       cls: 'text-green-400 bg-green-500/10 border-green-500/30' },
  error:   { label: 'Failed',         cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
} as const

function formatTs(ts: number | null): string {
  if (ts === null) return '\u2014'
  return new Date(ts * 1000).toLocaleString()
}

export default function IndexManagementPanel() {
  const { ingest, triggerRun } = useIngestStatus()
  const cfg = STATUS_CONFIG[ingest.status]

  async function handleRebuild() {
    await triggerRun('/ingest/run')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Rebuild Status card */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Rebuild Status</h2>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 mb-1">Last rebuild</p>
            <p className="text-slate-200 font-mono text-xs">{formatTs(ingest.last_rebuild_at ?? null)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Experts at rebuild</p>
            <p className="text-slate-200 font-mono text-xs">
              {ingest.expert_count_at_rebuild !== null && ingest.expert_count_at_rebuild !== undefined
                ? ingest.expert_count_at_rebuild
                : '\u2014'}
            </p>
          </div>
          {ingest.started_at !== null && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Started at</p>
              <p className="text-slate-200 font-mono text-xs">{formatTs(ingest.started_at)}</p>
            </div>
          )}
        </div>

        {ingest.status === 'error' && ingest.error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 text-red-400 text-xs font-mono">
            {ingest.error}
          </div>
        )}

        <div className="pt-3 border-t border-slate-700/40">
          <button
            onClick={handleRebuild}
            disabled={ingest.status === 'running'}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              ingest.status === 'running'
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/25'
            }`}
          >
            {ingest.status === 'running' ? 'Rebuilding\u2026' : 'Rebuild Index'}
          </button>
          {ingest.status === 'running' && (
            <p className="text-xs text-slate-500 mt-2">
              This typically takes 2\u201310 minutes. Live search is unaffected.
            </p>
          )}
        </div>
      </div>

      {/* About card */}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">About Index Rebuilds</h2>
        <ul className="space-y-2 text-xs text-slate-400">
          <li className="flex gap-2">
            <span className="text-purple-400 font-bold mt-0.5">1.</span>
            <span>Tags all experts using AI — updates skills, domains, and findability scores.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-purple-400 font-bold mt-0.5">2.</span>
            <span>Rebuilds the FAISS vector index so new experts and tag changes are searchable.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-purple-400 font-bold mt-0.5">3.</span>
            <span>Hot-swaps the live index atomically — no downtime, no failed searches during rebuild.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
