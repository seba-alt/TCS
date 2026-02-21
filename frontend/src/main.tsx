import "./instrument";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import MarketplacePage from './pages/MarketplacePage.tsx'
import AdminApp from './admin/AdminApp.tsx'
import LoginPage from './admin/LoginPage.tsx'
import RequireAuth from './admin/RequireAuth.tsx'
import OverviewPage from './admin/pages/OverviewPage.tsx'
import SearchesPage from './admin/pages/SearchesPage.tsx'
import GapsPage from './admin/pages/GapsPage.tsx'
import ScoreExplainerPage from './admin/pages/ScoreExplainerPage.tsx'
import LeadsPage from './admin/pages/LeadsPage.tsx'
import ExpertsPage from './admin/pages/ExpertsPage.tsx'
import SettingsPage from './admin/pages/SettingsPage.tsx'
import SearchLabPage from './admin/pages/SearchLabPage.tsx'
import IntelligenceDashboardPage from './admin/pages/IntelligenceDashboardPage.tsx'

const router = createBrowserRouter([
  {
    path: '/',
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
          { path: 'searches', element: <SearchesPage /> },
          { path: 'gaps', element: <GapsPage /> },
          { path: 'score-explainer', element: <ScoreExplainerPage /> },
          { path: 'leads', element: <LeadsPage /> },
          { path: 'experts', element: <ExpertsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'search-lab', element: <SearchLabPage /> },
          { path: 'intelligence', element: <IntelligenceDashboardPage /> },
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
