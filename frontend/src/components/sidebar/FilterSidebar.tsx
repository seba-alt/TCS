import { useState } from 'react'
import { PanelLeftClose, PanelRightOpen, Search, DollarSign, Tag } from 'lucide-react'
import { SearchInput } from './SearchInput'
import { RateSlider } from './RateSlider'
import { TagMultiSelect } from './TagMultiSelect'

function IconStrip() {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="flex items-center justify-center h-10 w-full text-gray-400">
        <Search size={18} />
      </div>
      <div className="flex items-center justify-center h-10 w-full text-gray-400">
        <DollarSign size={18} />
      </div>
      <div className="flex items-center justify-center h-10 w-full text-gray-400">
        <Tag size={18} />
      </div>
    </div>
  )
}

function FilterControls() {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto flex-1 py-3">
      <div className="flex flex-col gap-1.5 px-4">
        <span className="text-xs font-medium text-gray-500 uppercase">Search</span>
        <SearchInput />
      </div>
      <div className="flex flex-col gap-1.5 px-4">
        <span className="text-xs font-medium text-gray-500 uppercase">Hourly Rate</span>
        <RateSlider />
      </div>
      <div className="flex flex-col gap-1.5 px-4">
        <span className="text-xs font-medium text-gray-500 uppercase">Domain Tags</span>
        <TagMultiSelect />
      </div>
    </div>
  )
}

export function FilterSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`
        hidden md:flex flex-col
        sticky top-0 h-screen
        bg-gray-50 border-r border-gray-200
        transition-all duration-200
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center h-10 w-full border-b border-gray-200"
        aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
      >
        {collapsed ? <PanelRightOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      {/* Collapsed: icon strip; Expanded: full filter controls */}
      {collapsed ? <IconStrip /> : <FilterControls />}
    </aside>
  )
}
