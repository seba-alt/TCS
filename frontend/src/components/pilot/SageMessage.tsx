interface SageMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export function SageMessage({ role, content }: SageMessageProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-brand-purple flex items-center justify-center mr-2 shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">S</span>
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-brand-purple text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
