interface Expert {
  name: string
  title: string
  company: string
  hourly_rate: string
  profile_url: string | null
  why_them?: string
}

interface ExpandedExpertRowProps {
  responseExperts: string  // Raw JSON string from DB column
  colSpan: number
}

export default function ExpandedExpertRow({ responseExperts, colSpan }: ExpandedExpertRowProps) {
  let experts: Expert[] = []
  try { experts = JSON.parse(responseExperts) } catch { experts = [] }

  if (experts.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-5 py-3 bg-slate-900/40 text-sm text-slate-500 italic">
          No expert matches for this query.
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-4 bg-slate-900/40 border-b border-slate-700/40">
        <div className="space-y-2">
          {experts.map((e, i) => (
            <div key={i} className="flex items-start justify-between text-sm">
              <div className="min-w-0">
                <span className="font-medium text-white">{e.name}</span>
                <span className="text-slate-600 mx-1">—</span>
                <span className="text-slate-400">{e.title} @ {e.company}</span>
                {e.why_them && <p className="text-xs text-slate-500 mt-0.5 italic">{e.why_them}</p>}
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span className="text-slate-500 text-xs">{e.hourly_rate}</span>
                {e.profile_url && (
                  <a
                    href={e.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 text-xs hover:underline"
                  >
                    Profile ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}
