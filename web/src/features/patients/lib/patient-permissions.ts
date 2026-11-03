import type { ClinicRole } from '../../auth/types/auth'

export function canReadPatients(role: ClinicRole | null): boolean {
  return role !== null
}

export function canWritePatients(role: ClinicRole | null): boolean {
  return role === 'ADMIN' || role === 'RECEPTIONIST'
}

export function canChangePatientStatus(role: ClinicRole | null): boolean {
  return role === 'ADMIN'
}
