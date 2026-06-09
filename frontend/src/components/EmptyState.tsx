export default function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 flex flex-col items-center gap-3 text-gray-400">
      <svg
        className="w-12 h-12 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
      <p className="text-sm font-medium">No scan results yet</p>
      <p className="text-xs">Enter an environment URL and click Run Scan to begin.</p>
    </div>
  )
}
