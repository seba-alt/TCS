import { useRef } from 'react'
import { ArrowUp } from 'lucide-react'

interface SageInputProps {
  onSend: (text: string) => void
  disabled?: boolean
}

export function SageInput({ onSend, disabled = false }: SageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    const val = textareaRef.current?.value.trim()
    if (!val || disabled) return
    onSend(val)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      // Reset height after clear
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="flex items-end gap-2 border-t border-gray-100 p-3">
      <textarea
        ref={textareaRef}
        rows={1}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        placeholder="Ask Sage..."
        className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-purple transition-colors max-h-32 overflow-y-auto disabled:opacity-50"
        style={{ height: 'auto' }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-8 h-8 rounded-full bg-brand-purple text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-purple-700 transition-colors"
      >
        <ArrowUp size={16} />
      </button>
    </div>
  )
}
