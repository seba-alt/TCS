import { ChevronRight } from 'lucide-react'
import { BrowseCard } from './BrowseCard'
import type { BrowseCard as BrowseCardType } from '../../hooks/useBrowse'

// End-of-row "See All" card — same dimensions as BrowseCard
interface SeeAllEndCardProps {
  total: number
  title: string
  slug: string
  onClick: () => void
}

function SeeAllEndCard({ total, onClick }: SeeAllEndCardProps) {
  return (
    <div
      className="rounded-xl bg-white/60 border border-gray-200/60 flex flex-col items-center justify-center cursor-pointer hover:bg-white/80 transition-colors shrink-0"
      style={{ width: 160, height: 220 }}
      onClick={onClick}
    >
      <ChevronRight className="w-8 h-8 text-brand-purple mb-2" />
      <span className="text-sm text-gray-800 font-medium">See All</span>
      <span className="text-xs text-gray-400">{total} experts</span>
    </div>
  )
}

interface BrowseRowProps {
  title: string
  slug: string
  experts: BrowseCardType[]
  total: number
  onSeeAll: (slug: string, title: string) => void
  onViewProfile?: (url: string) => void
}

export function BrowseRow({ title, slug, experts, total, onSeeAll, onViewProfile }: BrowseRowProps) {
  return (
    <div>
      {/* Row header */}
      <div className="flex items-center justify-between mb-3 px-4 md:px-8">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <button
          onClick={() => onSeeAll(slug, title)}
          className="text-sm text-brand-purple hover:text-brand-purple/70 transition-colors flex items-center gap-1"
        >
          See All <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Scroll container with fade edge overlays */}
      <div className="relative">
        {/* Left fade edge — fades cards into the aurora background */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-full w-16 z-10"
          style={{
            background: 'linear-gradient(to right, var(--aurora-bg, #f8f7ff), transparent)',
          }}
        />
        {/* Right fade edge */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-16 z-10"
          style={{
            background: 'linear-gradient(to left, var(--aurora-bg, #f8f7ff), transparent)',
          }}
        />

        {/* Horizontal snap-scroll row */}
        <div
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pl-20 pr-4 md:pr-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {experts.map((expert) => (
            <div key={expert.username} className="snap-start shrink-0">
              <BrowseCard expert={expert} onViewProfile={onViewProfile} />
            </div>
          ))}

          {/* End-of-row "See All" card */}
          <div className="snap-start shrink-0">
            <SeeAllEndCard
              total={total}
              title={title}
              slug={slug}
              onClick={() => onSeeAll(slug, title)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
