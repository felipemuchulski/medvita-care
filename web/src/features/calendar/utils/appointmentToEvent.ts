import type { EventInput } from "@fullcalendar/react";
import { statusLabels } from "../../appointments/lib/appointment";
import type {
  Appointment,
  AppointmentStatus,
} from "../../appointments/types/appointment";

export const eventColors: Record<AppointmentStatus, string> = {
  SCHEDULED: "#1d4ed8",
  CONFIRMED: "#15803d",
  IN_PROGRESS: "#92400e",
  COMPLETED: "#475569",
  CANCELLED: "#b91c1c",
  NO_SHOW: "#7e22ce",
};
export function appointmentToEvent(appointment: Appointment): EventInput {
  return {
    id: appointment.id,
    title: appointment.patient.name,
    start: appointment.scheduledAt,
    end: appointment.endsAt,
    allDay: false,
    editable: false,
    color: eventColors[appointment.status],
    contrastColor: "#ffffff",
    extendedProps: {
      professional: appointment.professional.user.name,
      status: appointment.status,
      statusLabel: statusLabels[appointment.status],
    },
  };
}
