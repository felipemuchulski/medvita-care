import { Link, useParams } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'
import { useClinic } from '../../../hooks/use-clinic'
import { buttonClass } from '../../appointments/components/Selectors'
import { formatAppointment } from '../../appointments/lib/appointment'
import { useEncounter } from '../hooks/use-encounters'
import { canEditEncounter, canReadClinicalRecords, clinicalError } from '../lib/encounter'
import { ClinicalReadOnly } from '../components/ClinicalReadOnly'
import { EncounterForm } from '../components/EncounterForm'
import { EncounterStatusBadge } from '../components/EncounterStatusBadge'
export default function EncounterPage() {
  const { user } = useAuth()
  const clinic = useClinic()
  const { encounterId = '' } = useParams()
  if (clinic.isLoading) return <p role="status">Carregando clínica...</p>
  if (!clinic.activeClinicId) return <p role="alert">Selecione uma clínica.</p>
  if (!user || !canReadClinicalRecords(clinic.activeRole))
    return <p role="alert">Acesso clínico restrito ao oftalmologista vinculado.</p>
  return (
    <Detail
      key={`${clinic.activeClinicId}:${user.id}:${encounterId}`}
      clinic={clinic.activeClinicId}
      user={user.id}
      id={encounterId}
    />
  )
}
function Detail({ clinic, user, id }: { clinic: string; user: string; id: string }) {
  const query = useEncounter(clinic, user, id)
  if (query.isPending) return <p role="status">Carregando atendimento...</p>
  if (query.isError)
    return (
      <div
        role="alert"
        className="space-y-3"
      >
        <p>{clinicalError(query.error)}</p>
        <button
          className={buttonClass}
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </button>
        <Link
          to="/prontuarios"
          className={buttonClass}
        >
          Voltar
        </Link>
      </div>
    )
  const record = query.data
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5">
      <Link
        className={buttonClass}
        to={`/prontuarios/pacientes/${record.patientId}`}
      >
        Histórico do paciente
      </Link>
      <Link
        className={buttonClass}
        to={`/exames?patientId=${record.patientId}&encounterId=${record.id}`}
      >
        Exames deste atendimento
      </Link>
      <header className="space-y-3 rounded-xl border border-border bg-white p-4 sm:p-5">
        <div className="flex min-w-0 flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h1 className="min-w-0 break-words text-xl font-bold sm:text-2xl">
            {record.patient.name}
          </h1>
          <EncounterStatusBadge status={record.status} />
        </div>
        <div className="grid min-w-0 gap-2 text-sm text-text-secondary sm:grid-cols-2">
          <p className="[overflow-wrap:anywhere]">
            Profissional:{' '}
            <span className="font-medium text-text-primary">
              {record.professional.user.name}
            </span>
          </p>
          <p>Início: {formatAppointment(record.startedAt)} · UTC−03:00</p>
          {record.finishedAt && <p>Término: {formatAppointment(record.finishedAt)}</p>}
        </div>
      </header>
      {record.status !== 'IN_PROGRESS' && (
        <p
          role="status"
          className="rounded-lg bg-primary-light p-3 text-primary"
        >
          {record.status === 'COMPLETED'
            ? 'Atendimento concluído. O registro está disponível somente para leitura.'
            : 'Atendimento cancelado. O registro está disponível somente para leitura.'}
        </p>
      )}
      {canEditEncounter(record, user) ? (
        <EncounterForm
          key={record.id}
          encounter={record}
          clinic={clinic}
          user={user}
        />
      ) : (
        <ClinicalReadOnly encounter={record} />
      )}
    </div>
  )
}
