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
  sageMode: boolean

  // Retry mechanism — counter incremented by retry() triggers re-fetch in useExplore
  retryTrigger: number

  // Results actions
  setResults: (experts: Expert[], total: number, cursor: number | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  resetResults: () => void
  appendResults: (experts: Expert[], cursor: number | null) => void
  setFetchingMore: (v: boolean) => void
  setSageMode: (v: boolean) => void
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
  sageMode: false,
  retryTrigger: 0,

  setResults: (experts, total, cursor) => set({ experts, total, cursor }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  resetResults: () =>
    set({ experts: [], total: 0, cursor: null, loading: false, error: null, sageMode: false }),

  appendResults: (newExperts, cursor) =>
    set((state) => ({ experts: [...state.experts, ...newExperts], cursor })),

  setFetchingMore: (v) => set({ isFetchingMore: v }),

  setSageMode: (v) => set({ sageMode: v }),

  retry: () => set((s) => ({ error: null, retryTrigger: s.retryTrigger + 1 })),
})
