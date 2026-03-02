import { Outlet } from 'react-router-dom'
import { Analytics } from '../analytics'
import { IntercomIdentity } from '../components/IntercomIdentity'

/**
 * Root layout wrapping the Explorer page.
 * Renders the route outlet (MarketplacePage), the analytics tracker,
 * and the Intercom identity linker (side-effect only, renders nothing).
 */
export default function RootLayout() {
  return (
    <>
      <IntercomIdentity />
      <Analytics />
      <Outlet />
    </>
  )
}
