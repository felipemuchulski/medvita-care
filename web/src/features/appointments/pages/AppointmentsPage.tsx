import { filterRule, periodQuery, useUrlFilters } from '../../../lib/list-filters'
import { PeriodFields } from '../../../components/filters/PeriodFields'
import { FilterLink as Link } from '../../../components/filters/FilterLink'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useClinic } from '../../../hooks/use-clinic'
import { useAuth } from '../../../hooks/use-auth'
import { AppointmentStatusBadge } from '../components/AppointmentStatusBadge'
import { AppointmentForm } from '../components/AppointmentForm'
import {
  buttonClass,
  compactButtonClass,
  inputClass,
  PatientSelector,
  ProfessionalSelector,
} from '../components/Selectors'
import {
  useAppointment,
  useAppointments,
  useAppointmentMutations,
} from '../hooks/use-appointments'
import {
  appointmentError,
  validDate,
  canManageAppointment,
  canCreate,
  formatAppointment,
  statusLabels,
} from '../lib/appointment'
import type { AppointmentQuery, AppointmentStatus } from '../types/appointment'
import { EncounterAppointmentAction } from '../../medical-records/components/EncounterAppointmentAction'
import { CancelAppointmentDialog } from '../components/CancelAppointmentDialog'
const listRules = {
  page: filterRule.page,
  patientId: filterRule.uuid,
  professionalId: filterRule.uuid,
  patientSearch: filterRule.search,
  status: filterRule.enum(Object.keys(statusLabels)),
  from: filterRule.date,
  to: filterRule.date,
}

