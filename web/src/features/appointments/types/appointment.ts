import type { Patient, PaginationMeta } from "../../patients/types/patient";
export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";
export interface Professional {
  id: string;
  userId: string;
  crm: string;
  crmState: string;
  user: { name: string; active: boolean };
}
export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  cancellationReason: string | null;
  patient: Patient;
  professional: Professional;
  encounter?: { id: string } | null;
}
export interface AppointmentQuery {
  page?: number;
  limit?: number;
  patientId?: string;
  professionalId?: string;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
}
export interface AppointmentPayload {
  patientId: string;
  professionalId: string;
  scheduledAt: string;
  durationMinutes: number;
  reason?: string;
  notes?: string;
}
export interface AppointmentResponse {
  data: Appointment[];
  meta: PaginationMeta;
}
