import { ScanResult } from '../types'
import StatusBadge from './StatusBadge'

interface ResultsTableProps {
  results: ScanResult[]
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const activeCount = results.filter((r) => r.status === 'Active Layer').length
  const unmanagedCount = results.filter((r) => r.status === 'Unmanaged').length

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Scan Results</h2>
          <p className="text-xs text-gray-500 mt-0.5">{results.length} components scanned</p>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>
            <span className="font-semibold text-amber-700">{activeCount}</span> active-layer
          </span>
          <span>
            <span className="font-semibold text-gray-700">{unmanagedCount}</span> unmanaged
          </span>
          <span>
            <span className="font-semibold text-green-700">{results.length - activeCount - unmanagedCount}</span> clean
          </span>
        </div>
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
            {results.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-mono text-gray-800">{row.componentName}</td>
                <td className="px-6 py-3 text-gray-600">{row.componentType}</td>
                <td className="px-6 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-6 py-3 text-gray-500 max-w-sm">{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
