import { isApiError } from '../../../api/api-error'
import type { ClinicRole } from '../../auth/types/auth'
export const canEditClinic = (system: boolean, role?: ClinicRole) =>
  system || role === 'ADMIN'
export const normalizeClinicDocument = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
export function formatClinicDocument(value: string) {
  return /^\d{14}$/.test(value)
    ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : value
}
export function clinicError(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 403)
      return 'Você não tem permissão para acessar esta clínica ou executar esta ação.'
    if (error.status === 404) return 'Clínica não encontrada ou não disponível para você.'
    return error.message
  }
  return 'Não foi possível consultar ou salvar a clínica. Tente novamente.'
}
export const clinicRoleLabels = {
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepcionista',
  OPHTHALMOLOGIST: 'Oftalmologista',
}
