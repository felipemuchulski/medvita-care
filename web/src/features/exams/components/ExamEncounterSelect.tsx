import { useState } from 'react'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { useEncounters } from '../../medical-records/hooks/use-encounters'
import { examDate, examError } from '../lib/exam'
export function ExamEncounterSelect({
  clinic,
  user,
  patient,
  value,
  onChange,
}: {
  clinic: string
  user: string
  patient: string
  value: string
  onChange: (id: string) => void
}) {
  const [page, setPage] = useState(1)
  const query = useEncounters(
    clinic,
    user,
    { patientId: patient, page, limit: 10 },
    undefined,
    Boolean(patient),
  )
  return (
    <div className="form-field">
      <label
        htmlFor="exam-encounter"
        className="text-sm font-medium"
      >
        Atendimento associado (opcional)
      </label>
      <select
        id="exam-encounter"
        className={inputClass}
        value={value}
        disabled={!patient || query.isPending || query.isError}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="exam-encounter-help"
      >
        <option value="">Sem atendimento associado</option>
        {value && !query.data?.data.some((e) => e.id === value) && (
          <option value={value}>Atendimento selecionado</option>
        )}
        {query.data?.data
          .filter((e) => e.status !== 'CANCELLED')
          .map((e) => (
            <option
              key={e.id}
              value={e.id}
            >
              {examDate(e.startedAt)}
            </option>
          ))}
      </select>
      <p
        id="exam-encounter-help"
        className="text-sm text-text-secondary"
      >
        {patient
          ? 'Somente seus atendimentos deste paciente na clínica ativa.'
          : 'Selecione o paciente para consultar atendimentos.'}
      </p>
      {query.isError && (
        <div role="alert">
          <p>{examError(query.error)}</p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {query.data && query.data.meta.totalPages > 1 && (
        <nav
          aria-label="Paginação de atendimentos"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            className={buttonClass}
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={page >= query.data.meta.totalPages || query.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </div>
  )
}
