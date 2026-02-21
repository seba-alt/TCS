import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import { createFilterSlice } from './filterSlice'
import { createResultsSlice } from './resultsSlice'
import { createPilotSlice } from './pilotSlice'

import type { FilterSlice } from './filterSlice'
import type { ResultsSlice } from './resultsSlice'
import type { PilotSlice } from './pilotSlice'

// Re-export types for consumers
export type { FilterSlice, ResultsSlice, PilotSlice }
export type { Expert } from './resultsSlice'
export type { PilotMessage } from './pilotSlice'

// Combined store type
export type ExplorerStore = FilterSlice & ResultsSlice & PilotSlice

// Combined store with persist middleware
// Only filter DATA fields are persisted — never actions, never results, never pilot
export const useExplorerStore = create<ExplorerStore>()(
  persist(
    (...a) => ({
      ...createFilterSlice(...a),
      ...createResultsSlice(...a),
      ...createPilotSlice(...a),
    }),
    {
      name: 'explorer-filters',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist filter DATA fields — never actions, never results, never pilot
      partialize: (state) => ({
        query:     state.query,
        rateMin:   state.rateMin,
        rateMax:   state.rateMax,
        tags:      state.tags,
        sortBy:    state.sortBy,
        sortOrder: state.sortOrder,
      }),
      // Hook point for Phase 16 auto-search on rehydration
      onRehydrateStorage: () => (_state) => {
        // Phase 16+ wires: _state?.triggerSearch()
      },
    }
  )
)

// Slice hooks using useShallow to avoid infinite re-renders with object selectors
export const useFilterSlice = () =>
  useExplorerStore(
    useShallow((state) => ({
      query:        state.query,
      rateMin:      state.rateMin,
      rateMax:      state.rateMax,
      tags:         state.tags,
      sortBy:       state.sortBy,
      sortOrder:    state.sortOrder,
      setQuery:     state.setQuery,
      setRateRange: state.setRateRange,
      toggleTag:    state.toggleTag,
      setTags:      state.setTags,
      setSortBy:    state.setSortBy,
      resetFilters: state.resetFilters,
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
      setResults:       state.setResults,
      setLoading:       state.setLoading,
      setError:         state.setError,
      resetResults:     state.resetResults,
      appendResults:    state.appendResults,
      setFetchingMore:  state.setFetchingMore,
    }))
  )

export const usePilotSlice = () =>
  useExplorerStore(
    useShallow((state) => ({
      messages:     state.messages,
      isOpen:       state.isOpen,
      isStreaming:  state.isStreaming,
      sessionId:    state.sessionId,
      addMessage:   state.addMessage,
      setOpen:      state.setOpen,
      setStreaming:  state.setStreaming,
      setSessionId: state.setSessionId,
      resetPilot:   state.resetPilot,
    }))
  )
