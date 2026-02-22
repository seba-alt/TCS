import { useEffect, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { useFilterSlice } from '../../store'

export function RateSlider() {
  const { rateMin, rateMax, setRateRange } = useFilterSlice()

  // Local display state — updated continuously during drag (does NOT trigger fetch)
  const [localValue, setLocalValue] = useState<[number, number]>([rateMin, rateMax])

  // Sync from store when store values change externally (e.g. clear all)
  useEffect(() => {
    setLocalValue([rateMin, rateMax])
  }, [rateMin, rateMax])

  return (
    <div className="px-1">
      {/* Display labels — show local values during drag for immediate feedback */}
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>EUR {localValue[0]}</span>
        <span>EUR {localValue[1]}</span>
      </div>

      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        min={0}
        max={5000}
        step={10}
        minStepsBetweenThumbs={1}
        value={localValue}
        onValueChange={(val) => setLocalValue(val as [number, number])}
        onValueCommit={(val) => setRateRange(val[0], val[1])}
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
  )
}
