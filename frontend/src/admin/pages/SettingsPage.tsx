import { useAdminExperts } from '../hooks/useAdminData'
import { useNavigate } from 'react-router-dom'
import pkgJson from '../../../package.json'
import IndexManagementPanel from '../components/IndexManagementPanel'

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-slate-700/50 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm text-white text-right ml-4 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const { data, loading } = useAdminExperts()
  const navigate = useNavigate()

  function handleLogout() {
    sessionStorage.removeItem('admin_key')
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">System information and configuration</p>
      </div>

      {/* System info */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">System</h2>
        <div>
          <InfoRow label="App version" value={`v${pkgJson.version}`} mono />
          <InfoRow
            label="Experts in index"
            value={loading ? <span className="text-slate-500 animate-pulse">Loading…</span> : (data?.experts.length ?? '—')}
          />
          <InfoRow label="Vector dimensions" value="768" mono />
        </div>
      </div>

      {/* Scoring config */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Scoring</h2>
        <div>
          <InfoRow label="GAP_THRESHOLD" value="0.60" mono />
          <InfoRow
            label="Gap definition"
            value="top_match_score < 0.60 OR response_type = 'clarification'"
            mono
          />
        </div>
      </div>

      {/* Index Management */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Index Management</h2>
        <IndexManagementPanel />
      </div>

      {/* Session */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Session</h2>
        <p className="text-sm text-slate-400 mb-4">
          Your admin key is stored in <code className="text-purple-400 font-mono text-xs bg-slate-900 px-1.5 py-0.5 rounded">sessionStorage</code> and
          cleared when you close the tab or log out.
        </p>
        <button
          onClick={handleLogout}
          className="px-5 py-2 bg-slate-700 hover:bg-red-900/50 border border-slate-600 hover:border-red-700/60 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  )
}
