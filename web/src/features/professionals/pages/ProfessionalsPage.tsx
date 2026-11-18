import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'
import { useClinic } from '../../../hooks/use-clinic'
import { buttonClass } from '../../appointments/components/Selectors'
import { ProfessionalForm } from '../components/ProfessionalForm'
import { ProfessionalsList } from '../components/ProfessionalsList'
import { useProfessional, useProfessionalMutations } from '../hooks/use-professionals'
import {
  canCreateProfessionals,
  canEditProfessionals,
  professionalEditDeniedMessage,
  professionalError,
} from '../lib/professional'
import type { CreateProfessionalPayload } from '../types/professional'

export default function ProfessionalsPage() {
  const clinic = useClinic()
  const { user } = useAuth()
  if (clinic.isLoading) return <p role="status">Carregando clínica...</p>
  if (!user || !clinic.activeClinicId || !clinic.activeRole)
    return (
      <p role="alert">
        {clinic.error ||
          'Selecione uma clínica com vínculo ativo para acessar profissionais.'}
      </p>
    )
  const canCreate = canCreateProfessionals(clinic.activeRole, user.isSystemAdmin)
  const canEdit = canEditProfessionals(user.isSystemAdmin)
  const ownUser =
    !user.isSystemAdmin && clinic.activeRole === 'OPHTHALMOLOGIST' ? user.id : undefined
  return (
    <ProfessionalScreen
      key={`${clinic.activeClinicId}:${user.id}:${clinic.activeRole}:${user.isSystemAdmin}`}
      clinic={clinic.activeClinicId}
      canCreate={canCreate}
      canEdit={canEdit}
      ownUser={ownUser}
    />
  )
}
function ProfessionalScreen({
  clinic,
  canCreate,
  canEdit,
  ownUser,
}: {
  clinic: string
  canCreate: boolean
  canEdit: boolean
  ownUser?: string
}) {
  const { professionalId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const create = location.pathname.endsWith('/novo')
  const edit = location.pathname.endsWith('/editar')
  const detail = useProfessional(clinic, professionalId)
  const mutations = useProfessionalMutations(clinic)
  if (!create && !professionalId)
    return (
      <ProfessionalsList
        clinic={clinic}
        canCreate={canCreate}
        canEdit={canEdit}
        ownUser={ownUser}
      />
    )
  if ((create && !canCreate) || (edit && !canEdit))
    return (
      <div role="alert">
        <p>
          {edit
            ? professionalEditDeniedMessage
            : 'Você não tem permissão para cadastrar profissionais nesta clínica.'}
        </p>
        {edit && <p>Solicite a correção do cadastro ao administrador do sistema.</p>}
        <Link
          className={buttonClass}
          to="/profissionais"
        >
          Voltar
        </Link>
      </div>
    )
  if (create)
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Cadastrar profissional</h1>
        <ProfessionalForm
          clinic={clinic}
          onSave={async (payload) => {
            const p = await mutations.create.mutateAsync(
              payload as CreateProfessionalPayload,
            )
            navigate(`/profissionais/${p.id}`, {
              state: { success: 'Profissional cadastrado com sucesso.' },
            })
          }}
        />
      </div>
    )
  if (detail.isPending) return <p role="status">Carregando profissional...</p>
  if (detail.isError || !detail.data || (ownUser && detail.data.userId !== ownUser))
    return (
      <div
        role="alert"
        className="space-y-3"
      >
        <p>{professionalError(detail.error)}</p>
        <button
          className={buttonClass}
          onClick={() => void detail.refetch()}
        >
          Tentar novamente
        </button>
        <Link
          className={buttonClass}
          to="/profissionais"
        >
          Voltar
        </Link>
      </div>
    )
  const p = detail.data
  if (edit)
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Editar profissional</h1>
        <ProfessionalForm
          key={p.id}
          clinic={clinic}
          professional={p}
          onSave={async (payload) => {
            await mutations.update.mutateAsync({ id: p.id, payload })
            navigate(`/profissionais/${p.id}`, {
              state: { success: 'Profissional atualizado com sucesso.' },
            })
          }}
        />
      </div>
    )
  return (
    <div className="min-w-0 space-y-5">
      <Link
        className={buttonClass}
        to="/profissionais"
      >
        Profissionais
      </Link>
      <h1 className="text-2xl font-bold">Detalhes do profissional</h1>
      {location.state?.success && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-green-900"
        >
          {location.state.success}
        </p>
      )}
      <article className="space-y-5 rounded-xl border border-border bg-white p-4 sm:p-6">
        <h2 className="break-words text-xl font-semibold">{p.user.name}</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            ['CRM/UF', `${p.crm}/${p.crmState}`],
            ['RQE', p.rqe || 'Não informado'],
            ['Especialidade', p.specialty],
            ['E-mail', p.user.email],
          ].map(([label, value]) => (
            <div
              key={label}
              className="min-w-0"
            >
              <dt className="text-sm text-text-secondary">{label}</dt>
              <dd className="[overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-text-secondary">
          Perfil global consultado pelo vínculo ativo de oftalmologista nesta clínica. A
          situação de outros vínculos não é retornada neste cadastro.
        </p>
      </article>
      {!canEdit && (
        <p className="text-sm text-text-secondary">
          Para corrigir os dados deste perfil global, solicite a alteração ao
          administrador do sistema.
        </p>
      )}
      {canEdit && (
        <Link
          className={buttonClass}
          to={`/profissionais/${p.id}/editar`}
        >
          Editar profissional
        </Link>
      )}
    </div>
  )
}
