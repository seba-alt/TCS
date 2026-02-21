function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 p-4 space-y-3">
      {/* Avatar circle */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>

      {/* Tag pill placeholders */}
      <div className="flex gap-1.5">
        <div className="h-5 bg-gray-200 rounded-full w-16" />
        <div className="h-5 bg-gray-200 rounded-full w-20" />
        <div className="h-5 bg-gray-200 rounded-full w-14" />
      </div>

      {/* Body text lines */}
      <div className="h-3 bg-gray-200 rounded w-full" />
      <div className="h-3 bg-gray-200 rounded w-4/5" />
    </div>
  )
}

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
