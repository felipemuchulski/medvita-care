import { FilterLink as Link } from '../../../components/filters/FilterLink'
import { lazy, Suspense } from 'react'
import { filterRule, periodQuery, useUrlFilters } from '../../../lib/list-filters'
import { PeriodFields } from '../../../components/filters/PeriodFields'
import { useParams } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'
import { useClinic } from '../../../hooks/use-clinic'
import {
  buttonClass,
  inputClass,
  PatientSelector,
} from '../../appointments/components/Selectors'
import { usePatient } from '../../patients/hooks/use-patients'
import { formatDateOnly } from '../../patients/lib/patient-format'
import { useEncounters } from '../hooks/use-encounters'
import {
  canReadClinicalRecords,
  canPreviewClinicalRecords,
  clinicalError,
  encounterLabels,
} from '../lib/encounter'
import type { EncounterStatus } from '../types/encounter'
import { EncounterList } from '../components/EncounterList'
const ClinicalDesignPreview = import.meta.env.DEV
  ? lazy(() => import('../components/ClinicalDesignPreview'))
  : null

const listRules = {
  page: filterRule.page,
  patientId: filterRule.uuid,
  professionalId: filterRule.uuid,
  patientSearch: filterRule.search,
  status: filterRule.enum(Object.keys(encounterLabels)),
  from: filterRule.date,
  to: filterRule.date,
}

export default function MedicalRecordsPage() {
  const clinic = useClinic()
  const { user } = useAuth()
  const { patientId } = useParams()
  if (
    user &&
    !canReadClinicalRecords(clinic.activeRole) &&
    canPreviewClinicalRecords(clinic.activeRole, user.isSystemAdmin) &&
    ClinicalDesignPreview
  ) {
    return (
      <Suspense fallback={<p role="status">Carregando prévia visual...</p>}>
        <ClinicalDesignPreview />
      </Suspense>
    )
  }
  if (clinic.isLoading) return <p role="status">Carregando clínica...</p>
  if (!clinic.activeClinicId)
    return (
      <p role="alert">
        {clinic.error || 'Selecione uma clínica para acessar prontuários.'}
      </p>
    )
  if (!user || !canReadClinicalRecords(clinic.activeRole))
    return (
      <p role="alert">Prontuários são restritos ao oftalmologista vinculado à clínica.</p>
    )
  return (
    <Records
      key={`${clinic.activeClinicId}:${user.id}:${patientId ?? 'list'}`}
      clinic={clinic.activeClinicId}
      user={user.id}
    />
  )
}
function Records({ clinic, user }: { clinic: string; user: string }) {
  const { patientId } = useParams()
  const filters = useUrlFilters(listRules, {
    page: '1',
    from: '',
    to: '',
    patientSearch: '',
    status: '',
    patientId: '',
  })
  const { patientId: patient, status, from, to } = filters.values
  const page = Number(filters.values.page)
  const invalidPeriod = filters.invalidPeriod
  const query = useEncounters(
    clinic,
    user,
    {
      page,
      limit: 20,
      patientId: patient || undefined,
      status: (status || undefined) as EncounterStatus | undefined,
      professionalId: filters.values.professionalId || undefined,
      ...periodQuery(from, to),
    },
    patientId,
    !invalidPeriod,
  )
  const identity = usePatient(clinic, patientId)
  const history = Boolean(patientId)
  return (
    <div className="min-w-0 space-y-5">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">
          {history ? 'Histórico do paciente' : 'Prontuários oftalmológicos'}
        </h1>
        <p className="text-sm text-text-secondary">
          {history
            ? 'Histórico autorizado dos atendimentos nesta clínica.'
            : 'Consulte seus atendimentos ou localize um paciente para abrir o histórico clínico.'}
        </p>
        {history && (
          <div className="flex flex-wrap gap-3">
            <Link
              className={buttonClass}
              to="/prontuarios"
            >
              Voltar aos prontuários
            </Link>
            <Link
              className={buttonClass}
              to={`/exames?patientId=${patientId}`}
            >
              Consultar exames do paciente
            </Link>
          </div>
        )}
      </header>
      {history && (
        <section className="rounded-xl border border-border bg-white p-4">
          {identity.isPending ? (
            <p role="status">Carregando paciente...</p>
          ) : identity.isError || identity.data.clinicId !== clinic ? (
            <p role="alert">Paciente não encontrado ou não autorizado.</p>
          ) : (
            <>
              <h2 className="break-words text-xl font-semibold">{identity.data.name}</h2>
              <p>Nascimento: {formatDateOnly(identity.data.birthDate)}</p>
            </>
          )}
        </section>
      )}
      <section
        className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 md:grid-cols-2"
        aria-label="Filtros de prontuários"
      >
        {!history && (
          <>
            <PatientSelector
              key={filters.resetKey}
              searchValue={filters.values.patientSearch}
              onSearchChange={(value) => filters.update({ patientSearch: value }, true)}
              clinic={clinic}
              value={patient}
              onChange={(value) => filters.update({ patientId: value })}
            />
            {patient && (
              <Link
                className={buttonClass}
                to={`/prontuarios/pacientes/${patient}`}
              >
                Abrir histórico do paciente selecionado
              </Link>
            )}
          </>
        )}
        <label className="form-field">
          <span>Status do atendimento</span>
          <select
            aria-label="Status do atendimento"
            className={inputClass}
            value={status}
            onChange={(event) => filters.update({ status: event.target.value })}
          >
            <option value="">Todos</option>
            {Object.entries(encounterLabels).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-2">
          <PeriodFields
            from={from}
            to={to}
            onChange={filters.update}
          />
        </div>
        <button
          type="button"
          className={`${buttonClass} justify-self-start`}
          onClick={filters.reset}
        >
          Limpar filtros
        </button>
      </section>
      {invalidPeriod ? (
        <p
          role="alert"
          className="text-red-800"
        >
          O fim do período deve ser igual ou posterior ao início.
        </p>
      ) : query.isPending ? (
        <p role="status">Carregando atendimentos...</p>
      ) : query.isError ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl bg-red-50 p-4 text-red-900"
        >
          <p>{clinicalError(query.error)}</p>
          <button
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : !query.data.data.length ? (
        <p className="rounded-xl border border-dashed border-border p-6">
          Nenhum atendimento encontrado para os filtros selecionados.
        </p>
      ) : (
        <EncounterList
          records={query.data.data}
          user={user}
          history={history}
        />
      )}
      {!invalidPeriod && query.data && query.data.meta.totalPages > 1 && (
        <nav
          aria-label="Paginação de atendimentos"
          className="flex flex-wrap items-center gap-3"
        >
          <button
            className={buttonClass}
            disabled={page <= 1 || query.isFetching}
            onClick={() => filters.update({ page: String(page - 1) })}
          >
            Anterior
          </button>
          <p>
            Página {page} de {query.data.meta.totalPages}
          </p>
          <button
            className={buttonClass}
            disabled={page >= query.data.meta.totalPages || query.isFetching}
            onClick={() => filters.update({ page: String(page + 1) })}
          >
            Próxima
          </button>
        </nav>
      )}
      {!history && (
        <p className="text-sm text-text-secondary">
          Para iniciar um atendimento, abra o agendamento atribuído a você em{' '}
          <Link
            to="/agendamentos"
            className="inline-flex min-h-11 items-center font-medium text-primary underline"
          >
            Agendamentos
          </Link>
          .
        </p>
      )}
    </div>
  )
}
