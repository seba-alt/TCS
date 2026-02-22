import "./instrument";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
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

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/marketplace" replace />,
  },
  {
    path: '/marketplace',
    element: <MarketplacePage />,
  },
  {
    path: '/chat',
    element: <App />,
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
