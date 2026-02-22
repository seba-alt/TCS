import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface NewsletterGateModalProps {
  isOpen: boolean
  onSubscribe: (email: string) => void
  onDismiss: () => void
}

export function NewsletterGateModal({ isOpen, onSubscribe, onDismiss }: NewsletterGateModalProps) {
  const [email, setEmail] = useState('')

  const isValid = /.+@.+\..+/.test(email)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isValid) {
      onSubscribe(email)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="newsletter-gate-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-semibold text-white leading-tight">
                  Unlock the Full Expert Pool
                </h2>
              </div>
              <button
                onClick={onDismiss}
                className="text-white/50 hover:text-white text-2xl leading-none ml-4 mt-0.5 transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Supporting copy */}
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              Get curated expert insights delivered to your inbox — plus instant access to full profiles.
              Curated insights, no spam, ever.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
                autoFocus
              />
              <button
                type="submit"
                disabled={!isValid}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all
                  bg-white text-gray-900 hover:bg-white/90
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Unlock Profiles
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
