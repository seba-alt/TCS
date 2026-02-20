/**
 * useEmailGate — manages email gate unlock state.
 *
 * Design decisions:
 * - Lazy useState initializer reads localStorage synchronously on first render.
 *   This prevents a flash of "locked" state for returning users (no useEffect flash).
 * - submitEmail writes localStorage FIRST, then fires backend call.
 *   Backend failure is intentionally silent — localStorage is the UX source of truth.
 * - STORAGE_KEY is a stable string; changing it would force all existing users to re-submit.
 */
import { useCallback, useState } from 'react'

const STORAGE_KEY = 'tcs_gate_email'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface UseEmailGateReturn {
  isUnlocked: boolean
  email: string | null
  submitEmail: (email: string) => Promise<void>
}

export function useEmailGate(): UseEmailGateReturn {
  // Lazy initializer: runs synchronously before first render — no flash of locked state.
  const [email, setEmail] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })

  const isUnlocked = email !== null

  const submitEmail = useCallback(async (submittedEmail: string) => {
    // Write localStorage FIRST — this is the source of truth for unlock.
    // UI is unlocked immediately regardless of backend outcome.
    localStorage.setItem(STORAGE_KEY, submittedEmail)
    setEmail(submittedEmail)

    // Fire-and-forget: backend failure does NOT re-lock the gate.
    try {
      await fetch(`${API_URL}/api/email-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail }),
      })
    } catch {
      // Intentional: backend failure is silent. User is already unlocked via localStorage.
      // If Sentry is configured, errors will be captured automatically by the global handler.
    }
  }, [])

  return { isUnlocked, email, submitEmail }
}
