import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import type { SearchRow } from '../types'
import ExpandedExpertRow from './ExpandedExpertRow'

interface SearchesTableProps {
  data: SearchRow[]
  pageSize: number
  onPageSizeChange: (size: number) => void
}

export default function SearchesTable({ data, pageSize, onPageSizeChange }: SearchesTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const navigate = useNavigate()

  function toggleRow(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const columns: ColumnDef<SearchRow>[] = [
    {
      accessorKey: 'query',
      header: 'Query',
      cell: ({ getValue, row }) => (
        <span className="flex items-center gap-2 max-w-xs">
          <span className="truncate text-white" title={getValue<string>()}>{getValue<string>()}</span>
          {row.original.source === 'sage' && (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Sage
            </span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Timestamp',
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {new Date(getValue<string>()).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'email',
      header: 'User',
      cell: ({ getValue }) => (
        <button
          onClick={e => {
            e.stopPropagation()
            navigate('/admin/leads', { state: { email: getValue<string>() } })
          }}
          className="text-xs text-blue-400 hover:text-blue-300 hover:underline text-left"
          title="View lead profile"
        >
          {getValue<string>()}
        </button>
      ),
    },
    {
      accessorKey: 'match_count',
      header: 'Matches',
      cell: ({ getValue }) => (
        <span className="text-sm text-slate-300">{getValue<number>()}</span>
      ),
    },
    {
      accessorKey: 'top_match_score',
      header: 'Top Score',
      cell: ({ getValue }) => {
        const v = getValue<number | null>()
        if (v == null) return <span className="text-slate-600">—</span>
        const color =
          v >= 0.8 ? 'text-emerald-400' : v >= 0.6 ? 'text-yellow-400' : 'text-red-400'
        return <span className={`text-sm font-mono ${color}`}>{v.toFixed(3)}</span>
      },
    },
    {
      accessorKey: 'is_gap',
      header: 'Gap',
      cell: ({ getValue }) =>
        getValue<boolean>() ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-400 border border-red-800/50">
            Gap
          </span>
        ) : null,
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  })

  if (table.getState().pagination.pageSize !== pageSize) {
    table.setPageSize(pageSize)
  }

  const allRows = table.getRowModel().rows
  const COLS = columns.length

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/60">
                {table.getHeaderGroups().map(hg =>
                  hg.headers.map(h => (
                    <th
                      key={h.id}
                      className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {allRows.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="px-5 py-10 text-center text-slate-500">
                    No searches found.
                  </td>
                </tr>
              ) : (
                allRows.map(row => {
                  const original = row.original
                  const isExpanded = expandedRows.has(original.id)
                  return [
                    <tr
                      key={row.id}
                      onClick={() => toggleRow(original.id)}
                      className="border-b border-slate-700/40 hover:bg-slate-700/20 cursor-pointer transition-colors"
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-5 py-3 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>,
                    isExpanded && (
                      <ExpandedExpertRow
                        key={`exp-${row.id}`}
                        responseExperts={original.response_experts ?? '[]'}
                        colSpan={COLS}
                      />
                    ),
                  ]
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 rounded-lg border border-slate-600 disabled:opacity-30 hover:bg-slate-700 transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 rounded-lg border border-slate-600 disabled:opacity-30 hover:bg-slate-700 transition-colors"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
