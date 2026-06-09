import { ComponentStatus } from '../types'

const BADGE_STYLES: Record<ComponentStatus, string> = {
  'Active Layer': 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  'Base Layer':   'bg-green-100  text-green-800  ring-1 ring-green-300',
  'Unmanaged':    'bg-gray-100   text-gray-600   ring-1 ring-gray-300',
}

interface StatusBadgeProps {
  status: ComponentStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[status]}`}>
      {status}
    </span>
  )
}
