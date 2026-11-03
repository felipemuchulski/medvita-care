export type PatientSex = 'MALE' | 'FEMALE' | 'NOT_INFORMED'

export interface Patient {
  id: string
  clinicId: string
  name: string
  cpf: string | null
  birthDate: string
  sex: PatientSex | null
  phone: string | null
  email: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface PatientPayload {
  name: string
  cpf?: string | null
  birthDate: string
  sex?: PatientSex | null
  phone?: string | null
  email?: string | null
  zipCode?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
}

export interface PatientsQuery {
  page?: number
  limit?: number
  search?: string
  active?: boolean
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PatientsResponse {
  data: Patient[]
  meta: PaginationMeta
}
