import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'
import type { Expert } from './resultsSlice'

export interface NavigationSlice {
  // Navigation data fields — NOT persisted to localStorage
  navigationSource: 'browse' | 'sage' | 'direct'
  pendingSageResults: Expert[] | null
  pendingSearchQuery: string | null

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

  setNavigationSource: (source) => set({ navigationSource: source }),

  setPendingSageResults: (experts, query) =>
    set({ pendingSageResults: experts, pendingSearchQuery: query }),

  clearPendingSageResults: () =>
    set({ pendingSageResults: null, pendingSearchQuery: null }),
})