export default function AppointmentsPage() {
  const { activeClinicId, activeRole, isLoading, error } = useClinic()
  if (isLoading) return <p role="status">Carregando clínica...</p>
  if (!activeClinicId || !activeRole)
    return (
      <p role="alert">
        {error || 'Selecione uma clínica com vínculo ativo para acessar agendamentos.'}
      </p>
    )
  return (
    <AppointmentScreen
      key={`${activeClinicId}:${activeRole}`}
      clinic={activeClinicId}
      create={canCreate(activeRole)}
    />
  )
}
function Frame({ children }: { children: ReactNode }) {
  const location = useLocation()
  const calendarReturn = location.state?.calendarReturn
  return (
    <div className="min-w-0 space-y-5">
      <Link
        to="/agendamentos"
        className={buttonClass}
      >
        Agendamentos
      </Link>
      {typeof calendarReturn === 'string' &&
        /^\/calendario(?:\?|$)/.test(calendarReturn) && (
          <Link
            to={calendarReturn}
            className={buttonClass}
          >
            Voltar ao calendário
          </Link>
        )}
      {children}
    </div>
  )
}
function AppointmentScreen({ clinic, create }: { clinic: string; create: boolean }) {
  const { user } = useAuth()
  const { activeRole, activeClinicId } = useClinic()
  const { appointmentId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isNew = location.pathname.endsWith('/novo')
  const editing = location.pathname.endsWith('/reagendar')
  const detail = useAppointment(clinic, appointmentId)
  const mutations = useAppointmentMutations(clinic)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [notice, setNotice] = useState('')
  if (isNew)
    return (
      <Frame>
        <h1 className="text-2xl font-bold">Novo agendamento</h1>
        {create ? (
          <AppointmentForm
            clinic={clinic}
            initialDate={
              location.state?.calendarClinic === clinic &&
              validDate(location.state?.calendarDate)
                ? location.state.calendarDate
                : ''
            }
            initialTime={
              location.state?.calendarClinic === clinic &&
              typeof location.state?.calendarTime === 'string' &&
              /^([01]\d|2[0-3]):[0-5]\d$/.test(location.state.calendarTime)
                ? location.state.calendarTime
                : ''
            }
            pending={mutations.create.isPending}
            onSave={async (payload) => {
              try {
                const a = await mutations.create.mutateAsync(payload)
                navigate(`/agendamentos/${a.id}${location.search}`, {
                  state: { success: 'Agendamento criado com sucesso.' },
                })
              } catch (e) {
                throw new Error(appointmentError(e), { cause: e })
              }
            }}
          />
        ) : (
          <p role="alert">Você não tem permissão para cadastrar agendamentos.</p>
        )}
      </Frame>
    )
  if (!appointmentId)
    return (
      <AppointmentList
        clinic={clinic}
        create={create}
      />
    )
  if (detail.isPending)
    return (
      <Frame>
        <p role="status">Carregando agendamento...</p>
      </Frame>
    )
  if (detail.isError || detail.data?.clinicId !== clinic)
    return (
      <Frame>
        <p role="alert">{appointmentError(detail.error)}</p>
        <button
          className={buttonClass}
          onClick={() => void detail.refetch()}
        >
          Tentar novamente
        </button>
      </Frame>
    )
  const a = detail.data
  const allowed = canManageAppointment(a, activeRole, user?.id, activeClinicId)
  return (
    <Frame>
      <h1 className="text-2xl font-bold">
        {editing ? 'Reagendar consulta' : 'Detalhes do agendamento'}
      </h1>
      {(notice || location.state?.success) && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-green-900"
        >
          {notice || location.state.success}
        </p>
      )}
      {editing ? (
        allowed ? (
          <AppointmentForm
            key={a.id}
            clinic={clinic}
            appointment={a}
            pending={mutations.reschedule.isPending}
            onSave={async (payload) => {
              try {
                await mutations.reschedule.mutateAsync({
                  id: a.id,
                  scheduledAt: payload.scheduledAt,
                  durationMinutes: payload.durationMinutes,
                })
                navigate(`/agendamentos/${a.id}${location.search}`, {
                  state: {
                    success: 'Agendamento reagendado com sucesso.',
                    calendarReturn: location.state?.calendarReturn,
                  },
                })
              } catch (e) {
                throw new Error(appointmentError(e), { cause: e })
              }
            }}
          />
        ) : (
          <p role="alert">Este agendamento não pode ser reagendado.</p>
        )
      ) : (
        <>
          <article className="space-y-4 break-words rounded-xl border border-border bg-white p-4 sm:p-6">
            <h2 className="text-xl font-semibold">{a.patient.name}</h2>
            <AppointmentStatusBadge status={a.status} />
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Profissional', a.professional.user.name],
                ['CRM', `${a.professional.crm}/${a.professional.crmState}`],
                ['Início (UTC−03:00)', formatAppointment(a.scheduledAt)],
                ['Término (UTC−03:00)', formatAppointment(a.endsAt)],
                ['Duração', `${a.durationMinutes} minutos`],
                ['Motivo', a.reason || 'Não informado'],
                ['Observações', a.notes || 'Não informadas'],
                ['Motivo do cancelamento', a.cancellationReason || 'Não se aplica'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-0"
                >
                  <dt className="text-sm text-text-secondary">{label}</dt>
                  <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
          <EncounterAppointmentAction appointment={a} />
          {allowed && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                className={buttonClass}
                to={`/agendamentos/${a.id}/reagendar`}
                state={{ calendarReturn: location.state?.calendarReturn }}
              >
                Reagendar
              </Link>
              <button
                className={buttonClass}
                onClick={() => setCancelOpen(true)}
              >
                Cancelar agendamento
              </button>
            </div>
          )}
          {cancelOpen && allowed && (
            <CancelAppointmentDialog
              appointment={a}
              pending={mutations.cancel.isPending}
              error={
                mutations.cancel.error ? appointmentError(mutations.cancel.error) : ''
              }
              onClose={() => {
                setCancelOpen(false)
                mutations.cancel.reset()
              }}
              onConfirm={async (reason) => {
                try {
                  await mutations.cancel.mutateAsync({ id: a.id, reason })
                  setCancelOpen(false)
                  setNotice('Agendamento cancelado com sucesso.')
                } catch {
                  /* mutation error shown in dialog */
                }
              }}
            />
          )}
        </>
      )}
    </Frame>
  )
}
function AppointmentList({ clinic, create }: { clinic: string; create: boolean }) {
  const filterState = useUrlFilters(listRules, {
    page: '1',
    from: '',
    to: '',
    patientSearch: '',
  })
  const v = filterState.values
  const filters: AppointmentQuery = {
    page: Number(v.page),
    limit: 20,
    patientId: v.patientId || undefined,
    professionalId: v.professionalId || undefined,
    status: (v.status || undefined) as AppointmentStatus | undefined,
    ...periodQuery(v.from, v.to),
  }
  const query = useAppointments(clinic, filters, !filterState.invalidPeriod)
  function update(patch: Record<string, string>) {
    filterState.update(patch)
  }
  const rows = query.data?.data.filter((a) => a.clinicId === clinic) ?? []
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
        </div>
        {create && (
          <Link
            className={buttonClass}
            to="/agendamentos/novo"
          >
            Novo agendamento
          </Link>
        )}
      </div>
      <section
        aria-label="Filtros de agendamentos"
        className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 md:grid-cols-2"
      >
        <PatientSelector
          key={filterState.resetKey}
          searchValue={v.patientSearch}
          onSearchChange={(value) => filterState.update({ patientSearch: value }, true)}
          clinic={clinic}
          value={filters.patientId ?? ''}
          onChange={(patientId) => update({ patientId })}
        />
        <ProfessionalSelector
          clinic={clinic}
          value={filters.professionalId ?? ''}
          onChange={(professionalId) => update({ professionalId })}
        />
        <label className="form-field">
          Status
          <select
            className={inputClass}
            value={filters.status ?? ''}
            onChange={(e) =>
              update({
                status: e.target.value,
              })
            }
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <PeriodFields
          from={v.from}
          to={v.to}
          onChange={update}
        />
        <button
          className={buttonClass}
          onClick={filterState.reset}
        >
          Limpar filtros
        </button>
      </section>
      {filterState.invalidPeriod ? (
        <p role="status">Corrija o período para consultar os agendamentos.</p>
      ) : query.isPending ? (
        <p role="status">Carregando agendamentos...</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{appointmentError(query.error)}</p>
          <button
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center">
          Nenhum agendamento encontrado. Ajuste os filtros.
        </p>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {rows.map((a) => (
              <article
                key={a.id}
                className="min-w-0 space-y-2 rounded-xl border border-border bg-white p-4 [overflow-wrap:anywhere]"
              >
                <h2 className="text-lg font-semibold">{a.patient.name}</h2>
                <p>{a.professional.user.name}</p>
                <p>
                  {formatAppointment(a.scheduledAt)} · {a.durationMinutes} min
                </p>
                <AppointmentStatusBadge status={a.status} />
                <Link
                  className={`${buttonClass} mt-3 w-full`}
                  to={`/agendamentos/${a.id}`}
                >
                  Ver detalhes
                </Link>
              </article>
            ))}
          </div>
          <div className="hidden rounded-xl border border-border bg-white lg:block">
            <table className="w-full table-fixed text-left">
              <thead>
                <tr>
                  {['Paciente', 'Profissional', 'Data e horário', 'Status', 'Ações'].map(
                    (s) => (
                      <th
                        key={s}
                        className="p-3"
                      >
                        {s}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-border"
                  >
                    <td className="break-words p-3">{a.patient.name}</td>
                    <td className="break-words p-3">{a.professional.user.name}</td>
                    <td className="p-3">{formatAppointment(a.scheduledAt)}</td>
                    <td className="p-3">
                      <AppointmentStatusBadge status={a.status} />
                    </td>
                    <td className="p-3">
                      <Link
                        className={buttonClass}
                        to={`/agendamentos/${a.id}`}
                      >
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!filterState.invalidPeriod && query.data && query.data.meta.totalPages > 1 && (
        <nav
          aria-label="Paginação de agendamentos"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p>
            Página {filters.page} de {Math.max(1, query.data.meta.totalPages)} ·{' '}
            {query.data.meta.total} registros
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={compactButtonClass}
              disabled={filters.page === 1 || query.isFetching}
              onClick={() => update({ page: String(filters.page! - 1) })}
            >
              Anterior
            </button>
            <button
              type="button"
              className={compactButtonClass}
              disabled={filters.page! >= query.data.meta.totalPages || query.isFetching}
              onClick={() => update({ page: String(filters.page! + 1) })}
            >
              Próxima
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
