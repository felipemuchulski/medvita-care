import { z } from 'zod'
import { isApiError } from '../../../api/api-error'
import type { ClinicRole } from '../../auth/types/auth'
import type { Appointment } from '../../appointments/types/appointment'
import type { ClinicalData, ClinicalPayload, Encounter } from '../types/encounter'
export const encounterLabels = {
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}
export const canReadClinicalRecords = (role: ClinicRole | null) =>
  role === 'OPHTHALMOLOGIST'
export const canPreviewClinicalRecords = (
  role: ClinicRole | null,
  isSystemAdmin = false,
) => import.meta.env.DEV && (isSystemAdmin || role === 'ADMIN')
export const canEditEncounter = (encounter: Encounter, user: string) =>
  encounter.status === 'IN_PROGRESS' && encounter.professional.userId === user
export const canStartEncounter = (appointment: Appointment, user: string) =>
  appointment.professional.userId === user &&
  !appointment.encounter &&
  ['SCHEDULED', 'CONFIRMED'].includes(appointment.status)
export const textFields = [
  { name: 'chiefComplaint', label: 'Queixa principal', max: 4000 },
  { name: 'anamnesis', label: 'História clínica e antecedentes', max: 12000 },
  { name: 'clinicalAssessment', label: 'Avaliação clínica', max: 12000 },
  { name: 'plan', label: 'Plano / conduta', max: 12000 },
  { name: 'clinicalNotes', label: 'Observações clínicas', max: 12000 },
] as const
const text = (max: number) => z.string().max(max, `Use no máximo ${max} caracteres.`)
const pressure = z.string().refine((value) => {
  if (!value.trim()) return true
  const normalized = value.trim().replace(',', '.')
  return (
    /^\d+(?:\.\d{1,2})?$/.test(normalized) &&
    Number(normalized) >= 0 &&
    Number(normalized) <= 100
  )
}, 'Informe um valor de 0 a 100, com até duas casas decimais.')
export const encounterSchema = z.object({
  chiefComplaint: text(4000),
  anamnesis: text(12000),
  clinicalAssessment: text(12000),
  plan: text(12000),
  clinicalNotes: text(12000),
  visualAcuityRight: text(50),
  visualAcuityLeft: text(50),
  intraocularPressureRight: pressure,
  intraocularPressureLeft: pressure,
})
export type EncounterValues = z.infer<typeof encounterSchema>
export function toEncounterValues(data: ClinicalData): EncounterValues {
  return {
    chiefComplaint: data.chiefComplaint ?? '',
    anamnesis: data.anamnesis ?? '',
    clinicalAssessment: data.clinicalAssessment ?? '',
    plan: data.plan ?? '',
    clinicalNotes: data.clinicalNotes ?? '',
    visualAcuityRight: data.visualAcuityRight ?? '',
    visualAcuityLeft: data.visualAcuityLeft ?? '',
    intraocularPressureRight: String(data.intraocularPressureRight ?? ''),
    intraocularPressureLeft: String(data.intraocularPressureLeft ?? ''),
  }
}
export function toClinicalPayload(values: EncounterValues): ClinicalPayload {
  const clean = (v: string) => v.trim() || null
  const number = (v: string) => (v.trim() ? Number(v.trim().replace(',', '.')) : null)
  return {
    chiefComplaint: clean(values.chiefComplaint),
    anamnesis: clean(values.anamnesis),
    visualAcuityRight: clean(values.visualAcuityRight),
    visualAcuityLeft: clean(values.visualAcuityLeft),
    intraocularPressureRight: number(values.intraocularPressureRight),
    intraocularPressureLeft: number(values.intraocularPressureLeft),
    clinicalAssessment: clean(values.clinicalAssessment),
    plan: clean(values.plan),
    clinicalNotes: clean(values.clinicalNotes),
  }
}
export function completionReady(data: ClinicalPayload) {
  return Boolean(
    data.chiefComplaint?.trim() && data.clinicalAssessment?.trim() && data.plan?.trim(),
  )
}
export function clinicalError(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 401) return 'Sessão expirada. Entre novamente.'
    if (error.status === 403)
      return 'Acesso restrito ao oftalmologista autorizado nesta clínica.'
    if (error.status === 404)
      return 'Registro não encontrado ou não autorizado nesta clínica.'
    if (error.status === 409)
      return 'O agendamento já possui atendimento. Atualize os dados e abra o registro existente.'
    if (error.status === 400)
      return 'Confira os campos e o status do atendimento. Para concluir, preencha queixa principal, avaliação clínica e plano.'
  }
  return 'Não foi possível concluir a operação. Seus dados não foram confirmados pelo servidor. Tente novamente.'
}
