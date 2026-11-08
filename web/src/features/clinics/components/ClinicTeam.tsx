import { buttonClass } from '../../appointments/components/Selectors'
import { useClinicTeam } from '../hooks/use-clinics'
import { clinicError, clinicRoleLabels } from '../lib/clinic'
export function ClinicTeam({ user, id }: { user: string; id: string }) {
  const query = useClinicTeam(user, id)
  return (
    <section
      aria-labelledby="clinic-team-title"
      className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6"
    >
      <h2
        id="clinic-team-title"
        className="text-lg font-semibold"
      >
        Equipe vinculada
      </h2>
      {query.isPending ? (
        <p role="status">Carregando equipe...</p>
      ) : query.isError ? (
        <div
          role="alert"
          className="space-y-3"
        >
          <p>{clinicError(query.error)}</p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : !query.data.length ? (
        <p>Nenhum usuário vinculado a esta clínica.</p>
      ) : (
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
          {query.data.map((member) => (
            <li
              key={member.id}
              className="min-w-0 space-y-1 rounded-lg border border-border p-3 text-sm"
            >
              <p className="font-medium">
                {member.user?.name || 'Usuário não disponível'}
              </p>
              <p className="[overflow-wrap:anywhere]">
                {member.user?.email || 'E-mail não informado'}
              </p>
              <p>
                {clinicRoleLabels[member.role]} · Vínculo{' '}
                {member.active ? 'ativo' : 'inativo'}
              </p>
              {member.user && !member.user.active && (
                <p className="text-text-secondary">Usuário inativo</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-text-secondary">
        A consulta da equipe está disponível aqui. O gerenciamento de vínculos será
        tratado no módulo de Usuários.
      </p>
    </section>
  )
}
