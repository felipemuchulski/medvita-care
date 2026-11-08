import type { PaginationMeta } from '../../patients/types/patient'
export type ExamStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type ExamLaterality = 'OD' | 'OS' | 'AO'
export interface ExamType {
  id: string
  code: string
  name: string
  description?: string | null
  isActive: boolean
}
export interface ExamSummary {
  id: string
  clinicId: string
  patientId: string
  encounterId: string | null
  examTypeId: string
  requestedByProfessionalId: string
  laterality: ExamLaterality
  status: ExamStatus
  requestedAt: string
  performedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  patient: { id: string; name: string }
  examType: ExamType
  encounter: { id: string; startedAt: string } | null
  requestedByProfessional: {
    id: string
    userId: string
    crm: string
    crmState: string
    user: { id: string; name: string }
  }
}
export interface Exam extends ExamSummary {
  notes: string | null
  resultText: string | null
  cancellationReason: string | null
}
export interface ExamQuery {
  page?: number
  limit?: number
  patientId?: string
  encounterId?: string
  examTypeId?: string
  status?: ExamStatus
  search?: string
  from?: string
  to?: string
}
export interface ExamListResponse {
  data: ExamSummary[]
  meta: PaginationMeta
}
export interface CreateExamPayload {
  patientId: string
  examTypeId: string
  encounterId?: string
  laterality: ExamLaterality
  notes?: string
}
export type UpdateExamPayload = Pick<CreateExamPayload, 'laterality' | 'notes'>
export interface ExamResultPayload {
  resultText: string
  performedAt: string
}
