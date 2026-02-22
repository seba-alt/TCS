import { useLocation, useNavigate } from 'react-router-dom'
import ScoreExplainerPage from './ScoreExplainerPage'
import SearchLabPage from './SearchLabPage'
import IndexManagementPanel from '../components/IndexManagementPanel'

type ToolTab = 'score-explainer' | 'search-lab' | 'index'
const TABS: { id: ToolTab; label: string }[] = [
  { id: 'score-explainer', label: 'Score Explainer' },
  { id: 'search-lab', label: 'Search Lab' },
  { id: 'index', label: 'Index' },
]

export default function ToolsPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const hashTab = location.hash.replace('#', '') as ToolTab
  const activeTab: ToolTab = TABS.some(t => t.id === hashTab) ? hashTab : 'score-explainer'

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
          <button
            key={tab.id}
            onClick={() => navigate('/admin/tools#' + tab.id, { replace: true })}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-purple-500 text-white -mb-px'
                : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — CSS hidden to preserve component state */}
      <div className={activeTab === 'score-explainer' ? '' : 'hidden'}>
        <ScoreExplainerPage />
      </div>
      <div className={activeTab === 'search-lab' ? '' : 'hidden'}>
        <SearchLabPage />
      </div>
      <div className={activeTab === 'index' ? '' : 'hidden'}>
        <div className="p-8">
          <IndexManagementPanel />
        </div>
      </div>
    </div>
  )
}
