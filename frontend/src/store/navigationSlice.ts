import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'
import type { Expert } from './resultsSlice'

/** Cached browse API response — stored in-memory (not persisted) */
export interface CachedBrowseData {
  featured: Array<{
    username: string
    first_name: string
    last_name: string
    job_title: string
    company: string
    hourly_rate: number
    category: string | null
    tags: string[]
    photo_url: string | null
    profile_url: string
  }>
  rows: Array<{
    title: string
    slug: string
    experts: Array<{
      username: string
      first_name: string
      last_name: string
      job_title: string
      company: string
      hourly_rate: number
      category: string | null
      tags: string[]
      photo_url: string | null
      profile_url: string
    }>
    total: number
  }>
}

export interface NavigationSlice {
  // Navigation data fields — NOT persisted to localStorage
  navigationSource: 'browse' | 'sage' | 'direct'
  pendingSageResults: Expert[] | null
  pendingSearchQuery: string | null

  // Browse data cache — in-memory only, 5-minute TTL
  browseData: { data: CachedBrowseData; cachedAt: number } | null
  setBrowseData: (data: CachedBrowseData) => void

  // Navigation actions
  setNavigationSource: (source: NavigationSlice['navigationSource']) => void
  setPendingSageResults: (experts: Expert[], query: string) => void
  clearPendingSageResults: () => void
}

export const createNavigationSlice: StateCreator<
  ExplorerStore,
  [['zustand/persist', unknown]],
  [],
  NavigationSlice
> = (set) => ({
  navigationSource: 'direct',
  pendingSageResults: null,
  pendingSearchQuery: null,
  browseData: null,

  setNavigationSource: (source) => set({ navigationSource: source }),

  setBrowseData: (data) => set({ browseData: { data, cachedAt: Date.now() } }),

  setPendingSageResults: (experts, query) =>
    set({ pendingSageResults: experts, pendingSearchQuery: query }),

  clearPendingSageResults: () =>
    set({ pendingSageResults: null, pendingSearchQuery: null }),
})
