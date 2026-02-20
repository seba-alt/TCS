import { useState } from 'react'
import { useAdminSearches } from '../hooks/useAdminData'
import type { SearchRow } from '../types'

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="text-sm text-slate-300 space-y-2">{children}</div>
    </div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-500 text-xs">N/A</span>
  const color =
    score >= 0.8
      ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800/50'
      : score >= 0.6
      ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800/50'
      : 'bg-red-900/50 text-red-400 border-red-800/50'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${color}`}>
      {score.toFixed(3)}
    </span>
  )
}

export default function ScoreExplainerPage() {
  const { data, loading } = useAdminSearches({ page: 0, page_size: 50 })
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const selected: SearchRow | undefined = data?.rows.find(r => r.id === selectedId)

  let experts: { name?: string; title?: string; company?: string; why_them?: string }[] = []
  if (selected) {
    try {
      experts = JSON.parse(selected.response_experts || '[]')
    } catch {
      experts = []
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Score Explainer</h1>
        <p className="text-slate-500 text-sm mt-1">
          Understand how similarity scores work and drill into individual searches
        </p>
      </div>

      {/* Static explanation */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <InfoPanel title="What is the score?">
          <p>
            Every expert match is ranked by a <strong className="text-white">cosine similarity score</strong> between
            0 and 1. A score of <strong className="text-white">1.0</strong> means the expert's bio/title perfectly
            aligns with the user's query; <strong className="text-white">0.0</strong> means no alignment at all.
          </p>
          <p className="text-slate-500">
            Only the <em>top match score</em> is stored per conversation — individual scores per
            expert are not persisted.
          </p>
        </InfoPanel>

        <InfoPanel title="GAP_THRESHOLD = 0.60">
          <p>
            Searches with a top score <strong className="text-white">below 0.60</strong> are flagged as{' '}
            <span className="text-red-400 font-semibold">gaps</span> — cases where the platform couldn't
            find a confident expert match.
          </p>
          <p>
            Clarification responses (where the AI asks follow-up questions) are also treated as gaps
            regardless of score.
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-slate-400">≥ 0.80 — Strong match</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500 flex-shrink-0" />
              <span className="text-slate-400">0.60–0.79 — Acceptable match</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-slate-400">&lt; 0.60 — Gap (no confident match)</span>
            </div>
          </div>
        </InfoPanel>

        <InfoPanel title="How FAISS works">
          <p>
            Expert bios and titles are embedded into <strong className="text-white">768-dimensional vectors</strong>{' '}
            using the Gemini embedding model. At search time, the user query is embedded the same way.
          </p>
          <p>
            FAISS performs an <strong className="text-white">approximate nearest-neighbor search</strong> using
            cosine similarity (via L2-normalized inner product) to find the closest expert vectors.
          </p>
          <p className="text-slate-500">
            Vectors are normalized before indexing and querying so inner product equals cosine similarity.
          </p>
        </InfoPanel>
      </div>

      {/* Per-search drill-down */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Per-Search Drill-Down</h2>

        {loading ? (
          <p className="text-slate-500 text-sm animate-pulse">Loading searches…</p>
        ) : !data?.rows.length ? (
          <p className="text-slate-500 text-sm">No searches recorded yet</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Select a search</label>
              <select
                className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full max-w-lg"
                value={selectedId ?? ''}
                onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— choose a search —</option>
                {data.rows.map(r => (
                  <option key={r.id} value={r.id}>
                    [{new Date(r.created_at).toLocaleDateString()}] {r.query.slice(0, 80)}
                    {r.query.length > 80 ? '…' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div className="space-y-4 mt-4">
                {/* Query info */}
                <div className="flex flex-wrap gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Query</p>
                    <p className="text-white text-sm">{selected.query}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <p className="text-xs text-slate-500 mb-1">Top Score</p>
                    <ScoreBadge score={selected.top_match_score} />
                  </div>
                  <div className="flex-shrink-0">
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selected.is_gap
                          ? 'bg-red-900/50 text-red-400 border border-red-800/50'
                          : 'bg-emerald-900/50 text-emerald-400 border border-emerald-800/50'
                      }`}
                    >
                      {selected.is_gap ? 'Gap' : 'Match'}
                    </span>
                  </div>
                </div>

                {/* Expert matches */}
                {experts.length > 0 ? (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">
                      Expert matches returned ({experts.length})
                      {selected === data.rows[0] && (
                        <span className="ml-2 text-purple-400">
                          — top score: {selected.top_match_score?.toFixed(3) ?? 'N/A'} (first match)
                        </span>
                      )}
                    </p>
                    <div className="space-y-2">
                      {experts.map((ex, i) => (
                        <div
                          key={i}
                          className="bg-slate-900/60 border border-slate-700/40 rounded-lg px-4 py-3 flex items-start justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {i === 0 && (
                                <span className="text-xs bg-purple-900/50 text-purple-400 border border-purple-800/50 px-1.5 py-0.5 rounded font-medium">
                                  Top Match
                                </span>
                              )}
                              <p className="text-sm font-medium text-white truncate">
                                {ex.name ?? 'Unknown'}
                              </p>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{ex.title ?? ''}</p>
                            {ex.why_them && (
                              <p className="text-xs text-slate-500 italic mt-1">{ex.why_them}</p>
                            )}
                          </div>
                          {i === 0 && (
                            <div className="flex-shrink-0">
                              <ScoreBadge score={selected.top_match_score} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-600 mt-2">
                      Note: Individual scores per expert are not stored — only the top match score is captured.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No expert matches in this response.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
