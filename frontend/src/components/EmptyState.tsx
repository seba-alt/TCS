interface Props {
  onPromptSelect: (prompt: string) => void
}

const EXAMPLE_PROMPTS = [
  "I need help scaling my e-commerce store to its first $1M in revenue",
  "I'm looking for a fractional CFO to help me raise a Series A",
  "I need an expert in employment law to review a contractor agreement",
]

export default function EmptyState({ onPromptSelect }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <p className="text-2xl font-semibold text-neutral-900 mb-2">
        What problem can I help you solve today?
      </p>
      <p className="text-sm text-neutral-500 mb-8 max-w-sm">
        Describe your challenge and I'll match you with three experts who can help.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-md">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptSelect(prompt)}
            className="text-left px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-700 hover:border-brand-purple hover:text-brand-purple transition-colors duration-150"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
