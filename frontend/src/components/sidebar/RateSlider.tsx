import { useEffect, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { useFilterSlice, useExplorerStore } from '../../store'
import { trackEvent } from '../../tracking'

export function RateSlider() {
  const { rateMin, rateMax, setRateRange } = useFilterSlice()
  const maxRate = useExplorerStore((s) => s.maxRate)

  // Compute dynamic slider ceiling from API max_rate.
  // Floor at 10 to prevent a degenerate 0-0 range.
  // Round up to the nearest 10 for clean step alignment.
  const sliderMax = Math.max(maxRate, 10)
  const roundedMax = Math.ceil(sliderMax / 10) * 10

  // Local display state — updated continuously during drag (does NOT trigger fetch)
  const [localValue, setLocalValue] = useState<[number, number]>([rateMin, rateMax])

  // Sync from store when store values change externally (e.g. clear all)
  useEffect(() => {
    setLocalValue([rateMin, rateMax])
  }, [rateMin, rateMax])

  // Auto-adjust local and store values when the dynamic max shrinks below the
  // current selection (e.g. a tag filter narrows to lower-rate experts).
  useEffect(() => {
    setLocalValue(([min, max]) => [
      Math.min(min, roundedMax),
      Math.min(max, roundedMax),
    ])
    // Also commit to store if current store values exceed new max
    if (rateMax > roundedMax) {
      setRateRange(Math.min(rateMin, roundedMax), roundedMax)
    }
  }, [roundedMax]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleValueCommit(val: number[]) {
    const range: [number, number] = [val[0], val[1]]
    setRateRange(range[0], range[1])
    void trackEvent('filter_change', {
      filter: 'rate',
      value: [range[0], range[1]],
    })
  }

  return (
    <div className="px-1 relative">
      {/* Display labels — show local values during drag for immediate feedback */}
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>€{localValue[0]}</span>
        <span>€{localValue[1]}</span>
      </div>

      <div className="transition-all duration-300">
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          min={0}
          max={roundedMax}
          step={10}
          minStepsBetweenThumbs={1}
          value={localValue}
          onValueChange={(val) => setLocalValue(val as [number, number])}
          onValueCommit={handleValueCommit}
        >
          <Slider.Track className="bg-gray-200 relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-brand-purple rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb
            className="block w-4 h-4 bg-white border-2 border-brand-purple rounded-full shadow focus:outline-none"
            aria-label="Minimum rate"
          />
          <Slider.Thumb
            className="block w-4 h-4 bg-white border-2 border-brand-purple rounded-full shadow focus:outline-none"
            aria-label="Maximum rate"
          />
        </Slider.Root>
      </div>

      {/* Dynamic max rate label — updates when filtered results change */}
      <p className="text-xs text-gray-400 mt-1.5 text-right">
        €{roundedMax}/hr max
      </p>
    </div>
  )
}
