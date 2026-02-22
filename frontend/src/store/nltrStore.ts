import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface NltrState {
  subscribed: boolean
  email: string | null
  spinTrigger: boolean        // ephemeral — NOT persisted (see partialize)
  setSubscribed: (email: string) => void
  triggerSpin: () => void
  resetSpin: () => void
}

export const useNltrStore = create<NltrState>()(
  persist(
    (set) => ({
      subscribed: false,
      email: null,
      spinTrigger: false,
      setSubscribed: (email: string) => set({ subscribed: true, email }),
      triggerSpin: () => set({ spinTrigger: true }),
      resetSpin: () => set({ spinTrigger: false }),
    }),
    {
      name: 'tinrate-newsletter-v1',  // LOCKED — do NOT change
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        subscribed: state.subscribed,
        email: state.email,
        // spinTrigger intentionally excluded — ephemeral UI state only
      }),
    }
  )
)
