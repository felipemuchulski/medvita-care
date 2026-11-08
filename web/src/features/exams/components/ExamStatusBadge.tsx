import { examStatusLabels } from '../lib/exam'
import type { ExamStatus } from '../types/exam'
const colors = {
  REQUESTED: 'bg-primary-light text-primary',
  IN_PROGRESS: 'bg-amber-50 text-amber-900',
  COMPLETED: 'bg-emerald-50 text-emerald-900',
  CANCELLED: 'bg-slate-100 text-slate-700',
}
export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${colors[status]}`}
    >
      {examStatusLabels[status]}
    </span>
  )
}
