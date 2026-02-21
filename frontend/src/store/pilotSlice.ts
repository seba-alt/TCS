import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'

export interface PilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface PilotSlice {
  // Pilot data fields — NOT persisted to localStorage
  messages: PilotMessage[]
  isOpen: boolean
  isStreaming: boolean
  sessionId: string | null

  // Pilot actions
  addMessage: (msg: PilotMessage) => void
  setOpen: (open: boolean) => void
  setStreaming: (streaming: boolean) => void
  setSessionId: (id: string | null) => void
  resetPilot: () => void
}

export const createPilotSlice: StateCreator<
  ExplorerStore,
  [['zustand/persist', unknown]],
  [],
  PilotSlice
// Access filter state: get().query, get().tags, etc.
// The StateCreator receives get as third argument — the pilot can use this
// to read current filter state when constructing Gemini requests in Phase 18+
> = (set, _get) => ({
  messages: [],
  isOpen: false,
  isStreaming: false,
  sessionId: null,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setOpen: (open) => set({ isOpen: open }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setSessionId: (id) => set({ sessionId: id }),

  resetPilot: () =>
    set({ messages: [], isOpen: false, isStreaming: false, sessionId: null }),
})
