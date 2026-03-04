/**
 * EmailEntryGate — Dark overlay with white card email gate.
 *
 * Blocks the entire Explorer until the visitor submits their email.
 * No dismiss path: no close button, no overlay click, no Escape key.
 * Only a valid email submission unlocks the Explorer.
 *
 * Design: Dark overlay + centered white card with logo, heading, email input, purple CTA.
 * Animation: motion/react AnimatePresence fade-in/out on mount/unmount (~300ms exit).
 */
import { useState, useRef, useEffect, type FormEvent } from 'react'
import { motion } from 'motion/react'

interface EmailEntryGateProps {
  onSubmit: (email: string) => void
}

export function EmailEntryGate({ onSubmit }: EmailEntryGateProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the email input after a short delay to ensure the overlay is rendered
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()

    // Validate on submit only — no real-time validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }

    setError(null)
    onSubmit(trimmed)
  }

  return (
    <motion.div
      key="entry-gate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(26, 26, 46, 0.95)' }}
    >
      {/* White card */}
      <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Tinrate"
          className="h-12 mb-2"
        />

        {/* Badge */}
        <span className="inline-block bg-gray-100 text-gray-500 text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full mb-6">
          Search
        </span>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Get Access
        </h2>

        {/* Subtitle */}
        <p className="text-gray-400 text-sm text-center mb-8 max-w-xs">
          Enter your email to unlock.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 w-full">
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null) }}
            placeholder="you@email.com"
            aria-label="Email address"
            aria-required="true"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'entry-gate-error' : undefined}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-brand-purple/40 focus:ring-2 focus:ring-brand-purple/20 transition-all"
          />

          {error && (
            <p id="entry-gate-error" className="text-red-500 text-xs" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!email.trim()}
            className="w-full py-4 rounded-2xl font-semibold text-sm text-white transition-all
              bg-brand-purple hover:bg-brand-purple/90
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-purple"
          >
            Get Access
          </button>
        </form>

        {/* Privacy note */}
        <p className="text-gray-400 text-xs text-center mt-4">
          We respect your privacy. No spam.
        </p>
      </div>
    </motion.div>
  )
}
