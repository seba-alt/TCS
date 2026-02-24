/**
 * SkeletonHeroBanner — pulsing placeholder matching HeroBanner dimensions.
 * Displayed while useBrowse data is loading to prevent blank areas above the fold.
 * Matches h-[180px] md:h-[300px], mx-4 md:mx-8, rounded-2xl of HeroBanner.
 */
export function SkeletonHeroBanner() {
  return (
    <div className="animate-pulse rounded-2xl mx-4 md:mx-8 mb-4 bg-gray-200/10 h-[180px] md:h-[300px]" />
  )
}
