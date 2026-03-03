import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'

// Matches the /api/explore response contract — snake_case field names
export interface Expert {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  hourly_rate: number
  currency: string
  profile_url: string
  photo_url: string | null
  tags: string[]
  findability_score: number | null
  match_reason: string | null
}

export interface ResultsSlice {
  // Results data fields — NOT persisted to localStorage
  experts: Expert[]
  total: number
  cursor: number | null
  loading: boolean
  error: string | null
  isFetchingMore: boolean
  maxRate: number  // highest hourly_rate in current filtered results (from API max_rate)

  // Retry mechanism — counter incremented by retry() triggers re-fetch in useExplore
  retryTrigger: number

  // Results actions
  setResults: (experts: Expert[], total: number, cursor: number | null, maxRate: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  resetResults: () => void
  appendResults: (experts: Expert[], cursor: number | null) => void
  setFetchingMore: (v: boolean) => void
  retry: () => void
}

export const createResultsSlice: StateCreator<
  ExplorerStore,
  [['zustand/persist', unknown]],
  [],
  ResultsSlice
> = (set) => ({
  experts: [],
  total: 0,
  cursor: null,
  loading: false,
  error: null,
  isFetchingMore: false,
  maxRate: 5000,
  retryTrigger: 0,

  setResults: (experts, total, cursor, maxRate) => set({ experts, total, cursor, maxRate }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  resetResults: () =>
    set({ experts: [], total: 0, cursor: null, loading: false, error: null, maxRate: 5000 }),

  appendResults: (newExperts, cursor) =>
    set((state) => ({ experts: [...state.experts, ...newExperts], cursor })),

  setFetchingMore: (v) => set({ isFetchingMore: v }),

  retry: () => set((s) => ({ error: null, retryTrigger: s.retryTrigger + 1 })),
})
