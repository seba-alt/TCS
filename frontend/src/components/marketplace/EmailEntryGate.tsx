/**
 * EmailEntryGate — Full-screen mandatory email gate overlay.
 *
 * Blocks the entire Explorer until the visitor submits their email.
 * No dismiss path: no close button, no overlay click, no Escape key.
 * Only a valid email submission unlocks the Explorer.
 *
 * Design: Blurred Explorer backdrop with centered glassmorphic card.
 * Animation: motion/react AnimatePresence fade-in/out on mount/unmount.
 */
import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'

interface EmailEntryGateProps {
  onSubmit: (email: string) => void
}

export function EmailEntryGate({ onSubmit }: EmailEntryGateProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

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
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
      >
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <img src="/logo.png" alt="Tinrate" className="h-8" />
        </div>

        {/* Tagline */}
        <h2 className="text-xl font-semibold text-white text-center leading-tight mb-2">
          Find the Right Expert, Instantly
        </h2>
        <p className="text-white/60 text-sm text-center mb-6 leading-relaxed">
          Browse verified consultants matched to your exact needs.
          Enter your email to get started.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null) }}
            placeholder="your@email.com"
            aria-label="Email address"
            aria-required="true"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'entry-gate-error' : undefined}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
            autoFocus
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
        <p className="text-white/40 text-xs text-center mt-3">
          We respect your privacy. No spam.
        </p>
      </motion.div>
    </motion.div>
  )
}
