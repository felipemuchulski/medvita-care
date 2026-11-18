import { Link } from 'react-router'
import { useAuth } from '../hooks/use-auth'
import { useClinic } from '../hooks/use-clinic'
import { useOperationalClock } from '../hooks/use-operational-clock'
import { buttonClass } from '../features/appointments/components/Selectors'
import { appointmentError } from '../features/appointments/lib/appointment'
import { useDashboard } from '../features/dashboard/hooks/use-dashboard'
import {
  canReadDashboard,
  dashboardIndicators,
  dashboardPeriod,
} from '../features/dashboard/lib/dashboard'
import { DashboardAppointmentList } from '../features/dashboard/components/DashboardAppointmentList'
import type { ClinicRole } from '../features/auth/types/auth'

export default function DashboardPage() {
  const { user, status } = useAuth()
  const clinic = useClinic()
  const now = useOperationalClock()
  if (status === 'loading' || clinic.isLoading)
    return <p role="status">Carregando sua visão geral...</p>
  const administrative = user?.isSystemAdmin ? (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        className={buttonClass}
        to="/clinicas"
      >
        Gerenciar clínicas
      </Link>
      <Link
        className={buttonClass}
        to="/usuarios"
      >
        Gerenciar usuários
      </Link>
    </div>
  ) : null
  if (!user) return <p role="alert">Entre na sua conta para acessar a visão geral.</p>
  if (clinic.error)
    return (
      <div
        role="alert"
        className="space-y-4"
      >
        <p>
          Não foi possível verificar a clínica autorizada. Selecione a clínica novamente.
        </p>
        {administrative}
      </div>
    )
  if (!clinic.activeClinicId)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <p role="status">
          Selecione uma clínica com vínculo local ativo para consultar a agenda.
        </p>
        {administrative}
      </div>
    )
  if (
    !clinic.activeRole ||
    !canReadDashboard(clinic.activeRole) ||
    !user.clinicRoles.some(
      (m) => m.clinicId === clinic.activeClinicId && m.role === clinic.activeRole,
    )
  )
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <p role="alert">
          Seu acesso atual não permite consultar a agenda desta clínica. O acesso
          administrativo global não concede acesso clínico.
        </p>
        {administrative}
      </div>
    )
  return (
    <OperationalDashboard
      key={`${clinic.activeClinicId}:${user.id}:${clinic.activeRole}`}
      clinic={clinic.activeClinicId}
      user={user.id}
      role={clinic.activeRole}
      now={now}
    />
  )
}

function OperationalDashboard({
  clinic,
  user,
  role,
  now,
}: {
  clinic: string
  user: string
  role: ClinicRole
  now: number
}) {
  const query = useDashboard(clinic, user, role, now)
  const { today, first, last } = dashboardPeriod(now)
  const clinical = role === 'OPHTHALMOLOGIST'
  const date = (value: string) => value.split('-').reverse().join('/')
  const agenda = `/agendamentos?from=${today}&to=${today}`
  const calendar = `/calendario?date=${today}`
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <p>
          {clinical
            ? 'Sua agenda e seus atendimentos.'
            : 'Agenda operacional da clínica.'}
        </p>
        <p className="text-sm text-text-secondary">
          Hoje: {date(today)} · Fuso operacional UTC−03:00. Período consultado:{' '}
          {date(first)} a {date(last)}. Pendências: {date(first)} a hoje. Próximos
          agendamentos: de agora até {date(last)}.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            to={agenda}
            className={buttonClass}
          >
            Agenda de hoje
          </Link>
          <Link
            to={calendar}
            className={buttonClass}
          >
            Ver calendário
          </Link>
          <button
            type="button"
            className={buttonClass}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Atualizando...' : 'Atualizar dados'}
          </button>
        </div>
      </header>
      {query.isPending ? (
        <p role="status">Carregando todos os agendamentos do período...</p>
      ) : query.isError ? (
        <section
          role="alert"
          className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          <p>
            Dados indisponíveis. Não foi possível confirmar os indicadores.{' '}
            {appointmentError(query.error)}
          </p>
          <p>Consulte a agenda com um período menor ou tente atualizar os dados.</p>
          <Link
            to="/agendamentos"
            className={buttonClass}
          >
            Consultar agendamentos
          </Link>
        </section>
      ) : (
        <>
          {query.isFetching && (
            <p role="status">
              Atualizando dados. Os valores exibidos são da última consulta confirmada.
            </p>
          )}
          <p className="text-sm text-text-secondary">
            Última consulta:{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              timeZone: 'Etc/GMT+3',
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(query.dataUpdatedAt)}
            .
          </p>
          <DashboardData
            items={query.data}
            clinical={clinical}
            user={user}
            now={now}
          />
        </>
      )}
    </div>
  )
}

