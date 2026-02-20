import type { Expert } from '../types'

interface Props {
  expert: Expert
}

export default function ExpertCard({ expert }: Props) {
  const initials = expert.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <a
      href={expert.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full rounded-xl border border-neutral-200 bg-white p-4 hover:border-brand-purple hover:shadow-sm transition-all duration-150 group"
    >
      <div className="flex items-start gap-3">
        {/* Avatar — initials fallback (no photo URL in Expert type) */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center text-white text-sm font-semibold"
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Expert info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-neutral-900 text-sm group-hover:text-brand-purple transition-colors truncate">
            {expert.name}
          </p>
          <p className="text-xs text-neutral-600 truncate">
            {expert.title} @ {expert.company}
          </p>
          <p className="text-xs font-medium text-brand-purple mt-1">
            {expert.hourly_rate}/hr
          </p>
        </div>

        {/* External link indicator */}
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
      </div>
    </a>
  )
}
