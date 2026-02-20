import type { Message } from '../types'
import ExpertCard from './ExpertCard'

interface Props {
  message: Message
  thinkingQuote?: string
}

export default function ChatMessage({ message, thinkingQuote }: Props) {
  const isUser = message.role === 'user'
  const isThinking = !isUser && message.isStreaming && !message.content

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? 'order-1' : ''}`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-brand-purple text-white rounded-br-sm'
              : 'bg-neutral-100 text-neutral-900 rounded-bl-sm'
          }`}
        >
          {isThinking ? (
            /* Skeleton loading bar while thinking */
            <div className="py-1 space-y-2.5 min-w-[180px]">
              <div className="h-2 rounded-full bg-neutral-200 animate-pulse" style={{ width: '82%' }} />
              <div className="h-2 rounded-full bg-neutral-200 animate-pulse" style={{ width: '60%' }} />
              <div className="h-2 rounded-full bg-neutral-200 animate-pulse" style={{ width: '72%' }} />
            </div>
          ) : (
            <>
              {message.content}
              {message.isStreaming && message.content && (
                <span className="inline-block w-0.5 h-4 ml-0.5 bg-purple-300 animate-pulse align-middle" />
              )}
            </>
          )}
        </div>

        {/* Thinking quote below the skeleton */}
        {isThinking && thinkingQuote && (
          <p className="text-xs text-neutral-400 italic mt-1.5 pl-1">
            {thinkingQuote}
          </p>
        )}

        {/* Expert Cards — stacked vertically, rendered below assistant message */}
        {!isUser && message.experts && message.experts.length > 0 && (
          <div className="mt-3 space-y-3">
            {message.experts.map((expert, i) => (
              <ExpertCard key={expert.profile_url ?? `${expert.name}-${i}`} expert={expert} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
