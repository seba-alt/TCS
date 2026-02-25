import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'

export interface FilterSlice {
  // Filter data fields — these are persisted to localStorage
  query: string
  rateMin: number
  rateMax: number
  tags: string[]
  sortBy: 'relevance' | 'rate_asc' | 'rate_desc'
  sortOrder: 'asc' | 'desc'

  // Saved experts filter — NOT persisted (ephemeral toggle)
  savedFilter: boolean

  // Filter actions
  setQuery: (q: string) => void
  setRateRange: (min: number, max: number) => void
  toggleTag: (tag: string) => void
  setTags: (tags: string[]) => void
  setSortBy: (sortBy: FilterSlice['sortBy']) => void
  setSavedFilter: (v: boolean) => void
  resetFilters: () => void
}

const filterDefaults = {
  query: '',
  rateMin: 0,
  rateMax: 5000,
  tags: [] as string[],
  sortBy: 'relevance' as const,
  sortOrder: 'desc' as const,
  savedFilter: false,
}

// Use unknown for the persist type parameter to avoid circular reference
// The combined store in index.ts carries the full type
export const createFilterSlice: StateCreator<
  ExplorerStore,
  [['zustand/persist', unknown]],
  [],
  FilterSlice
> = (set, get) => ({
  ...filterDefaults,

  setQuery: (q) => {
    get().setSageMode(false)
    set({ query: q })
  },

  setRateRange: (min, max) => {
    get().setSageMode(false)
    set({ rateMin: min, rateMax: max })
  },

  toggleTag: (tag) => {
    get().setSageMode(false)
    set((state) => ({
      tags: state.tags.includes(tag)
        ? state.tags.filter((t) => t !== tag)
        : [...state.tags, tag],
    }))
  },

  setTags: (tags) => {
    get().setSageMode(false)
    set({ tags })
  },

  setSortBy: (sortBy) => set({ sortBy }),  // sort does NOT exit sage mode

  setSavedFilter: (v) => set({ savedFilter: v }),

  resetFilters: () => {
    get().setSageMode(false)
    set({ ...filterDefaults })
  },
})
