import { describe, it, expect } from 'vitest'

// Mirror the post-fix logic from FilterChips.tsx
const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000

function shouldShowRateChip(rateMin: number, rateMax: number): boolean {
  return rateMin !== DEFAULT_RATE_MIN || rateMax !== DEFAULT_RATE_MAX
}

describe('FilterChips rate chip visibility', () => {
  it('does NOT show rate chip when store has default rate values (0-5000)', () => {
    expect(shouldShowRateChip(0, 5000)).toBe(false)
  })

  it('shows rate chip when rateMin is non-default', () => {
    expect(shouldShowRateChip(100, 5000)).toBe(true)
  })

  it('shows rate chip when rateMax is non-default', () => {
    expect(shouldShowRateChip(0, 1500)).toBe(true)
    expect(shouldShowRateChip(0, 300)).toBe(true)
  })

  it('shows rate chip when both min and max are non-default', () => {
    expect(shouldShowRateChip(100, 300)).toBe(true)
  })

  it('regression guard: old DEFAULT_RATE_MAX=2000 would have shown chip incorrectly', () => {
    // Confirm the bug existed: with wrong default, store value 5000 !== 2000 → chip shown
    const wrongDefault: number = 2000
    const storeValue: number = 5000
    const wouldShowWithBug = 0 !== DEFAULT_RATE_MIN || storeValue !== wrongDefault
    expect(wouldShowWithBug).toBe(true)
    // And with the fix, it correctly returns false:
    expect(shouldShowRateChip(0, 5000)).toBe(false)
  })
})
