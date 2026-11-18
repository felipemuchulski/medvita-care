import type { AppointmentStatus } from '../types/appointment'
import { statusLabels } from '../lib/appointment'
import type { Appointment } from '../types/appointment'
import {
  isPastPendingAppointment,
  pendingAppointmentLabel,
} from '../lib/pending-appointment'
const colors = {
  SCHEDULED: 'bg-primary-light text-primary',
  CONFIRMED: 'bg-green-50 text-green-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-900',
  COMPLETED: 'bg-slate-100 text-slate-800',
  CANCELLED: 'bg-red-50 text-red-800',
  NO_SHOW: 'bg-purple-50 text-purple-800',
}
export function AppointmentStatusBadge({
  status,
  appointment,
  now,
}: {
  status: AppointmentStatus
  appointment?: Pick<Appointment, 'status' | 'endsAt' | 'encounter'>
  now?: number
}) {
  return (
    <span className="inline-flex min-w-0 flex-col items-start gap-1">
      <span
        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${colors[status]}`}
      >
        {statusLabels[status]}
      </span>
      {appointment && isPastPendingAppointment(appointment, now) && (
        <span className="rounded-lg bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">
          {pendingAppointmentLabel}
        </span>
      )}
    </span>
  )
}
