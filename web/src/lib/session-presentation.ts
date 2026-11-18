import type { ClinicContextValue } from '../contexts/clinic-context'
import { clinicRoleLabels } from '../features/clinics/lib/clinic'
import type { ClinicRole } from '../features/auth/types/auth'

export const sessionGreeting = (name?: string) =>
  name?.trim() ? `Olá, ${name.trim()}.` : 'Bem-vindo ao MedVita Care.'
export const sessionRole = (role: ClinicRole | null, system: boolean) =>
  role
    ? clinicRoleLabels[role]
    : system
      ? 'Administrador do sistema'
      : 'Sem papel clínico ativo'
export function selectedClinicName(
  context: Pick<ClinicContextValue, 'memberships' | 'activeClinicId' | 'isLoading'>,
) {
  if (context.isLoading) return 'Verificando clínica...'
  if (!context.activeClinicId) return 'Nenhuma clínica selecionada'
  return (
    context.memberships.find((m) => m.clinicId === context.activeClinicId)?.clinic
      ?.name || 'Clínica selecionada'
  )
}
