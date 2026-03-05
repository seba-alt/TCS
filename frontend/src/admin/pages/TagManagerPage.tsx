import { useState, useMemo } from 'react'
import { useTagCatalog, useTagAssignments, useAdminExperts, adminPost, adminDelete } from '../hooks/useAdminData'

type Mode = 'expert-to-tags' | 'tag-to-experts'

const EMPTY_ASSIGNMENTS: { username: string; first_name: string; last_name: string; manual_tags: string[] }[] = []
const EMPTY_EXPERTS: { username: string; first_name: string; last_name: string; job_title: string }[] = []

export default function TagManagerPage() {
  const [mode, setMode] = useState<Mode>('expert-to-tags')

  // Data hooks
  const { data: catalogData, loading: catalogLoading, refetch: refetchCatalog } = useTagCatalog()
  const { data: assignData, refetch: refetchAssign } = useTagAssignments()
  const { data: expertsData, refetch: refetchExperts } = useAdminExperts()

  // Catalog management state
  const [newTag, setNewTag] = useState('')
  const [catalogError, setCatalogError] = useState<string | null>(null)

  // Expert-to-Tags state
  const [expertSearch, setExpertSearch] = useState('')
  const [selectedExperts, setSelectedExperts] = useState<Set<string>>(new Set())
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignLoading, setAssignLoading] = useState(false)

  // Tag-to-Experts state
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [addExpertSearch, setAddExpertSearch] = useState('')
  const [showAddExperts, setShowAddExperts] = useState(false)

  const catalog = catalogData?.tags ?? []
  const assignments = assignData?.assignments ?? EMPTY_ASSIGNMENTS
  const experts = expertsData?.experts ?? EMPTY_EXPERTS

  // Expert search filter (client-side)
  const filteredExperts = useMemo(() => {
    if (!expertSearch.trim()) return experts
    const q = expertSearch.toLowerCase()
    return experts.filter(e =>
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      e.job_title.toLowerCase().includes(q)
    )
  }, [experts, expertSearch])

  // Manual tags lookup per expert
  const manualTagsMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const a of assignments) {
      map.set(a.username, a.manual_tags)
    }
    return map
  }, [assignments])

  // Tag-to-Experts: experts assigned to activeTag
  const expertsForActiveTag = useMemo(() => {
    if (!activeTag) return []
    return assignments.filter(a =>
      a.manual_tags.some(t => t.toLowerCase() === activeTag.toLowerCase())
    )
  }, [activeTag, assignments])

  // Tag-to-Experts: experts count per tag
  const tagExpertCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of assignments) {
      for (const t of a.manual_tags) {
        const key = t.toLowerCase()
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return counts
  }, [assignments])

  // Handlers
  const handleAddCatalogTag = async () => {
    const tag = newTag.trim()
    if (!tag) return
    setCatalogError(null)
    try {
      await adminPost('/tags/catalog', { tag })
      setNewTag('')
      refetchCatalog()
    } catch (e: unknown) {
      setCatalogError(e instanceof Error ? e.message : 'Failed to add tag')
    }
  }

  const handleDeleteCatalogTag = async (tagId: number) => {
    setCatalogError(null)
    try {
      await adminDelete(`/tags/catalog/${tagId}`)
      refetchCatalog()
    } catch (e: unknown) {
      setCatalogError(e instanceof Error ? e.message : 'Failed to delete tag')
    }
  }

  const handleBulkAssign = async () => {
    if (selectedExperts.size === 0 || selectedTags.size === 0) return
    setAssignLoading(true)
    setAssignError(null)
    try {
      await adminPost('/tags/assign', {
        usernames: Array.from(selectedExperts),
        tags: Array.from(selectedTags),
      })
      setSelectedTags(new Set())
      refetchAssign()
      refetchExperts()
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Failed to assign tags')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleRemoveTag = async (username: string, tag: string) => {
    try {
      await adminDelete(`/tags/assign/${encodeURIComponent(username)}/${encodeURIComponent(tag)}`)
      refetchAssign()
      refetchExperts()
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Failed to remove tag')
    }
  }

  const handleAddExpertsToTag = async (usernames: string[]) => {
    if (!activeTag || usernames.length === 0) return
    try {
      await adminPost('/tags/assign', {
        usernames,
        tags: [activeTag],
      })
      setShowAddExperts(false)
      setAddExpertSearch('')
      refetchAssign()
      refetchExperts()
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Failed to assign tag')
    }
  }

  const toggleExpert = (username: string) => {
    setSelectedExperts(prev => {
      const next = new Set(prev)
      if (next.has(username)) next.delete(username)
      else next.add(username)
      return next
    })
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const selectAllExperts = () => {
    setSelectedExperts(new Set(filteredExperts.map(e => e.username)))
  }

  const deselectAllExperts = () => {
    setSelectedExperts(new Set())
  }

  // Experts not assigned to active tag (for the add dropdown)
  const unassignedExperts = useMemo(() => {
    if (!activeTag) return []
    const assignedUsernames = new Set(
      expertsForActiveTag.map(a => a.username)
    )
    const q = addExpertSearch.toLowerCase()
    return experts.filter(e => {
      if (assignedUsernames.has(e.username)) return false
      if (!q) return true
      return `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q)
    })
  }, [activeTag, expertsForActiveTag, experts, addExpertSearch])

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Tag Manager</h1>
        <p className="text-slate-400 text-sm">Manage predefined tags and assign them to experts for improved search findability</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('expert-to-tags')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'expert-to-tags'
              ? 'bg-purple-600 text-white'
              : 'bg-transparent text-slate-400 hover:text-white'
          }`}
        >
          Expert &rarr; Tags
        </button>
        <button
          onClick={() => setMode('tag-to-experts')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'tag-to-experts'
              ? 'bg-purple-600 text-white'
              : 'bg-transparent text-slate-400 hover:text-white'
          }`}
        >
          Tag &rarr; Experts
        </button>
      </div>

      {/* Catalog Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">
            Tag Catalog ({catalog.length} tags)
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCatalogTag()}
              placeholder="Add new tag..."
              className="bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              onClick={handleAddCatalogTag}
              disabled={!newTag.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </div>
        {catalogError && (
          <p className="text-red-400 text-xs mb-2">{catalogError}</p>
        )}
        {catalogLoading ? (
          <p className="text-slate-500 text-sm">Loading catalog...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {catalog.map(t => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full text-xs"
              >
                {t.tag}
                <button
                  onClick={() => handleDeleteCatalogTag(t.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors ml-0.5"
                  title="Remove from catalog"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {catalog.length === 0 && (
              <p className="text-slate-500 text-xs">No tags in catalog. Tags will be seeded from AI skill tags on first load.</p>
            )}
          </div>
        )}
      </div>

      {/* Mode A: Expert -> Tags */}
      {mode === 'expert-to-tags' && (
        <div className="flex gap-4">
          {/* Left panel: Expert list */}
          <div className="w-2/5 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="mb-3">
              <input
                type="text"
                value={expertSearch}
                onChange={e => setExpertSearch(e.target.value)}
                placeholder="Search experts..."
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={selectAllExperts} className="text-xs text-purple-400 hover:text-purple-300">Select all</button>
              <button onClick={deselectAllExperts} className="text-xs text-slate-500 hover:text-slate-400">Deselect all</button>
              <span className="text-xs text-slate-600 ml-auto">{selectedExperts.size} selected</span>
            </div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filteredExperts.map(e => {
                const tags = manualTagsMap.get(e.username) ?? []
                return (
                  <label
                    key={e.username}
                    className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedExperts.has(e.username) ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedExperts.has(e.username)}
                      onChange={() => toggleExpert(e.username)}
                      className="mt-1 accent-purple-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {e.first_name} {e.last_name}
                      </p>
                      <p className="text-slate-500 text-xs truncate">{e.job_title}</p>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.map(t => (
                            <span key={t} className="bg-purple-600/20 text-purple-300 px-1.5 py-0.5 rounded text-[10px]">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
              {filteredExperts.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">No experts found</p>
              )}
            </div>
          </div>

          {/* Right panel: Tag assignment */}
          <div className="w-3/5 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">
              {selectedExperts.size > 0
                ? `${selectedExperts.size} expert${selectedExperts.size > 1 ? 's' : ''} selected`
                : 'Select experts to assign tags'}
            </h3>

            {/* Tag picker */}
            <div className="mb-4">
              <p className="text-slate-400 text-xs mb-2">Click tags to select, then assign:</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {catalog.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleTag(t.tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedTags.has(t.tag)
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {t.tag}
                  </button>
                ))}
              </div>
              <button
                onClick={handleBulkAssign}
                disabled={selectedExperts.size === 0 || selectedTags.size === 0 || assignLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {assignLoading ? 'Assigning...' : `Assign ${selectedTags.size} tag${selectedTags.size !== 1 ? 's' : ''} to ${selectedExperts.size} expert${selectedExperts.size !== 1 ? 's' : ''}`}
              </button>
              {assignError && (
                <p className="text-red-400 text-xs mt-2">{assignError}</p>
              )}
            </div>

            {/* Current tags for single selected expert */}
            {selectedExperts.size === 1 && (() => {
              const username = Array.from(selectedExperts)[0]
              const expert = experts.find(e => e.username === username)
              const tags = manualTagsMap.get(username) ?? []
              if (!expert) return null
              return (
                <div className="border-t border-slate-800 pt-4">
                  <h4 className="text-slate-400 text-xs font-medium mb-2">
                    Manual tags for {expert.first_name} {expert.last_name}:
                  </h4>
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tags.map(t => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full text-xs"
                        >
                          {t}
                          <button
                            onClick={() => handleRemoveTag(username, t)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                            title="Remove tag"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs">No manual tags assigned yet</p>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Mode B: Tag -> Experts */}
      {mode === 'tag-to-experts' && (
        <div className="flex gap-4">
          {/* Left panel: Tag list */}
          <div className="w-2/5 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Tags</h3>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {catalog.map(t => {
                const count = tagExpertCounts.get(t.tag.toLowerCase()) ?? 0
                return (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTag(t.tag); setShowAddExperts(false); setAddExpertSearch('') }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                      activeTag === t.tag
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.tag}</span>
                    <span className={`text-xs ${activeTag === t.tag ? 'text-purple-200' : 'text-slate-500'}`}>
                      {count} expert{count !== 1 ? 's' : ''}
                    </span>
                  </button>
                )
              })}
              {catalog.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">No tags in catalog</p>
              )}
            </div>
          </div>

          {/* Right panel: Experts for selected tag */}
          <div className="w-3/5 bg-slate-900 border border-slate-800 rounded-xl p-4">
            {activeTag ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">
                    Experts tagged: <span className="text-purple-400">{activeTag}</span>
                  </h3>
                  <button
                    onClick={() => setShowAddExperts(!showAddExperts)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    {showAddExperts ? 'Cancel' : '+ Add Experts'}
                  </button>
                </div>

                {/* Add experts dropdown */}
                {showAddExperts && (
                  <div className="mb-4 bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <input
                      type="text"
                      value={addExpertSearch}
                      onChange={e => setAddExpertSearch(e.target.value)}
                      placeholder="Search experts to add..."
                      className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {unassignedExperts.slice(0, 20).map(e => (
                        <button
                          key={e.username}
                          onClick={() => handleAddExpertsToTag([e.username])}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          <span className="text-purple-400">+</span>
                          <span>{e.first_name} {e.last_name}</span>
                          <span className="text-slate-500 text-xs ml-auto">{e.job_title}</span>
                        </button>
                      ))}
                      {unassignedExperts.length === 0 && (
                        <p className="text-slate-500 text-xs text-center py-2">All experts already assigned</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Assigned experts list */}
                <div className="space-y-2">
                  {expertsForActiveTag.map(a => (
                    <div
                      key={a.username}
                      className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">{a.first_name} {a.last_name}</p>
                        <p className="text-slate-500 text-xs">{a.username}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveTag(a.username, activeTag)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="Remove tag from expert"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {expertsForActiveTag.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">No experts assigned to this tag yet</p>
                  )}
                </div>

                {assignError && (
                  <p className="text-red-400 text-xs mt-2">{assignError}</p>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <p className="text-slate-500 text-sm">Select a tag to view assigned experts</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
