import { Outlet, useNavigate } from 'react-router-dom'
import AdminSidebar from './components/AdminSidebar'

export default function AdminApp() {
  const navigate = useNavigate()

  function handleLogout() {
    sessionStorage.removeItem('admin_token')
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-slate-950">
      <AdminSidebar onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto bg-slate-950">
        <Outlet />
      </main>
    </div>
  )
}
