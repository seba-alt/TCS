import { AnimatePresence, motion } from 'motion/react'
import EmailGate from '../EmailGate'

interface ProfileGateModalProps {
  onSubmit: (email: string) => Promise<void>
  onDismiss: () => void
}

export function ProfileGateModal({ onSubmit, onDismiss }: ProfileGateModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900 text-base">Unlock full profile</h2>
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Enter your email to view this expert's full profile on Tinrate.
          </p>
          <EmailGate onSubmit={onSubmit} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
