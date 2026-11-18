import {
  isPastPendingAppointment,
  pendingAppointmentLabel,
} from '../../appointments/lib/pending-appointment'
import type { EventInput } from '@fullcalendar/react'
import { statusLabels, formatAppointment } from '../../appointments/lib/appointment'
import type { Appointment, AppointmentStatus } from '../../appointments/types/appointment'

export const eventColors: Record<AppointmentStatus, string> = {
  SCHEDULED: '#063154',
  CONFIRMED: '#15803d',
  IN_PROGRESS: '#92400e',
  COMPLETED: '#475569',
  CANCELLED: '#b91c1c',
  NO_SHOW: '#7e22ce',
}
export function appointmentEventLabel(appointment: Appointment, now = Date.now()) {
  return `${formatAppointment(appointment.scheduledAt)} ${appointment.patient.name}, ${appointment.professional.user.name}, ${statusLabels[appointment.status]}${isPastPendingAppointment(appointment, now) ? '. ' + pendingAppointmentLabel : ''}. Abrir detalhes`
}
export function appointmentToEvent(
  appointment: Appointment,
  now = Date.now(),
): EventInput {
  return {
    id: appointment.id,
    title: appointment.patient.name,
    start: appointment.scheduledAt,
    end: appointment.endsAt,
    allDay: false,
    editable: false,
    color: eventColors[appointment.status],
    contrastColor: '#ffffff',
    extendedProps: {
      professional: appointment.professional.user.name,
      status: appointment.status,
      pendingReview: isPastPendingAppointment(appointment, now),
      statusLabel: statusLabels[appointment.status],
    },
  }
}
