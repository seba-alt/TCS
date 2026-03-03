import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: 'score-explainer', label: 'Score Explainer' },
  { to: 'search-lab', label: 'Search Lab' },
  { to: 'index', label: 'Index' },
]

export default function ToolsPage() {
  return (
    <div className="flex-1 overflow-auto">
      {/* Page header */}
      <div className="px-8 pt-8 pb-0">
        <h1 className="text-2xl font-bold text-white">Tools</h1>
        <p className="text-slate-500 text-sm mt-1">Search and index utilities</p>
      </div>

      {/* Tab bar */}
      <div className="px-8 mt-4 border-b border-slate-700/60 flex gap-6">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `pb-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-purple-500 text-white -mb-px'
                  : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Child route content */}
      <Outlet />
    </div>
  )
}
