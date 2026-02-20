import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import ChatInput from './components/ChatInput'
import ChatMessage from './components/ChatMessage'
import EmptyState from './components/EmptyState'
import { useChat } from './hooks/useChat'

const PLACEHOLDER_EMAIL = 'user@tinrate.com'

const THINKING_QUOTES = [
  "Consulting my Rolodex… (it's digital, relax)",
  "Cross-referencing expertise, rates, and vibes…",
  "Running the match algorithm. No pressure.",
  "Asking around. Discretely.",
  "Teaching AI to network so you don't have to.",
  "Scanning 900+ experts for your perfect match…",
  "Finding someone who's actually solved this before…",
  "Almost there — quality takes a second.",
]

export default function App() {
  const { messages, status, sendMessage, retryLast } = useChat({
    email: PLACEHOLDER_EMAIL,
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const isLoading = status === 'thinking' || status === 'streaming'
  const [quoteIndex, setQuoteIndex] = useState(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (status !== 'thinking') return
    setQuoteIndex(0)
    const interval = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % THINKING_QUOTES.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [status])

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header />

      <main
        className="flex-1 overflow-y-auto pt-20 pb-24 px-4"
        aria-live="polite"
        aria-label="Conversation"
      >
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((message, i) => {
                const isLastAssistant =
                  message.role === 'assistant' && i === messages.length - 1
                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    thinkingQuote={
                      isLastAssistant && status === 'thinking'
                        ? THINKING_QUOTES[quoteIndex]
                        : undefined
                    }
                  />
                )
              })}

              {status === 'error' && (
                <div className="flex justify-center mb-3">
                  <button
                    onClick={retryLast}
                    className="text-sm px-4 py-2 rounded-xl bg-brand-purple text-white hover:bg-purple-700 transition-colors"
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

      <ChatInput onSubmit={sendMessage} disabled={isLoading} />
    </div>
  )
}
