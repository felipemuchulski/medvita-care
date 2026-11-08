import type { Patient, PaginationMeta } from '../../patients/types/patient'
import type { Professional } from '../../professionals/types/professional'
export type EncounterStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export interface ClinicalData {
  chiefComplaint: string | null
  anamnesis: string | null
  visualAcuityRight: string | null
  visualAcuityLeft: string | null
  intraocularPressureRight: number | string | null
  intraocularPressureLeft: number | string | null
  clinicalAssessment: string | null
  plan: string | null
  clinicalNotes: string | null
}
export interface Encounter extends ClinicalData {
  id: string
  clinicId: string
  patientId: string
  professionalId: string
  appointmentId: string
  status: EncounterStatus
  startedAt: string
  finishedAt: string | null
  cancellationReason: string | null
  patient: Patient
  professional: Professional
}
export type ClinicalPayload = Omit<
  ClinicalData,
  'intraocularPressureRight' | 'intraocularPressureLeft'
> & {
  intraocularPressureRight: number | null
  intraocularPressureLeft: number | null
}
export interface EncounterQuery {
  page?: number
  limit?: number
  patientId?: string
  professionalId?: string
  status?: EncounterStatus
  from?: string
  to?: string
}
export interface EncounterResponse {
  data: Encounter[]
  meta: PaginationMeta
}
