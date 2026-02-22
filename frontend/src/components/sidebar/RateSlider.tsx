import { useEffect, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { useFilterSlice, useExplorerStore } from '../../store'
import { trackEvent } from '../../tracking'

export function RateSlider() {
  const { rateMin, rateMax, setRateRange } = useFilterSlice()
  const sageMode = useExplorerStore((s) => s.sageMode)

  // Local display state — updated continuously during drag (does NOT trigger fetch)
  const [localValue, setLocalValue] = useState<[number, number]>([rateMin, rateMax])
  const [showSageConfirm, setShowSageConfirm] = useState(false)
  const [pendingRange, setPendingRange] = useState<[number, number] | null>(null)

  // Sync from store when store values change externally (e.g. clear all)
  useEffect(() => {
    setLocalValue([rateMin, rateMax])
  }, [rateMin, rateMax])

  function handleValueCommit(val: number[]) {
    const range: [number, number] = [val[0], val[1]]

    // Sage mode: show confirmation before committing the rate range
    if (sageMode) {
      setPendingRange(range)
      setShowSageConfirm(true)
      return  // Do NOT call setRateRange yet
    }

    // Normal mode: commit immediately
    setRateRange(range[0], range[1])
    void trackEvent('filter_change', {
      filter: 'rate',
      value: [range[0], range[1]],
    })
  }

  function handleSageConfirmSwitch() {
    setShowSageConfirm(false)
    if (pendingRange !== null) {
      // setRateRange calls setSageMode(false) via filterSlice and triggers useExplore
      setRateRange(pendingRange[0], pendingRange[1])
      void trackEvent('filter_change', {
        filter: 'rate',
        value: [pendingRange[0], pendingRange[1]],
      })
    }
    setPendingRange(null)
  }

  function handleSageConfirmCancel() {
    setShowSageConfirm(false)
    // Revert local display to committed store values
    setLocalValue([rateMin, rateMax])
    setPendingRange(null)
  }

  return (
    <div className="px-1 relative">
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

      {showSageConfirm && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
          <p className="mb-1.5">Switch to filter mode? Sage results will be replaced.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSageConfirmSwitch}
              className="bg-brand-purple text-white rounded px-2 py-0.5 hover:bg-purple-700 transition-colors"
            >
              Switch
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSageConfirmCancel}
              className="text-gray-300 hover:text-white transition-colors px-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
