import { useState, useCallback } from 'react'
import type { FeedbackVote } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface UseFeedbackOptions {
  conversationId: number
  expertIds: string[]
  email: string | null
}

interface UseFeedbackReturn {
  vote: FeedbackVote
  submitVote: (v: 'up' | 'down') => void
  modalOpen: boolean
  closeModal: () => void
  submitDownvoteDetail: (reasons: string[], comment: string) => Promise<void>
}

export function useFeedback({ conversationId, expertIds, email }: UseFeedbackOptions): UseFeedbackReturn {
  const [vote, setVote] = useState<FeedbackVote>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const postFeedback = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        await fetch(`${API_URL}/api/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch {
        // Intentional: backend failure is silent. UI state already updated.
      }
    },
    []
  )

  const submitVote = useCallback(
    (v: 'up' | 'down') => {
      if (vote === v) return // clicking already-selected thumb does nothing
      setVote(v)
      // Fire-and-forget — UI updates immediately; backend failure is silent
      void postFeedback({
        conversation_id: conversationId,
        vote: v,
        email: email ?? undefined,
        expert_ids: expertIds,
      })
      if (v === 'down') {
        setModalOpen(true)
      }
    },
    [vote, conversationId, expertIds, email, postFeedback]
  )

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  const submitDownvoteDetail = useCallback(
    async (reasons: string[], comment: string) => {
      await postFeedback({
        conversation_id: conversationId,
        vote: 'down',
        email: email ?? undefined,
        expert_ids: expertIds,
        reasons,
        comment: comment || undefined,
      })
      setModalOpen(false)
    },
    [conversationId, expertIds, email, postFeedback]
  )

  return { vote, submitVote, modalOpen, closeModal, submitDownvoteDetail }
}
