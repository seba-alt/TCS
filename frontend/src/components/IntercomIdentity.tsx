import { useEffect } from 'react'
import { useIntercom } from 'react-use-intercom'
import { useNltrStore } from '../store/nltrStore'

/**
 * Side-effect only component that links the user's email to their Intercom session.
 * Renders nothing — purely wires the email gate result into Intercom identity.
 * Must be rendered inside an IntercomProvider context.
 */
export function IntercomIdentity() {
  const { update } = useIntercom()
  const email = useNltrStore((s) => s.email)

  useEffect(() => {
    if (email) {
      update({ email })
    }
  }, [email, update])

  return null  // side-effect only, renders nothing
}
