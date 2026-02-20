import { useFeedback } from '../hooks/useFeedback'
import DownvoteModal from './DownvoteModal'

interface Props {
  conversationId: number
  expertIds: string[]
  email: string | null
}

export default function FeedbackBar({ conversationId, expertIds, email }: Props) {
  const { vote, submitVote, modalOpen, closeModal, submitDownvoteDetail } = useFeedback({
    conversationId,
    expertIds,
    email,
  })

  return (
    <div className="mt-4 flex flex-col items-start gap-1.5">
      <p className="text-xs text-neutral-400">Were these results helpful?</p>
      <div className="flex items-center gap-2">
        {/* Thumbs up */}
        <button
          onClick={() => submitVote('up')}
          aria-label="Thumbs up"
          aria-pressed={vote === 'up'}
          className={`p-1.5 rounded-lg transition-colors ${
            vote === 'up'
              ? 'text-brand-purple'
              : 'text-neutral-400 hover:text-brand-purple'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill={vote === 'up' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
            className="w-5 h-5"
          >
            <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 0 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826L12.5 8h2.396a2 2 0 0 1 1.966 2.337l-1.053 6A2 2 0 0 1 13.843 18H9.828a2 2 0 0 1-1.414-.586l-1.914-1.914A1 1 0 0 1 6.5 15V8.86a1 1 0 0 1 .293-.707L10 4.5 11 3Z" />
          </svg>
        </button>

        {/* Thumbs down */}
        <button
          onClick={() => submitVote('down')}
          aria-label="Thumbs down"
          aria-pressed={vote === 'down'}
          className={`p-1.5 rounded-lg transition-colors ${
            vote === 'down'
              ? 'text-red-500'
              : 'text-neutral-400 hover:text-red-400'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill={vote === 'down' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
            className="w-5 h-5"
          >
            <path d="M19 11.75a1.25 1.25 0 1 1-2.5 0v-7.5a1.25 1.25 0 0 1 2.5 0v7.5ZM9 17v1.3c0 .268-.14.526-.395.607A2 2 0 0 1 6 17c0-.995.182-1.948.514-2.826L7.5 12H5.104a2 2 0 0 1-1.966-2.337l1.053-6A2 2 0 0 1 6.157 2h4.015a2 2 0 0 1 1.414.586l1.914 1.914A1 1 0 0 1 13.5 5v6.14a1 1 0 0 1-.293.707L10 15.5 9 17Z" />
          </svg>
        </button>
      </div>

      {modalOpen && (
        <DownvoteModal
          onClose={closeModal}
          onSubmit={submitDownvoteDetail}
        />
      )}
    </div>
  )
}
