import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { useExplorerStore } from '../../store'
import { useSage } from '../../hooks/useSage'
import { SageMessage } from './SageMessage'
import { SageInput } from './SageInput'

// Greeting shown when conversation is empty (first open)
const SAGE_GREETING = "Hey! I'm Sage — tell me what kind of expert you need and I'll find the right people."

export function SagePanel() {
  const setOpen = useExplorerStore((s) => s.setOpen)
  const { messages, isStreaming, handleSend } = useSage()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [panelGlow, setPanelGlow] = useState(false)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  // Panel border glow when Sage finishes responding (FAB is hidden while panel is open)
  const prevStreamingRef = useRef(isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current === true && isStreaming === false) {
      setPanelGlow(true)
      const t = setTimeout(() => setPanelGlow(false), 1500)
      return () => clearTimeout(t)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 16 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="fixed bottom-6 right-6 z-40 pointer-events-none"
    >
      <motion.div
        animate={{
          boxShadow: panelGlow
            ? '0 0 28px 8px rgba(139, 92, 246, 0.5)'
            : '0 0 0px 0px rgba(139, 92, 246, 0)',
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="rounded-2xl"
      >
      <div
        className="pointer-events-auto w-[380px] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        style={{
          height: 'min(70vh, 560px)',
          background: 'oklch(12% 0.025 279 / 0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center">
              <img src="/icon.png" alt="Tinrate" className="w-4 h-4 object-contain brightness-0 invert" />
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
          {messages.length === 0 && (
            <SageMessage role="assistant" content={SAGE_GREETING} />
          )}
          {messages.map((msg) => (
            <SageMessage key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isStreaming && (
            <div className="flex justify-start mb-3">
              <div className="w-6 h-6 rounded-full bg-brand-purple flex items-center justify-center mr-2 shrink-0">
                <img src="/icon.png" alt="" className="w-3.5 h-3.5 object-contain brightness-0 invert" />
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
      </div>
      </motion.div>
    </motion.div>
  )
}
