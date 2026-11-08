import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'
import { useClinic } from '../../../hooks/use-clinic'
import { buttonClass } from '../../appointments/components/Selectors'
import { useClinicDetails, useClinicTeam } from '../../clinics/hooks/use-clinics'
import { userError } from '../../users/lib/user'
import { ClinicUserCreateForm } from '../components/ClinicUserCreateForm'
import { ClinicMemberList } from '../components/ClinicMemberList'
export default function ClinicUsersPage() {
  const { user } = useAuth()
  const context = useClinic()
  const { clinicId } = useParams()
  const clinic = clinicId || context.activeClinicId
  const local = context.memberships.find((m) => m.clinicId === clinic)
  let content
  if (context.isLoading && !user?.isSystemAdmin)
    content = <p role="status">Carregando vínculos...</p>
  else if (context.error && !user?.isSystemAdmin)
    content = <p role="alert">{context.error}</p>
  else if (!clinic)
    content = (
      <div className="space-y-3">
        <p role="status">Selecione uma clínica ativa para consultar a equipe.</p>
        {user?.isSystemAdmin && (
          <Link
            className={buttonClass}
            to="/clinicas"
          >
            Selecionar clínica na administração
          </Link>
        )}
      </div>
    )
  else if (!user || (!user.isSystemAdmin && !local))
    content = (
      <p role="alert">Você não possui vínculo ativo autorizado com esta clínica.</p>
    )
  else if (!user.isSystemAdmin && clinic !== context.activeClinicId)
    content = <p role="status">Selecione esta clínica no menu para gerenciar a equipe.</p>
  else
    content = (
      <Members
        key={`${user.id}:${clinic}:${user.isSystemAdmin ? 'global' : local?.role}`}
        actor={user.id}
        clinic={clinic}
        system={user.isSystemAdmin}
        manage={user.isSystemAdmin || local?.role === 'ADMIN'}
      />
    )
  return (
    <div className="min-w-0 space-y-5 break-words [&_button]:min-h-11 [&_button]:min-w-11 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-primary">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Equipe da clínica</h1>
        <p className="text-sm text-text-secondary">
          Usuários vinculados, papéis e permissões da clínica selecionada.
        </p>
      </header>
      {content}
    </div>
  )
}
function Members({
  actor,
  clinic,
  system,
  manage,
}: {
  actor: string
  clinic: string
  system: boolean
  manage: boolean
}) {
  const context = useClinic()
  const team = useClinicTeam(actor, clinic)
  const detail = useClinicDetails(actor, clinic)
  const [create, setCreate] = useState(false)
  const [params] = useSearchParams()
  if (detail.isPending || team.isPending) return <p role="status">Carregando equipe...</p>
  if (detail.isError || team.isError)
    return (
      <div
        role="alert"
        className="space-y-3"
      >
        <p>{userError(detail.error || team.error)}</p>
        <button
          className={buttonClass}
          onClick={() => {
            void detail.refetch()
            void team.refetch()
          }}
        >
          Tentar novamente
        </button>
      </div>
    )
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Link
          className={buttonClass}
          to={`/clinicas/${clinic}`}
        >
          Dados da clínica
        </Link>
        {system && (
          <Link
            className={buttonClass}
            to="/usuarios"
          >
            Usuários globais
          </Link>
        )}
        {context.activeClinicId === clinic && (
          <Link
            className={buttonClass}
            to="/profissionais"
          >
            Profissionais da clínica
          </Link>
        )}
      </div>
      <h2 className="text-xl font-semibold">{detail.data.name}</h2>
      {manage && system && detail.data.active && (
        <button
          className={buttonClass}
          type="button"
          aria-expanded={create}
          onClick={() => setCreate(true)}
        >
          Vincular usuário existente
        </button>
      )}
      {manage && !system && (
        <p
          role="status"
          className="rounded-lg bg-primary-light p-4 text-sm text-primary"
        >
          Você pode gerenciar os vínculos existentes. Para vincular uma nova conta,
          solicite ao administrador do sistema: a busca de usuários globais não está
          disponível para ADMIN local.
        </p>
      )}
      {!detail.data.active && (
        <p role="status">
          Clínica inativa: novos vínculos e ativações estão indisponíveis.
        </p>
      )}
      {create && system && detail.data.active && (
        <ClinicUserCreateForm
          actor={actor}
          clinic={clinic}
          members={team.data}
          onClose={() => setCreate(false)}
        />
      )}
      {!team.data.length ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-border bg-white p-6"
        >
          Nenhum usuário vinculado a esta clínica.
        </p>
      ) : (
        <ClinicMemberList
          members={team.data}
          clinic={clinic}
          actor={actor}
          system={system}
          manage={manage}
          clinicActive={detail.data.active}
          selected={params.get('userId')}
        />
      )}
    </>
  )
}
