import { useState, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TEST_EMAIL = 'testlab@tinrate.com'

interface Expert {
  name?: string
  title?: string
  company?: string
  hourly_rate?: string
  profile_url?: string
  why_them?: string
}

interface Intelligence {
  hyde_triggered: boolean
  hyde_bio: string | null
  feedback_applied: boolean
}

interface Result {
  narrative: string
  experts: Expert[]
  intelligence: Intelligence
}

type Status = 'idle' | 'loading' | 'done' | 'error'

function Badge({ on, label, offLabel }: { on: boolean; label: string; offLabel?: string }) {
  return on ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-900/50 text-purple-300 border border-purple-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-500 border border-slate-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
      {offLabel ?? label}
    </span>
  )
}

export default function SearchLabPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function runQuery() {
    if (!query.trim() || status === 'loading') return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setStatus('loading')
    setResult(null)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, query: query.trim() }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '))
          if (!dataLine) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(dataLine.slice(6)) } catch { continue }

          if (event.event === 'result') {
            setResult({
              narrative: (event.narrative as string) ?? '',
              experts: (event.experts as Expert[]) ?? [],
              intelligence: (event.intelligence as Intelligence) ?? {
                hyde_triggered: false,
                hyde_bio: null,
                feedback_applied: false,
              },
            })
          } else if (event.event === 'done') {
            setStatus('done')
          } else if (event.event === 'error') {
            setError((event.message as string) ?? 'Unknown error')
            setStatus('error')
          }
        }
      }

      if (status !== 'error') setStatus('done')
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Request failed: ${msg}`)
      setStatus('error')
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runQuery()
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Search Lab</h1>
        <p className="text-slate-500 text-sm mt-1">
          Run live queries against the search engine and inspect intelligence metadata per result.
        </p>
      </div>

      {/* Query input */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
        <textarea
          className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-slate-600"
          rows={3}
          placeholder="Describe a problem or need… e.g. 'I need help structuring a Series A fundraise for a SaaS company'"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">⌘ + Enter to run</span>
          <button
            onClick={runQuery}
            disabled={!query.trim() || status === 'loading'}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'loading' ? 'Running…' : 'Run Query'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {status === 'loading' && !result && (
        <div className="flex items-center gap-3 text-slate-400 text-sm animate-pulse">
          <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          Querying search engine…
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-5 py-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Intelligence panel */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Intelligence Layer
            </h2>
            <div className="flex flex-wrap gap-2">
              <Badge
                on={result.intelligence.hyde_triggered}
                label="HyDE triggered"
                offLabel="HyDE skipped"
              />
              <Badge
                on={result.intelligence.feedback_applied}
                label="Feedback re-ranking applied"
                offLabel="Feedback re-ranking off"
              />
            </div>

            {result.intelligence.hyde_triggered && result.intelligence.hyde_bio && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-400 mb-2">Generated hypothetical bio</p>
                <blockquote className="text-sm text-slate-300 italic border-l-2 border-purple-600 pl-4 leading-relaxed">
                  {result.intelligence.hyde_bio}
                </blockquote>
              </div>
            )}

            {!result.intelligence.hyde_triggered && (
              <p className="text-xs text-slate-600">
                HyDE skipped — query returned strong enough results without expansion.
                {' '}Enable <code className="text-slate-500">QUERY_EXPANSION_ENABLED=true</code> in Railway to activate.
              </p>
            )}
          </div>

          {/* Narrative */}
          {result.narrative && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                AI Narrative
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">{result.narrative}</p>
            </div>
          )}

          {/* Expert results */}
          {result.experts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Matched Experts ({result.experts.length})
              </h2>
              {result.experts.map((ex, i) => (
                <div
                  key={i}
                  className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="text-xs bg-purple-900/50 text-purple-400 border border-purple-800/50 px-1.5 py-0.5 rounded font-medium">
                          Top Match
                        </span>
                      )}
                      <p className="text-sm font-semibold text-white">{ex.name ?? 'Unknown'}</p>
                    </div>
                    {ex.title && (
                      <p className="text-xs text-slate-400">{ex.title}{ex.company ? ` · ${ex.company}` : ''}</p>
                    )}
                    {ex.why_them && (
                      <p className="text-xs text-slate-500 italic mt-1 leading-relaxed">{ex.why_them}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right space-y-1">
                    {ex.hourly_rate && (
                      <p className="text-xs font-mono text-slate-300">€{ex.hourly_rate}/hr</p>
                    )}
                    {ex.profile_url && (
                      <a
                        href={ex.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Profile ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.experts.length === 0 && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-5 py-4 text-slate-500 text-sm">
              No expert matches returned for this query.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
