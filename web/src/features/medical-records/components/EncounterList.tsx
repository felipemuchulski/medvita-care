import { FilterLink as Link } from '../../../components/filters/FilterLink'
import { buttonClass } from '../../appointments/components/Selectors'
import { formatAppointment } from '../../appointments/lib/appointment'
import type { Encounter } from '../types/encounter'
import { EncounterStatusBadge } from './EncounterStatusBadge'
import { ClinicalReadOnly } from './ClinicalReadOnly'
export function EncounterList({
  records,
  user,
  history = false,
}: {
  records: Encounter[]
  user: string
  history?: boolean
}) {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      {records.map((record) => (
        <article
          key={record.id}
          className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-4 [overflow-wrap:anywhere]"
        >
          <h2 className="text-lg font-semibold">{record.patient.name}</h2>
          <p>{formatAppointment(record.startedAt)} · UTC−03:00</p>
          <p>Profissional: {record.professional.user.name}</p>
          <EncounterStatusBadge status={record.status} />
          <Link
            to={`/prontuarios/pacientes/${record.patientId}`}
            className={`${buttonClass} w-full`}
          >
            Histórico do paciente
          </Link>
          {record.professional.userId === user ? (
            <Link
              to={`/prontuarios/atendimentos/${record.id}`}
              className={`${buttonClass} w-full`}
            >
              Abrir atendimento
            </Link>
          ) : (
            history && (
              <details>
                <summary className="min-h-11 cursor-pointer py-3 font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary">
                  Consultar registro · somente leitura
                </summary>
                <ClinicalReadOnly encounter={record} />
              </details>
            )
          )}
        </article>
      ))}
    </div>
  )
}
