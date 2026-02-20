import { useEffect, useRef } from 'react'
import Header from './components/Header'
import ChatInput from './components/ChatInput'
import ChatMessage from './components/ChatMessage'
import EmptyState from './components/EmptyState'
import { useChat } from './hooks/useChat'

// v1: email is a fixed placeholder — user auth is out of scope (see REQUIREMENTS.md)
const PLACEHOLDER_EMAIL = 'user@tinrate.com'

export default function App() {
  const { messages, status, sendMessage, retryLast } = useChat({
    email: PLACEHOLDER_EMAIL,
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const isLoading = status === 'thinking' || status === 'streaming'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Fixed top header */}
      <Header />

      {/* Scrollable message area — padded so content clears fixed header (pt-16) and fixed input (pb-24) */}
      <main
        className="flex-1 overflow-y-auto pt-16 pb-24 px-4"
        aria-live="polite"
        aria-label="Conversation"
      >
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <EmptyState
              onPromptSelect={(prompt) => sendMessage(prompt)}
            />
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {/* Status message during loading — shown below last user message */}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex items-center gap-2 text-sm text-neutral-500 mb-3 pl-1">
                  <svg className="animate-spin w-4 h-4 text-brand-purple" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Finding experts...
                </div>
              )}

              {/* Error retry button */}
              {status === 'error' && (
                <div className="flex justify-center mb-3">
                  <button
                    onClick={retryLast}
                    className="text-sm text-brand-purple underline hover:text-purple-700"
                  >
                    Retry
                  </button>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Fixed bottom input */}
      <ChatInput onSubmit={sendMessage} disabled={isLoading} />
    </div>
  )
}
