import type { Message } from '../types'
import ExpertCard from './ExpertCard'

interface Props {
  message: Message
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? 'order-1' : ''}`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-brand-black text-white rounded-br-sm'
              : 'bg-neutral-100 text-neutral-900 rounded-bl-sm'
          }`}
        >
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 ml-0.5 bg-neutral-500 animate-pulse align-middle" />
          )}
        </div>

        {/* Expert Cards — stacked vertically, rendered below assistant message */}
        {!isUser && message.experts && message.experts.length > 0 && (
          <div className="mt-3 space-y-3">
            {message.experts.map((expert) => (
              <ExpertCard key={expert.profile_url} expert={expert} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
