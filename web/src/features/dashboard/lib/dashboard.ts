import type { ClinicRole } from '../../auth/types/auth'
import type { Appointment } from '../../appointments/types/appointment'
import { localInOffset, statusLabels } from '../../appointments/lib/appointment'
import { isPastPendingAppointment } from '../../appointments/lib/pending-appointment'
import { addDays } from '../../calendar/utils/calendar'

export type DashboardAppointment = Pick<
  Appointment,
  'id' | 'clinicId' | 'scheduledAt' | 'endsAt' | 'status' | 'encounter'
> & {
  patient: Pick<Appointment['patient'], 'id' | 'name'>
  professional: { userId: string; name: string }
}
export const canReadDashboard = (role: ClinicRole | null) =>
  role === 'ADMIN' || role === 'RECEPTIONIST' || role === 'OPHTHALMOLOGIST'
export function dashboardPeriod(now: number) {
  const today = localInOffset(new Date(now).toISOString()).slice(0, 10)
  const first = addDays(today, -30),
    last = addDays(today, 7)
  return {
    today,
    first,
    last,
    from: `${first}T00:00:00-03:00`,
    to: `${last}T23:59:59.999-03:00`,
  }
}
export function dashboardAppointment(
  a: Appointment,
  clinic: string,
  user: string,
  role: ClinicRole,
): DashboardAppointment {
  if (
    !Object.hasOwn(statusLabels, a.status) ||
    (a.encounter &&
      !['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(a.encounter.status)) ||
    a.clinicId !== clinic ||
    a.patient.id !== a.patientId ||
    a.professional.id !== a.professionalId ||
    !Number.isFinite(Date.parse(a.scheduledAt)) ||
    !Number.isFinite(Date.parse(a.endsAt)) ||
    Date.parse(a.endsAt) <= Date.parse(a.scheduledAt) ||
    (role === 'OPHTHALMOLOGIST' && a.professional.userId !== user)
  )
    throw new Error('Invalid dashboard scope')
  // Explicit operational projection: no notes, clinical fields or full entities.
  return {
    id: a.id,
    clinicId: a.clinicId,
    scheduledAt: a.scheduledAt,
    endsAt: a.endsAt,
    status: a.status,
    patient: { id: a.patient.id, name: a.patient.name },
    professional: { userId: a.professional.userId, name: a.professional.user.name },
    encounter: a.encounter ? { id: a.encounter.id, status: a.encounter.status } : null,
  }
}
export function dashboardIndicators(items: DashboardAppointment[], now: number) {
  const { today } = dashboardPeriod(now)
  const ordered = [...items].sort(
    (a, b) =>
      Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id.localeCompare(b.id),
  )
  const day = ordered.filter((a) => localInOffset(a.scheduledAt).slice(0, 10) === today)
  return {
    day,
    upcoming: ordered.filter(
      (a) =>
        ['SCHEDULED', 'CONFIRMED'].includes(a.status) &&
        !a.encounter &&
        Date.parse(a.scheduledAt) >= now,
    ),
    cancelled: day.filter((a) => a.status === 'CANCELLED'),
    pending: ordered.filter((a) => isPastPendingAppointment(a, now)).reverse(),
    inProgress: ordered.filter(
      (a) => a.status === 'IN_PROGRESS' && a.encounter?.status === 'IN_PROGRESS',
    ),
  }
}
