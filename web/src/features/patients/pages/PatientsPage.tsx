import { Search, UserPlus, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { isApiError } from '../../../api/api-error'
import type { ClinicRole } from '../../auth/types/auth'
import { useClinic } from '../../../hooks/use-clinic'
import PatientStatusBadge from '../components/PatientStatusBadge'
import PatientsUnavailable from '../components/PatientsUnavailable'
import { usePatients } from '../hooks/use-patients'
import { formatCpf, formatDateOnly } from '../lib/patient-format'
import { canReadPatients, canWritePatients } from '../lib/patient-permissions'

interface LocationState {
  notice?: string
}

export default function PatientsPage() {
  const { activeClinicId, activeRole } = useClinic()

  if (!activeClinicId || !activeRole || !canReadPatients(activeRole)) {
    return <PatientsUnavailable />
  }

  return (
    <PatientsContent
      key={activeClinicId}
      clinicId={activeClinicId}
      activeRole={activeRole}
    />
  )
}

function PatientsContent({
  clinicId,
  activeRole,
}: {
  clinicId: string
  activeRole: ClinicRole
}) {
  const location = useLocation()
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>(
    'active',
  )
  const [page, setPage] = useState(1)
  const query = {
    page,
    limit: 20,
    search: search || undefined,
    active: activeFilter === 'all' ? undefined : activeFilter === 'active',
  }
  const patientsQuery = usePatients(clinicId, query)
  const canWrite = canWritePatients(activeRole)

  function applySearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setSearch(draftSearch.trim())
    setPage(1)
  }

  const errorMessage = patientsQuery.error
    ? isApiError(patientsQuery.error)
      ? patientsQuery.error.message
      : 'Não foi possível carregar os pacientes.'
    : null
  const response = patientsQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cadastros da clínica ativa, isolados por vínculo autorizado.
          </p>
        </div>
        {canWrite && (
          <Link
            to="/pacientes/novo"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <UserPlus size={18} /> Novo paciente
          </Link>
        )}
      </div>

      {(location.state as LocationState | null)?.notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {(location.state as LocationState).notice}
        </p>
      )}

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <form
          onSubmit={applySearch}
          className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
        >
          <label className="relative">
            <span className="sr-only">Buscar paciente por nome ou CPF</span>
            <Search
              aria-hidden="true"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Buscar por nome ou CPF"
              className="min-h-11 w-full rounded-lg border border-border py-2 pl-10 pr-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por status</span>
            <select
              value={activeFilter}
              onChange={(event) => {
                setActiveFilter(event.target.value as typeof activeFilter)
                setPage(1)
              }}
              className="min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Buscar
          </button>
        </form>
      </div>

      {patientsQuery.isLoading ? (
        <div
          role="status"
          className="rounded-xl border border-border bg-white px-5 py-12 text-center text-text-secondary"
        >
          Carregando pacientes...
        </div>
      ) : errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-red-800"
        >
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => void patientsQuery.refetch()}
            className="mt-4 min-h-11 rounded-lg border border-red-300 px-4 py-2 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      ) : response?.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-5 py-12 text-center">
          <UsersRound
            size={36}
            className="mx-auto text-primary"
          />
          <p className="mt-4 font-medium">Nenhum paciente encontrado</p>
          <p className="mt-1 text-sm text-text-secondary">
            Ajuste a busca ou o filtro de status.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {response?.data.map((patient) => (
              <article
                key={patient.id}
                className="rounded-xl border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{patient.name}</h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      CPF: {formatCpf(patient.cpf)}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Nascimento: {formatDateOnly(patient.birthDate)}
                    </p>
                  </div>
                  <PatientStatusBadge active={patient.active} />
                </div>
                <Link
                  to={`/pacientes/${patient.id}`}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary"
                >
                  Ver detalhes
                </Link>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-white shadow-sm md:block">
            <table className="w-full border-collapse text-left">
              <thead className="bg-background text-sm text-text-secondary">
                <tr>
                  <th className="px-5 py-3 font-medium">Nome</th>
                  <th className="px-5 py-3 font-medium">CPF</th>
                  <th className="px-5 py-3 font-medium">Nascimento</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {response?.data.map((patient) => (
                  <tr key={patient.id}>
                    <td className="px-5 py-4 font-medium">{patient.name}</td>
                    <td className="px-5 py-4 text-sm">{formatCpf(patient.cpf)}</td>
                    <td className="px-5 py-4 text-sm">
                      {formatDateOnly(patient.birthDate)}
                    </td>
                    <td className="px-5 py-4">
                      <PatientStatusBadge active={patient.active} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/pacientes/${patient.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {response && response.meta.totalPages > 1 && (
            <nav
              aria-label="Paginação de pacientes"
              className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 sm:flex-row"
            >
              <p className="text-sm text-text-secondary">
                Página {response.meta.page} de {response.meta.totalPages} ·{' '}
                {response.meta.total} pacientes
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || patientsQuery.isFetching}
                  onClick={() => setPage((value) => value - 1)}
                  className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= response.meta.totalPages || patientsQuery.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                  className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
