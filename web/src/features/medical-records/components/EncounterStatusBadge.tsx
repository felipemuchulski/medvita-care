import { encounterLabels } from '../lib/encounter'
import type { EncounterStatus } from '../types/encounter'
const colors = {
  IN_PROGRESS: 'bg-amber-50 text-amber-900',
  COMPLETED: 'bg-green-50 text-green-800',
  CANCELLED: 'bg-red-50 text-red-800',
}
export function EncounterStatusBadge({ status }: { status: EncounterStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${colors[status]}`}
    >
      {encounterLabels[status]}
    </span>
  )
}
