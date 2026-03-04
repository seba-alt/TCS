import { useNewsletterSubscribers } from '../hooks/useAdminData'
import { AdminCard } from '../components/AdminCard'
import { AdminPageHeader } from '../components/AdminPageHeader'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export default function LeadsPage() {
  const { data: nltrData, loading: nltrLoading } = useNewsletterSubscribers()

  function downloadLeadsCsv() {
    const adminToken = sessionStorage.getItem('admin_token') || ''
    fetch(`${API_URL}/api/admin/export/newsletter.csv`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  return (
    <div className="p-8 space-y-6">
      <AdminPageHeader
        title="Leads"
        subtitle="All lead signups"
        action={
          <button
            onClick={downloadLeadsCsv}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Export CSV
          </button>
        }
      />

      <AdminCard className="overflow-hidden">
        {/* Header row */}
        <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Leads</span>
            <span className="text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded-full">
              {nltrData?.count ?? 0} {(nltrData?.count ?? 0) === 1 ? 'lead' : 'leads'}
            </span>
          </div>
        </div>

        {/* Lead list */}
        {nltrLoading ? (
          <p className="px-5 py-4 text-slate-500 text-sm animate-pulse">Loading leads...</p>
        ) : !nltrData || nltrData.subscribers.length === 0 ? (
          <p className="px-5 py-4 text-slate-600 text-sm">No leads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Signed Up
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {nltrData.subscribers.map((sub) => (
                  <tr key={sub.email} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                    <td className="px-5 py-3 text-white font-medium">{sub.email}</td>
                    <td className="px-5 py-3 text-slate-400">{formatDateShort(sub.created_at)}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{sub.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

    </div>
  )
}
