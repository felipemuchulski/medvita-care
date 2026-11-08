import type { ClinicRole } from '../../auth/types/auth'
import { isApiError } from '../../../api/api-error'
import { formatAppointment } from '../../appointments/lib/appointment'
export const canAccessExams = (role: ClinicRole | null) => role === 'OPHTHALMOLOGIST'
export const examStatusLabels = {
  REQUESTED: 'Solicitado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}
export const lateralityLabels = {
  OD: 'OD — Olho direito',
  OS: 'OS — Olho esquerdo',
  AO: 'AO — Ambos os olhos',
}
export const examDate = (value: string | null) =>
  value ? formatAppointment(value) : 'Não informado'
export const examError = (error: unknown) => {
  if (isApiError(error)) {
    if (error.status === 403)
      return 'Você não possui perfil profissional ou vínculo ativo autorizado para acessar exames nesta clínica.'
    if (error.status === 404)
      return 'Registro não encontrado ou não autorizado nesta clínica.'
    return error.message
  }
  return 'Não foi possível carregar ou salvar o exame. Tente novamente.'
}
export function resultDate(local: string, requestedAt: string) {
  const value = `${local.length === 16 ? `${local}:00` : local}-03:00`
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()))
    throw new Error('Informe uma data de realização válida.')
  // Inputs have second precision; preserve the request's milliseconds in that same second.
  const requested = Date.parse(requestedAt)
  if (Math.floor(date.getTime() / 1000) === Math.floor(requested / 1000))
    return requestedAt
  return date.toISOString()
}
export function localDateTime(value: string) {
  return new Date(Date.parse(value) - 3 * 60 * 60 * 1000).toISOString().slice(0, 19)
}
