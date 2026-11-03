import type { ClinicRole } from '../../auth/types/auth'

export interface ClinicSummary {
  id: string
  name: string
  document: string
  active: boolean
}

export interface ClinicMembership {
  id: string
  clinicId: string
  userId: string
  role: ClinicRole
  active: boolean
  createdAt: string
  updatedAt: string
  clinic?: ClinicSummary
}
