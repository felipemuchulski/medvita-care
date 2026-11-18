import { useId, useState } from 'react'
import { Link } from 'react-router'
import { AppointmentStatusBadge } from '../../appointments/components/AppointmentStatusBadge'
import { buttonClass } from '../../appointments/components/Selectors'
import { formatAppointment } from '../../appointments/lib/appointment'
import type { DashboardAppointment } from '../lib/dashboard'

export function DashboardAppointmentList({
  title,
  description,
  items,
  clinical,
  user,
  now,
}: {
  title: string
  description: string
  items: DashboardAppointment[]
  clinical: boolean
  user: string
  now: number
}) {
  const titleId = useId()
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(items.length / 5)
  const current = Math.min(page, Math.max(1, totalPages))
  return (
    <section
      aria-labelledby={titleId}
      className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm sm:p-6"
    >
      <header className="space-y-1">
        <h2
          id={titleId}
          className="text-lg font-semibold"
        >
          {title}
        </h2>
        <p className="text-sm text-text-secondary">{description}</p>
      </header>
      {!items.length ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm">
          Nenhum agendamento nesta categoria no período informado.
        </p>
      ) : (
        <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
          {items.slice((current - 1) * 5, current * 5).map((a) => (
            <li
              key={a.id}
              className="min-w-0 space-y-3 rounded-lg border border-border p-4 [overflow-wrap:anywhere]"
            >
              <h3 className="font-semibold">{a.patient.name}</h3>
              <p className="text-sm">{formatAppointment(a.scheduledAt)} · UTC−03:00</p>
              <p className="text-sm text-text-secondary">
                Profissional: {a.professional.name}
              </p>
              <AppointmentStatusBadge
                status={a.status}
                appointment={a}
                now={now}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link
                  to={`/agendamentos/${a.id}`}
                  className={buttonClass}
                  aria-label={`Abrir agendamento de ${a.patient.name} em ${formatAppointment(a.scheduledAt)}`}
                >
                  Ver agendamento
                </Link>
                {clinical &&
                  a.professional.userId === user &&
                  a.encounter?.status === 'IN_PROGRESS' && (
                    <Link
                      to={`/prontuarios/atendimentos/${a.encounter.id}`}
                      className={buttonClass}
                      aria-label={`Abrir atendimento em andamento de ${a.patient.name}`}
                    >
                      Abrir atendimento
                    </Link>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <nav
          aria-label={`Paginação: ${title}`}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm">
            Página {current} de {totalPages} · {items.length} registros
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              aria-label={`Página anterior: ${title}`}
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-label={`Próxima página: ${title}`}
              disabled={current === totalPages}
              onClick={() => setPage(current + 1)}
            >
              Próxima
            </button>
          </div>
        </nav>
      )}
    </section>
  )
}
