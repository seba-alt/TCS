import "./instrument";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import AdminApp from './admin/AdminApp.tsx'
import OverviewPage from './admin/pages/OverviewPage.tsx'
import SearchesPage from './admin/pages/SearchesPage.tsx'
import GapsPage from './admin/pages/GapsPage.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/admin',
    element: <AdminApp />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'searches', element: <SearchesPage /> },
      { path: 'gaps', element: <GapsPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
