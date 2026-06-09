export default function Header() {
  return (
    <header className="bg-indigo-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
        <svg
          className="w-7 h-7 text-indigo-200"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
        <h1 className="text-xl font-semibold tracking-tight">Active Layer Auditor</h1>
        <span className="ml-auto text-xs text-indigo-300 font-medium">Power Platform · Dataverse</span>
      </div>
    </header>
  )
}
