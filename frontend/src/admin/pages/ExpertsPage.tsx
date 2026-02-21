import { useState } from 'react'
import { useAdminExperts, adminPost } from '../hooks/useAdminData'
import type { ExpertRow } from '../types'

const CATEGORIES = [
  'Finance', 'Marketing', 'Tech', 'Sales', 'HR', 'Legal',
  'Operations', 'Sports', 'Healthcare', 'Real Estate', 'Strategy',
]

function CategoryDropdown({
  username,
  current,
  onChanged,
}: {
  username: string
  current: string | null
  onChanged: () => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const cat = e.target.value
    if (!cat) return
    setSaving(true)
    try {
      await adminPost(`/experts/${encodeURIComponent(username)}/classify`, { category: cat })
      onChanged()
    } catch (err) {
      alert(`Failed to classify: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={current ?? ''}
      onChange={handleChange}
      disabled={saving}
      className="bg-slate-900 border border-slate-600 text-sm text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 w-36"
    >
      <option value="">Unclassified</option>
      {CATEGORIES.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  )
}

interface AddFormState {
  first_name: string
  last_name: string
  username: string
  job_title: string
  company: string
  bio: string
  hourly_rate: string
  profile_url: string
}

const EMPTY_FORM: AddFormState = {
  first_name: '',
  last_name: '',
  username: '',
  job_title: '',
  company: '',
  bio: '',
  hourly_rate: '',
  profile_url: '',
}

export default function ExpertsPage() {
  const { data, loading, error, refetch } = useAdminExperts()
  const [autoClassifying, setAutoClassifying] = useState(false)
  const [autoResult, setAutoResult] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function handleAutoClassify() {
    setAutoClassifying(true)
    setAutoResult(null)
    try {
      const res = await adminPost<{ classified: number; categories: Record<string, string> }>(
        '/experts/auto-classify',
        {},
      )
      setAutoResult(`Classified ${res.classified} expert${res.classified !== 1 ? 's' : ''}`)
      refetch()
    } catch (err) {
      setAutoResult(`Error: ${err}`)
    } finally {
      setAutoClassifying(false)
    }
  }

  async function handleAddExpert(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await adminPost('/experts', {
        ...form,
        hourly_rate: parseFloat(form.hourly_rate) || 0,
        profile_url: form.profile_url || undefined,
      })
      setForm(EMPTY_FORM)
      setShowAddForm(false)
      refetch()
    } catch (err) {
      setFormError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = data?.experts.filter((e: ExpertRow) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      e.username.toLowerCase().includes(s) ||
      e.first_name.toLowerCase().includes(s) ||
      e.last_name.toLowerCase().includes(s) ||
      e.job_title.toLowerCase().includes(s) ||
      e.company.toLowerCase().includes(s)
    )
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Experts</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage expert profiles, classification, and add new experts
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, title, company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 w-64 placeholder-slate-500"
        />
        <button
          onClick={handleAutoClassify}
          disabled={autoClassifying}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {autoClassifying ? 'Classifying…' : 'Auto-classify all'}
        </button>
        {autoResult && <span className="text-sm text-slate-400">{autoResult}</span>}
        <div className="ml-auto">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Expert
          </button>
        </div>
      </div>

      {/* Add Expert form */}
      {showAddForm && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Add New Expert</h2>
          <form onSubmit={handleAddExpert} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'first_name', label: 'First Name', required: true },
              { key: 'last_name', label: 'Last Name', required: true },
              { key: 'username', label: 'Username', required: true },
              { key: 'job_title', label: 'Job Title', required: true },
              { key: 'company', label: 'Company', required: true },
              { key: 'hourly_rate', label: 'Hourly Rate (€)', required: true, type: 'number' },
            ].map(({ key, label, required, type }) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  type={type ?? 'text'}
                  value={form[key as keyof AddFormState]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required={required}
                  className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Profile URL (optional)</label>
              <input
                type="url"
                value={form.profile_url}
                onChange={e => setForm(f => ({ ...f, profile_url: e.target.value }))}
                placeholder="https://tinrate.com/u/username"
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                required
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
            {formError && (
              <div className="sm:col-span-2 text-red-400 text-sm">{formError}</div>
            )}
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {submitting ? 'Generating tags...' : 'Add Expert'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); setFormError(null) }}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expert table */}
      {loading && <p className="text-slate-500 text-sm animate-pulse">Loading experts…</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}

      {filtered && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/60">
            <span className="text-sm text-slate-400">
              {filtered.length} of {data?.experts.length} expert{data?.experts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Job Title</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Profile</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      No experts found
                    </td>
                  </tr>
                )}
                {filtered.map((expert: ExpertRow) => (
                  <tr key={expert.username} className="border-b border-slate-700/40 hover:bg-slate-700/10 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">
                        {expert.first_name} {expert.last_name}
                      </p>
                      <p className="text-xs text-slate-500">@{expert.username}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-300 max-w-[180px]">
                      <span className="block truncate" title={expert.job_title}>{expert.job_title}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 max-w-[140px]">
                      <span className="block truncate" title={expert.company}>{expert.company}</span>
                    </td>
                    <td className="px-5 py-3">
                      <CategoryDropdown
                        username={expert.username}
                        current={expert.category}
                        onChanged={refetch}
                      />
                    </td>
                    <td className="px-5 py-3 text-right text-slate-400">
                      {expert.hourly_rate > 0 ? `€${expert.hourly_rate}/h` : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {expert.profile_url ? (
                        <a
                          href={expert.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 text-xs"
                        >
                          →
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
