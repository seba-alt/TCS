import { Navigate, Outlet } from 'react-router-dom'

export default function RequireAuth() {
  const key = sessionStorage.getItem('admin_key')
  if (!key) {
    return <Navigate to="/admin/login" replace />
  }
  return <Outlet />
}
