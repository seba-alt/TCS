import { SkeletonBrowseCard } from './SkeletonBrowseCard'

interface SkeletonBrowseRowProps {
  count?: number
}

export function SkeletonBrowseRow({ count = 6 }: SkeletonBrowseRowProps) {
  return (
    <div>
      {/* Row header skeleton */}
      <div className="flex items-center justify-between mb-3 px-4 md:px-8">
        <div className="animate-pulse bg-gray-200/20 rounded h-6 w-48" />
        <div className="animate-pulse bg-gray-200/20 rounded h-4 w-16" />
      </div>

      {/* Card row — overflow hidden so skeleton cards don't scroll */}
      <div className="flex gap-3 overflow-hidden px-4 md:px-8">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonBrowseCard key={i} />
        ))}
      </div>
    </div>
  )
}
