import { useState } from 'react'
import { ScanResult, ComponentStatus } from '../types'
import StatusBadge from './StatusBadge'

type Filter = 'All' | ComponentStatus

interface ResultsTableProps {
  results: ScanResult[]
}

const FILTERS: Filter[] = ['All', 'Active Layer', 'Unmanaged', 'Base Layer']

export default function ResultsTable({ results }: ResultsTableProps) {
  const [activeFilter, setActiveFilter] = useState<Filter>('All')
  const [hideClean, setHideClean] = useState(true)

  const activeCount = results.filter(r => r.status === 'Active Layer').length
  const unmanagedCount = results.filter(r => r.status === 'Unmanaged').length
  const cleanCount = results.length - activeCount - unmanagedCount

  const filtered = results
    .filter(r => activeFilter === 'All' || r.status === activeFilter)
    .filter(r => !hideClean || r.status !== 'Base Layer')

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Scan Results</h2>
          <p className="text-xs text-gray-500 mt-0.5">{results.length} components scanned</p>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span><span className="font-semibold text-amber-700">{activeCount}</span> active-layer</span>
          <span><span className="font-semibold text-gray-700">{unmanagedCount}</span> unmanaged</span>
          <span><span className="font-semibold text-green-700">{cleanCount}</span> clean</span>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              activeFilter === f
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {f}
            {f !== 'All' && (
              <span className="ml-1 opacity-70">
                ({f === 'Active Layer' ? activeCount : f === 'Unmanaged' ? unmanagedCount : cleanCount})
              </span>
            )}
          </button>
        ))}
        </div>
        <button
          onClick={() => setHideClean(v => !v)}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            hideClean
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
          }`}
        >
          {hideClean ? `Clean hidden (${cleanCount})` : `Hide clean (${cleanCount})`}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left">Component Name</th>
              <th className="px-6 py-3 text-left">Component Type</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                  No components match this filter.
                </td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-gray-800">{row.componentName}</td>
                  <td className="px-6 py-3 text-gray-600">{row.componentType}</td>
                  <td className="px-6 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-6 py-3 text-gray-500 max-w-sm">{row.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
