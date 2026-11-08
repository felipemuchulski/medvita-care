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

export interface Clinic extends ClinicSummary {
  phone: string | null
  email: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateClinicPayload {
  name: string
  document: string
  phone?: string
  email?: string
  zipCode?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}
export type UpdateClinicPayload = Partial<
  Pick<
    CreateClinicPayload,
    | 'name'
    | 'phone'
    | 'email'
    | 'street'
    | 'number'
    | 'complement'
    | 'neighborhood'
    | 'state'
  >
>
export interface ClinicTeamMember {
  id: string
  clinicId: string
  userId: string
  role: ClinicRole
  active: boolean
  user?: { id: string; name: string; email: string; active: boolean }
}
