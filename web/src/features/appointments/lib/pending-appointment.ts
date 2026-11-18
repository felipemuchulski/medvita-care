import type { Appointment } from '../types/appointment'

export const pendingAppointmentLabel = 'Agendamento passado — pendente de revisão'
export function isPastPendingAppointment(
  appointment: Pick<Appointment, 'status' | 'endsAt' | 'encounter'>,
  now = Date.now(),
) {
  const end = Date.parse(appointment.endsAt)
  return (
    Number.isFinite(end) &&
    end <= now &&
    ['SCHEDULED', 'CONFIRMED'].includes(appointment.status) &&
    !appointment.encounter
  )
}
