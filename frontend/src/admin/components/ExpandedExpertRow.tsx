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
        <td colSpan={colSpan} className="px-6 py-3 bg-gray-50 text-sm text-gray-400 italic">
          No expert matches for this query.
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-4 bg-gray-50">
        <div className="space-y-2">
          {experts.map((e, i) => (
            <div key={i} className="flex items-start justify-between text-sm">
              <div>
                <span className="font-medium text-gray-900">{e.name}</span>
                <span className="text-gray-500 mx-1">—</span>
                <span className="text-gray-600">{e.title} @ {e.company}</span>
                {e.why_them && <p className="text-xs text-gray-400 mt-0.5 italic">{e.why_them}</p>}
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span className="text-gray-500">{e.hourly_rate}</span>
                {e.profile_url && (
                  <a href={e.profile_url} target="_blank" rel="noopener noreferrer"
                    className="text-brand-purple hover:underline text-xs">Profile ↗</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}
