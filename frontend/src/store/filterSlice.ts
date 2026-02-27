import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'

export interface FilterSlice {
  // Filter data fields — these are persisted to localStorage
  query: string
  rateMin: number
  rateMax: number
  tags: string[]
  industryTags: string[]
  sortBy: 'relevance' | 'rate_asc' | 'rate_desc'
  sortOrder: 'asc' | 'desc'

  // View mode — persisted to localStorage
  viewMode: 'grid' | 'list'

  // Saved experts — managed via manual localStorage under tcs_saved_experts key (NOT in persist envelope)
  savedExperts: string[]

  // Saved experts filter — NOT persisted (ephemeral toggle)
  savedFilter: boolean

  // Filter actions
  setQuery: (q: string) => void
  setRateRange: (min: number, max: number) => void
  toggleTag: (tag: string) => void
  setTags: (tags: string[]) => void
  toggleIndustryTag: (tag: string) => void
  resetIndustryTags: () => void
  setSortBy: (sortBy: FilterSlice['sortBy']) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setSavedFilter: (v: boolean) => void
  toggleSavedExpert: (username: string) => void
  resetFilters: () => void
}

const filterDefaults = {
  query: '',
  rateMin: 0,
  rateMax: 5000,
  tags: [] as string[],
  industryTags: [] as string[],
  sortBy: 'relevance' as const,
  sortOrder: 'desc' as const,
  viewMode: 'grid' as const,
  savedFilter: false,
}

function hydratesavedExperts(): string[] {
  try {
    const raw = localStorage.getItem('tcs_saved_experts')
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch { return [] }
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
  // Hydrate savedExperts from localStorage at store creation time
  // NOT inside partialize — we manage this key (tcs_saved_experts) manually
  savedExperts: hydratesavedExperts(),

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

  toggleIndustryTag: (tag) => {
    get().setSageMode(false)
    set((state) => ({
      industryTags: state.industryTags.includes(tag)
        ? state.industryTags.filter((t) => t !== tag)
        : [...state.industryTags, tag],
    }))
  },

  resetIndustryTags: () => {
    get().setSageMode(false)
    set({ industryTags: [] })
  },

  setSortBy: (sortBy) => set({ sortBy }),  // sort does NOT exit sage mode

  setViewMode: (mode) => set({ viewMode: mode }),

  setSavedFilter: (v) => set({ savedFilter: v }),

  toggleSavedExpert: (username) => set((state) => {
    const next = state.savedExperts.includes(username)
      ? state.savedExperts.filter(u => u !== username)
      : [...state.savedExperts, username]
    localStorage.setItem('tcs_saved_experts', JSON.stringify(next))
    return { savedExperts: next }
  }),

  resetFilters: () => {
    get().setSageMode(false)
    // Reset filter state but preserve savedExperts — resetting filters should not un-bookmark experts
    set({ ...filterDefaults })
  },
})
