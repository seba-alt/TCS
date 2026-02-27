import "./instrument";
import { StrictMode, lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import './index.css'
import RootLayout from './layouts/RootLayout.tsx'
import MarketplacePage from './pages/MarketplacePage.tsx'

// Lazy-load all admin components — excluded from public Explorer bundle
const AdminApp = lazy(() => import('./admin/AdminApp'))
const LoginPage = lazy(() => import('./admin/LoginPage'))
const RequireAuth = lazy(() => import('./admin/RequireAuth'))
const OverviewPage = lazy(() => import('./admin/pages/OverviewPage'))
const GapsPage = lazy(() => import('./admin/pages/GapsPage'))
const LeadsPage = lazy(() => import('./admin/pages/LeadsPage'))
const ExpertsPage = lazy(() => import('./admin/pages/ExpertsPage'))
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage'))
const IntelligenceDashboardPage = lazy(() => import('./admin/pages/IntelligenceDashboardPage'))
const ToolsPage = lazy(() => import('./admin/pages/ToolsPage'))
const DataPage = lazy(() => import('./admin/pages/DataPage'))

/**
 * Generic redirect component preserving query params.
 * Uses imperative navigate() inside useEffect to avoid re-render loop.
 * Declarative <Navigate> triggers re-renders when searchParams change,
 * causing "Maximum call stack exceeded" in React StrictMode.
 */
function RedirectWithParams({ to }: { to: string }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    navigate(qs ? `${to}?${qs}` : to, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function AdminLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950" role="status" aria-live="polite">
      <span className="text-slate-400 text-sm">Loading…</span>
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <MarketplacePage />,
      },
    ],
  },
  // Legacy redirects — all paths lead to /
  {
    path: '/explore',
    element: <RedirectWithParams to="/" />,
  },
  {
    path: '/browse',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/marketplace',
    element: <RedirectWithParams to="/" />,
  },
  {
    path: '/chat',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/admin/login',
    element: (
      <Suspense fallback={<AdminLoadingFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<AdminLoadingFallback />}>
        <RequireAuth />
      </Suspense>
    ),
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
          // Catch-all: redirect unknown admin paths to overview
          { path: '*', element: <Navigate to="/admin" replace /> },
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
