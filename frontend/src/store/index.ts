import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import { createFilterSlice } from './filterSlice'
import { createResultsSlice } from './resultsSlice'

import type { FilterSlice } from './filterSlice'
import type { ResultsSlice } from './resultsSlice'

// Re-export types for consumers
export type { FilterSlice, ResultsSlice }
export type { Expert } from './resultsSlice'

// Combined store type
export type ExplorerStore = FilterSlice & ResultsSlice

// Combined store with persist middleware
// Only filter DATA fields are persisted — never actions, never results
export const useExplorerStore = create<ExplorerStore>()(
  persist(
    (...a) => ({
      ...createFilterSlice(...a),
      ...createResultsSlice(...a),
    }),
    {
      name: 'explorer-filters',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // Only persist filter DATA fields — never actions, never results
      partialize: (state) => ({
        query:        state.query,
        rateMin:      state.rateMin,
        rateMax:      state.rateMax,
        tags:         state.tags,
        industryTags: state.industryTags,
        sortBy:       state.sortBy,
        sortOrder:    state.sortOrder,
        viewMode:     state.viewMode,
      }),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          // v1 → v2: add industryTags field (default empty array)
          state.industryTags = []
        }
        return state as unknown as ExplorerStore
      },
      onRehydrateStorage: () => (_state) => {
      },
    }
  )
)

// Slice hooks using useShallow to avoid infinite re-renders with object selectors
export const useFilterSlice = () =>
  useExplorerStore(
    useShallow((state) => ({
      query:               state.query,
      rateMin:             state.rateMin,
      rateMax:             state.rateMax,
      tags:                state.tags,
      industryTags:        state.industryTags,
      sortBy:              state.sortBy,
      sortOrder:           state.sortOrder,
      viewMode:            state.viewMode,
      savedExperts:        state.savedExperts,
      savedFilter:         state.savedFilter,
      setQuery:            state.setQuery,
      setRateRange:        state.setRateRange,
      toggleTag:           state.toggleTag,
      setTags:             state.setTags,
      toggleIndustryTag:   state.toggleIndustryTag,
      resetIndustryTags:   state.resetIndustryTags,
      setSortBy:           state.setSortBy,
      setViewMode:         state.setViewMode,
      setSavedFilter:      state.setSavedFilter,
      toggleSavedExpert:   state.toggleSavedExpert,
      resetFilters:        state.resetFilters,
    }))
  )

export const useResultsSlice = () =>
  useExplorerStore(
    useShallow((state) => ({
      experts:          state.experts,
      total:            state.total,
      cursor:           state.cursor,
      loading:          state.loading,
      error:            state.error,
      isFetchingMore:   state.isFetchingMore,
      retryTrigger:     state.retryTrigger,
      setResults:       state.setResults,
      setLoading:       state.setLoading,
      setError:         state.setError,
      resetResults:     state.resetResults,
      appendResults:    state.appendResults,
      setFetchingMore:  state.setFetchingMore,
      retry:            state.retry,
    }))
  )
