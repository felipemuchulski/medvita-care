import { useNavigationNotice } from '../../../hooks/use-navigation-notice'
import { filterRule, periodQuery, useUrlFilters } from '../../../lib/list-filters'
import { FilterLink as Link } from '../../../components/filters/FilterLink'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router'
import { lazy, Suspense, useState } from 'react'
import { useAuth } from '../../../hooks/use-auth'
import { useClinic } from '../../../hooks/use-clinic'
import { buttonClass } from '../../appointments/components/Selectors'
import { canAccessExams, canPreviewExams, examError, examStatusLabels } from '../lib/exam'
import { useExam, useExams, useExamTypes } from '../hooks/use-exams'
import { ExamFilters } from '../components/ExamFilters'
import { ExamList } from '../components/ExamList'
import { ExamForm } from '../components/ExamForm'
import { ExamDetails } from '../components/ExamDetails'
import type { ExamStatus } from '../types/exam'

const ExamDesignPreview = import.meta.env.DEV
  ? lazy(() => import('../components/ExamDesignPreview'))
  : null

const listRules = {
  page: filterRule.page,
  search: filterRule.search,
  patientId: filterRule.uuid,
  encounterId: filterRule.uuid,
  examTypeId: filterRule.uuid,
  status: filterRule.enum(Object.keys(examStatusLabels)),
  from: filterRule.date,
  to: filterRule.date,
}

