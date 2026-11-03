import { createContext } from 'react'
import type { ClinicRole } from '../features/auth/types/auth'
import type { ClinicMembership } from '../features/clinics/types/clinic'

export interface ClinicContextValue {
  memberships: ClinicMembership[]
  activeMembership: ClinicMembership | null
  activeClinicId: string | null
  activeRole: ClinicRole | null
  isLoading: boolean
  error: string | null
  selectClinic: (clinicId: string) => void
}

export const ClinicContext = createContext<ClinicContextValue | null>(null)
