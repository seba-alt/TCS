import { Outlet } from 'react-router-dom'
import { Analytics } from '../analytics'

/**
 * Root layout wrapping the Explorer page.
 * Renders the route outlet (MarketplacePage) and the analytics tracker.
 */
export default function RootLayout() {
  return (
    <>
      <Analytics />
      <Outlet />
    </>
  )
}
