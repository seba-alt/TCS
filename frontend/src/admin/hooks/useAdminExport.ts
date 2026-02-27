import { useState } from 'react'
import type { SearchFilters } from '../types'

const getAdminToken = () => sessionStorage.getItem('admin_token') ?? ''
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type ExportSection = 'searches' | 'gaps'

export function useAdminExport() {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function downloadCsv(section: ExportSection, filtered: boolean, filters?: SearchFilters) {
    setExporting(true)
    setExportError(null)

    try {
      const url = new URL(`${API_URL}/api/admin/export/${section}.csv`)
      url.searchParams.set('filtered', String(filtered))
      if (filtered && filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            url.searchParams.set(k, String(v))
          }
        })
      }

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${getAdminToken()}` },
      })
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${section}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return { downloadCsv, exporting, exportError }
}
