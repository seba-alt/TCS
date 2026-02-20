import type { Expert } from '../types'

interface Props {
  expert: Expert
  locked?: boolean
}

export default function ExpertCard({ expert, locked = false }: Props) {
  const initials = expert.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const profileUrl = expert.profile_url || null

  const inner = (
    <div className="flex items-start gap-3">
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center text-white text-sm font-semibold"
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Expert info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-neutral-900 text-sm leading-snug group-hover:text-brand-purple transition-colors">
            {expert.name}
          </p>
          {profileUrl && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-neutral-400 group-hover:text-brand-purple flex-shrink-0 mt-0.5 transition-colors"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {(expert.title || expert.company) && (
          <p className="text-xs text-neutral-500 mt-0.5">
            {[expert.title, expert.company].filter(Boolean).join(' · ')}
          </p>
        )}

        <p className="text-xs font-semibold text-brand-purple mt-1">
          {expert.hourly_rate}/hr
        </p>

        {expert.why_them && (
          <p className="text-xs text-neutral-600 mt-2 leading-relaxed border-t border-neutral-100 pt-2">
            {expert.why_them}
          </p>
        )}
      </div>
    </div>
  )

  if (locked) {
    return (
      <div
        className="block w-full rounded-2xl border border-neutral-200 bg-white p-4 grayscale opacity-60 pointer-events-none select-none"
        aria-hidden="true"
      >
        {inner}
      </div>
    )
  }

  if (profileUrl) {
    return (
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-2xl border border-neutral-200 bg-white p-4 hover:border-brand-purple hover:shadow-md transition-all duration-200 group cursor-pointer"
      >
        {inner}
      </a>
    )
  }

  return (
    <div className="block w-full rounded-2xl border border-neutral-200 bg-white p-4">
      {inner}
    </div>
  )
}
