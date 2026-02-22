import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { useExplorerStore } from '../../store'
import { useSage } from '../../hooks/useSage'
import { SageMessage } from './SageMessage'
import { SageInput } from './SageInput'

// Greeting shown when conversation is empty (first open)
const SAGE_GREETING = "Hi! I'm Sage. Tell me what kind of expert you're looking for and I'll update the results for you."

export function SagePanel() {
  const setOpen = useExplorerStore((s) => s.setOpen)
  const { messages, isStreaming, handleSend } = useSage()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-0 right-0 z-40 h-full w-full md:w-[380px] glass-surface shadow-2xl flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="font-semibold text-white text-sm">Sage</span>
          <span className="text-xs text-white/50">AI assistant</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {/* Greeting shown when conversation is empty */}
        {messages.length === 0 && (
          <SageMessage role="assistant" content={SAGE_GREETING} />
        )}
        {messages.map((msg) => (
          <SageMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {/* Typing indicator while Gemini processes */}
        {isStreaming && (
          <div className="flex justify-start mb-3">
            <div className="w-6 h-6 rounded-full bg-brand-purple flex items-center justify-center mr-2 shrink-0">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div className="bg-white/10 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <SageInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </motion.div>
  )
}
