import "./instrument";
import { StrictMode, lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import * as Sentry from '@sentry/react'
import { IntercomProvider } from 'react-use-intercom'
import './index.css'
import RootLayout from './layouts/RootLayout.tsx'
import MarketplacePage from './pages/MarketplacePage.tsx'
import { ErrorFallback } from './components/ErrorFallback'

// RSIL-02: Catch unhandled promise rejections to prevent silent blank screens.
// Sentry's browserTracingIntegration already captures these; this ensures they
// are logged to console and never silently swallowed.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[TCS] Unhandled promise rejection:', event.reason)
})

const INTERCOM_APP_ID = import.meta.env.VITE_INTERCOM_APP_ID ?? 'o9v3tocw'

// Lazy-load all admin components — excluded from public Explorer bundle
const AdminApp = lazy(() => import('./admin/AdminApp'))
const LoginPage = lazy(() => import('./admin/LoginPage'))
const RequireAuth = lazy(() => import('./admin/RequireAuth'))
const OverviewPage = lazy(() => import('./admin/pages/OverviewPage'))
const GapsPage = lazy(() => import('./admin/pages/GapsPage'))
const LeadsPage = lazy(() => import('./admin/pages/LeadsPage'))
const ExpertsPage = lazy(() => import('./admin/pages/ExpertsPage'))
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage'))
const ToolsPage = lazy(() => import('./admin/pages/ToolsPage'))
const DataPage = lazy(() => import('./admin/pages/DataPage'))
const ScoreExplainerPage = lazy(() => import('./admin/pages/ScoreExplainerPage'))
const SearchLabPage = lazy(() => import('./admin/pages/SearchLabPage'))
const IndexManagementPanel = lazy(() => import('./admin/components/IndexManagementPanel'))
const TagManagerPage = lazy(() => import('./admin/pages/TagManagerPage'))
// SearchesPage and AdminMarketplacePage removed — content merged into DataPage

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
    element: (
      <IntercomProvider appId={INTERCOM_APP_ID} autoBoot>
        <RootLayout />
      </IntercomProvider>
    ),
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
          { path: 'tags', element: <TagManagerPage /> },
          { path: 'settings', element: <SettingsPage /> },
          // New consolidated pages — nested child routes for tab navigation
          {
            path: 'tools',
            element: <ToolsPage />,
            children: [
              { index: true, element: <Navigate to="score-explainer" replace /> },
              { path: 'score-explainer', element: <ScoreExplainerPage /> },
              { path: 'search-lab', element: <SearchLabPage /> },
              { path: 'index', element: <div className="p-8"><IndexManagementPanel /></div> },
            ],
          },
          // Data page — unified (no child routes), with redirects for old URLs
          { path: 'data', element: <DataPage /> },
          { path: 'data/searches', element: <Navigate to="/admin/data" replace /> },
          { path: 'data/marketplace', element: <Navigate to="/admin/data" replace /> },
          // Catch-all: redirect unknown admin paths to overview
          { path: '*', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallbackRender={(props) => <ErrorFallback {...props} />}
      onError={(error, info) => {
        Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
      }}
      onReset={() => {
        window.location.href = '/'
      }}
    >
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
)