function DashboardData({
  items,
  clinical,
  user,
  now,
}: {
  items: NonNullable<ReturnType<typeof useDashboard>['data']>
  clinical: boolean
  user: string
  now: number
}) {
  const data = dashboardIndicators(items, now)
  const indicators = [
    {
      label: 'Agendamentos do dia',
      value: data.day.length,
      description: 'Início previsto hoje, em todos os status.',
    },
    {
      label: 'Próximos agendamentos',
      value: data.upcoming.length,
      description:
        'Agendados ou confirmados, sem atendimento, nos próximos 7 dias e hoje.',
    },
    {
      label: 'Cancelados do dia',
      value: data.cancelled.length,
      description: 'Cancelados com início previsto hoje; não é a data do cancelamento.',
    },
    {
      label: 'Pendentes de revisão',
      value: data.pending.length,
      description: 'Término previsto já passou, sem atendimento; últimos 30 dias e hoje.',
    },
    ...(clinical
      ? [
          {
            label: 'Atendimentos em andamento',
            value: data.inProgress.length,
            description: 'Atendimentos em andamento da sua agenda no período consultado.',
          },
        ]
      : []),
  ]
  return (
    <>
      <dl
        aria-label="Indicadores operacionais"
        className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {indicators.map((indicator) => (
          <div
            key={indicator.label}
            className="min-w-0 rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5"
          >
            <dt className="font-medium">{indicator.label}</dt>
            <dd className="mt-2 text-3xl font-bold text-primary">{indicator.value}</dd>
            <dd className="mt-2 text-sm text-text-secondary">{indicator.description}</dd>
          </div>
        ))}
      </dl>
      {!items.length && <p role="status">Não há agendamentos no período consultado.</p>}
      <DashboardAppointmentList
        title="Agenda do dia"
        description="Todos os agendamentos com início previsto hoje, inclusive concluídos e cancelados."
        items={data.day}
        clinical={clinical}
        user={user}
        now={now}
      />
      <DashboardAppointmentList
        title="Próximos agendamentos"
        description="A partir de agora até o fim do sétimo dia seguinte, ordenados por horário."
        items={data.upcoming}
        clinical={clinical}
        user={user}
        now={now}
      />
      {clinical && (
        <DashboardAppointmentList
          title="Atendimentos em andamento"
          description="Atendimentos em andamento com início agendado no período consultado, inclusive em dias anteriores."
          items={data.inProgress}
          clinical={clinical}
          user={user}
          now={now}
        />
      )}
      <DashboardAppointmentList
        title="Pendências operacionais"
        description="Últimos 30 dias e hoje. Agendados/confirmados cujo término previsto passou, sem atendimento vinculado. Revise o agendamento; esta indicação não altera o status."
        items={data.pending}
        clinical={clinical}
        user={user}
        now={now}
      />
      <DashboardAppointmentList
        title="Cancelados do dia"
        description="Consultas canceladas que estavam marcadas para hoje."
        items={data.cancelled}
        clinical={clinical}
        user={user}
        now={now}
      />
    </>
  )
}
