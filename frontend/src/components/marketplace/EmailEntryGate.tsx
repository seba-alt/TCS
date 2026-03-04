/**
 * EmailEntryGate — Dark overlay email gate.
 *
 * Blocks the entire Explorer until the visitor submits their email.
 * No dismiss path: no close button, no overlay click, no Escape key.
 * Only a valid email submission unlocks the Explorer.
 *
 * Design: Dark charcoal (#1a1a2e) semi-transparent overlay with minimal copy.
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(26, 26, 46, 0.95)' }}
    >
      {/* Logo */}
      <img
        src="/logo-dark-bg.png"
        alt="Tinrate"
        className="h-10 mb-8"
      />

      {/* Minimal copy */}
      <h2 className="text-xl font-semibold text-white text-center mb-2">
        Get Access
      </h2>
      <p className="text-white/50 text-sm text-center mb-6">
        Enter your email to unlock.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 w-full max-w-sm">
        <input
          ref={inputRef}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null) }}
          placeholder="your@email.com"
          aria-label="Email address"
          aria-required="true"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'entry-gate-error' : undefined}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
        />

        {error && (
          <p id="entry-gate-error" className="text-red-400 text-xs" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!email.trim()}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all
            bg-white text-gray-900 hover:bg-white/90
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          Get Access
        </button>
      </form>

      {/* Privacy note */}
      <p className="text-white/30 text-xs text-center mt-4">
        We respect your privacy. No spam.
      </p>
    </motion.div>
  )
}
