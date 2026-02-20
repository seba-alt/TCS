import { Outlet } from 'react-router-dom'
import AdminSidebar from './components/AdminSidebar'

export default function AdminApp() {
  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
