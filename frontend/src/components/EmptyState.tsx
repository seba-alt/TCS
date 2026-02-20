const EXAMPLES = [
  "I need to scale my e-commerce store to $1M revenue — where do I start?",
  "Looking for a fractional CFO who's done Series A fundraising before",
  "Need an employment lawyer to review a contractor agreement",
  "I want to grow my LinkedIn from 0 to 10k followers in 6 months",
]

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-neutral-900 mb-4 leading-tight">
          What are you trying<br className="hidden sm:block" /> to figure out?
        </h2>
        <p className="text-neutral-500 max-w-sm mx-auto text-base leading-relaxed">
          Tell me your problem in plain English — no pitch decks, no buzzwords.
          I'll find three people who've actually solved it.
        </p>
      </div>

      <div className="w-full max-w-md">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">
          People come here with things like...
        </p>
        <div className="flex flex-col gap-2.5">
          {EXAMPLES.map((example) => (
            <div
              key={example}
              className="text-left px-4 py-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 text-sm text-neutral-600 leading-relaxed"
            >
              "{example}"
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
