import "./instrument";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate, useSearchParams } from 'react-router-dom'
import './index.css'
import RootLayout from './layouts/RootLayout.tsx'
import BrowsePage from './pages/BrowsePage.tsx'
import MarketplacePage from './pages/MarketplacePage.tsx'
import AdminApp from './admin/AdminApp.tsx'
import LoginPage from './admin/LoginPage.tsx'
import RequireAuth from './admin/RequireAuth.tsx'
import OverviewPage from './admin/pages/OverviewPage.tsx'
import GapsPage from './admin/pages/GapsPage.tsx'
import LeadsPage from './admin/pages/LeadsPage.tsx'
import ExpertsPage from './admin/pages/ExpertsPage.tsx'
import SettingsPage from './admin/pages/SettingsPage.tsx'
import IntelligenceDashboardPage from './admin/pages/IntelligenceDashboardPage.tsx'
import ToolsPage from './admin/pages/ToolsPage.tsx'
import DataPage from './admin/pages/DataPage.tsx'

/**
 * Redirects /marketplace to /explore preserving query params.
 * Must be a component (not inline Navigate) because useSearchParams
 * requires a RouterProvider context.
 */
function MarketplaceRedirect() {
  const [searchParams] = useSearchParams()
  const queryString = searchParams.toString()
  const destination = queryString ? `/explore?${queryString}` : '/explore'
  return <Navigate to={destination} replace />
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <BrowsePage />,
      },
      {
        path: '/explore',
        element: <MarketplacePage />,
      },
    ],
  },
  {
    path: '/marketplace',
    element: <MarketplaceRedirect />,
  },
  {
    path: '/chat',
    element: <Navigate to="/explore" replace />,
  },
  {
    path: '/admin/login',
    element: <LoginPage />,
  },
  {
    path: '/admin',
    element: <RequireAuth />,
    children: [
      {
        element: <AdminApp />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'gaps', element: <GapsPage /> },
          { path: 'leads', element: <LeadsPage /> },
          { path: 'experts', element: <ExpertsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'intelligence', element: <IntelligenceDashboardPage /> },
          // New consolidated pages
          { path: 'tools', element: <ToolsPage /> },
          { path: 'data',  element: <DataPage /> },
          // Redirects from old standalone URLs
          { path: 'search-lab',      element: <Navigate to="/admin/tools" replace /> },
          { path: 'score-explainer', element: <Navigate to="/admin/tools" replace /> },
          { path: 'index',           element: <Navigate to="/admin/tools" replace /> },
          { path: 'searches',        element: <Navigate to="/admin/data" replace /> },
          { path: 'marketplace',     element: <Navigate to="/admin/data" replace /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
