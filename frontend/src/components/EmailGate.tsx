/**
 * EmailGate — inline email capture form rendered below locked Expert Cards.
 *
 * Design decisions:
 * - No modal, no slide-in panel — plain JSX in the chat message flow (per CONTEXT.md)
 * - Mandatory gate: no dismiss, no skip, no close button
 * - Unlock is instant: parent unmounts this component on isUnlocked=true (no fade)
 * - Loading state: spinner + disabled input while backend call is in flight
 * - Backend failure: onSubmit (useEmailGate.submitEmail) unlocks on localStorage write;
 *   this component just shows loading until the Promise resolves
 * - Uses animate-spin pattern matching existing ChatInput.tsx spinner
 */
import { useState, type FormEvent } from 'react'

interface Props {
  onSubmit: (email: string) => Promise<void>
}

export default function EmailGate({ onSubmit }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()

    // Client-side validation: simple regex is sufficient for UX feedback.
    // Server-side Pydantic EmailStr is the authoritative validator.
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!isValidEmail) {
      setError('Please enter a valid email address.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      await onSubmit(trimmed)
      // Parent sets isUnlocked=true → this component unmounts, cleaning all form state
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-sm font-semibold text-neutral-900 mb-1">
        Unlock expert profiles
      </p>
      <p className="text-xs text-neutral-500 mb-3">
        Enter your email to view full profiles and connect with experts.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        <input
          type="email"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null) }}
          disabled={loading}
          placeholder="you@example.com"
          aria-label="Email address"
          aria-required="true"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'email-gate-error' : undefined}
          className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed mb-2"
        />
        {error && (
          <p id="email-gate-error" className="text-xs text-red-500 mb-2" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="w-full rounded-xl bg-brand-purple text-white text-sm font-semibold py-2.5 hover:bg-purple-700 active:bg-purple-800 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin w-4 h-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Unlocking…
            </>
          ) : (
            'Unlock profiles'
          )}
        </button>
        <p className="text-xs text-neutral-400 text-center mt-2">We'll never spam you.</p>
      </form>
    </div>
  )
}
