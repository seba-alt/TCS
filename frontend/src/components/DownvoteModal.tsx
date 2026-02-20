import { useState, useEffect, useCallback } from 'react'

const REASONS = [
  'Wrong experts shown',
  'Experts not relevant to my problem',
  'Experts seem unavailable or too expensive',
  'Other',
]

interface Props {
  onClose: () => void
  onSubmit: (reasons: string[], comment: string) => Promise<void>
}

export default function DownvoteModal({ onClose, onSubmit }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const showCommentField = selected.has('Other')

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const toggleReason = (reason: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(reason)) {
        next.delete(reason)
      } else {
        next.add(reason)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    await onSubmit(Array.from(selected), comment)
    // onSubmit closes the modal via closeModal()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-800">
            Help us improve
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-600 transition-colors -mt-0.5 ml-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-neutral-500 mb-4">
          What went wrong? (optional — your vote is already recorded)
        </p>

        {/* Checkboxes */}
        <div className="space-y-2.5 mb-4">
          {REASONS.map((reason) => (
            <label key={reason} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(reason)}
                onChange={() => toggleReason(reason)}
                className="w-4 h-4 rounded border-neutral-300 text-brand-purple focus:ring-brand-purple accent-brand-purple"
              />
              <span className="text-sm text-neutral-700">{reason}</span>
            </label>
          ))}
        </div>

        {/* Free-text field — only visible when "Other" is checked */}
        {showCommentField && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more..."
            maxLength={1000}
            rows={3}
            className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple"
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-xl text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (selected.size === 0 && !comment.trim())}
            className="text-sm px-4 py-2 rounded-xl bg-brand-purple text-white hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending...' : 'Send feedback'}
          </button>
        </div>
      </div>
    </div>
  )
}
