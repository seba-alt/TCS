import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'

// Matches the /api/explore response contract from Phase 14
export interface Expert {
  username: string
  firstName: string
  lastName: string
  jobTitle: string
  company: string
  hourlyRate: number
  tags: string[]
  findabilityScore: number
  matchReason: string | null
}

export interface ResultsSlice {
  // Results data fields — NOT persisted to localStorage
  experts: Expert[]
  total: number
  cursor: number | null
  loading: boolean
  error: string | null

  // Results actions
  setResults: (experts: Expert[], total: number, cursor: number | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  resetResults: () => void
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

  setResults: (experts, total, cursor) => set({ experts, total, cursor }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  resetResults: () =>
    set({ experts: [], total: 0, cursor: null, loading: false, error: null }),
})
