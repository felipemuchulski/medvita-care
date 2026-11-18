import { useNavigationNotice } from '../../../hooks/use-navigation-notice'
import { UserPlus, UsersRound } from 'lucide-react'
import { FilterLink as Link } from '../../../components/filters/FilterLink'
import { SearchField } from '../../../components/filters/SearchField'
import { filterRule, useUrlFilters } from '../../../lib/list-filters'
import { isApiError } from '../../../api/api-error'
import type { ClinicRole } from '../../auth/types/auth'
import { useClinic } from '../../../hooks/use-clinic'
import PatientStatusBadge from '../components/PatientStatusBadge'
import PatientsUnavailable from '../components/PatientsUnavailable'
import { usePatients } from '../hooks/use-patients'
import { formatCpf, formatDateOnly } from '../lib/patient-format'
import { canReadPatients, canWritePatients } from '../lib/patient-permissions'

const rules = {
  search: filterRule.search,
  active: filterRule.enum(['active', 'inactive', 'all']),
  page: filterRule.page,
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
  const notice = useNavigationNotice('notice')
  const filters = useUrlFilters(rules, { active: 'active', page: '1', search: '' })
  const { search, active: activeFilter } = filters.values
  const page = Number(filters.values.page)
  const query = {
    page,
    limit: 20,
    search: search || undefined,
    active: activeFilter === 'all' ? undefined : activeFilter === 'active',
  }
  const patientsQuery = usePatients(clinicId, query)
  const canWrite = canWritePatients(activeRole)

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

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <section
          aria-label="Filtros de pacientes"
          className="grid min-w-0 gap-3 sm:grid-cols-[1fr_180px_auto]"
        >
          <SearchField
            key={filters.resetKey}
            label="Buscar paciente por nome ou CPF"
            value={search}
            onChange={(value) => filters.update({ search: value }, true)}
          />
          <label className="form-field min-w-0">
            <span>Status</span>
            <select
              aria-label="Filtrar por status"
              value={activeFilter}
              onChange={(event) => filters.update({ active: event.target.value })}
              className="min-h-11 w-full rounded-lg border border-control-border bg-white px-3 py-2 text-base"
            >
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <button
            type="button"
            onClick={filters.reset}
            className="min-h-11 self-end rounded-lg border border-primary px-4 py-2 text-primary"
          >
            Limpar filtros
          </button>
        </section>
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
                    <h2 className="break-words font-semibold">{patient.name}</h2>
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
            <table className="w-full table-fixed border-collapse text-left">
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
                  onClick={() => filters.update({ page: String(page - 1) })}
                  className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= response.meta.totalPages || patientsQuery.isFetching}
                  onClick={() => filters.update({ page: String(page + 1) })}
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
