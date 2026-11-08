import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useClinic } from '../../../hooks/use-clinic'
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
  canChange,
  canManage,
  formatAppointment,
  statusLabels,
  toIso,
} from '../lib/appointment'
import type { AppointmentQuery, AppointmentStatus } from '../types/appointment'
import { EncounterAppointmentAction } from '../../medical-records/components/EncounterAppointmentAction'
import { CancelAppointmentDialog } from '../components/CancelAppointmentDialog'
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
      manage={canManage(activeRole)}
    />
  )
}
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-5">
      <Link
        to="/agendamentos"
        className={buttonClass}
      >
        Agendamentos
      </Link>
      {children}
    </div>
  )
}
function AppointmentScreen({ clinic, manage }: { clinic: string; manage: boolean }) {
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
        {manage ? (
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
                navigate(`/agendamentos/${a.id}`, {
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
        manage={manage}
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
  const allowed = manage && canChange(a)
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
                navigate(`/agendamentos/${a.id}`, {
                  state: { success: 'Agendamento reagendado com sucesso.' },
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
function AppointmentList({ clinic, manage }: { clinic: string; manage: boolean }) {
  const [filters, setFilters] = useState<AppointmentQuery>({
    page: 1,
    limit: 20,
  })
  const [error, setError] = useState('')
  const query = useAppointments(clinic, filters)
  function update(patch: AppointmentQuery) {
    setFilters((f) => ({ ...f, ...patch, page: 1 }))
  }
  const rows = query.data?.data.filter((a) => a.clinicId === clinic) ?? []
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
        </div>
        {manage && (
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
                status: (e.target.value || undefined) as AppointmentStatus | undefined,
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
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {(['from', 'to'] as const).map((key) => (
            <label
              key={key}
              className="form-field"
            >
              {key === 'from' ? 'De' : 'Até'}
              <input
                type="date"
                className={inputClass}
                value={filters[key]?.slice(0, 10) ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                    ? toIso(
                        `${e.target.value}T${key === 'from' ? '00:00' : '23:59'}`,
                        '-03:00',
                      ).replace(key === 'to' ? ':00-03:00' : 'never', ':59.999-03:00')
                    : undefined
                  const next = { ...filters, [key]: value }
                  if (
                    next.from &&
                    next.to &&
                    Date.parse(next.from) > Date.parse(next.to)
                  ) {
                    setError('A data final deve ser posterior à inicial.')
                    return
                  }
                  setError('')
                  update({ [key]: value })
                }}
              />
            </label>
          ))}
        </div>
        <button
          className={buttonClass}
          onClick={() => {
            setFilters({ page: 1, limit: 20 })
            setError('')
          }}
        >
          Limpar filtros
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
      {query.isPending ? (
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
      {query.data && query.data.meta.totalPages > 1 && (
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
              onClick={() => setFilters((f) => ({ ...f, page: f.page! - 1 }))}
            >
              Anterior
            </button>
            <button
              type="button"
              className={compactButtonClass}
              disabled={filters.page! >= query.data.meta.totalPages || query.isFetching}
              onClick={() => setFilters((f) => ({ ...f, page: f.page! + 1 }))}
            >
              Próxima
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
