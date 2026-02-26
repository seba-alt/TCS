import { useEffect, useRef } from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { useExplorerStore } from '../../store'
import { useSage } from '../../hooks/useSage'
import { SageMessage } from './SageMessage'
import { SageInput } from './SageInput'

// Greeting shown when conversation is empty (first open) — mirrors SagePanel
const SAGE_GREETING = "Hey! I'm Sage — tell me what kind of expert you need and I'll find the right people."

interface SageMobileSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Mobile Sage bottom sheet — fixed 60% height, non-draggable.
 * Wraps Sage chat in a Vaul Drawer. Auto-closes 2s after a
 * discovery query completes (sageMode=true) so the user sees results.
 */
export function SageMobileSheet({ open, onClose }: SageMobileSheetProps) {
  const { messages, isStreaming, handleSend } = useSage()
  const sageMode = useExplorerStore((s) => s.sageMode)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  // Auto-close after discovery query: watch isStreaming transition true→false while sageMode=true
  const prevStreamingRef = useRef(isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current === true && isStreaming === false && sageMode) {
      const t = setTimeout(() => onClose(), 2000)
      return () => clearTimeout(t)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, sageMode, onClose])

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      // dismissible=false disables swipe-to-dismiss — close button only (per CONTEXT.md)
      dismissible={false}
      modal={true}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl flex flex-col"
          style={{
            height: '60vh',
            background: 'oklch(12% 0.025 279 / 0.97)',
          }}
        >
          {/* NO drag handle — not draggable per CONTEXT.md */}

          {/* Header with close button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center">
                <img src="/icon.png" alt="Tinrate" className="w-4 h-4 object-contain brightness-0 invert" />
              </div>
              <span className="font-semibold text-white text-sm">Sage</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
              aria-label="Close Sage"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages — scrollable */}
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

          {/* Input — pinned to bottom with safe-area inset for notched phones */}
          <div className="shrink-0 pb-safe">
            <SageInput onSend={handleSend} disabled={isStreaming} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
