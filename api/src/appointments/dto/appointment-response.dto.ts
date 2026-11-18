import { Appointment, AppointmentStatus } from "../entities/appointment.entity";
import { EncounterStatus } from "src/encounters/entities/encounter.entity";

export interface AppointmentResponseDto {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  scheduledAt: Date;
  endsAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  patient: { id: string; name: string };
  professional: {
    id: string;
    userId: string;
    crm: string;
    crmState: string;
    user: { id: string; name: string };
  };
  encounter: { id: string; status: EncounterStatus } | null;
}

// Construct every nested object explicitly: never serialize entity relations here.
export function toAppointmentResponse(
  appointment: Appointment,
): AppointmentResponseDto {
  return {
    id: appointment.id,
    clinicId: appointment.clinicId,
    patientId: appointment.patientId,
    professionalId: appointment.professionalId,
    scheduledAt: appointment.scheduledAt,
    endsAt: appointment.endsAt,
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    reason: appointment.reason,
    notes: appointment.notes,
    cancellationReason: appointment.cancellationReason,
    cancelledAt: appointment.cancelledAt,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    patient: {
      id: appointment.patient.id,
      name: appointment.patient.name,
    },
    professional: {
      id: appointment.professional.id,
      userId: appointment.professional.userId,
      crm: appointment.professional.crm,
      crmState: appointment.professional.crmState,
      user: {
        id: appointment.professional.user.id,
        name: appointment.professional.user.name,
      },
    },
    encounter: appointment.encounter
      ? { id: appointment.encounter.id, status: appointment.encounter.status }
      : null,
  };
}
