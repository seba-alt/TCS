import { useLocation, useNavigate } from 'react-router-dom'
import SearchesPage from './SearchesPage'
import AdminMarketplacePage from './AdminMarketplacePage'

type DataTab = 'searches' | 'marketplace'
const TABS: { id: DataTab; label: string }[] = [
  { id: 'searches', label: 'Searches' },
  { id: 'marketplace', label: 'Marketplace' },
]

export default function DataPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const hashTab = location.hash.replace('#', '') as DataTab
  const activeTab: DataTab = TABS.some(t => t.id === hashTab) ? hashTab : 'marketplace'

  return (
    <div className="flex-1 overflow-auto">
      {/* Tab bar */}
      <div className="px-8 pt-6 border-b border-slate-700/60 flex gap-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => navigate('/admin/data#' + tab.id, { replace: true })}
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
      <div className={activeTab === 'searches' ? '' : 'hidden'}>
        <SearchesPage />
      </div>
      <div className={activeTab === 'marketplace' ? '' : 'hidden'}>
        <AdminMarketplacePage />
      </div>
    </div>
  )
}
