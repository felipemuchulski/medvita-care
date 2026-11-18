import type { PaginationMeta } from "../../patients/types/patient";
import type { EncounterStatus } from "../../medical-records/types/encounter";
export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";
export type { Professional } from "../../professionals/types/professional";
import type { Professional } from "../../professionals/types/professional";
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
  patient: { id: string; name: string };
  professional: Pick<Professional, "id" | "userId" | "crm" | "crmState"> & {
    user: { id: string; name: string };
  };
  encounter: { id: string; status: EncounterStatus } | null;
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