export default function ExamsPage() {
  const { user } = useAuth()
  const clinic = useClinic()
  const { examId } = useParams()
  const location = useLocation()
  if (
    user &&
    !canAccessExams(clinic.activeRole) &&
    canPreviewExams(clinic.activeRole, user.isSystemAdmin) &&
    ExamDesignPreview
  ) {
    return (
      <Suspense fallback={<p role="status">Carregando prévia de exames...</p>}>
        <ExamDesignPreview key={`${user.id}:${clinic.activeClinicId ?? 'no-clinic'}`} />
      </Suspense>
    )
  }
  const create = location.pathname.endsWith('/novo')
  const title = create ? 'Solicitar exame' : examId ? 'Detalhes do exame' : 'Exames'
  return (
    <div className="min-w-0 space-y-5 break-words [&_button]:min-h-11 [&_button]:min-w-11 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-primary">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-text-secondary">
          Solicitações e resultados dos exames solicitados por você na clínica ativa.
        </p>
      </header>
      {clinic.isLoading ? (
        <p role="status">Carregando clínica...</p>
      ) : clinic.error ? (
        <p role="alert">{clinic.error}</p>
      ) : !clinic.activeClinicId ? (
        <p role="status">Selecione uma clínica com vínculo ativo no menu.</p>
      ) : !user || !canAccessExams(clinic.activeRole) ? (
        <p role="alert">
          O acesso aos exames é restrito ao oftalmologista vinculado à clínica.
        </p>
      ) : (
        <Screen
          key={`${clinic.activeClinicId}:${user.id}:${clinic.activeRole}:${examId || (create ? 'create' : 'list')}`}
          clinic={clinic.activeClinicId}
          user={user.id}
          create={create}
          id={examId || ''}
        />
      )}
    </div>
  )
}
function Screen({
  clinic,
  user,
  create,
  id,
}: {
  clinic: string
  user: string
  create: boolean
  id: string
}) {
  if (create)
    return (
      <Create
        clinic={clinic}
        user={user}
      />
    )
  if (id)
    return (
      <Detail
        clinic={clinic}
        user={user}
        id={id}
      />
    )
  return (
    <List
      clinic={clinic}
      user={user}
    />
  )
}
function Create({ clinic, user }: { clinic: string; user: string }) {
  const [params] = useSearchParams()
  const [createdId, setCreatedId] = useState('')
  if (createdId)
    return (
      <Navigate
        to={`/exames/${createdId}`}
        replace
        state={{ created: true }}
      />
    )
  return (
    <ExamForm
      clinic={clinic}
      user={user}
      initialPatient={params.get('patientId') || ''}
      initialEncounter={params.get('encounterId') || ''}
      onCreated={setCreatedId}
    />
  )
}
function Detail({ clinic, user, id }: { clinic: string; user: string; id: string }) {
  const notice = useNavigationNotice('created', 'Exame solicitado com sucesso.')
  const query = useExam(clinic, user, id)
  if (query.isPending) return <p role="status">Carregando exame...</p>
  if (query.isError)
    return (
      <div
        role="alert"
        className="space-y-3"
      >
        <p>{examError(query.error)}</p>
        <button
          type="button"
          className={buttonClass}
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </button>
        <Link
          className={buttonClass}
          to="/exames"
        >
          Voltar aos exames
        </Link>
      </div>
    )
  return (
    <ExamDetails
      clinic={clinic}
      user={user}
      exam={query.data}
      navigationNotice={notice}
    />
  )
}
function List({ clinic, user }: { clinic: string; user: string }) {
  const filters = useUrlFilters(listRules, { page: '1', from: '', to: '', search: '' })
  const v = filters.values
  const types = useExamTypes(clinic, user)
  const page = Number(v.page)
  const patient = v.patientId || undefined
  const encounter = v.encounterId || undefined
  const query = useExams(
    clinic,
    user,
    {
      page,
      limit: 20,
      patientId: patient,
      encounterId: encounter,
      search: v.search || undefined,
      examTypeId: v.examTypeId || undefined,
      status: (v.status || undefined) as ExamStatus | undefined,
      ...periodQuery(v.from, v.to),
    },
    !filters.invalidPeriod,
  )
  function changePage(nextPage: number) {
    filters.update({ page: String(nextPage) })
  }
  const createParams = new URLSearchParams()
  if (patient) createParams.set('patientId', patient)
  if (encounter) createParams.set('encounterId', encounter)
  return (
    <>
      <div className="flex flex-wrap gap-3">
        {types.data?.length ? (
          <Link
            className={buttonClass}
            to={`/exames/novo${createParams.size ? '?' + createParams.toString() : ''}`}
          >
            Nova solicitação
          </Link>
        ) : null}
        {patient && (
          <Link
            className={buttonClass}
            to={`/prontuarios/pacientes/${patient}`}
          >
            Voltar ao histórico do paciente
          </Link>
        )}
      </div>
      {patient && (
        <p className="text-sm text-text-secondary">
          Exames filtrados pelo paciente do prontuário
          {encounter ? ' e pelo atendimento selecionado' : ''}.
        </p>
      )}
      {types.isError && (
        <div
          role="alert"
          className="space-y-3"
        >
          <p>{examError(types.error)}</p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void types.refetch()}
          >
            Recarregar tipos de exame
          </button>
        </div>
      )}
      <ExamFilters
        values={v}
        resetKey={filters.resetKey}
        types={types.data || []}
        onChange={filters.update}
        onClear={filters.reset}
      />
      {filters.invalidPeriod ? (
        <p role="status">Corrija o período para consultar os exames.</p>
      ) : query.isPending ? (
        <p role="status">Carregando exames...</p>
      ) : query.isError ? (
        <div
          role="alert"
          className="space-y-3"
        >
          <p>{examError(query.error)}</p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : !query.data.data.length ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-border bg-white p-6"
        >
          Nenhum exame encontrado para os filtros selecionados.
        </p>
      ) : (
        <ExamList exams={query.data.data} />
      )}
      {!filters.invalidPeriod && query.data && query.data.meta.totalPages > 1 && (
        <nav
          aria-label="Paginação de exames"
          className="flex flex-wrap items-center gap-3"
        >
          <button
            type="button"
            className={buttonClass}
            disabled={page <= 1 || query.isFetching}
            onClick={() => changePage(page - 1)}
          >
            Anterior
          </button>
          <p className="text-sm">
            Página {page} de {query.data.meta.totalPages}
          </p>
          <button
            type="button"
            className={buttonClass}
            disabled={page >= query.data.meta.totalPages || query.isFetching}
            onClick={() => changePage(page + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </>
  )
}
