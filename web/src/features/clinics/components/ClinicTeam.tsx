import { Link } from 'react-router'
import { ClinicMemberList } from '../../clinic-users/components/ClinicMemberList'
import { buttonClass } from '../../appointments/components/Selectors'
import { useClinicTeam } from '../hooks/use-clinics'
import { clinicError } from '../lib/clinic'
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
        <ClinicMemberList
          members={query.data}
          clinic={id}
          actor={user}
        />
      )}
      <Link
        className={buttonClass}
        to={`/clinicas/${id}/usuarios`}
      >
        Abrir equipe e ações autorizadas
      </Link>
    </section>
  )
}
