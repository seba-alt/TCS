import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'
import { trackEvent } from '../tracking'

export interface FilterSlice {
  // Filter data fields — these are persisted to localStorage
  query: string
  rateMin: number
  rateMax: number
  tags: string[]
  industryTags: string[]

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
> = (set) => ({
  ...filterDefaults,
  // Hydrate savedExperts from localStorage at store creation time
  // NOT inside partialize — we manage this key (tcs_saved_experts) manually
  savedExperts: hydratesavedExperts(),

  setQuery: (q) => set({ query: q }),

  setRateRange: (min, max) => set({ rateMin: min, rateMax: max }),

  toggleTag: (tag) => set((state) => {
    const isRemoving = state.tags.includes(tag)
    return {
      tags: isRemoving
        ? state.tags.filter((t) => t !== tag)
        : [...state.tags, tag],
      // Clear search query when adding a tag (clicking a tag resets search)
      ...(isRemoving ? {} : { query: '' }),
    }
  }),

  setTags: (tags) => set({ tags }),

  toggleIndustryTag: (tag) => set((state) => {
    const isRemoving = state.industryTags.includes(tag)
    return {
      industryTags: isRemoving
        ? state.industryTags.filter((t) => t !== tag)
        : [...state.industryTags, tag],
      // Clear search query when adding an industry tag
      ...(isRemoving ? {} : { query: '' }),
    }
  }),

  resetIndustryTags: () => set({ industryTags: [] }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setSavedFilter: (v) => set({ savedFilter: v }),

  toggleSavedExpert: (username) => set((state) => {
    const isRemoving = state.savedExperts.includes(username)
    const next = isRemoving
      ? state.savedExperts.filter(u => u !== username)
      : [...state.savedExperts, username]
    localStorage.setItem('tcs_saved_experts', JSON.stringify(next))

    // Fire-and-forget analytics event
    void trackEvent('save', {
      expert_id: username,
      action: isRemoving ? 'unsave' : 'save',
    })

    return { savedExperts: next }
  }),

  resetFilters: () => {
    // Reset filter state but preserve savedExperts — resetting filters should not un-bookmark experts
    set({ ...filterDefaults })
  },
})
