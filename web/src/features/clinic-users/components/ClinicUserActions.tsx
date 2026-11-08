import { useRef, useState } from 'react'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import type { ClinicRole } from '../../auth/types/auth'
import { clinicRoleLabels } from '../../clinics/lib/clinic'
import type { ClinicTeamMember } from '../../clinics/types/clinic'
import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import { userError } from '../../users/lib/user'
import { useClinicUserMutations } from '../hooks/use-clinic-user-mutations'
export function ClinicUserActions({
  clinic,
  member,
  clinicActive,
  actor,
}: {
  clinic: string
  member: ClinicTeamMember
  clinicActive: boolean
  actor: string
}) {
  const mutation = useClinicUserMutations(clinic)
  const [action, setAction] = useState<'role' | 'active' | null>(null)
  const [role, setRole] = useState<ClinicRole>(member.role)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const pending = mutation.role.isPending || mutation.active.isPending
  async function confirm() {
    if (lock.current) return
    lock.current = true
    setError('')
    setMessage('')
    try {
      if (action === 'role')
        await mutation.role.mutateAsync({ userId: member.userId, role })
      else
        await mutation.active.mutateAsync({
          userId: member.userId,
          active: !member.active,
        })
      setAction(null)
      setMessage('Vínculo atualizado com sucesso.')
    } catch (e) {
      setError(userError(e))
    } finally {
      lock.current = false
      mutation.role.reset()
      mutation.active.reset()
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setRole(member.role)
            setError('')
            setAction('role')
          }}
        >
          Alterar papel
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!member.active && (!clinicActive || !member.user?.active)}
          onClick={() => {
            setError('')
            setAction('active')
          }}
        >
          {member.active ? 'Desativar vínculo' : 'Ativar vínculo'}
        </button>
      </div>
      {!member.active && (!clinicActive || !member.user?.active) && (
        <p className="text-xs text-text-secondary">
          Para ativar o vínculo, a conta e a clínica precisam estar ativas.
        </p>
      )}
      {message && (
        <p
          role="status"
          className="text-sm text-primary"
        >
          {message}
        </p>
      )}
      {action && (
        <ClinicalDialog
          title={
            action === 'role'
              ? 'Alterar papel na clínica?'
              : member.active
                ? 'Desativar vínculo?'
                : 'Ativar vínculo?'
          }
          label="Confirmar alteração"
          pending={pending}
          onClose={() => setAction(null)}
          onConfirm={() => void confirm()}
        >
          <p>
            <strong>{member.user?.name || 'Usuário selecionado'}</strong>
          </p>
          {action === 'role' && (
            <div className="form-field">
              <label htmlFor="membership-role">Novo papel</label>
              <select
                id="membership-role"
                className={inputClass}
                value={role}
                disabled={pending}
                onChange={(e) => setRole(e.target.value as ClinicRole)}
              >
                {Object.entries(clinicRoleLabels).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-sm">
            A clínica deve manter pelo menos um administrador ativo. Alterar o vínculo não
            exclui a conta ou o histórico.
          </p>
          {member.userId === actor && (
            <p className="text-sm">
              Esta alteração afeta seu próprio acesso e revalidará suas permissões.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="text-red-800"
            >
              {error}
            </p>
          )}
        </ClinicalDialog>
      )}
    </div>
  )
}
